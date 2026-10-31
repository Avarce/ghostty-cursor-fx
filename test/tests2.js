// Jump checks for any shader, and the input-box line checks for lightning
// (loaded by index.html?shader=...).
const _claude = { claude: true, line6: '❯ ', col: 2 }, _shell = { line6: '', col: 0 }, _T0 = 100;
const _R = (since, o) => render(_T0 + since, _T0, o);
const _cnt = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2]) > 3) n++; return n; };
// Changed pixels per row, plus the x extent of the changes on rows 5 and 7 (the box lines).
const _rows = (a, b) => {
  const h = {}, x5 = [Infinity, -Infinity], x7 = [Infinity, -Infinity]; let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2]) > 3) {
      n++; const r = Math.floor((H - 1 - y - PADY) / CH); h[r] = (h[r] || 0) + 1;
      const ex = r === 5 ? x5 : r === 7 ? x7 : null;
      if (ex) { ex[0] = Math.min(ex[0], x); ex[1] = Math.max(ex[1], x); }
    }
  }
  return { n, h, x5: isFinite(x5[0]) ? x5 : null, x7: isFinite(x7[0]) ? x7 : null };
};

// Cursor jumps without the Enter signal must change nothing (JUMP_EFFECTS off); typing still does.
window.runJump = async () => {
  await window.ready; if (window.failed) return { failed: window.failed };
  const out = {};
  for (const linear of [1, 0]) {
    let jump = 0, typing = 0;
    for (const prev of [[0, 30], [-3, 0], [2, 0], [0, -20], [-1, 25]])
      for (const since of [0.13, 0.3, 0.6, 1.2])
        jump += _cnt(_R(since, { screen: _claude, prev, linear }), _R(since, { screen: _claude, prev: [0, 0], linear }));
    for (const since of [0.05, 0.1])
      typing += _cnt(_R(since, { screen: _claude, prev: [0, -1], linear }), _R(since, { screen: _claude, prev: [0, 0], linear }));
    out[linear ? 'linear' : 'srgb'] = { jump, typing };
  }
  return out;
};

// Lightning: the input box lines (rows 5 and 7 on the Claude screen).
window.runLines = async () => {
  await window.ready; if (window.failed) return { failed: window.failed };
  const out = {};
  for (const linear of [1, 0]) {
    const o = {};
    o.typing = [0.045, 0.1, 0.2].map(s => _rows(_R(s, { screen: _claude, prev: [0, -1], linear }), _R(s, { screen: _claude, prev: [0, 0], linear })));
    o.typingShell = _rows(_R(0.06, { screen: _shell, prev: [0, -1], linear }), _R(0.06, { screen: _shell, prev: [0, 0], linear }));
    o.blinkOff = _rows(_R(0.06, { screen: { ..._claude, cursor: false }, prev: [0, -1], linear }), _R(0.06, { screen: { ..._claude, cursor: false }, prev: [0, 0], linear }));
    o.send = [0.1, 0.25, 0.45, 0.58].map(s => _rows(_R(s, { screen: _claude, prev: [0, 0], signal: 'start', linear }), _R(s, { screen: _claude, prev: [0, 0], linear })));
    o.sendShell = _rows(_R(0.25, { screen: _shell, prev: [0, 0], signal: 'start', linear }), _R(0.25, { screen: _shell, prev: [0, 0], linear }));
    out[linear ? 'linear' : 'srgb'] = o;
  }
  // Contact sheet: typing spark, surge early, surge late (half size).
  const shots = [['typing t=0.02', 0.06, {}], ['typing t=0.09', 0.13, {}], ['send t=0.08', 0.12, { signal: 'start' }], ['send t=0.26', 0.3, { signal: 'start' }]];
  const sheet = document.createElement('canvas');
  sheet.width = W / 2; sheet.height = shots.length * (H / 2 + 14);
  const sc = sheet.getContext('2d');
  sc.fillStyle = '#000'; sc.fillRect(0, 0, sheet.width, sheet.height); sc.fillStyle = '#ccc'; sc.font = '11px monospace';
  shots.forEach(([label, s, extra], i) => {
    _R(s, { screen: _claude, prev: extra.signal ? [0, 0] : [0, -1], ...extra });
    const y = i * (H / 2 + 14);
    sc.fillText(label, 4, y + 11);
    sc.drawImage(gl.canvas, 0, y + 14, W / 2, H / 2);
  });
  sheet.id = 'sheet';
  document.getElementById('sheet')?.remove();
  document.body.prepend(sheet);
  return out;
};
