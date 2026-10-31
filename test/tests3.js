// Jump checks for any shader (same-row jumps play, other-row jumps don't), and the
// surge checks for lightning (loaded by index.html?shader=...).
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

window.runJump = async () => {
  await window.ready; if (window.failed) return { failed: window.failed };
  const out = {};
  for (const linear of [1, 0]) {
    let sameRow = 0, otherRow = 0, typing = 0;
    for (const since of [0.13, 0.3, 0.6, 1.2]) {
      for (const prev of [[0, 30], [0, -20]])
        sameRow += _cnt(_R(since, { screen: _claude, prev, linear }), _R(since, { screen: _claude, prev: [0, 0], linear }));
      for (const prev of [[-3, 0], [2, 0], [-1, 25], [-2, -20]])
        otherRow += _cnt(_R(since, { screen: _claude, prev, linear }), _R(since, { screen: _claude, prev: [0, 0], linear }));
    }
    for (const since of [0.05, 0.1])
      typing += _cnt(_R(since, { screen: _claude, prev: [0, -1], linear }), _R(since, { screen: _claude, prev: [0, 0], linear }));
    out[linear ? 'linear' : 'srgb'] = { sameRow, otherRow, typing };
  }
  return out;
};

// Lightning: the surge on the box lines (rows 5 and 7 on the Claude screen).
window.runSurge = async () => {
  await window.ready; if (window.failed) return { failed: window.failed };
  const out = {};
  for (const linear of [1, 0]) {
    const o = {};
    o.send = [0.1, 0.2, 0.45, 0.66].map(s => _rows(_R(s, { screen: _claude, prev: [0, 0], signal: 'start', linear }), _R(s, { screen: _claude, prev: [0, 0], linear })));
    o.sendShell = [0.2, 0.45].map(s => _rows(_R(s, { screen: _shell, prev: [0, 0], signal: 'start', linear }), _R(s, { screen: _shell, prev: [0, 0], linear })));
    o.typing = _rows(_R(0.06, { screen: _claude, prev: [0, -1], linear }), _R(0.06, { screen: _claude, prev: [0, 0], linear }));
    o.blinkOff = _rows(_R(0.06, { screen: { ..._claude, cursor: false }, prev: [0, -1], linear }), _R(0.06, { screen: { ..._claude, cursor: false }, prev: [0, 0], linear }));
    o.sendHidden = _rows(_R(0.2, { screen: _claude, prev: [0, 0], signal: 'start', linear, hidden: 1 }), _R(0.2, { screen: _claude, prev: [0, 0], linear }));
    out[linear ? 'linear' : 'srgb'] = o;
  }
  const shots = [['send t=0.04', 0.08, _claude, 'start'], ['send t=0.12', 0.16, _claude, 'start'], ['send t=0.26', 0.3, _claude, 'start'],
                 ['shell send t=0.2', 0.24, _shell, 'start'], ['delete-all jump t=0.05', 0.17, _claude, null]];
  const sheet = document.createElement('canvas');
  sheet.width = W / 2; sheet.height = shots.length * (H / 2 + 14);
  const sc = sheet.getContext('2d');
  sc.fillStyle = '#000'; sc.fillRect(0, 0, sheet.width, sheet.height); sc.fillStyle = '#ccc'; sc.font = '11px monospace';
  shots.forEach(([label, s, screen, signal], i) => {
    _R(s, { screen, prev: signal ? [0, 0] : [0, 30], signal });
    const y = i * (H / 2 + 14);
    sc.fillText(label, 4, y + 11);
    sc.drawImage(gl.canvas, 0, y + 14, W / 2, H / 2);
  });
  sheet.id = 'sheet';
  document.getElementById('sheet')?.remove();
  document.body.prepend(sheet);
  return out;
};
