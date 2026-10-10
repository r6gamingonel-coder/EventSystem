// Drives the real dashboard in headless Chromium: first-run setup → project → every screen. Fails on console errors.
// Usage: node scripts/ui-smoke.mjs [screenshotDir]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.NODE_ENV = 'test';
const { chromium } = await import('playwright-core');
const { createApp } = await import('../server/app.js');
const shots = process.argv[2]; if (shots) fs.mkdirSync(shots, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eak-ui-'));
const { app, ctx } = await createApp({ DATA_DIR: dir, NODE_ENV: 'test', JOB_POLL_MS: '100' });
await ctx.seedPromise; ctx.jobs.start();
const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const exe = ['/opt/pw-browsers/chromium/chrome-linux/chrome', ...fs.readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('chromium-')).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
const errors = []; let live = true;
page.on('console', (m) => { if (live && m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => live && errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => live && errors.push(`requestfailed: ${r.url()}`));
page.on('response', (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });
const shot = async (name) => { if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: false }); };
const step = async (label, fn) => { try { await fn(); console.log('  ✓', label); } catch (e) { errors.push(`${label}: ${e.message.split('\n')[0]}`); console.log('  ✗', label, e.message.split('\n')[0]); } };

await page.goto(base);
await step('first-run setup screen', async () => { await page.waitForSelector('text=Create the owner account'); await shot('00-setup'); });
await step('create owner and sign in', async () => {
  await page.fill('input[type=email]', 'owner@example.com'); await page.fill('input[autocomplete=new-password]', 'Sup3rSecretPass');
  await page.click('button:has-text("Create owner")'); await page.waitForSelector('text=Welcome to EA KIDS Studio'); await shot('01-overview-empty');
});
await step('create a project from the modal', async () => {
  await page.click('button:has-text("＋ New")'); await page.fill('.modal input', 'نتعلم الألوان مع أصدقاء الحيوانات | EA KIDS'); await page.click('.modal button:has-text("Create")'); await page.waitForSelector('text=Script generator'); 
});
await step('generate script with offline colours kit', async () => {
  await page.selectOption('#kit-select', 'colors');
  await page.click('button:has-text("Generate script")'); await page.waitForSelector('text=Script (', { timeout: 30000 }); await shot('02-script');
});
const views = ['overview', 'ideas', 'storyboard', 'media', 'voice', 'render', 'thumbnails', 'metadata', 'youtube', 'calendar', 'monetization', 'analytics', 'costs', 'characters', 'brand', 'providers', 'settings'];
let n = 3;
for (const v of views) {
  await step(`view: ${v}`, async () => {
    await page.goto(`${base}/#/${v}`); await page.waitForFunction((t) => !document.querySelector('#view .spinner') && document.querySelector('#view').children.length > 0, v, { timeout: 20000 });
    await page.waitForTimeout(v === 'storyboard' || v === 'media' || v === 'brand' ? 1200 : 300); await shot(`${String(n++).padStart(2, '0')}-${v}`);
    const bad = await page.locator('#view .card.bad').count(); if (bad) throw new Error(`error card shown: ${await page.locator('#view .card.bad').first().innerText()}`);
  });
}
await step('scene editor opens and saves', async () => {
  await page.goto(`${base}/#/storyboard`); await page.waitForSelector('.scene'); await page.locator('.scene button:has-text("Edit")').first().click();
  await page.waitForSelector('.modal'); await page.click('.modal button:has-text("Visual")'); await shot('30-scene-editor'); await page.click('.modal button:has-text("Save scene")'); await page.waitForSelector('.modal', { state: 'detached' });
});
await step('mobile layout has no horizontal overflow', async () => {
  await page.setViewportSize({ width: 390, height: 800 }); await page.goto(`${base}/#/storyboard`); await page.waitForSelector('.scene'); await page.waitForTimeout(500);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); await shot('31-mobile-storyboard'); if (over > 4) throw new Error(`horizontal overflow ${over}px`);
});
await step('sign out', async () => { await page.setViewportSize({ width: 1360, height: 900 }); await page.goto(base); await page.click('button:has-text("Sign out")'); await page.waitForSelector('text=Sign in'); });
live = false; await browser.close(); server.close(); await ctx.close(); fs.rmSync(dir, { recursive: true, force: true });
if (errors.length) { console.log('\nERRORS:\n' + errors.map((e) => ' - ' + e).join('\n')); process.exit(1); }
console.log('\nUI smoke test passed with no console errors.');
