// Safe subprocess execution: argv arrays only (never a shell), timeouts, abort support,
// bounded output capture, and line-streaming for ffmpeg progress.
import { spawn } from 'node:child_process';

export function run(cmd, args, { signal, timeoutMs = 0, onStdoutLine, onStderrLine, cwd, input, maxBuffer = 4 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Object.assign(new Error('Cancelled'), { cancelled: true }));
    const child = spawn(cmd, args.map(String), { cwd, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = ''; let err = ''; let timedOut = false; let cancelled = false;
    let outRest = ''; let errRest = '';
    const cap = (s, add) => (s.length + add.length > maxBuffer ? (s + add).slice(-maxBuffer) : s + add);
    const feed = (rest, chunk, cb) => {
      if (!cb) return '';
      const lines = (rest + chunk).split(/\r?\n/);
      const tail = lines.pop();
      lines.forEach((l) => l && cb(l));
      return tail;
    };
    child.stdout.on('data', (d) => { const s = d.toString('utf8'); out = cap(out, s); outRest = feed(outRest, s, onStdoutLine); });
    child.stderr.on('data', (d) => { const s = d.toString('utf8'); err = cap(err, s); errRest = feed(errRest, s, onStderrLine); });
    const timer = timeoutMs ? setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs) : null;
    const onAbort = () => { cancelled = true; child.kill('SIGKILL'); };
    signal?.addEventListener('abort', onAbort, { once: true });
    child.on('error', (e) => { clearTimeout(timer); reject(Object.assign(e, { code: e.code === 'ENOENT' ? 'ENOENT' : e.code, cmd })); });
    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (cancelled) return reject(Object.assign(new Error('Cancelled'), { cancelled: true }));
      if (timedOut) return reject(Object.assign(new Error(`${cmd} timed out after ${timeoutMs}ms`), { timedOut: true }));
      if (code !== 0) return reject(Object.assign(new Error(`${cmd} exited with code ${code}`), { exitCode: code, stdout: out, stderr: err }));
      resolve({ stdout: out, stderr: err });
    });
    if (input !== undefined) child.stdin.end(input); else child.stdin.end();
  });
}

/** Check that a binary exists and return its first version line (or null). */
export async function probeBinary(cmd, args = ['-version']) {
  try { const { stdout, stderr } = await run(cmd, args, { timeoutMs: 8000 }); return (stdout || stderr).split('\n')[0].trim(); }
  catch { return null; }
}
