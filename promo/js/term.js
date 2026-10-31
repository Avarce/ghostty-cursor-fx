// A terminal screen painted cell by cell (like Ghostty draws it), in the user's
// Graphite theme, plus the two screens the promo needs: Claude Code (sent prompt
// on a lighter bar, input box between two full-width lines, status line) and zsh.
export const BG = '#2a2a2a', FG = '#c6bba3', DIM = '#8f8879', BAR = '#373737', RULE = '#6a6a6a',
  CORAL = '#d98a6c', GREEN = '#97c278', BLUE = '#61aeed', CUR_TEXT = '#2a2a2a';
const FONT = '"TX-02 Retina SemiCondensed", Menlo, "Apple Symbols", monospace';

export class Term {
  // W, H: canvas size; CH: cell height; padX/padY: where row 0, col 0 starts.
  constructor({ W, H, CH, padX = Math.round(CH * 0.36), padY = Math.round(CH * 0.27), fontScale = 0.6 }) {
    Object.assign(this, { W, H, CH, padX, padY });
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.fontPx = Math.round(CH * fontScale);
    this.ctx.font = `${this.fontPx}px ${FONT}`;
    this.CW = Math.round(this.ctx.measureText('M').width * 100) / 100;
    this.line = Math.max(2, Math.min(4, Math.round(CH / 40)));
  }

  // Cursor rect in Ghostty's convention (y-up, top-left corner), whole pixels.
  rect(row, col) {
    const x = Math.round(this.padX + col * this.CW);
    return [x, this.H - (this.padY + row * this.CH), Math.round(this.padX + (col + 1) * this.CW) - x, this.CH];
  }

  // screen: { rows: [[[text, color], ...] | {bar: true, segs}], lines: [row, ...], cursor: {row, col, color} }
  paint(screen) {
    const c = this.ctx, { W, H, CH, CW, padX, padY } = this;
    c.fillStyle = BG; c.fillRect(0, 0, W, H);
    c.font = `${this.fontPx}px ${FONT}`;
    c.textBaseline = 'alphabetic';
    const base = Math.round(CH * 0.5 + this.fontPx * 0.36);
    screen.rows.forEach((row, r) => {
      if (!row) return;
      const segs = Array.isArray(row) ? row : row.segs;
      const y = Math.round(padY + r * CH);
      if (y > H || y + CH < 0) return;
      if (row.bar) { c.fillStyle = BAR; c.fillRect(0, y, W, CH); }
      let col = 0;
      for (const [text, color] of segs) {
        c.fillStyle = color || FG;
        for (const ch of text) {
          if (ch !== ' ') c.fillText(ch, Math.round(padX + col * CW), y + base);
          col++;
        }
      }
    });
    for (const r of screen.lines || []) {
      const y = Math.round(padY + r * CH + CH / 2 - this.line / 2);
      const m = Math.round(Math.min(padX, CH * 0.36) * 0.5);
      c.fillStyle = RULE; c.fillRect(m, y, W - 2 * m, this.line);
    }
    const cu = screen.cursor;
    if (cu) {
      const [x, , w] = this.rect(cu.row, cu.col);
      c.fillStyle = cu.color; c.fillRect(x, Math.round(padY + cu.row * CH), w, CH);
    }
    return this.canvas;
  }
}

const SPIN = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
export const spinner = (t, verb = 'Orchestrating') =>
  [[SPIN[Math.floor(Math.max(0, t) * 8) % SPIN.length] + ' ', CORAL], [verb + '… ', CORAL], ['(esc to interrupt)', DIM]];

// Event-driven state of one take. events: [{t, type: 'key'|'back'|'enter'|'done'|'clear'|'out', ch}], sorted.
// Returns what the shader needs (change, prev move, signal) plus the screen's state.
export function takeState(events, lt) {
  const st = { input: '', sent: null, answered: false, sentAt: null, change: -100, prev: [0, -1], signal: null, keys: 0 };
  for (const e of events) {
    if (e.t > lt) break;
    st.change = e.t;
    if (e.type === 'key') { st.input += e.ch; st.prev = [0, -1]; st.signal = null; st.keys++; }
    else if (e.type === 'back') { st.input = st.input.slice(0, -1); st.prev = [0, 1]; st.signal = null; }   // Backspace
    else if (e.type === 'enter') { st.sent = st.input; st.input = ''; st.prev = [0, 0]; st.signal = 'start'; st.sentAt = e.t; st.answered = false; }
    else if (e.type === 'done') { st.prev = [0, 0]; st.signal = 'done'; st.answered = true; }
    else if (e.type === 'out') { st.prev = [0, 0]; st.signal = null; st.answered = true; }
    else if (e.type === 'clear') { st.prev = [0, Math.max(3, st.input.length)]; st.input = ''; st.signal = null; }
  }
  return st;
}

// Keystrokes for `text` starting at t0, one every `step` seconds.
export const typeKeys = (text, t0, step) => [...text].map((ch, i) => ({ t: t0 + i * step, type: 'key', ch }));

// zsh: `before` rows, then the prompt. Enter leaves the command on its row and the
// cursor at the start of the next one; done/out prints `out` and a fresh prompt.
export const zshPrompt = (dir = '~/projects/app') => [[dir, BLUE], [' ❯ ', GREEN]];
export function shellScreen(st, lt, { color, before = [], out = [], dir }) {
  const rows = [...before], pr = before.length, P = zshPrompt(dir), plen = P.reduce((n, [s]) => n + [...s].length, 0);
  if (st.sent === null) {
    rows[pr] = [...P, [st.input, FG]];
    return { rows, cursor: { row: pr, col: plen + st.input.length, color } };
  }
  rows[pr] = [...P, [st.sent, FG]];
  if (!st.answered) return { rows, cursor: { row: pr + 1, col: 0, color } };
  out.forEach((r, i) => { rows[pr + 1 + i] = r; });
  const nr = pr + 1 + out.length;
  rows[nr] = [...P, [st.input, FG]];
  return { rows, cursor: { row: nr, col: plen + st.input.length, color } };
}

// Claude Code screen for a take state. Rows 0-4 transcript, 5/7 box lines, 6 input, 8 status.
export function claudeScreen(st, lt, { color, before, answer, status = true }) {
  const rows = [];
  before = before || [[['⏺ ', FG], ['Updated install.sh and the README.', FG]], [['  └ 2 files changed, 41 insertions(+)', DIM]]];
  if (st.sent === null) {
    rows.push(...before);
  } else if (!st.answered) {
    rows[0] = before[before.length - 1];
    rows[2] = { bar: true, segs: [['❯ ' + st.sent, FG]] };
    rows[4] = spinner(lt - st.sentAt);
  } else {
    rows[0] = { bar: true, segs: [['❯ ' + st.sent, FG]] };
    rows[2] = [['⏺ ', FG], [answer || 'Done.', FG]];
    rows[3] = [['  └ ', DIM], ['all checks pass', DIM]];
  }
  rows[6] = [['❯ ', FG], [st.input, FG]];
  if (status) rows[8] = [['  ⏵⏵ accept edits on', DIM], [' (shift+tab to cycle)', DIM]];
  return { rows, lines: [5, 7], cursor: { row: 6, col: 2 + st.input.length, color } };
}
