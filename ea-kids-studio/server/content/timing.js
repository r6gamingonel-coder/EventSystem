// Narration → cues → subtitle timing. Cues are the unit of TTS synthesis, so after audio exists
// the subtitle timings are exact (measured), not guessed.
export const WORDS_PER_SEC = 2.1;       // slow, clear children's narration at speed 1.0
export const CUE_GAP_SEC = 0.35;        // pause between sentences
export const SCENE_LEAD_SEC = 0.5;      // visuals appear before the voice starts
export const SCENE_TAIL_SEC = 0.6;      // breathing room after the last word

export const countWords = (t) => (String(t).trim().match(/\S+/g) || []).length;

/** Split narration into sentence-level cues. Long sentences are split further at commas. */
export function splitCues(text) {
  const out = [];
  for (const para of String(text || '').split(/\n+/)) {
    for (const s of para.split(/(?<=[.!?؟…])\s+/)) {
      const t = s.trim();
      if (!t) continue;
      if (countWords(t) > 16) {
        const parts = t.split(/(?<=[,،;؛])\s+/).map((x) => x.trim()).filter(Boolean);
        let buf = '';
        for (const p of parts) {
          if (buf && countWords(buf + ' ' + p) > 14) { out.push(buf); buf = p; } else buf = buf ? `${buf} ${p}` : p;
        }
        if (buf) out.push(buf);
      } else out.push(t);
    }
  }
  return out;
}

export const estimateCueSec = (text, speed = 1) => Math.max(0.9, countWords(text) / (WORDS_PER_SEC * speed)) + 0.15;

/** Estimated timeline for a scene before real audio exists. */
export function estimateScene(narration, speed = 1) {
  const cues = splitCues(narration);
  let t = SCENE_LEAD_SEC;
  const subs = cues.map((text) => { const d = estimateCueSec(text, speed); const c = { start: +t.toFixed(2), end: +(t + d).toFixed(2), text }; t += d + CUE_GAP_SEC; return c; });
  const duration = cues.length ? t - CUE_GAP_SEC + SCENE_TAIL_SEC : 2.5;
  return { cues, subtitles: subs, durationSec: +duration.toFixed(2) };
}

/** Wrap a caption into ≤ maxLen-character lines at word boundaries (max 2 lines; extra stays on line 2). */
export function wrapCaption(text, maxLen = 38) {
  const words = String(text).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > maxLen) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

const pad = (n, l = 2) => String(Math.floor(n)).padStart(l, '0');
export function fmtTime(sec, sep = ',') {
  const ms = Math.round(sec * 1000);
  return `${pad(ms / 3600000)}:${pad((ms % 3600000) / 60000)}:${pad((ms % 60000) / 1000)}${sep}${pad(ms % 1000, 3)}`;
}
export const toSrt = (cues) => cues.map((c, i) => `${i + 1}\n${fmtTime(c.start)} --> ${fmtTime(c.end)}\n${wrapCaption(c.text).join('\n')}\n`).join('\n');
export const toVtt = (cues) => `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${fmtTime(c.start, '.')} --> ${fmtTime(c.end, '.')}\n${wrapCaption(c.text).join('\n')}\n`).join('\n')}`;
