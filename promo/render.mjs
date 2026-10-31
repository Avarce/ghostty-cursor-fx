// Renders the promo from index.html with the installed Google Chrome (headless, Metal GPU).
//
//   node render.mjs stills 0.5 12.4 30          PNG stills at those seconds  -> out/stills/
//   node render.mjs sheet                       contact sheet of key moments  -> out/sheet.png
//   node render.mjs video                       the whole video, 3 chunks in parallel, muxed -> out/cursor-fx-promo.mp4
//   node render.mjs chunk <from> <to> <file>    frames [from, to) into one H.264 file (used by `video`)
//   node render.mjs mux                         re-join out/chunk_*.mp4 with the song (after re-rendering one chunk)
//   node render.mjs events                      out/events.json: song time of every cut and Enter/done hit, for the sync check
//   node render.mjs readme                      ../media: lightning-enter.gif/.mp4 loop + effects/<name>.png (one Enter frame each, all thirteen)
//   node render.mjs cues --cut showcase         out/showcase_cues.json: every keystroke, Enter, done and cut on screen (music/compose.py reads it)
//   options: --jobs N (main cut 3; the 4K cuts 1, don't raise it on an 8 GB Mac), --cut trio (the 39 s lightning / cyber / glitch cut, 3840x2160 -> out/cursor-fx-trio-4k.mp4 + -1080p.mp4),
//            --cut showcase (the 56 s cut on its own track, audio/showcase.wav from music/compose.py -> out/cursor-fx-showcase-4k.mp4 + -1080p.mp4)
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);                       // the repo: serves promo/ and shaders/
const OUT = path.join(HERE, 'out');
const SONG = path.join(HERE, 'audio', 'song.wav');
// The audio of a cut: file, where video time 0 sits in it, fades. The showcase track is written for the video (0 = 0).
async function audioOf(cut) {
  if (cut === 'showcase') return { file: path.join(HERE, 'audio', 'showcase.wav'), start: 0, fi: 0.01, fo: 0.8 };
  const { SONG_START } = await import('./js/timeline.js');
  return { file: SONG, start: SONG_START, fi: 0.4, fo: cut === 'main' ? 1.6 : 1.0 };
}
const ARGS = process.argv.slice(2);
const CUT = ARGS.includes('--cut') ? ARGS[ARGS.indexOf('--cut') + 1] : 'main';
const NAME = CUT === 'main' ? 'cursor-fx-promo' : `cursor-fx-${CUT}-4k`;
const CHUNK = k => path.join(OUT, CUT === 'main' ? `chunk_${k}.mp4` : `${CUT}_chunk_${k}.mp4`);
let sink = null;   // receives the PNG frames POSTed by the page (trio cut)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glsl': 'text/plain',
  '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };

function serve() {
  return new Promise(res => {
    const srv = createServer(async (req, rsp) => {
      if (req.method === 'POST' && req.url.startsWith('/frame')) {
        const parts = []; for await (const d of req) parts.push(d);
        const ok = await sink(Buffer.concat(parts), +new URL(req.url, 'http://x').searchParams.get('i'));
        rsp.writeHead(ok ? 204 : 409, { connection: 'close' }).end(); return;
      }
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT)) { rsp.writeHead(403).end(); return; }
      try { const b = await readFile(p); rsp.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }).end(b); }
      catch { rsp.writeHead(404).end(); }
    }).listen(0, '127.0.0.1', () => res(srv));
    srv.requestTimeout = 0; srv.headersTimeout = 0;
  });
}

async function openStage() {
  const srv = await serve();
  // Now and then a headless Chrome hangs while starting (seen with three at once): give up after 60 s and retry.
  for (let attempt = 1; ; attempt++) {
    const browser = await chromium.launch({ channel: 'chrome', headless: true, timeout: 60000, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--js-flags=--expose-gc'] });
    try {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) console.error('page:', m.text()); });
      page.setDefaultTimeout(60000);
      await page.goto(`http://127.0.0.1:${srv.address().port}/promo/index.html?cut=${CUT}`);
      await page.waitForFunction(() => window.FRAMES || window.failed);
      const failed = await page.evaluate(() => window.failed);
      if (failed) throw new Error(failed);
      const frames = await page.evaluate(() => window.FRAMES), size = await page.evaluate(() => window.SIZE);
      return { srv, browser, page, frames, size, close: async () => { await browser.close(); srv.close(); } };
    } catch (e) {
      await browser.close().catch(() => {});
      if (attempt >= 3) { srv.close(); throw e; }
      console.error(`stage start failed (${e.message.split('\n')[0]}), retrying`);
    }
  }
}

const png = async (page, t) => {
  const url = await page.evaluate(async t => { await window.renderAt(t); return window.grab(); }, t);
  return Buffer.from(url.split(',')[1], 'base64');
};

function ffmpeg(args) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
  p.done = new Promise((res, rej) => p.on('close', code => code ? rej(new Error('ffmpeg exit ' + code)) : res()));
  return p;
}
// 4K: final quality in one pass, 4 encoder threads. Render the 4K cut with ONE job: three 4K Chromes plus three
// 4K encoders ran an 8 GB Mac out of memory and froze it (2026-10-29).
const ENCODE_4K = ['-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-threads', '4',
  '-x264-params', 'aq-mode=3', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'];
const ENCODE = ['-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
  '-x264-params', 'aq-mode=3', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'];

async function chunk(from, to, file) {
  // Watchdog: a headless Chrome sometimes stalls (seen with three starting at once); exit so `video` retries the chunk.
  let last = Date.now();
  const dog = setInterval(() => { if (Date.now() - last > 120000) { console.error(`${path.basename(file)}: stalled, giving up`); process.exit(3); } }, 5000);
  const s = await openStage();
  to = Math.min(to, s.frames);
  const pushed = CUT !== 'main';   // the 4K cut: the page POSTs each frame as a PNG (see pushFrame in index.html)
  const ff = ffmpeg(['-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-', ...(pushed ? ENCODE_4K : ENCODE), file]);
  const write = async buf => { if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); };
  // Frames arrive numbered; a retried upload of a frame already written is ignored, a gap is refused.
  let next = from;
  sink = async (buf, i) => { if (i < next) return true; if (i > next) return false; await write(buf); next++; return true; };
  const t0 = Date.now();
  for (let i = from; i < to; i++) {
    if (pushed) await s.page.evaluate(i => window.pushFrame(i / 60, i), i);
    else await write(await png(s.page, i / 60));
    last = Date.now();
    if ((i - from) % 120 === 0) console.log(`${path.basename(file)}: frame ${i} (${((Date.now() - t0) / Math.max(1, i - from)).toFixed(0)} ms/frame)`);
  }
  ff.stdin.end(); await ff.done; clearInterval(dog); await s.close();
}

// Joins out/chunk_*.mp4 (stream copy) and adds the song, cut sample-accurately at SONG_START, faded at both ends.
async function mux(jobs, N) {
  const files = Array.from({ length: jobs }, (_, k) => CHUNK(k));
  const list = path.join(OUT, `${CUT}_chunks.txt`);
  await writeFile(list, files.map(f => `file '${f}'`).join('\n'));
  const au = await audioOf(CUT);
  const dur = N / 60, fo = au.fo, master = path.join(OUT, NAME + '.mp4');
  const ff = ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-ss', String(au.start), '-t', String(dur), '-i', au.file,
    '-filter_complex', `[1:a]afade=t=in:st=0:d=${au.fi}:curve=qsin,afade=t=out:st=${(dur - fo).toFixed(3)}:d=${fo}:curve=qsin[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', master]);
  ff.stdin.end(); await ff.done;
  console.log('wrote', master);
  if (CUT !== 'main') {   // a 1080p copy scaled down from the 4K master (sharper than rendering at 1080p)
    const hd = path.join(OUT, NAME.replace('-4k', '-1080p') + '.mp4');
    const f2 = ffmpeg(['-i', master, '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '15',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:a', 'copy', '-movflags', '+faststart', hd]);
    f2.stdin.end(); await f2.done;
    console.log('wrote', hd);
  }
}

async function main() {
  const [cmd, ...rest] = ARGS.filter((x, i) => x !== '--cut' && ARGS[i - 1] !== '--cut');
  await mkdir(OUT, { recursive: true });
  if (cmd === 'stills') {
    const s = await openStage(); await mkdir(path.join(OUT, 'stills'), { recursive: true });
    for (const t of rest.map(Number)) await writeFile(path.join(OUT, 'stills', `t${t.toFixed(2)}.png`), await png(s.page, t));
    await s.close();
  } else if (cmd === 'sheet') {
    // Key moments, 4 per row, scaled to 480x270.
    const times = rest.length ? rest.map(Number) : [1.0, 3.0, 5.0, 9.0, 12.4, 12.6, 13.8, 14.6, 17.2, 18.9, 20.7, 21.8,
      23.4, 24.9, 25.5, 27.0, 29.4, 30.9, 32.0, 33.8, 35.3, 36.2, 39.4, 40.3, 43.5, 44.4, 47.6, 48.6, 52.5, 54.6, 56.6, 58.7,
      60.5, 62.3, 63.9, 66.5, 69.0, 74.0, 76.0];
    const s = await openStage(); const dir = path.join(OUT, 'sheet'); await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
    for (const [i, t] of times.entries()) await writeFile(path.join(dir, `${String(i).padStart(3, '0')}.png`), await png(s.page, t));
    await s.close();
    const ff = ffmpeg(['-framerate', '1', '-i', path.join(dir, '%03d.png'), '-vf', 'scale=480:270,tile=4x' + Math.ceil(times.length / 4) + ':padding=4:color=black', '-frames:v', '1', path.join(OUT, 'sheet.png')]);
    ff.stdin.end(); await ff.done;
    console.log('times:', times.join(' '));
  } else if (cmd === 'chunk') {
    await chunk(+rest[0], +rest[1], rest[2]);
  } else if (cmd === 'video') {
    const jobs = rest.includes('--jobs') ? +rest[rest.indexOf('--jobs') + 1] : CUT === 'main' ? 3 : 1;   // 4K: one job (memory)
    const s = await openStage(); const N = s.frames; await s.close();
    const per = Math.ceil(N / jobs);
    const procs = [];
    const run = (k, f) => new Promise(res => {
      const p = spawn(process.execPath, [fileURLToPath(import.meta.url), 'chunk', String(k * per), String(Math.min(N, (k + 1) * per)), f, '--cut', CUT], { stdio: 'inherit' });
      p.on('close', code => res(code));
    });
    for (let k = 0; k < jobs; k++) {
      const f = CHUNK(k);
      procs.push((async () => {
        await new Promise(r => setTimeout(r, k * 4000));   // stagger the Chrome launches
        for (let attempt = 1; attempt <= 3; attempt++) {
          if (await run(k, f) === 0) return;
          console.error(`chunk ${k} failed (attempt ${attempt})`);
        }
        throw new Error('chunk ' + k + ' failed 3 times');
      })());
    }
    await Promise.all(procs);
    await mux(jobs, N);
  } else if (cmd === 'mux') {
    const s = await openStage(); const N = s.frames; await s.close();
    await mux(rest.includes('--jobs') ? +rest[rest.indexOf('--jobs') + 1] : CUT === 'main' ? 3 : 1, N);
  } else if (cmd === 'events') {
    const s = await openStage();
    const ev = await s.page.evaluate(async cut => {
      const m = await import(cut === 'main' ? './js/scenes.js' : `./js/${cut}.js`);
      const cuts = m.SHOTS.flatMap(x => [...(x.t0 > 0 ? [{ t: x.t0, name: 'cut' }] : []), ...(x.hits || []).filter(h => Math.abs(h.t - x.t0) > 0.02)]);
      const hits = (m.HITS || []).filter(h => !cuts.some(c => Math.abs(c.t - h.t) < 0.02)).map(h => ({ t: h.t, name: 'hit' }));
      return [...cuts, ...hits].sort((a, b) => a.t - b.t);
    }, CUT);
    await s.close();
    const { start } = await audioOf(CUT);
    await writeFile(path.join(OUT, CUT === 'main' ? 'events.json' : `${CUT}_events.json`), JSON.stringify(ev.map(e => ({ t: +(start + e.t).toFixed(4), name: `${e.name} ${e.t.toFixed(3)}` })), null, 1));
    console.log(ev.length, 'cuts and hits ->', path.join(OUT, CUT === 'main' ? 'events.json' : `${CUT}_events.json`));
  } else if (cmd === 'cues') {
    const s = await openStage();
    const cues = await s.page.evaluate(async cut => (await import(`./js/${cut}.js`)).CUES, CUT);
    await s.close();
    const file = path.join(OUT, `${CUT}_cues.json`);
    await writeFile(file, JSON.stringify(cues, null, 1));
    console.log(cues.length, 'cues ->', file);
  } else if (cmd === 'readme') {
    const MEDIA = path.join(ROOT, 'media'); await mkdir(path.join(MEDIA, 'effects'), { recursive: true });
    const { EFFECTS, ALL } = await import('./js/effects.js');
    const s = await openStage();
    const [cx, cy, cw, ch] = await s.page.evaluate(async () => (await import('./js/scenes.js')).CARD_RECT);
    // One Enter frame per effect: the brightest of a few moments in its first half.
    for (const n of ALL) {   // all thirteen
      let best = null;
      for (const f of [0.15, 0.22, 0.3, 0.38, 0.46]) {
        const since = 0.04 + f * EFFECTS[n].enter;
        const lum = await s.page.evaluate(([n, since, r]) => { window.renderCard(n, since);
          const d = document.getElementById('out').getContext('2d').getImageData(...r).data; let L = 0;
          for (let i = 0; i < d.length; i += 16) L += d[i] + d[i + 1] + d[i + 2]; return L; }, [n, since, [cx, cy, cw, ch]]);
        if (!best || lum > best.lum) best = { lum, since };
      }
      const url = await s.page.evaluate(([n, since]) => { window.renderCard(n, since); return window.grab(); }, [n, best.since]);
      const ff = ffmpeg(['-f', 'png_pipe', '-i', '-', '-vf', `crop=${cw}:${ch}:${cx}:${cy},scale=1200:-1:flags=lanczos`, path.join(MEDIA, 'effects', n + '.png')]);
      ff.stdin.end(Buffer.from(url.split(',')[1], 'base64')); await ff.done;
      console.log(n, 'at', best.since.toFixed(2), 's');
    }
    // The loop: 60 fps MP4 and a 25 fps GIF.
    const LOOP = await s.page.evaluate(async () => (await import('./js/scenes.js')).LOOP);
    const mp4 = path.join(MEDIA, 'lightning-enter.mp4');
    const ff = ffmpeg(['-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-', '-vf', `crop=${cw}:${ch}:${cx}:${cy},scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', mp4]);
    for (let i = 0; i < Math.round(LOOP * 60); i++) {
      const url = await s.page.evaluate(t => { window.renderLoop(t); return window.grab(); }, i / 60);
      if (!ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await ff.done; await s.close();
    const gif = ffmpeg(['-i', mp4, '-filter_complex', 'fps=25,scale=880:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a', '-loop', '0', path.join(MEDIA, 'lightning-enter.gif')]);
    gif.stdin.end(); await gif.done;
    console.log('wrote', MEDIA);
  } else {
    console.log('usage: node render.mjs stills <t...> | sheet [t...] | video [--jobs N] | chunk <from> <to> <file> | mux | events | cues | readme  [--cut trio|showcase]');
  }
}
main().catch(e => { console.error(e); process.exit(1); });
