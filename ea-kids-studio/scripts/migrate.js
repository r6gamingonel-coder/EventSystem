import { buildConfig } from '../server/config.js';
import { openDb, migrate } from '../server/db.js';
const cfg = buildConfig();
const db = openDb(cfg.dbFile);
const applied = migrate(db, console.log);
console.log(applied.length ? `Applied ${applied.length} migration(s).` : 'Database is up to date.');
db.close();
