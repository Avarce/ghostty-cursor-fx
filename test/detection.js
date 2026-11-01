// Is the input box found wherever it is? The box in a whole window, next to a sidebar, in a split
// (other panes left and right), and a short underline that must not count. Loaded by
// cjk.html?shader=...&run=detection.js, see run_detection.py.
(() => {
  const T0 = 100;
  const COLS = Math.floor((W - 2 * PADX) / CW);
  const box = [5, 7];
  const screens = {
    window: { box, cur: { row: 6, col: 2 } },
    sidebar: { box, pane: [9, COLS], cur: { row: 6, col: 11 } },
    split: { box, pane: [9, 39], cur: { row: 6, col: 11 } },
    splitRight: { box, pane: [30, COLS], cur: { row: 6, col: 32 } },
    cursorFarRight: { box, pane: [9, 39], cur: { row: 6, col: 37 } },
  };
  const screenPixels = opts => {
    drawTerm(opts);
    const c = screenData(), px = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) px.set(c.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    return px;
  };
  // Changed pixels within a band of screen rows, inside and outside the columns of the pane.
  const changed = (a, b, rows, pane) => {
    const L = pane ? PADX + pane[0] * CW : 0, R = pane ? PADX + pane[1] * CW : W;
    let inside = 0, outside = 0;
    for (const r of rows) for (let y = H - (PADY + (r + 1) * CH); y < H - (PADY + r * CH); y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 6) {
        if (x >= L && x < R) inside++; else outside++;
      }
    }
    return { inside, outside };
  };
  const out = {};
  for (const [name, screen] of Object.entries(screens)) {
    const plain = screenPixels(screen);
    const idle = render(T0 + 50, T0, { screen });
    // LINE_TINT colors a box line it found, without any signal.
    const tint = changed(plain, idle, [5, 7], screen.pane);
    // The Enter effect: the same frame with and without the signal, at a few moments.
    let lit = 0, spill = 0, darker = 0, lighter = 0;
    for (const since of [0.12, 0.25, 0.4, 0.6]) {
      const off = render(T0 + since, T0, { screen });
      const on = render(T0 + since, T0, { screen, signal: 'enter' });
      const d = changed(off, on, [4, 5, 7, 8], screen.pane);
      lit = Math.max(lit, d.inside); spill = Math.max(spill, d.outside);
      for (let i = 0; i < on.length; i += 4) {
        const l = on[i] + on[i + 1] + on[i + 2] - off[i] - off[i + 1] - off[i + 2];
        if (l < -6) darker++; else if (l > 6) lighter++;
      }
    }
    out[name] = { found: tint.inside > 200, lit, spill, darkShare: +(darker / Math.max(1, darker + lighter)).toFixed(2) };
  }
  // An underline of ten cells right above the cursor is not a box line; the full one below is.
  // Measured away from the cursor, whose glow reaches the row above it.
  const u = { box: [7], short: { row: 5, from: 0, to: 10 }, cur: { row: 6, col: 2 } };
  const idleU = render(T0 + 50, T0, { screen: u });
  out.underline = { tinted: changed(screenPixels(u), idleU, [5], [5, 10]).inside };
  // A shell prompt with a line of its own after its text on the first row (starship's $fill): Enter
  // lights that line, whether the new prompt is already there (cursor on its second row) or the cursor
  // is still under the sent line, also with rows taller than the cursor (adjust-cell-height).
  const RULE = { row: 4, from: 16, to: COLS - 2 };
  const prompt = ['', '', '', '', '╭─ ~/tmp 35ms', '╰─ 80% ❯ ls'];
  const strip = (a, b, row, y0, y1, from, to) => {
    let n = 0;
    for (let y = H - (PADY + row * CH + y1); y < H - (PADY + row * CH + y0); y++) for (let x = PADX + from * CW; x < PADX + to * CW; x++) {
      const i = (y * W + x) * 4;
      if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 6) n++;
    }
    return n;
  };
  out.shell = { ruleLit: 1e9, textLit: 0, underLit: 0 };
  for (const screen of [
    { rows: prompt, short: RULE, cur: { row: 5, col: 12 } },
    { rows: prompt, short: RULE, cur: { row: 6, col: 0 } },
    { rows: prompt, short: RULE, cur: { row: 5, col: 12 }, curH: 40 },
    { rows: prompt, short: RULE, cur: { row: 6, col: 0 }, curH: 40 },
  ]) {
    let rule = 0, text = 0, under = 0;
    for (const since of [0.06, 0.12, 0.25, 0.4]) {
      const off = render(T0 + since, T0, { screen });
      const on = render(T0 + since, T0, { screen, signal: 'enter' });
      rule = Math.max(rule, strip(off, on, 4, CH / 2 - 2, CH / 2 + 2, RULE.from + 2, RULE.to - 2));
      text = Math.max(text, strip(off, on, 4, CH / 2 - 2, CH / 2 + 2, 0, 12));
      under = Math.max(under, strip(off, on, 5, CH - 3, CH + 3, 14, RULE.to - 2));
    }
    out.shell.ruleLit = Math.min(out.shell.ruleLit, rule);
    out.shell.textLit = Math.max(out.shell.textLit, text);
    out.shell.underLit = Math.max(out.shell.underLit, under);
  }
  // A hash of a few frames, to compare a shader's output between two versions of it.
  let hash = 2166136261;
  for (const [t, signal] of [[50, null], [0.25, 'enter'], [0.25, 'done']]) {
    const px = render(T0 + t, T0, { screen: screens.window, signal });
    for (let i = 0; i < px.length; i += 16) hash = Math.imul(hash ^ px[i] ^ (px[i + 1] << 8) ^ (px[i + 2] << 16), 16777619);
  }
  return { ...out, hash: hash >>> 0 };
})();
