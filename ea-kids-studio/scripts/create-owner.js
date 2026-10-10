// Usage: npm run create-owner -- you@example.com "Your Name"   (password is prompted, never passed on argv)
import readline from 'node:readline/promises';
import { buildConfig } from '../server/config.js';
import { openDb, migrate } from '../server/db.js';
import { createAuth } from '../server/services/auth.js';
const [email, name = ''] = process.argv.slice(2);
if (!email) { console.error('Usage: npm run create-owner -- <email> [name]'); process.exit(1); }
const cfg = buildConfig(); const db = openDb(cfg.dbFile); migrate(db);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const password = process.env.EAK_OWNER_PASSWORD || await rl.question('Password (min 10 chars, letters + numbers): ');
rl.close();
const auth = createAuth({ db, cfg });
const u = auth.createUser({ email, name, password, role: 'owner' });
console.log(`Owner created: ${u.email}`);
db.close();
