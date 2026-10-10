// Original, royalty-free music and sound effects synthesised in pure JS (no samples, no third-party
// material), so every track is owned by EA KIDS and carries no licensing obligation. Quality is
// intentionally simple (bell/marimba tones over a gentle pentatonic loop); owners may import
// licensed tracks instead — their licence is recorded per asset.
const SR = 44100;

// Small seeded PRNG so the same seed always yields the same tune.
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

function wav16(samples, sampleRate = SR) {
  const n = samples.length; const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return buf;
}
function normalize(samples, peak = 0.7) {
  let m = 0; for (let i = 0; i < samples.length; i++) m = Math.max(m, Math.abs(samples[i]));
  if (m > 0) { const g = peak / m; for (let i = 0; i < samples.length; i++) samples[i] *= g; }
  return samples;
}

/** Add a plucked bell/marimba-like note into `out` at sample offset `at`. */
function pluck(out, at, hz, dur, amp = 0.5, bright = 1) {
  const n = Math.min(out.length - at, Math.floor(dur * SR));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 4.2);
    const v = Math.sin(2 * Math.PI * hz * t) + 0.42 * bright * Math.sin(2 * Math.PI * hz * 2 * t) * Math.exp(-t * 6) + 0.18 * bright * Math.sin(2 * Math.PI * hz * 3.01 * t) * Math.exp(-t * 11) + 0.1 * Math.sin(2 * Math.PI * hz * 4.2 * t) * Math.exp(-t * 18);
    out[at + i] += v * env * amp;
  }
}
function pad(out, at, hz, dur, amp = 0.1) {
  const n = Math.min(out.length - at, Math.floor(dur * SR));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.25) * Math.min(1, (dur - t) / 0.35);
    out[at + i] += (Math.sin(2 * Math.PI * hz * t) + 0.35 * Math.sin(2 * Math.PI * hz * 2.003 * t)) * env * amp;
  }
}

const PENTA = [0, 2, 4, 7, 9];                  // C major pentatonic degrees (semitones)
const CHORDS = [[48, 55, 64], [45, 52, 60], [53, 60, 69], [55, 62, 71]]; // C, Am, F, G (MIDI)
const ROOTS = [36, 33, 41, 43];

/** @returns {Buffer} mono 16-bit WAV, exactly `durationSec` long, peak-normalised to 0.6 */
export function synthMusic({ durationSec = 60, bpm = 92, seed = 7, mood = 'main' } = {}) {
  const total = Math.ceil(durationSec * SR);
  const out = new Float32Array(total);
  const beat = 60 / bpm; const bar = beat * 4; const R = rng(seed);
  const bars = Math.ceil(durationSec / bar) + 1;
  const scaleNote = (idx) => { const oct = Math.floor(idx / 5); return 60 + oct * 12 + PENTA[((idx % 5) + 5) % 5]; };
  let idx = 5 + 2;                              // start around G4
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar; const c = b % 4;
    const at = (t) => Math.floor((t0 + t) * SR);
    if (at(0) >= total) break;
    CHORDS[c].forEach((m) => pad(out, at(0), midiHz(m), bar, mood === 'soft' ? 0.07 : 0.1));
    pluck(out, at(0), midiHz(ROOTS[c]), beat * 1.8, 0.55, 0.3);
    pluck(out, at(beat * 2), midiHz(ROOTS[c] + 7), beat * 1.5, 0.35, 0.3);
    // melody: stepwise eighth-note phrases, resolving to the tonic area at the end of each 4-bar phrase
    for (let e = 0; e < 8; e++) {
      const rest = e % 4 === 3 && R() < 0.5 && !(c === 3 && e === 7);
      if (rest) continue;
      const step = Math.floor(R() * 5) - 2;
      idx = Math.max(3, Math.min(11, idx + step));
      if (c === 3 && e >= 6) idx = [5, 7, 8][Math.floor(R() * 3)];
      pluck(out, at(e * beat / 2), midiHz(scaleNote(idx)), beat * 0.9, mood === 'soft' ? 0.28 : 0.4, 1);
    }
  }
  const fade = Math.floor(Math.min(1.5, durationSec / 4) * SR);
  for (let i = 0; i < fade; i++) { out[total - 1 - i] *= i / fade; out[i] *= Math.min(1, i / (0.05 * SR)); }
  return wav16(normalize(out, 0.6));
}

const env = (t, a, d) => Math.min(1, t / a) * Math.exp(-t * d);
export const SFX_NAMES = ['pop', 'chime', 'whoosh', 'sparkle', 'boing', 'tada'];

export function synthSfx(name) {
  const dur = { pop: 0.25, chime: 1.2, whoosh: 0.7, sparkle: 1.1, boing: 0.6, tada: 1.6 }[name];
  if (!dur) throw new Error(`Unknown sfx: ${name}`);
  const out = new Float32Array(Math.ceil(dur * SR)); const R = rng(name.length * 977);
  if (name === 'pop') for (let i = 0; i < out.length; i++) { const t = i / SR; const f = 700 * Math.exp(-t * 14) + 180; out[i] = Math.sin(2 * Math.PI * f * t) * env(t, 0.002, 22); }
  if (name === 'chime') [72, 76, 79].forEach((m, k) => pluck(out, Math.floor(k * 0.14 * SR), midiHz(m), 1.0, 0.5, 1));
  if (name === 'whoosh') { let lp = 0; for (let i = 0; i < out.length; i++) { const t = i / SR; const a = 0.04 + 0.5 * Math.sin(Math.PI * Math.min(1, t / dur)) ** 2; lp += (R() * 2 - 1 - lp) * (0.05 + 0.25 * (t / dur)); out[i] = lp * a * 3; } }
  if (name === 'sparkle') for (let k = 0; k < 7; k++) pluck(out, Math.floor(k * 0.09 * SR), midiHz(84 + PENTA[Math.floor(R() * 5)] + (R() < 0.4 ? 12 : 0)), 0.45, 0.3, 1.4);
  if (name === 'boing') for (let i = 0; i < out.length; i++) { const t = i / SR; const f = 260 + 220 * Math.sin(2 * Math.PI * 4 * t) * Math.exp(-t * 5) + 120 * Math.exp(-t * 3); out[i] = Math.sin(2 * Math.PI * f * t + 3 * Math.sin(2 * Math.PI * 9 * t) * Math.exp(-t * 6)) * env(t, 0.003, 4.5); }
  if (name === 'tada') { [60, 64, 67, 72].forEach((m, k) => pluck(out, Math.floor(k * 0.09 * SR), midiHz(m), 1.2, 0.4, 1)); [60, 64, 67, 72].forEach((m) => pluck(out, Math.floor(0.45 * SR), midiHz(m), 1.1, 0.3, 0.8)); }
  return wav16(normalize(out, 0.7));
}
