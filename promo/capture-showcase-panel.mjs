// Captures the settings panel (`cursor-fx edit`) for the showcase cut: capture/showcase-panel/NNNN.jpg,
// 60 fps, 2880x1620 (1440x810 at 2x). Runs on a throwaway copy of your Ghostty config (CURSOR_FX_CONFIG)
// with the repo's shaders, so nothing installed changes. Time is Playwright's fake clock, one frame per
// 1/60 s. On the beat (120 BPM): "ship it" typed into the preview, Enter, the Cursor section switched off and on.
//
//   node capture-showcase-panel.mjs
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdtemp, cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { S16 } from './js/showcase-grid.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const OUT = path.join(HERE, 'capture', 'showcase-panel');
const SECONDS = 2.1, EFFECT = 'cyber';

const box = await mkdtemp(path.join(tmpdir(), 'cursor-fx-panel-'));
const gh = path.join(box, 'ghostty');
await mkdir(gh, { recursive: true });
const live = path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'), 'ghostty');
let config = await readFile(path.join(live, 'config'), 'utf8').catch(() => 'theme = Graphite\n');
config = config.replace(/^config-file = cursor-effects\/.*$/m, '') + `\nconfig-file = cursor-effects/${EFFECT}.conf\n`;
await writeFile(path.join(gh, 'config'), config);
await cp(path.join(live, 'themes'), path.join(gh, 'themes'), { recursive: true }).catch(() => {});
await cp(path.join(ROOT, 'shaders'), path.join(gh, 'shaders'), { recursive: true });
await cp(path.join(ROOT, 'cursor-effects'), path.join(gh, 'cursor-effects'), { recursive: true });

const env = { ...process.env, CURSOR_FX_CONFIG: path.join(gh, 'config'), CURSOR_FX_SAVEPOINTS: path.join(box, 'savepoints'), CURSOR_FX_CACHE: path.join(box, 'cache') };
const server = spawn('python3', [path.join(ROOT, 'bin', 'cursor-fx'), 'edit', '--no-open'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
const url = await new Promise((res, rej) => {
  server.stdout.on('data', d => { const m = String(d).match(/http:\/\/\S+/); if (m) res(m[0]); });
  server.on('close', () => rej(new Error('cursor-fx edit exited')));
});

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem('cursor-fx-lang', 'en'); } catch {} });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('page:', e.message));
  const T0 = new Date('2026-10-31T12:00:00Z').getTime();
  await page.clock.install({ time: T0 });
  await page.goto(url);
  await page.clock.pauseAt(T0 + 1000);              // from here on, time moves only with runFor()
  await page.clock.runFor(1500);
  await page.waitForTimeout(500);
  await page.clock.runFor(500);
  // The Cursor section at the top of the settings column.
  await page.evaluate(() => document.querySelector('section.sec[data-group="Cursor"]').scrollIntoView({ block: 'start' }));
  await page.clock.runFor(300);
  const flip = () => page.evaluate(() => document.querySelector('section.sec[data-group="Cursor"] .sechead input[type=checkbox]').click());
  const keys = [...'ship it'].map((ch, i) => [Math.round(i * S16 * 60), ch]);
  await rm(OUT, { recursive: true, force: true }); await mkdir(OUT, { recursive: true });
  const N = Math.round(SECONDS * 60);
  for (let i = 0; i < N; i++) {
    for (const [f, ch] of keys) if (f === i) await page.keyboard.press(ch === ' ' ? 'Space' : ch);
    if (i === 60) await page.keyboard.press('Enter');
    if (i === 84 || i === 105) await flip();
    await page.clock.runFor(1000 / 60);
    if (i % 6 === 0) await page.waitForTimeout(20);   // let the save requests to the local server finish
    await page.screenshot({ path: path.join(OUT, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 90 });
  }
  console.log('status:', await page.locator('#status').textContent());
  console.log(`wrote ${N} frames to ${OUT}`);
} finally {
  await browser.close();
  server.kill();
  await rm(box, { recursive: true, force: true });
}
