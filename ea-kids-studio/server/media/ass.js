// ASS caption generation (burned in with libass, which shapes Arabic via HarfBuzz/FriBidi).
import { wrapCaption } from '../content/timing.js';

const t = (s) => { const cs = Math.round(s * 100); const h = Math.floor(cs / 360000); const m = Math.floor((cs % 360000) / 6000); const sec = Math.floor((cs % 6000) / 100); return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
const clean = (s) => String(s).replace(/[{}\\]/g, '').replace(/\r?\n/g, ' ');
// libass assumes an LTR paragraph; an RLM on each Arabic line makes leading/trailing punctuation resolve as RTL.
const RLM = '\u200F';
const bidi = (line) => (/[\u0600-\u06FF]/.test(line) ? `${RLM}${line}${RLM}` : line);

export function buildAss(cues, { width, height, shorts = false }) {
  const short = Math.min(width, height);
  const size = Math.round(short * (shorts ? 0.062 : 0.06));
  const outline = Math.max(3, Math.round(size * 0.09));
  const marginV = Math.round(height * (shorts ? 0.36 : 0.06));
  const lines = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${width}`, `PlayResY: ${height}`, 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Cap,Tajawal,${size},&H00FFFFFF,&H00FFFFFF,&H005B2823,&H80000000,-1,0,0,0,100,100,0,0,1,${outline},0,2,${Math.round(width * 0.06)},${Math.round(width * 0.06)},${marginV},1`, '',
    '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  for (const c of cues) {
    const text = wrapCaption(clean(c.text), shorts ? 24 : 38).map(bidi).join('\\N');
    lines.push(`Dialogue: 0,${t(c.start)},${t(c.end)},Cap,,0,0,0,,${text}`);
  }
  return lines.join('\n') + '\n';
}
