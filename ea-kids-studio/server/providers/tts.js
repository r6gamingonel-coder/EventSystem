// Text-to-speech providers. Each synthesises ONE cue (sentence) to a file. Free/local first:
// espeak-ng (draft quality) → paid cloud voices (opt-in, cost-gated) → your own recordings (import).
// Never clone a real person's voice without written authorisation.
import fs from 'node:fs';
import { run } from '../lib/exec.js';
import { AppError, RetryableError, notConfigured } from '../lib/errors.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const TTS_INFO = {
  espeak: { label: 'espeak-ng (local, free)', quality: 'draft', paid: false, license: { source: 'espeak-ng (local)', license: 'Speech generated locally with eSpeak NG (GPL-3.0 software). Draft/robotic quality.', commercialUse: true, note: 'Not recommended for published episodes.' } },
  azure: { label: 'Azure Speech (cloud)', quality: 'high', paid: true, license: { source: 'Azure AI Speech', license: 'Microsoft Azure terms (verify current terms for commercial use of output)', commercialUse: true, note: 'Verify terms.' } },
  openai: { label: 'OpenAI TTS (cloud)', quality: 'high', paid: true, license: { source: 'OpenAI TTS', license: 'OpenAI terms (verify current terms; disclose AI-generated voice)', commercialUse: true, note: 'Verify terms.' } },
  elevenlabs: { label: 'ElevenLabs (cloud)', quality: 'high', paid: true, license: { source: 'ElevenLabs', license: 'Commercial use requires an eligible paid plan; verify. Do not use cloned voices of real people without authorisation.', commercialUse: true, note: 'Verify plan.' } },
  google: { label: 'Google Cloud TTS (cloud)', quality: 'high', paid: true, license: { source: 'Google Cloud Text-to-Speech', license: 'Google Cloud terms (verify current terms)', commercialUse: true, note: 'Verify terms.' } },
};

export const VOICES = {
  espeak: { ar: [{ id: 'ar', label: 'Arabic (eSpeak)' }], en: [{ id: 'en-us', label: 'English US (eSpeak)' }] },
  azure: { ar: [{ id: 'ar-IQ-RanaNeural', label: 'Rana — Iraqi Arabic (F)' }, { id: 'ar-IQ-BasselNeural', label: 'Bassel — Iraqi Arabic (M)' }, { id: 'ar-SA-ZariyahNeural', label: 'Zariyah — Saudi Arabic (F)' }, { id: 'ar-EG-SalmaNeural', label: 'Salma — Egyptian Arabic (F)' }], en: [{ id: 'en-US-JennyNeural', label: 'Jenny — US English (F)' }, { id: 'en-US-AnaNeural', label: 'Ana — US English (child-like)' }] },
  openai: { ar: [{ id: 'coral', label: 'Coral' }, { id: 'nova', label: 'Nova' }, { id: 'sage', label: 'Sage' }], en: [{ id: 'coral', label: 'Coral' }, { id: 'nova', label: 'Nova' }] },
  elevenlabs: { ar: [{ id: '', label: 'Use your own voice id (stock voice you are licensed to use)' }], en: [{ id: '', label: 'Use your own voice id' }] },
  google: { ar: [{ id: 'ar-XA-Wavenet-A', label: 'ar-XA Wavenet A (F)' }, { id: 'ar-XA-Wavenet-B', label: 'ar-XA Wavenet B (M)' }], en: [{ id: 'en-US-Neural2-F', label: 'en-US Neural2 F' }] },
};

export function createTts({ cfg }) {
  const k = cfg.keys;
  const http = async (label, url, init) => {
    let res;
    try { res = await fetch(url, init); } catch (e) { if (init.signal?.aborted) throw Object.assign(new Error('Cancelled'), { cancelled: true }); throw new RetryableError(`${label} unreachable: ${e.message}`); }
    if (res.status === 401 || res.status === 403) throw new AppError(401, 'TTS_AUTH', `${label} rejected the credentials.`, { hint: 'Check the API key / region in .env.' });
    if (res.status === 429 || res.status >= 500) throw new RetryableError(`${label} temporarily unavailable (${res.status})`);
    if (!res.ok) throw new AppError(502, 'TTS_ERROR', `${label} error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res;
  };
  const rateDelta = (speed) => `${Math.round((speed - 1) * 100)}%`;

  const impl = {
    async espeak({ text, language, voice, speed, outFile, signal }) {
      const wpm = Math.round((language === 'en' ? 150 : 190) * speed); // eSpeak Arabic is slow per word; 190 ≈ 1.5 words/s
      try {
        await run(cfg.espeak, ['-v', voice || (language === 'en' ? 'en-us' : 'ar'), '-s', wpm, '-p', 58, '-g', 2, '-w', outFile, '--stdin'], { input: text, signal, timeoutMs: 60000 });
      } catch (e) {
        if (e.code === 'ENOENT') throw notConfigured('espeak-ng', 'Install it (Linux: `sudo apt install espeak-ng`, macOS: `brew install espeak-ng`) or choose another narration provider / import your own recording.');
        throw e;
      }
      return { file: outFile, ext: 'wav' };
    },
    async azure({ text, language, voice, speed, outFile, signal }) {
      if (!k.azureSpeechKey || !k.azureSpeechRegion) throw notConfigured('Azure Speech', 'Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env.');
      const v = voice || (language === 'en' ? 'en-US-JennyNeural' : 'ar-IQ-RanaNeural');
      const ssml = `<speak version='1.0' xml:lang='${v.split('-').slice(0, 2).join('-')}'><voice name='${esc(v)}'><prosody rate='${rateDelta(speed)}'>${esc(text)}</prosody></voice></speak>`;
      const res = await http('Azure Speech', `https://${k.azureSpeechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: 'POST', signal, headers: { 'Ocp-Apim-Subscription-Key': k.azureSpeechKey, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm', 'User-Agent': 'ea-kids-studio' }, body: ssml });
      fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
      return { file: outFile, ext: 'wav' };
    },
    async openai({ text, language, voice, speed, outFile, signal }) {
      if (!k.openai) throw notConfigured('OpenAI', 'Set OPENAI_API_KEY in .env.');
      const res = await http('OpenAI TTS', `${cfg.openaiBase}/audio/speech`, { method: 'POST', signal, headers: { authorization: `Bearer ${k.openai}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: cfg.models.openaiTts, voice: voice || 'coral', input: text, response_format: 'wav', speed: Math.max(0.25, Math.min(4, speed)), instructions: language === 'ar' ? 'Speak slowly and warmly in clear Modern Standard Arabic for young children.' : 'Speak slowly and warmly for young children.' }) });
      fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
      return { file: outFile, ext: 'wav' };
    },
    async elevenlabs({ text, voice, speed, outFile, signal }) {
      if (!k.elevenlabs) throw notConfigured('ElevenLabs', 'Set ELEVENLABS_API_KEY in .env and choose a voice id you are licensed to use.');
      if (!voice) throw notConfigured('ElevenLabs voice', 'Enter a voice id in the narration settings (do not use a cloned voice without authorisation).');
      const res = await http('ElevenLabs', `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, { method: 'POST', signal, headers: { 'xi-api-key': k.elevenlabs, 'content-type': 'application/json' }, body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { speed: Math.max(0.7, Math.min(1.2, speed)) } }) });
      fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
      return { file: outFile, ext: 'mp3' };
    },
    async google({ text, language, voice, speed, outFile, signal }) {
      if (!k.googleTts) throw notConfigured('Google Cloud TTS', 'Set GOOGLE_TTS_API_KEY in .env (enable the Text-to-Speech API in Google Cloud).');
      const v = voice || (language === 'en' ? 'en-US-Neural2-F' : 'ar-XA-Wavenet-A');
      const res = await http('Google TTS', `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(k.googleTts)}`, { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: { text }, voice: { languageCode: v.split('-').slice(0, 2).join('-'), name: v }, audioConfig: { audioEncoding: 'LINEAR16', speakingRate: speed } }) });
      fs.writeFileSync(outFile, Buffer.from((await res.json()).audioContent, 'base64'));
      return { file: outFile, ext: 'wav' };
    },
  };

  const synthesizeCue = (provider, args) => {
    if (!impl[provider]) throw new AppError(400, 'BAD_PROVIDER', `Unknown TTS provider: ${provider}`);
    return impl[provider](args);
  };
  return { synthesizeCue, info: TTS_INFO, voices: VOICES };
}

const TASHKEEL = /[ً-ٰٟۖ-ۭـ]/g;
export const stripTashkeel = (s) => String(s).replace(TASHKEEL, '');

/** Replace whole tokens using the pronunciation lexicon (diacritic-insensitive match). */
export function applyPronunciations(text, entries) {
  if (!entries?.length) return text;
  const map = new Map(entries.map((e) => [stripTashkeel(e.word), e.replacement]));
  return String(text).split(/(\s+|[.،؟!?:؛,«»"()])/).map((tok) => map.get(stripTashkeel(tok)) ?? tok).join('');
}
