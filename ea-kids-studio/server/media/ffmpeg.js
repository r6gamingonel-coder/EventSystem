// FFmpeg/ffprobe wrappers. Arguments are always passed as arrays (no shell); paths are produced
// by the server, never taken from request bodies.
import { run } from '../lib/exec.js';
import { notConfigured, RetryableError } from '../lib/errors.js';

export async function probe(cfg, file) {
  try {
    const { stdout } = await run(cfg.ffprobe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { timeoutMs: 30000 });
    const j = JSON.parse(stdout);
    const v = j.streams?.find((s) => s.codec_type === 'video');
    const a = j.streams?.find((s) => s.codec_type === 'audio');
    const [num, den] = String(v?.avg_frame_rate || '0/1').split('/').map(Number);
    return {
      durationSec: Number(j.format?.duration) || Number(v?.duration) || Number(a?.duration) || 0,
      width: v?.width || null, height: v?.height || null, fps: den ? num / den : null,
      videoCodec: v?.codec_name || null, audioCodec: a?.codec_name || null, hasVideo: !!v, hasAudio: !!a,
      sampleRate: a ? Number(a.sample_rate) : null, channels: a?.channels || null, bitRate: Number(j.format?.bit_rate) || null, sizeBytes: Number(j.format?.size) || null,
    };
  } catch (e) {
    if (e.code === 'ENOENT') throw notConfigured('ffprobe', 'Install FFmpeg (includes ffprobe) and set FFPROBE_PATH if needed.');
    throw e;
  }
}

/**
 * Run ffmpeg with `-progress pipe:1`; calls onProgress(0..1) using out_time vs expectedSec.
 * Non-zero exit → RetryableError for resource-ish failures, plain Error otherwise (filter/arg bugs are not retried).
 */
export async function ffmpeg(cfg, args, { signal, onProgress, expectedSec, timeoutMs = 0 } = {}) {
  const full = ['-hide_banner', '-nostdin', '-y', '-loglevel', 'error', '-progress', 'pipe:1', '-nostats', ...args];
  try {
    return await run(cfg.ffmpeg, full, {
      signal, timeoutMs,
      onStdoutLine: (l) => {
        if (onProgress && expectedSec && l.startsWith('out_time_us=')) {
          const us = Number(l.split('=')[1]);
          if (Number.isFinite(us)) onProgress(Math.min(1, us / 1e6 / expectedSec));
        }
      },
    });
  } catch (e) {
    if (e.code === 'ENOENT') throw notConfigured('FFmpeg', 'Install FFmpeg 6+ (https://ffmpeg.org/download.html) and set FFMPEG_PATH if it is not on PATH.');
    if (e.cancelled) throw e;
    const tail = String(e.stderr || '').trim().split('\n').slice(-6).join(' | ');
    const err = /No space left|Cannot allocate memory|Killed|Resource temporarily/i.test(tail) ? new RetryableError(`FFmpeg resource failure: ${tail}`) : new Error(`FFmpeg failed: ${tail || e.message}`);
    err.hint = 'See the production log for the failing step. Check disk space and that all media files exist.';
    throw err;
  }
}

/** ASS/filtergraph path escaping for use inside -vf / filter_complex option values. */
export const escFilterPath = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/,/g, '\\,').replace(/\[/g, '\\[').replace(/]/g, '\\]');
