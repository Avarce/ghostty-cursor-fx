// The storyboard: shots placed on the music grid (timeline.js), each a pure
// function of video time t. Every effect frame comes from the real shader.
import { EFFECTS, ORDER } from './effects.js';
import { Term, takeState, typeKeys, claudeScreen, shellScreen, zshPrompt, BG, FG, DIM, GREEN, CUR_TEXT } from './term.js';
import { background, termWindow, fullBleed, shade, lowerThird, chip, centerText, window_, ease, ramp, clamp, SANS, INK, SOFT, TITLE_H } from './comp.js';
import { bar, BEAT, E8, S16, DROP, BASS_BACK, END, SETTLE, HIT } from './timeline.js';

export const W = 1920, H = 1080;
export const URL_TEXT = 'github.com/YOUR-NAME/ghostty-cursor-fx';

// --- views: how big the terminal is drawn ---
const terms = new Map();
export const getTerm = o => { const k = JSON.stringify(o); if (!terms.has(k)) terms.set(k, new Term(o)); return terms.get(k); };
const WIDE = { W: 1520, H: 572, CH: 60, padY: 16 };
const WIN_X = (W - WIDE.W) / 2, WIN_Y = 196;
// Close-up: the cursor row's middle at y = 450.
const CLOSE = (padX = 150) => ({ W, H, CH: 150, padX, padY: Math.round(450 - 6.5 * 150) });
// Macro: one cell big; padX puts column `col` in the middle.
const macro = (col = 2, CH = 270) => { const t = getTerm({ W, H, CH, padX: 0, padY: 0 }); return { W, H, CH, padX: Math.round(W / 2 - (col + 0.5) * t.CW), padY: Math.round(500 - 6.5 * CH) }; };

// Keys on a list of grid positions (seconds); text[i] lands at times[i].
export const keysAt = (text, times) => [...text].map((ch, i) => ({ t: times[i], type: 'key', ch }));
export const every = (t0, step, n) => Array.from({ length: n }, (_, i) => t0 + i * step);
// Text already typed before the shot starts.
export const prefill = (text, t0) => typeKeys(text, t0 - 30, 0.01);

let FXR = null;  // the shader runner, set by init()
export function init(fx) { FXR = fx; }

// Render one take of effect `name` in `view` at time t; returns the shader output canvas and the cursor rect.
export function renderTake(name, view, events, t, screenFn, screenOpts = {}) {
  const e = EFFECTS[name], term = getTerm(view);
  const st = takeState(events, t);
  const screen = (screenFn || claudeScreen)(st, t, { color: e.color, ...screenOpts });
  term.paint(screen);
  const cu = screen.cursor;
  const cur = term.rect(cu.row, cu.col), prev = term.rect(cu.row + st.prev[0], cu.col + st.prev[1]);
  const img = FXR.draw(name, term.canvas, { time: 100 + t, change: 100 + st.change, cur, prev, color: e.color, signal: st.signal, bg: BG, fg: FG, curText: CUR_TEXT });
  return { img, cur, term, st };
}

// Chips: [[t, label, sub]] — the latest one that has started is shown.
function chips(c, t, list, x, y) {
  let k = -1; list.forEach(([tt], i) => { if (t >= tt) k = i; });
  if (k < 0) return;
  const [tt, label, sub, color] = list[k];
  chip(c, x, y, label, color || '#ece6d8', ramp(t, tt, tt + 0.12), { sub });
}

// --- shot builders ---
// A take in the terminal window. o: { fx, t0, t1, events, zoom: [a, b], chips, lower: [from, to], head, screen, screenOpts, title }
const hitsOf = o => o.events.filter(e => (e.type === 'enter' || e.type === 'done') && e.t + SETTLE >= o.t0 && e.t + SETTLE < o.t1)
  .map(e => ({ t: DROP + Math.round((e.t + SETTLE - DROP) / S16) * S16, name: `${o.fx} ${e.type}` }));  // the 16th it lands on
function wideShot(o) {
  return { t0: o.t0, t1: o.t1, fx: o.fx, hits: hitsOf(o), draw(c, t) {
    const e = EFFECTS[o.fx];
    const { img, cur } = renderTake(o.fx, WIDE, o.events, t, o.screen, o.screenOpts);
    background(c, W, H, e.color, 0.07);
    const zr = o.zoom || [1.0, 1.035];
    const z = typeof zr === 'function' ? zr(t) : zr[0] + (zr[1] - zr[0]) * ((t - o.t0) / (o.t1 - o.t0));
    const fx = 0, fy = (WIDE.H - cur[1] + cur[3] / 2) / WIDE.H;  // push in toward the input row, the left edge stays put
    termWindow(c, img, WIN_X, WIN_Y, { zoom: z, fx, fy, title: o.title || 'claude' });
    if (o.chips) chips(c, t, o.chips, WIN_X, WIN_Y - 34);
    if (o.lower) lowerThird(c, WIN_X, 905, e.name, e.color, e.line, window_(t, o.lower[0], o.lower[1], 0.3, 0.2));
    if (o.head) o.head(c, t);
  } };
}

// Full-bleed close-up of the cursor while typing.
function closeShot(o) {
  return { t0: o.t0, t1: o.t1, fx: o.fx, draw(c, t) {
    const e = EFFECTS[o.fx];
    const view = o.view || CLOSE(o.padX);
    const { img, cur } = renderTake(o.fx, view, o.events, t, o.screen, { status: false, ...o.screenOpts });
    const z = o.zoom ? o.zoom[0] + (o.zoom[1] - o.zoom[0]) * ease((t - o.t0) / (o.t1 - o.t0)) : 1;
    const fy = (view.H - cur[1] + cur[3] / 2) / view.H;
    background(c, W, H);
    fullBleed(c, img, W, H, { zoom: z, fx: (cur[0] + cur[2] / 2) / W, fy });
    shade(c, W, H, { top: 0.35, bottom: 0.75 });
    if (o.chips) chips(c, t, o.chips, 150, 92);
    if (o.lower) lowerThird(c, 150, 930, e.name, e.color, e.line, window_(t, o.lower[0], o.lower[1], 0.3, 0.2));
    if (o.label) o.label(c, t);
  } };
}

const CH_TYPING = (t, sub = 'as you type') => [t, 'TYPING', sub];
const CH_ENTER = (t, sub = 'prompt sent') => [t, 'ENTER', sub];
const CH_DONE = (t, sub = 'answer arrived, from the edges in') => [t, 'DONE', sub];
const fxColor = n => EFFECTS[n].color;

// --- the storyboard ---
export const SHOTS = [];
const add = s => SHOTS.push(s);

// A. Cold open: three cursor portraits while the voice comes in (bars -6..-4).
[['cyber', 'glyph rain inside the cursor'], ['glitch', 'a corrupted signal that tears'], ['lightning', 'arcs of current crawl around it']].forEach(([n, sub], i) => {
  const t0 = bar(-6 + i), t1 = bar(-5 + i);
  add(closeShot({ fx: n, t0, t1, view: macro(2), events: [], zoom: [1.0, 1.06], label(c, t) {
    const a = window_(t, t0 + 0.25, t1, 0.4, 0.3);
    c.save(); c.globalAlpha = a; c.font = `650 26px ${SANS}`; c.letterSpacing = '6px'; c.fillStyle = fxColor(n);
    c.fillText(EFFECTS[n].name.toUpperCase(), 150, 960); c.letterSpacing = '0px';
    c.font = `450 26px ${SANS}`; c.fillStyle = SOFT; c.fillText(sub, 150, 1000); c.restore();
  } }));
});

// B. The prompt: typed during the build, sent on the drop, answered a bar later; the title lands.
add(wideShot({ fx: 'lightning', t0: bar(-3), t1: bar(2),
  events: [...typeKeys('make the cursor effects awesome', bar(-3, 1), S16), { t: DROP - SETTLE, type: 'enter' }, { t: bar(1) - HIT, type: 'done' }],
  answer: 'Done: thirteen effects, each with its own cursor.',
  screenOpts: { answer: 'Done: thirteen effects, each with its own cursor.' },
  zoom: t => t < DROP ? 1.0 + 0.07 * ease((t - bar(-3)) / (DROP - bar(-3))) : 1.0 + 0.035 * (t - DROP) / (bar(2) - DROP),
  chips: [CH_TYPING(bar(-3, 1), 'in Claude Code'), CH_ENTER(DROP), CH_DONE(bar(1))],
  head(c, t) {
    const a = window_(t, bar(0, 2), bar(2), 0.45, 0.3);
    centerText(c, 'Cursor FX for Ghostty', W / 2, 90, { size: 64, weight: 700, a });
    centerText(c, 'Animated cursor effects for the Ghostty terminal', W / 2, 132, { size: 25, weight: 450, color: SOFT, a });
  } }));

// C. Lightning (bars 2-4): typing close-up, delete-all bolt, Enter, done.
{
  const L = [bar(2), bar(5)];
  add(closeShot({ fx: 'lightning', t0: bar(2), t1: bar(3), events: [...prefill('fix the l', bar(2)), ...keysAt('ogin bug', every(bar(2), E8, 8))],
    zoom: [1.0, 1.04], chips: [CH_TYPING(bar(2), 'sparks')], lower: L }));
  add(wideShot({ fx: 'lightning', t0: bar(3), t1: bar(5),
    events: [...prefill('fix the login bug', bar(3)), { t: bar(3) + E8, type: 'clear' }, ...keysAt('ship it', every(bar(3, 2), S16, 7)),
             { t: bar(4) - HIT, type: 'enter' }, { t: bar(4, 2) - HIT, type: 'done' }],
    screenOpts: { answer: 'Fixed: the session token now refreshes.' },
    chips: [[bar(3) + E8, 'SELECT ALL + DELETE', 'a bolt along the line'], CH_TYPING(bar(3, 2)), CH_ENTER(bar(4)), CH_DONE(bar(4, 2))], lower: L }));
}

// D. Cyber (bars 5-7).
{
  const L = [bar(5), bar(8)];
  add(closeShot({ fx: 'cyber', t0: bar(5), t1: bar(6), events: [...prefill('refactor the a', bar(5)), ...keysAt('uth flow', every(bar(5), E8, 8))],
    zoom: [1.0, 1.04], chips: [CH_TYPING(bar(5), 'each letter decrypts')], lower: L }));
  add(wideShot({ fx: 'cyber', t0: bar(6), t1: bar(8),
    events: [...prefill('refactor the auth flow', bar(6)), { t: bar(6) - HIT, type: 'enter' }, { t: bar(7) - HIT, type: 'done' }],
    screenOpts: { answer: 'Refactored: auth now lives in one module.' },
    chips: [CH_ENTER(bar(6), 'data rain'), CH_DONE(bar(7))], lower: L }));
}

// E. Glitch (bars 8-10).
{
  const L = [bar(8), bar(11)];
  add(closeShot({ fx: 'glitch', t0: bar(8), t1: bar(9), events: [...prefill('why is the build b', bar(8)), ...keysAt('roken?', [0, 1, 2, 4, 5, 6].map(k => bar(8) + k * E8))],
    zoom: [1.0, 1.04], chips: [CH_TYPING(bar(8), 'tears into slices')], lower: L }));
  add(wideShot({ fx: 'glitch', t0: bar(9), t1: bar(10),
    events: [...prefill('why is the build broken?', bar(9)), { t: bar(9) - HIT, type: 'enter' }, { t: bar(9, 2) - HIT, type: 'done' }],
    screenOpts: { answer: 'Found it: a stale lockfile. Rebuilt clean.' },
    chips: [CH_ENTER(bar(9), 'the lines break into slices'), CH_DONE(bar(9, 2))], lower: L }));
  add(closeShot({ fx: 'glitch', t0: bar(10), t1: bar(11), view: macro(4),
    events: [...prefill('ok', bar(10) - 1), ...keysAt('!', [bar(10, 2)])], zoom: [1.0, 1.05], lower: L,
    chips: [[bar(10), 'CURSOR', 'a corrupted signal: split channels, tearing']] }));
}

// F. Four more, two bars each: close-up typing (2 beats), then Enter and done.
[['phosphor', 11, 'add a retro mode to the UI', 'Added a CRT theme toggle.'],
 ['neon', 13, 'make the logo glow', 'The logo now has a soft glow.'],
 ['shockwave', 15, 'find the memory leak', 'Found it: a listener never removed.'],
 ['teleport', 17, 'move the tests to /spec', 'Moved 24 test files.']].forEach(([n, b, text, answer]) => {
  const L = [bar(b), bar(b + 2)], k = text.length - 4;
  add(closeShot({ fx: n, t0: bar(b), t1: bar(b, 2), events: [...prefill(text.slice(0, k), bar(b)), ...keysAt(text.slice(k), every(bar(b), E8, 4))],
    zoom: [1.0, 1.03], chips: [CH_TYPING(bar(b))], lower: L }));
  add(wideShot({ fx: n, t0: bar(b, 2), t1: bar(b + 2),
    events: [...prefill(text, bar(b)), { t: bar(b, 2) - HIT, type: 'enter' }, { t: bar(b, 5) - HIT, type: 'done' }],
    screenOpts: { answer }, chips: [CH_ENTER(bar(b, 2)), CH_DONE(bar(b, 5))], lower: L }));
});

// G. The break: aurora in Claude Code, embers in zsh, katana typing.
const headline = (c, t, a0, a1, text, sub) => {
  const a = window_(t, a0, a1, 0.35, 0.3);
  centerText(c, text, W / 2, 82, { size: 46, weight: 650, a });
  if (sub) centerText(c, sub, W / 2, 122, { size: 25, weight: 450, color: SOFT, a });
};
add(wideShot({ fx: 'aurora', t0: bar(19), t1: bar(21),
  events: [...prefill('write the release n', bar(19)), ...keysAt('otes', every(bar(19), E8, 4)), { t: bar(19, 2) - HIT, type: 'enter' }, { t: bar(20, 2) - HIT, type: 'done' }],
  screenOpts: { answer: 'Wrote CHANGELOG.md for v1.2.' }, lower: [bar(19), bar(21)],
  head(c, t) {
    headline(c, t, bar(19, 1), bar(20, 2), 'Enter plays when you send a prompt', 'out from the cursor, along the input box');
    headline(c, t, bar(20, 2), bar(21), 'Done plays when the answer arrives', 'from the edges in, so you notice even when you looked away');
  } }));
const ZSH_BEFORE = [[...zshPrompt(), ['git pull', FG]], [['Already up to date.', FG]], [...zshPrompt(), ['git status --short', FG]], [[' M src/app.ts', FG]]];
add(wideShot({ fx: 'embers', t0: bar(21), t1: bar(23), title: 'zsh',
  events: [...prefill('npm run bu', bar(21)), ...keysAt('ild', every(bar(21), E8, 3)), { t: bar(21, 2) - HIT, type: 'enter' }, { t: bar(22, 2) - HIT, type: 'done' }],
  screen: shellScreen,
  screenOpts: { before: ZSH_BEFORE, out: [[['vite v5.4.2 building for production...', DIM]], [['✓ 1342 modules transformed.', GREEN]], [['✓ built in 6.12s', GREEN]]] },
  lower: [bar(21), bar(23)], chips: [CH_TYPING(bar(21)), CH_ENTER(bar(21, 2), 'command run'), CH_DONE(bar(22, 2), 'a long command finished')],
  head(c, t) { headline(c, t, bar(21, 0.5), bar(23), 'Works in zsh too', 'Enter on every command · Done after any command longer than 5 seconds'); } }));
add(closeShot({ fx: 'katana', t0: bar(23), t1: BASS_BACK, events: [...keysAt('ship v2.0', every(bar(23), E8, 9))],
  zoom: [1.0, 1.05], chips: [CH_TYPING(bar(23), 'a slash through the cursor')], lower: [bar(23), BASS_BACK] }));

// H. Bass back: fireworks, mecha, then twelve at once.
add(wideShot({ fx: 'fireworks', t0: BASS_BACK, t1: BASS_BACK + 3 * BEAT,
  events: [...prefill('celebrate the release', BASS_BACK), { t: BASS_BACK - HIT, type: 'enter' }],
  chips: [CH_ENTER(BASS_BACK)], lower: [BASS_BACK, BASS_BACK + 3 * BEAT] }));
add(wideShot({ fx: 'mecha', t0: BASS_BACK + 3 * BEAT, t1: BASS_BACK + 6 * BEAT,
  events: [...prefill('clean up old branches', BASS_BACK), { t: BASS_BACK + 3 * BEAT - HIT, type: 'enter' }],
  chips: [CH_ENTER(BASS_BACK + 3 * BEAT)], lower: [BASS_BACK + 3 * BEAT, BASS_BACK + 6 * BEAT] }));
{
  const t0 = BASS_BACK + 6 * BEAT, t1 = bar(27);
  const TILE = { W: 432, H: 212, CH: 22, padY: 7 };
  add({ t0, t1, draw(c, t) {
    background(c, W, H, null);
    const gx = 26, gy = 22, tw = TILE.W, th = TILE.H + 30, x0 = (W - (4 * tw + 3 * gx)) / 2, y0 = 222;
    ORDER.forEach((n, i) => {
      const te = t0 + i * S16 - HIT;
      const { img } = renderTake(n, TILE, [...prefill('ship it', t0), { t: te, type: 'enter' }], t);
      const x = x0 + (i % 4) * (tw + gx), y = y0 + Math.floor(i / 4) * (th + gy);
      const a = ramp(t, t0 + i * S16 * 0.5 - 0.1, t0 + i * S16 * 0.5 + 0.1);
      c.save(); c.globalAlpha = a; c.drawImage(img, x, y); c.strokeStyle = 'rgba(255,255,255,0.08)'; c.strokeRect(x + 0.5, y + 0.5, tw - 1, TILE.H - 1);
      c.font = `600 20px ${SANS}`; c.fillStyle = EFFECTS[n].color; c.fillText(EFFECTS[n].name, x + 2, y + TILE.H + 24); c.restore();
    });
    const a = window_(t, t0, t1 + 1, 0.3, 0);
    centerText(c, '12 effects', W / 2, 112, { size: 64, weight: 700, a });
    centerText(c, 'switch with one command: cursor-fx <name>', W / 2, 160, { size: 26, weight: 450, color: SOFT, a });
  } });
}

// I. Second break: the panel, then the close.
export const PANEL = { t0: bar(27), t1: bar(29, 2) };
add({ t0: PANEL.t0, t1: PANEL.t1, panel: true, draw(c, t, frames) {
  background(c, W, H, '#9fd0fe', 0.05);
  const img = frames && frames(t - PANEL.t0);
  const k = 1 + 0.03 * (t - PANEL.t0) / (PANEL.t1 - PANEL.t0);
  const pw = 1440 * k, ph = 810 * k, x = (W - pw) / 2, y = 205 - (k - 1) * 300;
  if (img) {
    c.save(); c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 60; c.shadowOffsetY = 24;
    c.fillStyle = '#1b1b1d'; c.fillRect(x, y, pw, ph); c.restore();
    c.drawImage(img, x, y, pw, ph);
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
  }
  const a = window_(t, PANEL.t0, PANEL.t1, 0.35, 0.3);
  centerText(c, 'Tune everything live', W / 2, 92, { size: 48, weight: 650, a });
  centerText(c, 'cursor-fx edit  ·  live preview, every setting, saved to Ghostty as you go', W / 2, 138, { size: 26, weight: 450, color: SOFT, a });
} });

{
  const t0 = PANEL.t1, t1 = END;
  const CARD = { W: 980, H: 196, CH: 52, padY: 20 };
  const k1 = typeKeys('./install.sh', t0 + 0.25, S16 / 2);
  const tEnter = t0 + 0.25 + 12 * S16 / 2 + 0.1;
  const k2 = typeKeys('cursor-fx lightning', tEnter + 0.5, S16 / 2);
  const events = [...k1, { t: tEnter, type: 'enter' }, { t: tEnter + 0.35, type: 'out' }, ...k2];
  const out = [[['Installed 12 effects into ~/.config/ghostty', DIM]]];
  add({ t0, t1, draw(c, t) {
    background(c, W, H, '#9fd0fe', 0.06);
    const a = window_(t, t0, t1 + 5, 0.4, 0);
    centerText(c, 'Cursor FX for Ghostty', W / 2, 250, { size: 76, weight: 700, a });
    centerText(c, '12 cursor effects · Enter and Done moments · a live tuning panel', W / 2, 304, { size: 28, weight: 450, color: SOFT, a });
    const { img } = renderTake('lightning', CARD, events, t, shellScreen, { before: [], out, dir: '~/ghostty-cursor-fx' });
    const x = (W - CARD.W) / 2, y = 390;
    const k = 1 + 0.04 * (t - t0) / (t1 - t0);
    c.save(); c.globalAlpha = ramp(t, t0, t0 + 0.3);
    c.translate(W / 2, y + 117); c.scale(k, k); c.translate(-W / 2, -(y + 117));
    termWindow(c, img, x, y, { title: 'zsh' }); c.restore();
    const b = window_(t, t0 + 1.2, t1 + 5, 0.4, 0);
    centerText(c, URL_TEXT, W / 2, 760, { size: 40, weight: 600, color: '#9fd0fe', a: b });
    centerText(c, 'MIT licensed  ·  macOS + Linux  ·  Ghostty 1.4+', W / 2, 812, { size: 26, weight: 450, color: SOFT, a: b });
  } });
}

// Fades: in from black at the start, out to black at the end.
export function fadeAlpha(t) {
  return Math.min(ramp(t, 0, 0.6), 1 - ramp(t, END - 1.0, END));
}
export const DURATION = END;

// --- README assets: the terminal window alone (no captions), cropped by render.mjs ---
export const CARD_RECT = [WIN_X - 20, WIN_Y - 20, WIDE.W + 40, WIDE.H + TITLE_H + 40];
// One effect's Enter, `since` seconds after the effect starts.
export function drawCard(c, name, since) {
  const t = 50 + since;
  const { img } = renderTake(name, WIDE, [...prefill('make the cursor effects awesome', 50), { t: 50 - SETTLE, type: 'enter' }], t);
  c.fillStyle = '#121214'; c.fillRect(0, 0, W, H);
  termWindow(c, img, WIN_X, WIN_Y, {});
}
// The README loop (LOOP seconds): type, Enter, done; fades through dark at the seam.
export const LOOP = 7.0;
const LOOP_EVENTS = [...typeKeys('make the cursor effects awesome', 0.45, 0.068), { t: 2.95 - SETTLE, type: 'enter' }, { t: 4.35 - SETTLE, type: 'done' }];
export function drawLoop(c, t, name = 'lightning') {
  const { img } = renderTake(name, WIDE, LOOP_EVENTS, t, null, { answer: 'Done: thirteen effects, each with its own cursor.' });
  c.fillStyle = '#121214'; c.fillRect(0, 0, W, H);
  termWindow(c, img, WIN_X, WIN_Y, {});
  const a = Math.min(ramp(t, 0, 0.3), 1 - ramp(t, LOOP - 0.3, LOOP));
  if (a < 1) { c.fillStyle = `rgba(18,18,20,${1 - a})`; c.fillRect(0, 0, W, H); }
}
