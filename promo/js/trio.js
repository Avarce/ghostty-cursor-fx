// The trio cut: lightning, cyber, glitch on the same song, ~39 s, 3840x2160.
// Each shot draws a 2D composite (real shader frames + type); post.js adds the motion
// (punches, shake, color split, slices, transitions). Times are video seconds on the grid.
import { EFFECTS } from './effects.js';
import { BG, FG, DIM, CUR_TEXT, claudeScreen } from './term.js';
import { termWindow, clamp, ease, ramp, SANS, INK, SOFT } from './comp.js';
import { bar, BEAT, E8, S16, DROP, SETTLE, HIT, JUMP_SETTLE } from './timeline.js';
import { getTerm, renderTake, prefill, keysAt, every } from './scenes.js';

export const W = 3840, H = 2160, K = 2;
export const END = bar(13);                      // 38.95 s
export const URL_TEXT = 'github.com/YOUR-NAME/ghostty-cursor-fx';
const STOP = bar(5, 1), BASS_GAP = 33.85, SLAM = bar(10, 3);   // measured: rap stop ends 23.07, bass gap 33.85-34.3, return 34.34

// --- views (4K). Wide terminals show rows 2-8 (input box, status) big. ---
const WIDE = { W: 3360, H: 1118, CH: 150, padY: 34 - 2 * 150 };
const WIN = [240, 560];
const CLOSE = (padX = 300, CH = 330) => ({ W, H, CH, padX, padY: Math.round(980 - 6.5 * CH) });
const MACRO = { W, H, CH: 600, padX: 0, padY: Math.round(1000 - 6.5 * 600) };
const macro = (col = 2) => { const t = getTerm(MACRO); return { ...MACRO, padX: Math.round(W / 2 - (col + 0.5) * t.CW) }; };
const TRI = { W: 1240, H, CH: 300, padX: 120, padY: Math.round(1000 - 6.5 * 300) };
const COL = { W: 1160, H: 636, CH: 84, padY: 24 - 2 * 84 };
const BEFORE = [[], [], [['⏺ ', FG], ['Updated install.sh and the README.', FG]], [['  └ 2 files changed, 41 insertions(+)', DIM]]];

// --- the prompt typed during the build: "make the" on 8ths, the rest on 16ths ---
const PROMPT = 'make the cursor effects awesome';
const PROMPT_KEYS = keysAt(PROMPT, [...every(bar(-3, 0.5), E8, 8), ...every(bar(-2) + S16, S16, PROMPT.length - 8)]);

// --- motion events for post.js ---
// punch: zoom kick; shake: px; rgb: color split px; slice: glitch bands; bolt: lightning streak.
export const HITS = [];
const hit = (t, o) => HITS.push({ t, ...o });
const env = (t, key, tau) => HITS.reduce((s, h) => s + (h[key] && t >= h.t ? h[key] * Math.exp(-(t - h.t) / tau) : 0), 0);

// --- type ---
function slam(c, text, x, y, size, color, t0, t, { style = 'plain', align = 'left', weight = 850, glow = 0.55, track = -0.02 } = {}) {
  if (t < t0) return;
  const dt = t - t0, a = clamp(dt / 0.05);
  const s = 1 + 0.22 * Math.exp(-dt / 0.06);
  c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(s, s);
  c.font = `${weight} ${size}px ${SANS}`; c.textAlign = align; c.textBaseline = 'alphabetic';
  c.letterSpacing = `${track * size}px`;
  let shown = text;
  if (style === 'cyber') {                        // letters decrypt one by one through random glyphs
    const G = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*+=<>/\\';
    const f = Math.floor(t * 30);
    shown = [...text].map((ch, i) => (dt > 0.05 + i * 0.045 || ch === ' ') ? ch : G[(f * 7 + i * 13) % G.length]).join('');
  }
  if (style === 'glitch' && dt < 0.45) {          // offset magenta / cyan copies that settle
    const f = Math.floor(t * 30), j = (k) => ((f * 9301 + k * 49297) % 233280) / 233280 - 0.5;
    const amp = size * 0.06 * (1 - dt / 0.45);
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(214,157,231,0.55)'; c.fillText(shown, j(1) * amp * 2, j(2) * amp * 0.3);
    c.fillStyle = 'rgba(110,206,218,0.55)'; c.fillText(shown, j(3) * amp * 2, j(4) * amp * 0.3);
    c.globalCompositeOperation = 'source-over';
  }
  if (style === 'lightning' && dt < 0.25) c.translate((Math.sin(t * 190) * 0.5) * size * 0.02 * (1 - dt / 0.25), 0);
  c.shadowColor = color; c.shadowBlur = size * 0.25 * glow;
  c.fillStyle = color; c.fillText(shown, 0, 0);
  c.shadowBlur = 0;
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

function bg(c, accent, glow = 0.09) {
  c.fillStyle = '#0e0e10'; c.fillRect(0, 0, W, H);
  if (accent) {
    const n = parseInt(accent.slice(1), 16);
    const g = c.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, W * 0.55);
    g.addColorStop(0, `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${glow})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
}

// --- shots ---
export const SHOTS = [];
// focus: where punches zoom toward (uv, y up). trans: transition into this shot.
const add = s => { SHOTS.push(s); return s; };

// A take in the big terminal window.
function wide(o) {
  return add({ t0: o.t0, t1: o.t1, trans: o.trans, fx: o.fx, focus: o.focus || [0.3, 0.42], draw(c, t) {
    const e = EFFECTS[o.fx];
    const { img } = renderTake(o.fx, WIDE, o.events, t, null, { before: BEFORE, answer: o.answer });
    bg(c, e.color);
    termWindow(c, img, WIN[0], WIN[1], { k: K });
    if (o.chips) chips(c, t, o.chips, WIN[0], WIN[1] - 70, e.color);
    if (o.over) o.over(c, t);
  } });
}
// Full-bleed close-up or macro.
function full(o) {
  return add({ t0: o.t0, t1: o.t1, trans: o.trans, fx: o.fx, focus: o.focus || [0.5, 0.55], draw(c, t) {
    const e = EFFECTS[o.fx];
    const { img } = renderTake(o.fx, o.view, o.events, t, null, { status: false, before: [] });
    c.drawImage(img, 0, 0);
    const g = c.createLinearGradient(0, H * 0.62, 0, H); g.addColorStop(0, 'rgba(10,10,12,0)'); g.addColorStop(1, 'rgba(10,10,12,0.7)');
    c.fillStyle = g; c.fillRect(0, H * 0.62, W, H * 0.38);
    if (o.chips) chips(c, t, o.chips, 300, 150, e.color);
    if (o.over) o.over(c, t);
  } });
}
const NAME = (n, t0, style) => (c, t) => slam(c, EFFECTS[n].name.toUpperCase(), 300, 2000, 300, EFFECTS[n].color, t0, t, { style });

// 1. Build (bars -6..-1): three cursor portraits, then the prompt typed, faster and faster cuts.
full({ fx: 'lightning', t0: 0, t1: bar(-5), view: macro(2), events: [] });
full({ fx: 'cyber', t0: bar(-5), t1: bar(-4), view: macro(2), events: [], trans: { type: 3, dur: 0.3 } });
full({ fx: 'glitch', t0: bar(-4), t1: bar(-3), view: macro(2), events: [], trans: { type: 2, dur: 0.16 } });
[1, 2, 3].forEach(b => hit(bar(-4, b), { slice: 0.8, rgb: 10 }));
wide({ fx: 'lightning', t0: bar(-3), t1: bar(-2), events: PROMPT_KEYS, trans: { type: 1, dur: 0.22 },
  chips: [[bar(-3, 0.5), 'TYPING', 'in Claude Code']] });
full({ fx: 'lightning', t0: bar(-2), t1: bar(-1), view: CLOSE(260, 280), events: PROMPT_KEYS, trans: { type: 1, dur: 0.18 },
  chips: [[bar(-2), 'TYPING', 'sparks off every key']] });
// the montage: the same prompt, the cursor switching effect on the beat, then 8ths
[['cyber', 0, 1], ['glitch', 1, 2], ['lightning', 2, 2.5], ['cyber', 2.5, 3], ['glitch', 3, 3.5]].forEach(([n, a, b]) => {
  full({ fx: n, t0: bar(-1, a), t1: bar(-1, b), view: CLOSE(260, 280), events: PROMPT_KEYS });
  hit(bar(-1, a), { punch: 0.5, rgb: n === 'glitch' ? 12 : 4, slice: n === 'glitch' ? 0.6 : 0 });
});
wide({ fx: 'lightning', t0: bar(-1, 3.5), t1: DROP, events: PROMPT_KEYS, chips: [[bar(-1, 3.5), 'READY', '']] });
hit(bar(-1, 3.5), { punch: 0.4 });

// 2. The drop: Enter fires the surge; the title lands; done comes back in from the edges.
wide({ fx: 'lightning', t0: DROP, t1: bar(1), trans: null,
  events: [...PROMPT_KEYS, { t: DROP - SETTLE, type: 'enter' }, { t: bar(0, 3) - HIT, type: 'done' }],
  answer: 'Done: the cursor effects are live.',
  chips: [[DROP, 'ENTER', 'prompt sent'], [bar(0, 3), 'DONE', 'answer arrived, from the edges in']],
  over(c, t) {
    slam(c, 'CURSOR FX', W / 2, 330, 250, INK, bar(0, 1.5), t, { align: 'center', weight: 900, glow: 0 });
    slam(c, 'for Ghostty', W / 2, 452, 84, SOFT, bar(0, 2.25), t, { align: 'center', weight: 500, glow: 0, track: 0 });
  } });
hit(DROP, { punch: 1.6, shake: 22, rgb: 16, bolt: 1.0 });
hit(bar(0, 3), { punch: 0.7, shake: 8, rgb: 8 });

// 3. Lightning: rapid typing, select-all + delete bolt, Enter, done.
full({ fx: 'lightning', t0: bar(1), t1: bar(2), view: CLOSE(300), trans: { type: 1, dur: 0.2 },
  events: keysAt('fix the login bug', every(bar(1), S16, 16)),
  chips: [[bar(1), 'TYPING', 'sparks']], over: NAME('lightning', bar(1), 'lightning') });
wide({ fx: 'lightning', t0: bar(2), t1: bar(3),
  events: [...prefill('fix the login bug', bar(2)), { t: bar(2, 0.5) - JUMP_SETTLE, type: 'clear' }, ...keysAt('ship', every(bar(2, 1), S16, 4)),
           { t: bar(2, 2) - HIT, type: 'enter' }, { t: bar(2, 3) - HIT, type: 'done' }],
  answer: 'Fixed: the token refreshes now.',
  chips: [[bar(2, 0.5) - JUMP_SETTLE, 'SELECT ALL + DELETE', 'a bolt along the line'], [bar(2, 1), 'TYPING', ''], [bar(2, 2), 'ENTER', ''], [bar(2, 3), 'DONE', '']] });
hit(bar(2), { punch: 0.6, bolt: 0.8 });
hit(bar(2, 0.5), { punch: 0.8, shake: 12, rgb: 8 });
hit(bar(2, 2), { punch: 1.0, shake: 14, rgb: 10 });
hit(bar(2, 3), { punch: 0.8, shake: 10, rgb: 8 });

// 4. Cyber: letters decrypt, data rain on Enter, the rap stops, done slams back in.
full({ fx: 'cyber', t0: bar(3), t1: bar(4), view: CLOSE(300), trans: { type: 3, dur: 0.3 },
  events: [...prefill('deploy', bar(3)), ...keysAt(' to prod', every(bar(3), E8, 8))],
  chips: [[bar(3), 'TYPING', 'each letter decrypts']], over: NAME('cyber', bar(3), 'cyber') });
wide({ fx: 'cyber', t0: bar(4), t1: bar(5),
  events: [...prefill('deploy to prod', bar(4)), { t: bar(4) - SETTLE, type: 'enter' }],
  chips: [[bar(4), 'ENTER', 'data rain']] });
hit(bar(4), { punch: 1.2, shake: 16, rgb: 10 });
full({ fx: 'cyber', t0: bar(5), t1: STOP, view: macro(2), events: [] });
wide({ fx: 'cyber', t0: STOP, t1: bar(6), trans: { type: 3, dur: 0.16 },
  events: [...prefill('deploy to prod', bar(4)), { t: bar(4) - SETTLE, type: 'enter' }, { t: STOP - SETTLE, type: 'done' }],
  answer: 'Deployed: v2.0 is live.', chips: [[STOP, 'DONE', 'the rain comes in from the edges']] });
hit(STOP, { punch: 1.3, shake: 18, rgb: 12 });

// 5. Glitch: tearing keystrokes, slices on Enter and done, the cursor up close.
full({ fx: 'glitch', t0: bar(6), t1: bar(7), view: CLOSE(300), trans: { type: 2, dur: 0.18 },
  events: keysAt('why is it broken?', every(bar(6), S16, 16)),
  chips: [[bar(6), 'TYPING', 'tears into slices']], over: NAME('glitch', bar(6), 'glitch') });
[0, 1, 2, 3].forEach(b => hit(bar(6, b), { slice: 0.5, rgb: 8 }));
wide({ fx: 'glitch', t0: bar(7), t1: bar(8), trans: { type: 2, dur: 0.14 },
  events: [...prefill('why is it broken?', bar(7)), { t: bar(7) - SETTLE, type: 'enter' }, { t: bar(7, 2) - HIT, type: 'done' }],
  answer: 'Found it: a stale lockfile.', chips: [[bar(7), 'ENTER', 'the lines break into slices'], [bar(7, 2), 'DONE', '']] });
hit(bar(7), { punch: 1.1, shake: 14, rgb: 18, slice: 1.0 });
hit(bar(7, 2), { punch: 0.9, rgb: 14, slice: 0.8 });
full({ fx: 'glitch', t0: bar(8), t1: bar(9), view: macro(3), trans: { type: 2, dur: 0.16 },
  events: [...prefill('o', bar(8)), ...keysAt('k!', [bar(8, 1), bar(8, 2)])],
  chips: [[bar(8), 'CURSOR', 'a corrupted signal']] });
[0, 1, 2, 3, 3.5].forEach(b => hit(bar(8, b), { slice: 0.7, rgb: 14, punch: 0.3 }));

// 6. Break: the three side by side, typing together; the bass drops out; triple Enter on its return.
add({ t0: bar(9), t1: BASS_GAP, trans: { type: 1, dur: 0.25 }, focus: [0.5, 0.55], draw(c, t) {
  bg(c, null);
  ['lightning', 'cyber', 'glitch'].forEach((n, i) => {
    const { img } = renderTake(n, TRI, keysAt('ship it', every(bar(10), S16, 7)), t, null, { status: false, before: [] });
    const x = 20 + i * 1280;
    c.drawImage(img, x, 0);
    slam(c, EFFECTS[n].name.toUpperCase(), x + 620, 1960, 150, EFFECTS[n].color, bar(9, i), t, { align: 'center', style: n });
  });
  c.fillStyle = '#0e0e10'; c.fillRect(1260, 0, 20, H); c.fillRect(2540, 0, 20, H);
} });
[0, 1, 2].forEach(b => hit(bar(9, b), { punch: 0.35 }));

const TRIO = ['lightning', 'cyber', 'glitch'];
const trioEvents = [...prefill('ship it', bar(10)), { t: SLAM - SETTLE, type: 'enter' }, { t: bar(12) - HIT, type: 'done' }];
add({ t0: BASS_GAP, t1: END, focus: [0.5, 0.68], draw(c, t) {
  bg(c, '#9fd0fe', 0.05);
  TRIO.forEach((n, i) => {
    const { img } = renderTake(n, COL, trioEvents, t, null, { before: BEFORE, answer: 'Shipped.' });
    const x = 120 + i * 1220;
    termWindow(c, img, x, 300, { k: K, title: n });
    label(c, EFFECTS[n].name.toUpperCase(), x, 1095, BASS_GAP, t, { size: 52, color: EFFECTS[n].color });
  });
  slam(c, 'CURSOR FX', W / 2, 1560, 300, INK, bar(11), t, { align: 'center', weight: 900, glow: 0 });
  slam(c, 'for Ghostty', W / 2, 1700, 92, SOFT, bar(11, 1), t, { align: 'center', weight: 500, glow: 0, track: 0 });
  const a = clamp((t - bar(11, 2)) / 0.15);
  if (a > 0) {
    c.save(); c.globalAlpha = a; c.textAlign = 'center';
    c.font = `500 64px "TX-02 Retina SemiCondensed", Menlo, monospace`; c.fillStyle = '#9fd0fe';
    c.fillText('cursor-fx lightning  ·  cyber  ·  glitch', W / 2, 1860);
    c.font = `600 60px ${SANS}`; c.fillStyle = INK; c.fillText(URL_TEXT, W / 2, 1990);
    c.font = `450 46px ${SANS}`; c.fillStyle = SOFT; c.fillText('12 effects  ·  MIT  ·  macOS + Linux  ·  Ghostty 1.4+', W / 2, 2075);
    c.restore();
  }
} });
hit(SLAM, { punch: 2.0, shake: 26, rgb: 18, bolt: 1.0 });
hit(bar(11), { punch: 0.8, shake: 8 });
hit(bar(12), { punch: 0.7, shake: 8, rgb: 8 });

// --- frame: composite A (and B in a transition) + post parameters ---
const shotAt = t => SHOTS.find(s => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];
export function frame(t, ca, cb) {
  const s = shotAt(t), i = SHOTS.indexOf(s);
  let a = s, b = null, mix = 0, type = 0, blur = 0;
  // in the first half of a transition we are still in the previous shot: look ahead
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
  const pn = (k) => Math.sin(n * 12.9898 + k * 78.233) * 43758.5453 % 1;
  const shake = env(t, 'shake', 0.12);
  // a bolt streak at each lightning-style hit, at a height picked per hit
  const bh = HITS.filter(h => h.bolt && t >= h.t).pop();
  return {
    a: ca, b: b ? cb : null,
    post: {
      time: t, type, mix, blur,
      // punches on the hits, plus a slow push through every shot so nothing sits still
      zoom: (1 + 0.06 * env(t, 'punch', 0.09)) * (1 + 0.03 * clamp((t - cur.t0) / (cur.t1 - cur.t0))),
      focus: cur.focus,
      shake: [shake * pn(1), shake * pn(2)],
      rgb: env(t, 'rgb', 0.1),
      slice: Math.min(1, env(t, 'slice', 0.07)),
      bolt: bh ? bh.bolt * Math.exp(-(t - bh.t) / 0.07) : 0,
      boltY: bh ? 0.35 + 0.3 * ((bh.t * 7.13) % 1) : 0.5,
      seed: bh ? bh.t : 0,
      fade: Math.max(1 - clamp(t / 0.5), clamp((t - (END - 0.75)) / 0.75)),
    },
  };
}
export const DURATION = END;
