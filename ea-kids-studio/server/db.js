// SQLite via Node's built-in `node:sqlite` (no native build step). WAL mode, FK enforcement,
// forward-only SQL migrations tracked in schema_migrations.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ROOT } from './config.js';

const MIGRATIONS_DIR = path.join(ROOT, 'server', 'migrations');

export const now = () => new Date().toISOString();
export const j = (v) => JSON.stringify(v ?? null);
export const parse = (s, d = null) => { try { return s == null ? d : JSON.parse(s); } catch { return d; } };

export function openDb(file) {
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  const db = {
    raw,
    file,
    get: (sql, ...p) => raw.prepare(sql).get(...p) ?? null,
    all: (sql, ...p) => raw.prepare(sql).all(...p),
    run: (sql, ...p) => raw.prepare(sql).run(...p),
    exec: (sql) => raw.exec(sql),
    tx(fn) {
      raw.exec('BEGIN IMMEDIATE');
      try { const r = fn(); raw.exec('COMMIT'); return r; } catch (e) { raw.exec('ROLLBACK'); throw e; }
    },
    close: () => raw.close(),
  };
  return db;
}

export function migrate(db, log = () => {}) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const done = new Set(db.all('SELECT name FROM schema_migrations').map((r) => r.name));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const applied = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    db.tx(() => { db.exec(sql); db.run('INSERT INTO schema_migrations(name, applied_at) VALUES (?, ?)', f, now()); });
    log(`applied migration ${f}`);
    applied.push(f);
  }
  return applied;
}

// ---- settings helpers (JSON values) ----
export const getSetting = (db, key, fallback = null) => {
  const r = db.get('SELECT value FROM settings WHERE key = ?', key);
  return r ? parse(r.value, fallback) : fallback;
};
export const setSetting = (db, key, value) =>
  db.run('INSERT INTO settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at', key, j(value), now());

export const audit = (db, userId, action, entity, entityId, detail) =>
  db.run('INSERT INTO audit_log(user_id,action,entity,entity_id,detail,ts) VALUES (?,?,?,?,?,?)', userId ?? null, action, entity ?? null, entityId ?? null, detail ? j(detail) : null, now());
