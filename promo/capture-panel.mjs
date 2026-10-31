// Captures the tuning panel (`cursor-fx edit`) for the promo: capture/panel/NNNN.jpg, 60 fps, 1440x810.
// It runs the panel on a throwaway copy of your Ghostty config (CURSOR_FX_CONFIG), so nothing
// installed changes and Ghostty isn't reloaded. Time is driven by Playwright's fake clock, one
// frame per 1/60 s, so the preview animates at true speed however slow the screenshots are.
//
//   node capture-panel.mjs [seconds]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdtemp, cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BEAT } from './js/timeline.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const OUT = path.join(HERE, 'capture', 'panel');
const SECONDS = +(process.argv[2] || 5.2);    // the panel shot: 10 beats of the song
const EFFECT = 'cyber';

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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.125 });
  await ctx.addInitScript(() => { try { localStorage.setItem('cursor-fx-lang', 'en'); } catch {} });
  const page = await ctx.newPage();
  const T0 = new Date('2026-10-29T12:00:00Z').getTime();
  await page.clock.install({ time: T0 });
  await page.goto(url);
  await page.clock.pauseAt(T0 + 1000);              // from here on, time moves only with runFor()
  await page.clock.runFor(1500);
  await page.waitForTimeout(500);
  await page.clock.runFor(500);

  // Scroll the settings so the Cursor glow slider sits beside the sticky preview.
  const glow = await page.evaluateHandle(() => [...document.querySelectorAll('input[type=range]')]
    .find(i => (i.closest('label,div')?.parentElement?.textContent || '').includes('Cursor glow')));
  await page.evaluate(el => { const r = el.getBoundingClientRect(); window.scrollBy(0, r.top - 600); }, glow);
  await page.clock.runFor(300);
  const info = await page.evaluate(el => ({ min: +el.min, max: +el.max, value: +el.value }), glow);
  console.log('cursor glow slider', info);

  // Press "Enter (send)" through the DOM (Playwright's click waits on animation frames, which the fake clock holds).
  const enter = () => page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Enter (send)').click());
  const set = (v, last) => page.evaluate(([el, v, last]) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); if (last) el.dispatchEvent(new Event('change', { bubbles: true })); }, [glow, v, last]);
  await rm(OUT, { recursive: true, force: true }); await mkdir(OUT, { recursive: true });
  const N = Math.round(SECONDS * 60);
  // The drag: three moves with short holds (the preview recompiles once the slider rests for 120 ms).
  const moves = [[4 * BEAT, 0.6, 0.95], [5 * BEAT, 0.95, 1.3], [6 * BEAT, 1.3, 1.6]];  // on the beats
  for (let i = 0; i < N; i++) {
    const t = i / 60;
    if (i === Math.round(BEAT * 60) || i === Math.round(7 * BEAT * 60)) await enter();
    for (const [t0, a, b] of moves) {
      if (t >= t0 && t <= t0 + 0.2) {
        const k = (t - t0) / 0.2, e = k * k * (3 - 2 * k);
        await set(Math.round((a + (b - a) * e) * 100) / 100, t + 1 / 60 > t0 + 0.2);
      }
    }
    await page.clock.runFor(1000 / 60);
    if (i % 6 === 0) await page.waitForTimeout(20);   // let the save requests to the local server finish
    await page.screenshot({ path: path.join(OUT, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 92 });
  }
  console.log('status:', await page.locator('#status').textContent());
  console.log(`wrote ${N} frames to ${OUT}`);
} finally {
  await browser.close();
  server.kill();
  await rm(box, { recursive: true, force: true });
}
