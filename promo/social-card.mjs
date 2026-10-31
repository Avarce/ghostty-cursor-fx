// The repository's social preview (the picture a shared link shows): 1280x640 PNG, drawn at 2x
// with the real shaders: the title and the five hero effects' Enter moments.
//   node social-card.mjs   -> out/social-preview.png (upload it in the repo's Settings > Social preview)
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.dirname(HERE);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.glsl': 'text/plain', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = createServer(async (req, rsp) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  let body; try { body = await readFile(p); } catch { rsp.writeHead(404).end(); return; }
  rsp.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }).end(body);
}).listen(0, '127.0.0.1');
await new Promise(r => srv.once('listening', r));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/promo/index.html`);
  await page.waitForFunction(() => window.FRAMES || window.failed);
  const url = await page.evaluate(async () => {
    const S = await import('./js/scenes.js'), { EFFECTS } = await import('./js/effects.js'), C = await import('./js/comp.js');
    const W = 2560, H = 1280, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.fillStyle = '#0e0e10'; c.fillRect(0, 0, W, H);
    const g = c.createRadialGradient(1900, 640, 0, 1900, 640, 1100); g.addColorStop(0, 'rgba(80,224,128,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // the title, left
    c.fillStyle = C.INK; c.font = `900 190px ${C.SANS}`; c.letterSpacing = '-4px'; c.fillText('CURSOR FX', 150, 560);
    c.letterSpacing = '0px'; c.fillStyle = C.SOFT; c.font = `500 92px ${C.SANS}`; c.fillText('for Ghostty', 156, 690);
    c.fillStyle = C.INK; c.font = `500 52px ${C.SANS}`;
    c.fillText('Thirteen animated cursor effects', 156, 840); c.fillText('for Claude Code and zsh', 156, 910);
    // five Enter moments, right: the input box of each, the effect at its brightest
    const HERO = [['cyber', 0.49], ['lightning', 0.22], ['glitch', 0.14], ['mecha', 0.26], ['neon', 0.45]];
    const VIEW = { W: 1000, H: 196, CH: 64, padX: 24, padY: 6 - 5 * 64 };
    const SET = 0.04;
    HERO.forEach(([n, since], i) => {
      const ev = [...S.prefill('make the cursor effects awesome', 50), { t: 50 - SET, type: 'enter' }];
      const { img } = S.renderTake(n, VIEW, ev, 50 + since, null, { status: false });
      const x = 1420, y = 120 + i * 214;
      c.save(); c.beginPath(); c.roundRect(x, y, VIEW.W, VIEW.H, 18); c.clip(); c.drawImage(img, x, y); c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 2; c.beginPath(); c.roundRect(x + 1, y + 1, VIEW.W - 2, VIEW.H - 2, 18); c.stroke();
      c.font = `700 40px ${C.SANS}`; const tw = c.measureText(EFFECTS[n].name).width;
      c.fillStyle = 'rgba(14,14,16,0.85)'; c.beginPath(); c.roundRect(x + VIEW.W - 52 - tw, y + VIEW.H / 2 - 32, tw + 44, 64, 14); c.fill();   // keeps the name readable over the effect
      c.fillStyle = EFFECTS[n].color; c.textAlign = 'right'; c.fillText(EFFECTS[n].name, x + VIEW.W - 30, y + VIEW.H / 2 + 14); c.textAlign = 'left';
    });
    return cv.toDataURL('image/png');
  });
  await mkdir(path.join(HERE, 'out'), { recursive: true });
  const big = path.join(HERE, 'out', 'social-preview@2x.png');
  await writeFile(big, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', big);
} finally { await browser.close(); srv.close(); }
