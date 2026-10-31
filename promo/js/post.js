// Post pass for the trio cut: takes the composited frame (and, during a transition, the
// incoming one) and adds the motion: zoom punch, shake, color split, glitch slices,
// whip / glyph-rain / slice transitions, a lightning streak, fade. No full-screen flashes.
const VS = '#version 300 es\nin vec2 pos; out vec2 uv; void main() { uv = pos * 0.5 + 0.5; gl_Position = vec4(pos, 0.0, 1.0); }';
const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uA, uB;
uniform vec2 uRes;
uniform float uTime, uZoom, uRGB, uSlice, uMix, uBlur, uBolt, uBoltY, uFade, uSeed;
uniform vec2 uShake, uFocus;
uniform int uType;            // 0 none, 1 whip, 2 slices, 3 glyph rain
uniform vec3 uBoltColor, uEdgeColor;

float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(float x) { float i = floor(x), f = fract(x); return mix(h11(i), h11(i + 1.0), f * f * (3.0 - 2.0 * f)); }

vec3 tex(sampler2D s, vec2 p) { return (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) ? vec3(0.055, 0.055, 0.063) : texture(s, p).rgb; }

// One image with color split along x (more toward the edges).
vec3 split(sampler2D s, vec2 p) {
  if (uRGB < 0.01) return tex(s, p);
  vec2 d = vec2(uRGB / uRes.x * (0.4 + 1.2 * abs(p.x - 0.5)), 0.0);
  return vec3(tex(s, p + d).r, tex(s, p).g, tex(s, p - d).b);
}

// Glitch slices: bands shift sideways; band layout changes every frame step.
vec2 sliced(vec2 p, float amount, float seed) {
  if (amount < 0.01) return p;
  float rows = 18.0 + 30.0 * h11(seed);
  float band = floor(p.y * rows);
  float hv = h11(band * 7.13 + seed * 3.7);
  if (hv > 1.0 - 0.45 * amount) p.x += (h11(band + seed * 11.0) - 0.5) * 0.12 * amount;
  return p;
}

vec3 scene(vec2 p) {
  float st = floor(uTime * 30.0) + uSeed;
  if (uType == 1) {                 // whip: A leaves to the left, B arrives from the right, motion-blurred
    float e = uMix;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 16; i++) {
      float k = (float(i) / 15.0 - 0.5) * uBlur;
      vec2 q = p + vec2(e + k, 0.0);
      acc += q.x < 1.0 ? split(uA, q) : split(uB, q - vec2(1.0, 0.0));
    }
    return acc / 16.0;
  }
  if (uType == 2) {                 // slices: bands flip from A to B with offsets and split
    float rows = 14.0 + 24.0 * h11(st);
    float band = floor(p.y * rows);
    bool useB = h11(band * 3.1 + st * 1.7) < uMix;
    vec2 q = sliced(p, 1.0, st);
    vec3 c = useB ? split(uB, q) : split(uA, q);
    return c;
  }
  if (uType == 3) {                 // glyph rain: columns fall from the top revealing B, with a glowing edge
    float cw = 26.0 / uRes.x;
    float col = floor(p.x / cw);
    float d = h11(col * 1.37) * 0.45;
    float q = clamp((uMix - d) / 0.55, 0.0, 1.0);
    float front = 1.0 - q * 1.08;    // reveal from the top (uv.y = 1) down
    vec3 c = p.y > front ? split(uB, p) : split(uA, p);
    float edge = exp(-abs(p.y - front) * uRes.y / 18.0) * step(0.001, q) * step(q, 0.999);
    float cell = step(0.25, fract(p.x / cw)) * step(fract(p.x / cw), 0.85);
    return c + uEdgeColor * edge * cell * 0.9;
  }
  return split(uA, sliced(p, uSlice, st));
}

void main() {
  vec2 p = (uv - uFocus) / uZoom + uFocus - uShake / uRes;
  vec3 c = scene(p);
  if (uBolt > 0.001) {              // a jagged streak across the frame (thin; a glow, not a flash)
    float y = uBoltY + (vnoise(uv.x * 9.0 + uSeed * 5.0) - 0.5) * 0.06 + (vnoise(uv.x * 37.0 + uSeed) - 0.5) * 0.018;
    float dy = abs(uv.y - y) * uRes.y;
    c += uBoltColor * (exp(-dy / 2.5) * 1.2 + exp(-dy / 26.0) * 0.35) * uBolt;
  }
  vec2 v = uv - 0.5;
  c *= 1.0 - 0.35 * dot(v, v) * 1.6;           // vignette
  c *= 1.0 - uFade;
  c += (h21(uv * uRes + uTime) - 0.5) / 255.0;  // dither against banding in the glows
  o = vec4(c, 1.0);
}`;

export class Post {
  constructor(W, H) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    const gl = this.gl = this.canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const p = this.prog = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.useProgram(p);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'pos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = [0, 1].map(i => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      return t;
    });
    this.u = n => gl.getUniformLocation(p, n);
    gl.uniform1i(this.u('uA'), 0); gl.uniform1i(this.u('uB'), 1);
    gl.viewport(0, 0, W, H);
  }

  // a, b: canvases (b only during a transition). f: { time, zoom, focus, shake, rgb, slice, type, mix, blur, bolt, boltY, boltColor, edgeColor, fade, seed }
  draw(a, b, f) {
    const gl = this.gl, u = this.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex[0]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, a);
    if (b) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex[1]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, b); }
    gl.uniform2f(u('uRes'), this.canvas.width, this.canvas.height);
    gl.uniform1f(u('uTime'), f.time);
    gl.uniform1f(u('uZoom'), f.zoom ?? 1);
    gl.uniform2f(u('uFocus'), ...(f.focus || [0.5, 0.5]));
    gl.uniform2f(u('uShake'), ...(f.shake || [0, 0]));
    gl.uniform1f(u('uRGB'), f.rgb || 0);
    gl.uniform1f(u('uSlice'), f.slice || 0);
    gl.uniform1i(u('uType'), b ? f.type || 0 : 0);
    gl.uniform1f(u('uMix'), f.mix || 0);
    gl.uniform1f(u('uBlur'), f.blur || 0);
    gl.uniform1f(u('uBolt'), f.bolt || 0);
    gl.uniform1f(u('uBoltY'), f.boltY ?? 0.5);
    gl.uniform3f(u('uBoltColor'), ...(f.boltColor || [0.62, 0.82, 1.0]));
    gl.uniform3f(u('uEdgeColor'), ...(f.edgeColor || [0.31, 0.88, 0.5]));
    gl.uniform1f(u('uFade'), f.fade || 0);
    gl.uniform1f(u('uSeed'), f.seed || 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return this.canvas;
  }
}
