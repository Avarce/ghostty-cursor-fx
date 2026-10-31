// Enter-signal checks for one shader (loaded by index.html?shader=...).
// Run with: (0, eval)(await (await fetch('tests.js')).text()); await runEnter()
window.runEnter = async (shots = [0.1, 0.3, 0.6]) => {
  await window.ready;
  if (window.failed) return { failed: window.failed };
  const name = new URLSearchParams(location.search).get('shader');
  const src = await (await fetch(name, { cache: 'no-store' })).text();
  const num = k => { const m = src.match(new RegExp('const float ' + k + '\\s*=\\s*([0-9.]+)')); return m ? +m[1] : null; };
  const ET = num('ENTER_TIME') ?? num('SEND_DURATION') ?? 1.0;
  const S = num('SETTLE'), JS = num('JUMP_SETTLE');
  const claude = { claude: true, line6: '❯ ', col: 2 };
  const shell = { line6: '', col: 0 };
  const T0 = 100;
  const R = (since, opts) => render(T0 + since, T0, opts);
  const cmp = (a, b) => {
    const h = {}; let n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 3) {
        n++; const r = Math.floor((H - 1 - y - PADY) / CH); h[r] = (h[r] || 0) + 1;
      }
    }
    return { n, h };
  };
  const out = { ET, S, JS };
  for (const linear of [1, 0]) {
    const o = {};
    // A. Signal starts while the cursor sits still (Claude screen): where the effect lands, and that it ends.
    const rows = {}; const totals = [];
    for (const f of [0.05, 0.15, 0.3, 0.5, 0.7, 0.9]) {
      const since = S + f * ET;
      const d = cmp(R(since, { screen: claude, prev: [0, 0], signal: 'start', linear }), R(since, { screen: claude, prev: [0, 0], linear }));
      totals.push(d.n); for (const k in d.h) rows[k] = (rows[k] || 0) + d.h[k];
    }
    o.startTotals = totals; o.startRows = rows;
    const endT = S + ET + 0.03;
    o.afterEnd = cmp(R(endT, { screen: claude, prev: [0, 0], signal: 'start', linear }), R(endT, { screen: claude, prev: [0, 0], linear })).n;
    // B. Nothing while settling.
    o.settleStart = cmp(R(S * 0.5, { screen: claude, prev: [0, 0], signal: 'start', linear }), R(S * 0.5, { screen: claude, prev: [0, 0], linear })).n;
    o.settleJump = cmp(R(JS * 0.5, { screen: claude, prev: [0, 30], signal: 'on', linear }), R(JS * 0.5, { screen: claude, prev: [0, 30], linear })).n;
    // C. Typing while the signal is on: same as without it.  D. Signal end: same as a plain color change.
    let typ = 0, end = 0;
    for (const since of [0.02, 0.06, 0.1, 0.2, 0.4, 0.8]) {
      typ += cmp(R(since, { screen: claude, prev: [0, -1], signal: 'on', linear }), R(since, { screen: claude, prev: [0, -1], linear })).n;
      end += cmp(R(since, { screen: claude, prev: [0, 0], signal: 'end', linear }), R(since, { screen: claude, prev: [0, 0], linear })).n;
    }
    o.typingOn = typ; o.signalEnd = end;
    // E. The program jumps the cursor while the signal is on: the Enter effect, same as A.
    const tj = JS + 0.3 * ET;
    o.jumpOnVsStart = cmp(R(tj, { screen: claude, prev: [0, 30], signal: 'on', linear }), R(tj - JS + S, { screen: claude, prev: [0, 0], signal: 'start', linear })).n;
    // F. Shell: cursor at the left edge of the next row, effect on the row above (5).
    const sr = {};
    for (const f of [0.15, 0.4, 0.7]) {
      const since = S + f * ET;
      const d = cmp(R(since, { screen: shell, prev: [0, 0], signal: 'start', linear }), R(since, { screen: shell, prev: [0, 0], linear }));
      for (const k in d.h) sr[k] = (sr[k] || 0) + d.h[k];
    }
    o.shellRows = sr;
    out[linear ? 'linear' : 'srgb'] = o;
  }
  // Contact sheet of the Enter effect on the Claude screen, half size.
  const sheet = document.createElement('canvas');
  sheet.width = W / 2; sheet.height = shots.length * (H / 2 + 14);
  const sc = sheet.getContext('2d');
  sc.fillStyle = '#000'; sc.fillRect(0, 0, sheet.width, sheet.height); sc.fillStyle = '#ccc'; sc.font = '11px monospace';
  shots.forEach((f, i) => {
    R(S + f * ET, { screen: claude, prev: [0, 0], signal: 'start' });
    const y = i * (H / 2 + 14);
    sc.fillText(`${name} t=${(f * ET).toFixed(2)}s`, 4, y + 11);
    sc.drawImage(gl.canvas, 0, y + 14, W / 2, H / 2);
  });
  sheet.id = 'sheet';
  document.getElementById('sheet')?.remove();
  document.body.prepend(sheet);
  return out;
};
