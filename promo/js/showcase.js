// The showcase cut: 56 s, 3840x2160, on an original track written for it (music/compose.py,
// same grid: showcase-grid.js). Five hero chapters (lightning, cyber, glitch, mecha, neon),
// each showing a different part (typing, delete-all, Enter, done, the cursor, the prompt mark),
// the settings panel, zsh, the other effects on the beat, all thirteen, the install.
// Every effect frame is the real shader; post.js adds the motion (punches, shake, color split,
// slices, transitions, the bolt streak). No full-screen flashes.
import { EFFECTS, ALL } from './effects.js';
import { FG, DIM, GREEN, shellScreen, zshPrompt, typeKeys } from './term.js';
import { termWindow, clamp, ease, easeOut, ramp, SANS, INK, SOFT } from './comp.js';
import { SETTLE, HIT, JUMP_SETTLE } from './timeline.js';
import { GRID, BEAT, E8, S16, bar } from './showcase-grid.js';
import { getTerm, renderTake, prefill, keysAt, every } from './scenes.js';

export const W = 3840, H = 2160, K = 2;
const DROP = GRID.drop1, BREAK = GRID.break, DROP2 = GRID.drop2, OUTRO = GRID.outro, END = GRID.end;
const MONO = '"TX-02 Retina SemiCondensed", Menlo, monospace';
const BEAM = '#5cd6ff';   // mecha's BEAM_COLOR

// --- views (4K). The wide terminal shows rows 2-8 (sent prompt, answer, input box, status). ---
const WIDE = { W: 3360, H: 1118, CH: 150, padY: 34 - 2 * 150 };
const WIN = [240, 560];
const CLOSE = (padX = 300, CH = 330) => ({ W, H, CH, padX, padY: Math.round(980 - 6.5 * CH) });
const MACRO = { W, H, CH: 600, padX: 0, padY: Math.round(1000 - 6.5 * 600) };
const macro = (col = 1) => { const t = getTerm(MACRO); return { ...MACRO, padX: Math.round(W / 2 - (col + 0.5) * t.CW) }; };
const BEFORE = [[], [], [['⏺ ', FG], ['Updated install.sh and the README.', FG]], [['  └ 2 files changed, 41 insertions(+)', DIM]]];

// --- motion events for post.js: punch (zoom kick), shake (px), rgb (color split px), slice, bolt ---
export const HITS = [];
const hit = (t, o) => HITS.push({ t, ...o });
const env = (t, key, tau) => HITS.reduce((s, h) => s + (h[key] && t >= h.t ? h[key] * Math.exp(-(t - h.t) / tau) : 0), 0);

// --- cues for the music: every keystroke, Enter, done, delete-all and cut that is on screen ---
export const CUES = [];

// --- type ---
function slam(c, text, x, y, size, color, t0, t, { style = 'plain', align = 'left', weight = 850, glow = 0.55, track = -0.02 } = {}) {
  if (t < t0) return;
  const dt = t - t0;
  let a = 1;                                      // whole on its first frame: the overshoot is the motion
  if (style === 'neon') {                         // a tube flickering on: on, off, on, dim, on
    const k = [[0.035, 0.7], [0.08, 0.05], [0.13, 0.9], [0.19, 0.3], [1e9, 1]].find(([e]) => dt < e)[1];
    a = k;
  }
  const s = style === 'neon' ? 1 : 1 + 0.22 * Math.exp(-dt / 0.06);
  c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(s, s);
  c.font = `${style === 'neon' ? 650 : weight} ${size}px ${SANS}`; c.textAlign = align; c.textBaseline = 'alphabetic';
  c.letterSpacing = `${track * size}px`;
  let shown = text;
  if (style === 'cyber') {                        // letters decrypt one by one through random glyphs
    const G = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*+=<>/\\';
    const f = Math.floor(t * 30);
    shown = [...text].map((ch, i) => (dt > 0.05 + i * 0.045 || ch === ' ') ? ch : G[(f * 7 + i * 13) % G.length]).join('');
  }
  const tw = c.measureText(shown).width, x0 = align === 'center' ? -tw / 2 : 0, cap = size * 0.72;
  if (style === 'glitch' && dt < 0.45) {          // offset magenta / cyan copies that settle
    const f = Math.floor(t * 30), j = k => ((f * 9301 + k * 49297) % 233280) / 233280 - 0.5;
    const amp = size * 0.06 * (1 - dt / 0.45);
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(214,157,231,0.55)'; c.fillText(shown, j(1) * amp * 2, j(2) * amp * 0.3);
    c.fillStyle = 'rgba(110,206,218,0.55)'; c.fillText(shown, j(3) * amp * 2, j(4) * amp * 0.3);
    c.globalCompositeOperation = 'source-over';
  }
  if (style === 'lightning' && dt < 0.25) c.translate((Math.sin(t * 190) * 0.5) * size * 0.02 * (1 - dt / 0.25), 0);
  if (style === 'neon') {                         // letters as glowing tubes: a colored tube, a hot core
    c.lineJoin = 'round';
    c.shadowColor = color; c.shadowBlur = size * 0.32;
    c.lineWidth = size * 0.05; c.strokeStyle = color; c.strokeText(shown, 0, 0);
    c.shadowBlur = size * 0.08; c.lineWidth = size * 0.017; c.strokeStyle = '#ffe6f6'; c.strokeText(shown, 0, 0);
    c.restore(); return;
  }
  c.shadowColor = color; c.shadowBlur = size * 0.25 * glow;
  c.fillStyle = color; c.fillText(shown, 0, 0);
  c.shadowBlur = 0;
  if (style === 'mecha') {                        // targeting brackets close in on the word, a scan runs down it
    const k = 1 + 0.25 * (1 - easeOut(dt / 0.2)), pad = size * 0.16, L = size * 0.2;
    const bx0 = x0 - pad, bx1 = x0 + tw + pad, by0 = -cap - pad, by1 = pad;
    const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
    c.save(); c.translate(cx, cy); c.scale(k, k); c.translate(-cx, -cy);
    c.strokeStyle = BEAM; c.lineWidth = size * 0.028; c.shadowColor = BEAM; c.shadowBlur = size * 0.12;
    for (const [px, py, dx, dy] of [[bx0, by0, 1, 1], [bx1, by0, -1, 1], [bx0, by1, 1, -1], [bx1, by1, -1, -1]]) {
      c.beginPath(); c.moveTo(px + dx * L, py); c.lineTo(px, py); c.lineTo(px, py + dy * L); c.stroke();
    }
    c.restore();
    const u = dt / 0.3;
    if (u < 1) { c.fillStyle = BEAM; c.globalAlpha = a * (1 - u); c.fillRect(bx0, by0 + (by1 - by0) * u, bx1 - bx0, size * 0.02); }
  }
  c.restore();
}

function label(c, text, x, y, t0, t, { size = 46, color = INK, sub = '', subColor = SOFT, dot = null } = {}) {
  if (t < t0) return;
  const a = clamp((t - t0) / 0.06);
  c.save(); c.globalAlpha = a; c.font = `750 ${size}px ${SANS}`; c.letterSpacing = `${size * 0.12}px`; c.textBaseline = 'middle';
  let xx = x;
  if (dot) { c.beginPath(); c.arc(x + size * 0.32, y, size * 0.26, 0, Math.PI * 2); c.fillStyle = dot; c.fill(); xx += size; }
  c.fillStyle = color; c.fillText(text, xx, y);
  if (sub) { const w = c.measureText(text).width; c.letterSpacing = '0px'; c.font = `450 ${size}px ${SANS}`; c.fillStyle = subColor; c.fillText(sub, xx + w + size * 0.6, y); }
  c.restore();
}
// The latest chip that has started: [t, text, sub]
function chips(c, t, list, x, y, color) {
  let k = -1; list.forEach(([tt], i) => { if (t >= tt) k = i; });
  if (k >= 0) label(c, list[k][1], x, y, list[k][0], t, { sub: list[k][2], dot: color });
}
function line(c, text, x, y, t0, t, { size = 58, color = INK, weight = 450, align = 'left', font = SANS } = {}) {
  if (t < t0) return;
  const a = Math.min(1, 0.45 + easeOut((t - t0) / 0.15));   // readable on its first frame
  c.save(); c.globalAlpha = a; c.font = `${weight} ${size}px ${font}`; c.fillStyle = color; c.textAlign = align;
  c.fillText(text, x, y + (1 - a) * size * 0.25); c.restore();
}

function bg(c, accent, glow = 0.09) {
  c.fillStyle = '#0e0e10'; c.fillRect(0, 0, W, H);
  if (accent) {
    const n = parseInt(accent.slice(1), 16);
    const g = c.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, W * 0.55);
    g.addColorStop(0, `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${glow})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
}

// A small showreel HUD, top right: timecode, tempo, a 16-step sequencer on the beat.
function hud(c, t, color) {
  const x = W - 240, y = 150, step = Math.floor(t / S16 + 1e-6) % 16;
  const s = Math.floor(t), f = Math.floor(t * 60) % 60;
  c.save(); c.textAlign = 'right'; c.textBaseline = 'middle'; c.font = `500 40px ${MONO}`; c.fillStyle = SOFT;
  c.fillText(`00:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}   ${GRID.bpm} BPM`, x, y);
  for (let i = 0; i < 16; i++) {
    c.fillStyle = i === step ? color : i % 4 === 0 ? 'rgba(236,230,216,0.34)' : 'rgba(236,230,216,0.15)';
    c.fillRect(x - (15 - i) * 30 - 18, y + 46, 18, 18);
  }
  c.restore();
}

// --- shots ---
export const SHOTS = [];
const add = s => { SHOTS.push(s); return s; };
// Cues: the events of a take that happen while it is on screen.
const cue = (o, events) => {
  // (an Enter fires up to SETTLE before the shot that shows it starts)
  for (const e of events) if (e.t >= o.t0 - 0.06 && e.t < o.t1 && e.type !== 'out' && !CUES.some(q => q.type === e.type && Math.abs(q.t - e.t) < 1e-3))
    CUES.push({ t: +e.t.toFixed(4), type: e.type, fx: o.fx });
  if (o.t0 > 0) CUES.push({ t: o.t0, type: o.trans ? 'trans' : 'cut', fx: o.fx });
};

// A take in the big terminal window. screen/screenOpts: another screen (zsh) instead of Claude Code.
function wide(o) {
  cue(o, o.events);
  return add({ t0: o.t0, t1: o.t1, trans: o.trans, fx: o.fx, focus: o.focus || [0.3, 0.42], draw(c, t) {
    const e = EFFECTS[o.fx];
    const opts = o.screen ? o.screenOpts : { before: BEFORE, answer: o.answer };
    const { img } = renderTake(o.fx, WIDE, o.events, t, o.screen || null, opts);
    bg(c, e.color);
    termWindow(c, img, WIN[0], WIN[1], { k: K, title: o.title || 'claude' });
    if (o.chips) chips(c, t, o.chips, WIN[0], WIN[1] - 70, e.color);
    if (o.over) o.over(c, t);
    hud(c, t, e.color);
  } });
}
// Full-bleed close-up or macro. tOff shifts the shader clock (to catch a timed look, like mecha's lock-on).
function full(o) {
  cue(o, o.events);
  return add({ t0: o.t0, t1: o.t1, trans: o.trans, fx: o.fx, focus: o.focus || [0.5, 0.55], draw(c, t) {
    const e = EFFECTS[o.fx];
    const { img } = renderTake(o.fx, o.view, o.events, t + (o.tOff || 0), null, { status: false, before: [] });
    c.drawImage(img, 0, 0);
    const g = c.createLinearGradient(0, H * 0.62, 0, H); g.addColorStop(0, 'rgba(10,10,12,0)'); g.addColorStop(1, 'rgba(10,10,12,0.72)');
    c.fillStyle = g; c.fillRect(0, H * 0.62, W, H * 0.38);
    if (o.chips) chips(c, t, o.chips, 300, 150, e.color);
    if (o.over) o.over(c, t);
    hud(c, t, e.color);
  } });
}
const NAME = (n, t0, x = 300, y = 2000, size = 300) => (c, t) => slam(c, EFFECTS[n].name.toUpperCase(), x, y, size, EFFECTS[n].color, t0, t, { style: n });

// ============ 1. Intro (bars 0-4): five living cursors, then the prompt, the cursor changing each beat ============
const PORTRAITS = [['cyber', 'glyph rain inside the cursor'], ['lightning', 'arcs of current crawl around it'],
  ['glitch', 'a corrupted signal that tears'], ['mecha', 'armor plates and sensor eyes'], ['neon', 'a neon tube that breathes']];
PORTRAITS.forEach(([n, sub], i) => {
  const t0 = bar(0, 2 * i);
  full({ fx: n, t0, t1: t0 + 2 * BEAT, view: macro(1), events: [], tOff: n === 'mecha' ? 1.0 : 0, focus: [0.5, 0.52],
    over(c, t) { NAME(n, t0, 300, 1900, 260)(c, t); line(c, sub, 306, 2010, t0 + 0.08, t, { size: 64 }); } });
  if (i) hit(t0, { punch: 0.5, rgb: n === 'glitch' ? 14 : 6, slice: n === 'glitch' ? 0.6 : 0 });
});
const P1 = 'make it legendary';
const P1_KEYS = keysAt(P1, [...every(bar(2, 2), E8, 5), ...every(bar(3, 0.5), S16, P1.length - 5)]);
wide({ fx: 'lightning', t0: bar(2, 2), t1: bar(3, 1), events: P1_KEYS, trans: { type: 1, dur: 0.2 },
  chips: [[bar(2, 2), 'TYPING', 'in Claude Code']] });
hit(bar(2, 2), { punch: 0.4 });
const TEASE = [['cyber', bar(3, 1)], ['glitch', bar(3, 2)], ['neon', bar(3, 2.5)], ['mecha', bar(3, 3)]];
TEASE.forEach(([n, t0], i) => {
  full({ fx: n, t0, t1: i < TEASE.length - 1 ? TEASE[i + 1][1] : bar(3, 3.5), view: CLOSE(260, 280), events: P1_KEYS,
    chips: [[t0, EFFECTS[n].name.toUpperCase(), '']] });
  hit(t0, { punch: 0.5, rgb: n === 'glitch' ? 12 : 4, slice: n === 'glitch' ? 0.6 : 0 });
});

// ============ 2. Drop (bar 4): Enter fires the surge, the title lands, done comes back in ============
wide({ fx: 'lightning', t0: bar(3, 3.5), t1: bar(5),
  events: [...P1_KEYS, { t: DROP - SETTLE, type: 'enter' }, { t: bar(4, 3) - HIT, type: 'done' }],
  answer: 'Done: your cursor has thirteen new looks.',
  chips: [[bar(3, 3.5), 'READY', ''], [DROP, 'ENTER', 'prompt sent'], [bar(4, 3), 'DONE', 'the answer arrived']],
  over(c, t) {
    slam(c, 'CURSOR FX', W / 2, 330, 250, INK, bar(4, 1.5), t, { align: 'center', weight: 900, glow: 0 });
    slam(c, 'for Ghostty', W / 2, 452, 84, SOFT, bar(4, 2.25), t, { align: 'center', weight: 500, glow: 0, track: 0 });
  } });
hit(bar(3, 3.5), { punch: 0.3 });
hit(DROP, { punch: 1.6, shake: 22, rgb: 16, bolt: 1.0 });
hit(bar(4, 1.5), { punch: 0.45 });
hit(bar(4, 3), { punch: 0.7, shake: 8, rgb: 8 });

// ============ 3. Lightning (bars 5-6): sparks while typing; delete-all; Enter ============
full({ fx: 'lightning', t0: bar(5), t1: bar(6), view: CLOSE(300), trans: { type: 1, dur: 0.2 },
  events: [...prefill('f', bar(5)), ...keysAt('ix the login bug', every(bar(5), S16, 16))],
  chips: [[bar(5), 'TYPING', 'sparks fly off every key']], over: NAME('lightning', bar(5)) });
hit(bar(5), { punch: 0.6, bolt: 0.6 });
wide({ fx: 'lightning', t0: bar(6), t1: bar(7),
  events: [...prefill('fix the login bug', bar(6)), { t: bar(6, 0.5) - JUMP_SETTLE, type: 'clear' },
           ...keysAt('ship it', every(bar(6, 1), S16, 7)), { t: bar(6, 3) - HIT, type: 'enter' }],
  chips: [[bar(6, 0.5), 'DELETE-ALL', 'a bolt runs along the line'], [bar(6, 1), 'TYPING', ''], [bar(6, 3), 'ENTER', 'a surge of current along the input box']] });
hit(bar(6, 0.5), { punch: 0.8, shake: 12, rgb: 8, bolt: 0.5 });
hit(bar(6, 3), { punch: 1.0, shake: 14, rgb: 10 });

// ============ 4. Cyber (bars 7-8): every letter decrypts; data rain; your text in green ============
full({ fx: 'cyber', t0: bar(7), t1: bar(8), view: CLOSE(300), trans: { type: 3, dur: 0.3 },
  events: [...prefill('deploy', bar(7)), ...keysAt(' to prod', every(bar(7), E8, 8))],
  chips: [[bar(7), 'TYPING', 'every letter decrypts']], over: NAME('cyber', bar(7)) });
wide({ fx: 'cyber', t0: bar(8), t1: bar(9),
  events: [...prefill('deploy to prod', bar(8)), { t: bar(8) - SETTLE, type: 'enter' }],
  chips: [[bar(8), 'ENTER', 'data rain through the input box'], [bar(8, 2.5), 'YOUR TEXT', "in the cursor's color"]] });
hit(bar(8), { punch: 1.2, shake: 16, rgb: 10 });
hit(bar(8, 2.5), { punch: 0.35 });

// ============ 5. Glitch (bars 9-11): tearing keys; Enter and done in slices; the cursor; stutter, power down ============
full({ fx: 'glitch', t0: bar(9), t1: bar(10), view: CLOSE(300), trans: { type: 2, dur: 0.18 },
  events: [...prefill('w', bar(9)), ...keysAt('hy is it broken?', every(bar(9), S16, 16))],
  chips: [[bar(9), 'TYPING', 'the cursor tears into slices']], over: NAME('glitch', bar(9)) });
[0, 1, 2, 3].forEach(b => hit(bar(9, b), { slice: 0.5, rgb: 8 }));
wide({ fx: 'glitch', t0: bar(10), t1: bar(11), trans: { type: 2, dur: 0.14 },
  events: [...prefill('why is it broken?', bar(10)), { t: bar(10) - HIT, type: 'enter' }, { t: bar(10, 2) - HIT, type: 'done' }],
  answer: 'Found it: a stale lockfile.',
  chips: [[bar(10), 'ENTER', 'the lines break into slices'], [bar(10, 2), 'DONE', 'when the answer lands, in from the edges']] });
hit(bar(10), { punch: 1.1, shake: 14, rgb: 18, slice: 1.0 });
hit(bar(10, 2), { punch: 0.9, rgb: 14, slice: 0.8 });
full({ fx: 'glitch', t0: bar(11), t1: BREAK, view: macro(1), trans: { type: 2, dur: 0.16 },
  events: [...prefill('o', bar(11)), ...keysAt('k', [bar(11, 1)])],
  chips: [[bar(11), 'CURSOR', 'a corrupted signal, all the time']] });
[0, 1].forEach(b => hit(bar(11, b), { slice: 0.6, rgb: 12, punch: 0.3 }));
every(bar(11, 2), S16 / 2, 8).forEach(t => hit(t, { slice: 0.55, rgb: 10 }));   // the stutter (music: 32nd repeats)
const POWER_DOWN = [bar(11, 3), BREAK];                                         // the tape stop

// ============ 6. Break (bars 12-13): the settings panel; zsh ============
const PANEL = { t0: BREAK, t1: bar(13), dir: 'capture/showcase-panel' };
let panelImg = null, panelIdx = -1;
// Loads the panel frame a time needs (one at a time: 4K frames are big).
export async function beforeFrame(t) {
  if (t < PANEL.t0 - 0.2 || t >= PANEL.t1 + 0.2) return;
  const i = Math.max(0, Math.round((t - PANEL.t0) * 60));
  if (i === panelIdx) return;
  const img = new Image(); img.src = `${PANEL.dir}/${String(i).padStart(4, '0')}.jpg`;
  try { await img.decode(); panelImg = img; panelIdx = i; } catch { /* past the last frame: keep the previous */ }
}
add({ t0: PANEL.t0, t1: PANEL.t1, fx: 'cyber', focus: [0.5, 0.48], draw(c, t) {
  bg(c, '#50e080', 0.06);
  // a slow push toward the preview and the Cursor section
  const k = 1 + 0.12 * ease((t - PANEL.t0) / (PANEL.t1 - PANEL.t0));
  const pw = 2880, ph = 1620, x = (W - pw) / 2, y = 420, ox = x + 0.45 * pw, oy = y + 0.3 * ph;
  c.save(); c.translate(ox, oy); c.scale(k, k); c.translate(-ox, -oy);
  c.save(); c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 120; c.shadowOffsetY = 48;
  c.fillStyle = '#1b1b1d'; c.fillRect(x, y, pw, ph); c.restore();
  if (panelImg) c.drawImage(panelImg, x, y, pw, ph);
  c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, pw - 2, ph - 2);
  c.restore();
  c.fillStyle = '#0e0e10'; c.fillRect(0, 0, W, 380);   // the titles stay clear of the pushed-in panel
  line(c, 'Every part has a switch', W / 2, 230, PANEL.t0, t, { size: 110, weight: 700, align: 'center' });
  line(c, 'cursor-fx edit  ·  a live preview, saved to Ghostty as you go', W / 2, 330, PANEL.t0 + 0.15, t, { size: 54, color: SOFT, align: 'center' });
} });
CUES.push({ t: PANEL.t0, type: 'cut', fx: 'panel' });
// what capture-showcase-panel.mjs does on its frames: "ship it" on 16ths, Enter on beat 2, the Cursor switch off and on
[...'ship it'].forEach((ch, i) => CUES.push({ t: PANEL.t0 + Math.round(i * S16 * 60) / 60, type: 'key', fx: 'panel' }));
CUES.push({ t: PANEL.t0 + 1.0, type: 'enter', fx: 'panel' });
[84, 105].forEach(f => CUES.push({ t: PANEL.t0 + f / 60, type: 'switch', fx: 'panel' }));
const ZSH_BEFORE = [[...zshPrompt(), ['git pull', FG]], [['Already up to date.', FG]], [...zshPrompt(), ['git status --short', FG]], [[' M src/app.ts', FG]]];
wide({ fx: 'embers', t0: bar(13), t1: DROP2, title: 'zsh', screen: shellScreen,
  screenOpts: { before: ZSH_BEFORE, out: [] },
  events: [...prefill('npm run bu', bar(13)), ...keysAt('ild', every(bar(13), E8, 3)), { t: bar(13, 2) - HIT, type: 'enter' }],
  chips: [[bar(13), 'TYPING', ''], [bar(13, 2), 'ENTER', 'every command you run']],
  over(c, t) { line(c, 'Works in zsh too', W / 2, 330, bar(13), t, { size: 110, weight: 700, align: 'center' }); } });
hit(bar(13), { punch: 0.3 });
hit(bar(13, 2), { punch: 0.8, shake: 8, rgb: 6 });

// ============ 7. Mecha (bars 14-16): energy blades on the drop; thrusters both ways; the prompt mark; done ============
wide({ fx: 'mecha', t0: DROP2, t1: bar(15),
  events: [...prefill('clean up old branches', DROP2), { t: DROP2 - SETTLE, type: 'enter' }],
  chips: [[DROP2, 'ENTER', 'energy blades ignite along the input box']], over: NAME('mecha', bar(14, 0.5), 260, 360, 190) });
hit(DROP2, { punch: 1.8, shake: 24, rgb: 14, bolt: 1.0, boltColor: [0.36, 0.84, 1.0] });
hit(bar(14, 0.5), { punch: 0.45 });
const MECHA_KEYS = [...prefill('deploy', bar(15)), ...keysAt(' now', every(bar(15), E8, 4)),
  ...every(bar(15, 2), E8, 3).map(t => ({ t, type: 'back' }))];
full({ fx: 'mecha', t0: bar(15), t1: bar(16), view: CLOSE(300), trans: { type: 1, dur: 0.2 }, events: MECHA_KEYS,
  chips: [[bar(15), 'TYPING', 'a thruster burst behind the cursor'], [bar(15, 2), 'BACKSPACE', 'it fires from the right']] });
every(bar(15, 2), E8, 3).forEach(t => hit(t, { punch: 0.3, shake: 5 }));
full({ fx: 'mecha', t0: bar(16), t1: bar(16, 2), view: macro(1), events: [], trans: { type: 1, dur: 0.16 },
  chips: [[bar(16), 'PROMPT MARK', 'a targeting chevron that locks on']] });       // the lock-on runs at clock 132 = t 32.0
wide({ fx: 'mecha', t0: bar(16, 2), t1: bar(17),
  events: [...prefill('clean up old branches', DROP2), { t: DROP2 - SETTLE, type: 'enter' }, { t: bar(16, 2) - HIT, type: 'done' }],
  answer: 'Cleaned up 14 merged branches.', chips: [[bar(16, 2), 'DONE', 'two blades from the edges meet']] });
hit(bar(16, 2), { punch: 0.9, shake: 12, rgb: 8 });

// ============ 8. Neon (bars 17-18): the tube flickers back on after each key; the lines light up ============
full({ fx: 'neon', t0: bar(17), t1: bar(18), view: CLOSE(300), trans: { type: 1, dur: 0.2 },
  events: [...prefill('make the l', bar(17)), ...keysAt('ogo glow', every(bar(17), E8, 8))],
  chips: [[bar(17), 'TYPING', 'the tube flickers back on after every key']], over: NAME('neon', bar(17)) });
wide({ fx: 'neon', t0: bar(18), t1: bar(19),
  events: [...prefill('make the logo glow', bar(18)), { t: bar(18) - HIT, type: 'enter' }, { t: bar(18, 2) - HIT, type: 'done' }],
  answer: 'The logo glows now.', chips: [[bar(18), 'ENTER', 'the lines light up as neon tubes'], [bar(18, 2), 'DONE', '']] });
hit(bar(18), { punch: 1.0, shake: 10, rgb: 8 });
hit(bar(18, 2), { punch: 0.7, shake: 6 });

// ============ 9. The others, one Enter each on the beat (bars 19-22) ============
const MONTAGE = ['phosphor', 'shockwave', 'katana', 'teleport', 'fireworks', 'aurora', 'hologram'];
MONTAGE.forEach((n, i) => {
  const t0 = bar(19, 2 * i), e = EFFECTS[n];
  wide({ fx: n, t0, t1: t0 + 2 * BEAT, events: [...prefill('ship it', t0), { t: t0 - HIT, type: 'enter' }],
    over(c, t) {
      slam(c, e.name.toUpperCase(), 240, 1960, 170, e.color, t0, t, { weight: 850, glow: 0.4 });
      line(c, e.line.split(' · ')[1].replace(/^./, ch => ch.toUpperCase()), 246, 2060, t0 + 0.06, t, { size: 56 });
    } });
  hit(t0, { punch: 0.7, shake: 8, rgb: 6 });
});

// ============ 10. All thirteen (bars 22.5-24): Enter cascades across the grid, then done ============
{
  const t0 = bar(22, 2), TILE = { W: 640, H: 300, CH: 40, padY: 10 - 2 * 40 };
  const tileEv = i => [...prefill('ship it', t0), { t: t0 + 0.25 + i * S16 / 2 - HIT, type: 'enter' }, { t: bar(23, 2) - HIT, type: 'done' }];
  add({ t0, t1: OUTRO, fx: 'grid', trans: { type: 1, dur: 0.22 }, focus: [0.5, 0.5], draw(c, t) {
    bg(c, null);
    const gx = 48, x0 = (W - (5 * TILE.W + 4 * gx)) / 2, y0 = 560;
    ALL.forEach((n, i) => {
      const r = Math.floor(i / 5), inRow = r < 2 ? 5 : ALL.length - 10, col = i % 5;
      const x = x0 + (5 - inRow) * (TILE.W + gx) / 2 + col * (TILE.W + gx), y = y0 + r * 420;
      const { img } = renderTake(n, TILE, tileEv(i), t, null, { before: BEFORE, answer: 'Shipped.' });
      const a = ramp(t, t0 + i * S16 / 2 - 0.05, t0 + i * S16 / 2 + 0.12);
      c.save(); c.globalAlpha = a; c.drawImage(img, x, y);
      c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, TILE.W - 2, TILE.H - 2);
      c.font = `650 44px ${SANS}`; c.fillStyle = EFFECTS[n].color; c.fillText(EFFECTS[n].name, x + 4, y + TILE.H + 62); c.restore();
    });
    line(c, 'Thirteen effects', W / 2, 260, t0, t, { size: 130, weight: 750, align: 'center' });
    line(c, 'switch with one command:  cursor-fx <name>', W / 2, 380, t0 + 0.12, t, { size: 60, color: SOFT, align: 'center', font: MONO, weight: 500 });
    hud(c, t, '#ece6d8');
  } });
  CUES.push({ t: t0, type: 'trans', fx: 'grid' });
  ALL.forEach((n, i) => CUES.push({ t: +(t0 + 0.25 + i * S16 / 2 - HIT).toFixed(4), type: 'tile', fx: n }));
  CUES.push({ t: bar(23, 2) - HIT, type: 'done', fx: 'grid' });
  hit(t0, { punch: 0.4 });
  hit(bar(23, 2), { punch: 0.8, shake: 10, rgb: 6 });
}

// ============ 11. Outro (bars 24-28): the name, the install, where to get it ============
{
  const CARD = { W: 2600, H: 470, CH: 82, padY: 30 };   // five rows: install, its output, the switch, its output, the prompt
  const OUT1 = [[['Installed into ~/.config/ghostty (shaders/, cursor-effects/) and ~/.local/bin/cursor-fx.', DIM]]];   // install.sh's own words
  const tEnter1 = bar(24, 3), tEnter2 = bar(25, 3);
  const ev1 = [...typeKeys('./install.sh', bar(24, 1), S16 / 2), { t: tEnter1 - HIT, type: 'enter' }, { t: tEnter1 + 0.35, type: 'out' }];
  const ev2 = [...typeKeys('cursor-fx cyber', bar(25), S16 / 2), { t: tEnter2 - HIT, type: 'enter' }, { t: tEnter2 + 0.6, type: 'out' }];
  const DIRP = zshPrompt('~/ghostty-cursor-fx');
  const BEFORE2 = [[...DIRP, ['./install.sh', FG]], ...OUT1];
  const OUT2 = [[['Cursor effect: cyber (cursor #50e080)', DIM]]];
  for (const e of [...ev1, ...ev2]) if (e.type !== 'out') CUES.push({ t: +e.t.toFixed(4), type: e.type, fx: 'cyber' });
  CUES.push({ t: OUTRO, type: 'cut', fx: 'outro' });
  const FEATURES = [['Thirteen effects', '#50e080'], ['Typing, Enter and done', '#9fd0fe'], ['A live settings panel', '#ff5ed2'], ['Claude Code and zsh', '#bcc8dc']];
  add({ t0: OUTRO, t1: END, fx: 'outro', focus: [0.5, 0.5], draw(c, t) {
    bg(c, '#50e080', 0.05);
    slam(c, 'CURSOR FX', W / 2, 470, 280, INK, OUTRO, t, { align: 'center', weight: 900, glow: 0 });
    slam(c, 'for Ghostty', W / 2, 600, 92, SOFT, bar(24, 0.5), t, { align: 'center', weight: 500, glow: 0, track: 0 });
    const second = t >= bar(25) - 0.001;
    const { img } = second
      ? renderTake('cyber', CARD, ev2, t, shellScreen, { before: BEFORE2, out: OUT2, dir: '~/ghostty-cursor-fx' })
      : renderTake('cyber', CARD, ev1, t, shellScreen, { before: [], out: OUT1, dir: '~/ghostty-cursor-fx' });
    const a = ramp(t, bar(24, 0.75), bar(24, 1));
    c.save(); c.globalAlpha = a; termWindow(c, img, (W - CARD.W) / 2, 760, { k: K, title: 'zsh' }); c.restore();
    // the features, one per 8th
    const fw = 760, fx0 = W / 2 - 2 * fw;
    FEATURES.forEach(([txt, col], i) => {
      const t1 = bar(25, 2.5) + i * E8; if (t < t1) return;
      const k = easeOut((t - t1) / 0.18);
      c.save(); c.globalAlpha = k; c.textAlign = 'center'; c.textBaseline = 'middle';
      const cx = fx0 + (i + 0.5) * fw, cy = 1560 + (1 - k) * 18;
      c.beginPath(); c.arc(cx, cy - 70, 14, 0, Math.PI * 2); c.fillStyle = col; c.fill();
      c.font = `600 56px ${SANS}`; c.fillStyle = INK; c.fillText(txt, cx, cy); c.restore();
    });
    line(c, 'ghostty-cursor-fx', W / 2, 1840, bar(26, 0.5), t, { size: 104, weight: 500, align: 'center', font: MONO, color: '#50e080' });
    line(c, 'Free and open source on GitHub', W / 2, 1950, bar(26, 1), t, { size: 60, weight: 600, align: 'center' });
    line(c, 'MIT license  ·  macOS and Linux  ·  Ghostty 1.4+', W / 2, 2040, bar(26, 1.5), t, { size: 46, color: SOFT, align: 'center' });
  } });
  hit(OUTRO, { punch: 1.4, shake: 18, rgb: 10 });
  hit(tEnter1, { punch: 0.4 });
  hit(tEnter2, { punch: 0.6, shake: 6 });
  hit(bar(26, 0.5), { punch: 0.3 });
}
CUES.sort((a, b) => a.t - b.t);

// --- frame: composite A (and B in a transition) + post parameters ---
const shotAt = t => SHOTS.find(s => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];
export function frame(t, ca, cb) {
  const s = shotAt(t), i = SHOTS.indexOf(s);
  let a = s, b = null, mix = 0, type = 0, blur = 0;
  const next = SHOTS[i + 1];
  if (next && next.trans && t >= next.t0 - next.trans.dur / 2) { a = s; b = next; }
  else if (s.trans && t < s.t0 + s.trans.dur / 2 && i > 0) { a = SHOTS[i - 1]; b = s; }
  const ctxA = ca.getContext('2d'), ctxB = cb.getContext('2d');
  ctxA.save(); a.draw(ctxA, t); ctxA.restore();
  if (b) {
    ctxB.save(); b.draw(ctxB, t); ctxB.restore();
    const p = clamp((t - (b.t0 - b.trans.dur / 2)) / b.trans.dur);
    type = b.trans.type; mix = ease(p);
    blur = type === 1 ? Math.sin(Math.PI * p) * 0.25 : 0;
  }
  const cur = b && mix > 0.5 ? b : a;
  const n = Math.floor(t * 60);
  const pn = k => Math.sin(n * 12.9898 + k * 78.233) * 43758.5453 % 1;
  const shake = env(t, 'shake', 0.12);
  const bh = HITS.filter(h => h.bolt && t >= h.t).pop();
  // the tape stop before the break: the picture powers down (dims, never flashes)
  const pd = t < POWER_DOWN[1] ? ramp(t, POWER_DOWN[0], POWER_DOWN[1]) : 0;
  return {
    a: ca, b: b ? cb : null,
    post: {
      time: t, type, mix, blur,
      zoom: (1 + 0.06 * env(t, 'punch', 0.09)) * (1 + 0.03 * clamp((t - cur.t0) / (cur.t1 - cur.t0))) * (1 - 0.05 * ease(pd)),
      focus: cur.focus,
      shake: [shake * pn(1), shake * pn(2)],
      rgb: env(t, 'rgb', 0.1) + 10 * pd,
      slice: Math.min(1, env(t, 'slice', 0.07) + 0.5 * pd),
      bolt: bh ? bh.bolt * Math.exp(-(t - bh.t) / 0.07) : 0,
      boltY: bh ? 0.35 + 0.3 * ((bh.t * 7.13) % 1) : 0.5,
      boltColor: bh && bh.boltColor,
      seed: bh ? bh.t : 0,
      fade: Math.max(1 - clamp(t / 0.5), clamp((t - (END - 0.8)) / 0.8), 0.75 * ease(pd)),
    },
  };
}
export const DURATION = END;
