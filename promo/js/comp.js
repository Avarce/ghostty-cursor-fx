// 2D compositing: background, the terminal window, captions. All sizes in output pixels.
export const SANS = '"Inter", "Helvetica Neue", Arial, sans-serif';
export const INK = '#ece6d8', SOFT = '#b9b2a2', FAINT = '#7d776b';
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
export const ramp = (t, a, b) => clamp((t - a) / (b - a));
// 0 → 1 over [a, a+fi], 1 → 0 over [b-fo, b].
export const window_ = (t, a, b, fi = 0.25, fo = 0.25) => Math.min(fi ? ramp(t, a, a + fi) : (t >= a ? 1 : 0), fo ? 1 - ramp(t, b - fo, b) : (t < b ? 1 : 0));

const rgba = (hexc, a) => { const n = parseInt(hexc.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

export function background(c, W, H, accent, glow = 0.07) {
  c.fillStyle = '#121214'; c.fillRect(0, 0, W, H);
  if (accent) {
    const g = c.createRadialGradient(W / 2, H * 0.52, 0, W / 2, H * 0.52, W * 0.55);
    g.addColorStop(0, rgba(accent, glow)); g.addColorStop(1, rgba(accent, 0));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

// A macOS-style terminal window holding `img` (the shader output) at x, y; zoom scales it about (fx, fy) in window space.
export const TITLE_H = 38;
// k scales the chrome (2 for a 4K frame).
export function termWindow(c, img, x, y, { title = 'claude', zoom = 1, fx = 0.5, fy = 0.5, alpha = 1, k = 1 } = {}) {
  const TH = TITLE_H * k, w = img.width, h = img.height + TH, r = 14 * k;
  c.save(); c.globalAlpha = alpha;
  c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 60 * k; c.shadowOffsetY = 24 * k;
  roundRect(c, x, y, w, h, r); c.fillStyle = '#2a2a2a'; c.fill();
  c.shadowColor = 'transparent';
  c.save(); roundRect(c, x, y, w, h, r); c.clip();
  c.fillStyle = '#242424'; c.fillRect(x, y, w, TH);
  [['#ff5f57'], ['#febc2e'], ['#28c840']].forEach(([col], i) => {
    c.beginPath(); c.arc(x + (22 + i * 20) * k, y + TH / 2, 6 * k, 0, Math.PI * 2); c.fillStyle = col; c.globalAlpha = alpha * 0.85; c.fill();
  });
  c.globalAlpha = alpha;
  c.font = `500 ${15 * k}px ${SANS}`; c.fillStyle = '#8f8a80'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(title, x + w / 2, y + TH / 2 + k);
  c.textAlign = 'left';
  c.beginPath(); c.rect(x, y + TH, w, img.height); c.clip();
  c.imageSmoothingQuality = 'high';
  const ox = x + fx * w, oy = y + TH + fy * img.height;
  c.translate(ox, oy); c.scale(zoom, zoom); c.translate(-ox, -oy);
  c.drawImage(img, x, y + TH);
  c.restore();
  roundRect(c, x + 0.5, y + 0.5, w - 1, h - 1, r); c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = k; c.stroke();
  c.restore();
  return { w, h };
}

// Full-bleed image with a slow push (zoom about fx, fy).
export function fullBleed(c, img, W, H, { zoom = 1, fx = 0.5, fy = 0.5, alpha = 1 } = {}) {
  c.save(); c.globalAlpha = alpha; c.imageSmoothingQuality = 'high';
  const ox = fx * W, oy = fy * H;
  c.translate(ox, oy); c.scale(zoom, zoom); c.translate(-ox, -oy);
  c.drawImage(img, 0, 0, W, H);
  c.restore();
}

export function shade(c, W, H, { top = 0, bottom = 0.6 } = {}) {
  if (bottom) {
    const g = c.createLinearGradient(0, H * 0.62, 0, H);
    g.addColorStop(0, 'rgba(10,10,12,0)'); g.addColorStop(1, `rgba(10,10,12,${bottom})`);
    c.fillStyle = g; c.fillRect(0, H * 0.62, W, H * 0.38);
  }
  if (top) {
    const g = c.createLinearGradient(0, 0, 0, H * 0.3);
    g.addColorStop(0, `rgba(10,10,12,${top})`); g.addColorStop(1, 'rgba(10,10,12,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H * 0.3);
  }
}

// Effect name + one line, bottom left. a = 0..1 (fade + small rise).
export function lowerThird(c, x, y, name, color, line, a, { size = 64 } = {}) {
  if (a <= 0) return;
  c.save(); c.globalAlpha = a; c.textBaseline = 'alphabetic';
  const dy = (1 - easeOut(a)) * 14;
  c.font = `650 ${size}px ${SANS}`; c.fillStyle = color;
  c.fillText(name, x, y + dy);
  if (line) { c.font = `450 ${Math.round(size * 0.44)}px ${SANS}`; c.fillStyle = INK; c.fillText(line, x, y + dy + Math.round(size * 0.72)); }
  c.restore();
}

// A small label with a colored dot ("ENTER"), at x, y (left, middle).
export function chip(c, x, y, label, color, a, { size = 22, sub = '' } = {}) {
  if (a <= 0) return;
  c.save(); c.globalAlpha = a; c.textBaseline = 'middle';
  c.font = `650 ${size}px ${SANS}`;
  const tw = c.measureText(label).width;
  c.beginPath(); c.arc(x + size * 0.35, y, size * 0.3, 0, Math.PI * 2); c.fillStyle = color; c.fill();
  c.fillStyle = INK; c.fillText(label, x + size * 1.0, y + 1);
  if (sub) { c.font = `450 ${size}px ${SANS}`; c.fillStyle = SOFT; c.fillText(sub, x + size * 1.0 + tw + size * 0.6, y + 1); }
  c.restore();
}

export function centerText(c, text, x, y, { size = 48, weight = 600, color = INK, a = 1, spacing = 0 } = {}) {
  if (a <= 0) return;
  c.save(); c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.font = `${weight} ${size}px ${SANS}`; c.fillStyle = color;
  if (spacing) c.letterSpacing = `${spacing}px`;
  c.fillText(text, x, y);
  c.restore();
}
