// Script/storyboard generation providers. All paths end in normalizePackage(), so whatever a model
// returns is clamped to what the renderer can draw. No provider is ever called without the
// cost gate in the route/job layer (see services/costs.js).
import Anthropic from '@anthropic-ai/sdk';
import { AppError, RetryableError, notConfigured } from '../lib/errors.js';
import * as R from '../content/registry.js';
import { normalizePackage, normalizeScene } from '../content/schema.js';
import { generateOffline } from '../content/generator.js';
import { CHARACTERS } from '../art/characters.js';
import { REVIEW_CHECKLIST } from '../content/generator.js';

const FORMAT_HINT = {
  landscape: 'Landscape 16:9. Host character on the left (x≈0.25,y≈0.62,size≈0.66), lesson object on the right (x≈0.72,y≈0.57,size≈0.5), key word as a text layer at the top (y≈0.13,size≈0.17).',
  shorts: 'Vertical 9:16 Short (≤ 60 s). Lesson object centred high (x=0.5,y≈0.4,size≈0.6), host low (x=0.5,y≈0.78,size≈0.8), key word on top (y≈0.12,size≈0.12).',
};

export function systemPrompt(brief) {
  const lang = brief.language === 'en' ? 'English' : 'Modern Standard Arabic (simple, child-friendly, with light diacritics only where they prevent mispronunciation)';
  return `You are the scriptwriter and storyboard artist for EA KIDS, an original, Arabic-first educational YouTube channel for children aged ${brief.ageMin}–${brief.ageMax}.

HARD RULES
- Everything must be ORIGINAL. Never reuse characters, songs, lyrics or plots from any existing franchise or creator.
- Narration language: ${lang}. Short sentences (max ~12 words). Warm, calm, encouraging tone. One clear learning objective.
- Only include facts that are well established and safe for children. List EVERY factual claim in "factCheck" so a human can verify it. If unsure about a fact, leave it out — never invent science or statistics.
- Nothing scary, violent, unsafe to imitate, or inappropriate. Never ask children for personal information. No manipulative calls to action (no "subscribe or else", no pressure). No brand names.
- Use ONLY these characters: ${Object.values(CHARACTERS).map((c) => `${c.slug} (${c.nameEn}, ${c.species}: ${c.eduRole})`).join('; ')}; and animals: ${R.ANIMALS.join(', ')}.
- Each scene must be drawable by the local engine. Allowed values — background.preset: ${R.BACKGROUNDS.join(', ')}; prop refs: ${R.PROPS.join(', ')}; emotions: ${R.EMOTION_KEYS.join(', ')}; anim: ${R.ANIMS.join(', ')}; camera.move: ${R.CAMERA_MOVES.join(', ')}; transition: ${R.TRANSITIONS.join(', ')}; sfx: ${R.SFX.join(', ')}; kind: ${R.SCENE_KINDS.join(', ')}.
- Layer coordinates: x,y = centre of the layer in 0..1 of the frame; size = height as a fraction of the SHORTER frame side (0.15–0.8). ${FORMAT_HINT[brief.format] || FORMAT_HINT.landscape}
- Layer types: character (ref=slug, emotion), animal (ref), prop (ref, optional copies), text (text, color #RRGGBB; ≤ 3 words), logo (ref=wordmark).
- "visual.prompt" is an optional English prompt describing the scene for an image/video tool the owner may use; keep it consistent with the character descriptions.
- Start with an "intro" scene and end with an "outro" scene unless told otherwise. Use the background "tint" with background.color for colour lessons.

Return ONLY one JSON object (no markdown, no commentary) with this shape:
{"objective": string, "outcomes": [string], "factCheck": [{"claim": string}],
 "scenes": [{"title": string, "kind": string, "narration": string, "durationSec": number,
   "visual": {"background": {"preset": string, "color": "#RRGGBB"?}, "layers": [{"type": string, "ref": string, "emotion": string?, "text": string?, "color": string?, "x": number, "y": number, "size": number, "anim": string, "delay": number, "copies": number?}], "prompt": string},
   "camera": {"move": string, "amount": number}, "animationNotes": string, "characterNotes": string,
   "audio": {"music": "main"|"soft"|"none", "sfx": [{"at": number, "name": string}]}, "transition": string}],
 "music": {"style": string},
 "metadata": {"title": string, "description": string, "tags": [string], "playlist": string},
 "thumbnail": {"concept": string, "title": string}}`;
}

export function userPrompt(brief) {
  return `Create a complete video package.
Idea / topic: ${brief.topic || brief.title || '(choose a simple topic matching the category)'}
Category: ${brief.category} | Language: ${brief.language} | Ages: ${brief.ageMin}–${brief.ageMax} | Difficulty: ${brief.difficulty || 'easy'}
Format: ${brief.format} | Target duration: ${brief.targetDurationSec}s (scene durations must sum to roughly this)
Visual style: ${brief.visualStyle || 'flat-friendly'} | Narration style: ${brief.narrationStyle || 'warm-teacher'}
${brief.characters?.length ? `Preferred characters: ${brief.characters.join(', ')}` : ''}
${brief.notes ? `Owner notes: ${brief.notes}` : ''}`;
}

export function extractJson(text) {
  const s = String(text || '');
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : s;
  const a = body.indexOf('{'); const b = body.lastIndexOf('}');
  if (a < 0 || b <= a) throw new AppError(502, 'LLM_BAD_OUTPUT', 'The model did not return JSON. Try again or use a different provider.');
  try { return JSON.parse(body.slice(a, b + 1)); } catch (e) { throw new AppError(502, 'LLM_BAD_JSON', `The model returned malformed JSON (${e.message}). Try again.`); }
}

const rough = (s) => Math.ceil(String(s).length / 3); // ~tokens (conservative for Arabic)

export function createLlm({ cfg, log }) {
  async function callAnthropic({ system, user, signal, maxTokens = 16000 }) {
    if (!cfg.keys.anthropic) throw notConfigured('Anthropic (Claude)', 'Set ANTHROPIC_API_KEY in .env and restart. Get a key at https://console.anthropic.com/.');
    const client = new Anthropic({ apiKey: cfg.keys.anthropic, ...(cfg.anthropicBaseUrl ? { baseURL: cfg.anthropicBaseUrl } : {}), maxRetries: 1 });
    try {
      // Streaming + finalMessage avoids HTTP timeouts on long outputs. Thinking/effort are left at the model defaults.
      const stream = client.messages.stream({ model: cfg.models.anthropic, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }, { signal });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') throw new AppError(422, 'LLM_REFUSED', 'The model declined this request.', { hint: 'Rephrase the idea or choose a different topic.' });
      if (msg.stop_reason === 'max_tokens') throw new AppError(502, 'LLM_TRUNCATED', 'The response was cut off before finishing.', { hint: 'Ask for a shorter video or fewer scenes.' });
      const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      return { text, usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens }, model: msg.model || cfg.models.anthropic };
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { cancelled: true });
      const status = e?.status;
      if (status === 401 || status === 403) throw new AppError(401, 'LLM_AUTH', 'Anthropic rejected the API key.', { hint: 'Check ANTHROPIC_API_KEY in .env.' });
      if (status === 400) throw new AppError(400, 'LLM_BAD_REQUEST', `Anthropic rejected the request: ${e.message}`, { hint: 'Check ANTHROPIC_MODEL is a valid model id.' });
      if (status === 429 || status >= 500 || !status) throw new RetryableError(`Anthropic temporarily unavailable (${status || e.message})`, { cause: e });
      throw e;
    }
  }

  async function callOpenAiStyle({ base, key, model, system, user, signal, label }) {
    if (!base || !model) throw notConfigured(label, label === 'OpenAI' ? 'Set OPENAI_API_KEY in .env.' : 'Set OPENAI_COMPAT_BASE_URL and OPENAI_COMPAT_MODEL (e.g. http://localhost:11434/v1 and a local model name).');
    let res;
    try {
      res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST', signal,
        headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], response_format: { type: 'json_object' } }),
      });
    } catch (e) { if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { cancelled: true }); throw new RetryableError(`${label} unreachable: ${e.message}`, { cause: e }); }
    if (res.status === 401 || res.status === 403) throw new AppError(401, 'LLM_AUTH', `${label} rejected the API key.`, { hint: 'Check the key in .env.' });
    if (res.status === 429 || res.status >= 500) throw new RetryableError(`${label} temporarily unavailable (${res.status})`);
    if (!res.ok) throw new AppError(502, 'LLM_ERROR', `${label} error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return { text: data.choices?.[0]?.message?.content || '', usage: { inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0 }, model };
  }

  const dispatch = {
    anthropic: (a) => callAnthropic(a),
    openai: (a) => callOpenAiStyle({ ...a, base: cfg.openaiBase, key: cfg.keys.openai, model: cfg.models.openaiText, label: 'OpenAI' }),
    openai_compatible: (a) => callOpenAiStyle({ ...a, base: cfg.keys.openaiCompatBase, key: cfg.keys.openaiCompatKey, model: cfg.models.openaiCompat, label: 'OpenAI-compatible endpoint' }),
  };

  /** Token estimate used by the cost gate before any paid call. */
  function estimateTokens(brief) {
    const scenes = Math.max(4, Math.round((brief.targetDurationSec || 90) / 9));
    return { inputTokens: rough(systemPrompt(brief)) + rough(userPrompt(brief)), outputTokens: 350 * scenes + 600 };
  }
  const modelFor = (provider) => ({ anthropic: cfg.models.anthropic, openai: cfg.models.openaiText, openai_compatible: cfg.models.openaiCompat }[provider] || '');

  async function generatePackage(brief, { provider = 'offline_templates', signal } = {}) {
    const defaults = { language: brief.language, ageMin: brief.ageMin, ageMax: brief.ageMax, format: brief.format, category: brief.category, targetDurationSec: brief.targetDurationSec, title: brief.title, visualStyle: brief.visualStyle, narrationStyle: brief.narrationStyle, difficulty: brief.difficulty };
    if (provider === 'offline_templates') {
      if (!brief.kit) throw new AppError(400, 'KIT_REQUIRED', 'Offline generation needs a lesson kit.', { hint: 'Choose a kit (colours, numbers, alphabet, shapes, animals…) or configure an AI provider for free-form topics.' });
      return { pkg: generateOffline(brief), usage: { inputTokens: 0, outputTokens: 0 }, provider, model: brief.kit };
    }
    const call = dispatch[provider];
    if (!call) throw new AppError(400, 'BAD_PROVIDER', `Unknown LLM provider: ${provider}`);
    const out = await call({ system: systemPrompt(brief), user: userPrompt(brief), signal });
    try {
    const raw = extractJson(out.text);
    const pkg = normalizePackage({
      ...raw,
      meta: { ...defaults, title: raw.metadata?.title || brief.title || brief.topic, generator: { provider, model: out.model, at: new Date().toISOString() } },
      characters: [...new Set((raw.scenes || []).flatMap((s) => (s.visual?.layers || []).filter((l) => l.type === 'character').map((l) => l.ref)))],
      thumbnail: { template: R.CATEGORIES.some((c) => c.id === brief.category) ? ({ colors: 'colors', numbers: 'numbers', alphabet: 'alphabet', animals: 'animals', nature: 'nature', story: 'story', habits: 'habits', shapes: 'shapes', songs: 'songs' }[brief.category] || 'general') : 'general', ...raw.thumbnail },
      reviewChecklist: REVIEW_CHECKLIST.map((text) => ({ text, done: false })),
    }, defaults);
    if (pkg.scenes.length < 3) throw new AppError(502, 'LLM_TOO_FEW_SCENES', 'The model returned fewer than 3 usable scenes. Try again.');
    return { pkg, usage: out.usage, provider, model: out.model };
    } catch (e) { e.usage = out.usage; e.model = out.model; throw e; } // tokens were consumed even though the output was unusable
  }

  async function reviseScene(pkg, sceneId, instruction, { provider, signal } = {}) {
    const call = dispatch[provider];
    if (!call) throw notConfigured('AI scene revision', 'Scene revision needs an AI provider (Anthropic, OpenAI or a local OpenAI-compatible model). You can still edit the scene fields by hand.');
    const scene = pkg.scenes.find((s) => s.id === sceneId);
    const brief = { ...pkg.meta, topic: pkg.meta.title };
    const sys = `${systemPrompt(brief)}\n\nTASK: Revise ONE existing scene. Return ONLY the revised scene as a JSON object with the same fields as a scene in the shape above (title, kind, narration, durationSec, visual, camera, animationNotes, characterNotes, audio, transition). Keep everything the instruction does not mention unchanged. Keep narration child-friendly and factually safe.`;
    const user = `Video objective: ${pkg.objective}\nNeighbouring scenes (for continuity): ${JSON.stringify(pkg.scenes.filter((s) => Math.abs(s.index - scene.index) === 1).map((s) => ({ title: s.title, narration: s.narration })))}\nCurrent scene JSON: ${JSON.stringify({ title: scene.title, kind: scene.kind, narration: scene.narration, durationSec: scene.durationSec, visual: scene.visual, camera: scene.camera, animationNotes: scene.animationNotes, characterNotes: scene.characterNotes, audio: scene.audio, transition: scene.transition })}\nInstruction: ${instruction}`;
    const out = await call({ system: sys, user, signal });
    try {
      const revised = extractJson(out.text);
      const norm = normalizeScene({ ...revised, id: scene.id, review: { status: 'pending', note: '' } }, scene.index);
      return { scene: norm, usage: out.usage, provider, model: out.model };
    } catch (e) { e.usage = out.usage; e.model = out.model; throw e; }
  }

  return { generatePackage, reviseScene, estimateTokens, modelFor };
}
