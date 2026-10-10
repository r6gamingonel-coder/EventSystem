import { createApp, listen } from './app.js';

const { app, ctx } = await createApp();
ctx.jobs.start();
const server = await listen(app, ctx.cfg);
ctx.log.info('EA KIDS Studio started', { url: `http://${ctx.cfg.host}:${ctx.cfg.port}` });
console.log(`\n  EA KIDS Studio running at http://${ctx.cfg.host}:${ctx.cfg.port}\n`);
if (!['127.0.0.1', 'localhost', '::1'].includes(ctx.cfg.host)) {
  console.log('  ⚠  Bound to a non-loopback address. Put it behind HTTPS (reverse proxy) and set SECURE_COOKIES=true. See docs/PRODUCTION_CHECKLIST.md\n');
}
const shutdown = async () => { server.close(); await ctx.close(); process.exit(0); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
