// Backups: a consistent SQLite snapshot (VACUUM INTO) + optional media archive. Restores are manual and documented.
import fs from 'node:fs';
import path from 'node:path';
import { now } from '../db.js';
import { run } from '../lib/exec.js';
import { notFound, badRequest } from '../lib/errors.js';
import { safeJoin } from '../lib/security.js';

export function createBackup({ db, cfg, log }) {
  const list = () => (fs.existsSync(cfg.backupDir) ? fs.readdirSync(cfg.backupDir).filter((f) => /^eakids-.*\.(db|tar\.gz)$/.test(f)).map((f) => { const st = fs.statSync(path.join(cfg.backupDir, f)); return { name: f, bytes: st.size, createdAt: st.mtime.toISOString() }; }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []);
  function create({ includeMedia = false } = {}) {
    const stamp = now().replace(/[:.]/g, '-');
    const dbFile = path.join(cfg.backupDir, `eakids-${stamp}.db`);
    db.exec(`VACUUM INTO '${dbFile.replace(/'/g, "''")}'`);
    log.info('database backup created', { file: path.basename(dbFile) });
    return { db: path.basename(dbFile), bytes: fs.statSync(dbFile).size, media: includeMedia ? 'use createMediaArchive' : null };
  }
  async function createMediaArchive() {
    const name = `eakids-media-${now().replace(/[:.]/g, '-')}.tar.gz`;
    await run('tar', ['-czf', path.join(cfg.backupDir, name), '-C', cfg.dataDir, 'media'], { timeoutMs: 20 * 60_000 });
    return { archive: name, bytes: fs.statSync(path.join(cfg.backupDir, name)).size };
  }
  function file(name) {
    if (!/^eakids-[\w.\-]+\.(db|tar\.gz)$/.test(name)) throw badRequest('Invalid backup name.');
    const f = safeJoin(cfg.backupDir, name); if (!fs.existsSync(f)) throw notFound('Backup'); return f;
  }
  function prune(keep = 14) { const l = list().filter((x) => x.name.endsWith('.db')); l.slice(keep).forEach((x) => fs.rmSync(path.join(cfg.backupDir, x.name), { force: true })); return l.length - Math.min(keep, l.length); }
  return { list, create, createMediaArchive, file, prune };
}
