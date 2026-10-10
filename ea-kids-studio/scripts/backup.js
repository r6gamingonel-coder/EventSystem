// npm run backup [-- --media]   → consistent SQLite snapshot in data/backups/ (add --media for a tar.gz of data/media)
import { createApp } from '../server/app.js';
const { ctx } = await createApp();
const out = ctx.backup.create(); console.log(`Database backup: data/backups/${out.db} (${(out.bytes / 1e6).toFixed(1)} MB)`);
if (process.argv.includes('--media')) { const m = await ctx.backup.createMediaArchive(); console.log(`Media archive: data/backups/${m.archive} (${(m.bytes / 1e6).toFixed(1)} MB)`); }
console.log(`Pruned ${ctx.backup.prune()} old backup(s).`);
await ctx.close();
