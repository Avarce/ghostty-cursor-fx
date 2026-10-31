// Runs the real cursor shaders (../shaders/*.glsl) the way test/index.html does:
// Ghostty's uniforms, the screen as iChannel0, a linear-light texture like the
// panel preview, y-up (Y_DOWN false).
const PRELUDE = `#version 300 es
precision highp float; precision highp int;
uniform vec3 iResolution; uniform float iTime;
uniform vec4 iCurrentCursor; uniform vec4 iPreviousCursor;
uniform vec4 iCurrentCursorColor; uniform vec4 iPreviousCursorColor;
uniform int iCurrentCursorStyle; uniform int iCursorVisible;
uniform float iTimeCursorChange; uniform int iFocus;
uniform vec3 iPalette[16];
uniform vec3 iBackgroundColor; uniform vec3 iForegroundColor; uniform vec3 iCursorText;
#define CURSORSTYLE_BLOCK 0
uniform sampler2D iChannel0;
out vec4 _fragColor;
vec4 texLin(sampler2D s, vec2 uv) { vec4 c = texture(s, uv); return vec4(pow(c.rgb, vec3(2.2)), c.a); }
#define texture texLin
`;
const POST = `
void main() { vec4 c; mainImage(c, gl_FragCoord.xy); _fragColor = vec4(pow(c.rgb, vec3(1.0 / 2.2)), 1.0); }
`;

export const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

export class FX {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
    const gl = this.gl;
    this.progs = {};
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
                          [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  }

  compile(type, src) {
    const gl = this.gl, s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  async load(name, url) {
    const gl = this.gl;
    let body = await (await fetch(url, { cache: 'no-store' })).text();
    body = body.replace(/^#define Y_DOWN .*$/m, '#define Y_DOWN false');
    const prog = gl.createProgram();
    gl.attachShader(prog, this.compile(gl.VERTEX_SHADER, '#version 300 es\nin vec2 pos; void main() { gl_Position = vec4(pos, 0.0, 1.0); }'));
    gl.attachShader(prog, this.compile(gl.FRAGMENT_SHADER, PRELUDE + body + POST));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(name + ': ' + gl.getProgramInfoLog(prog));
    const u = {};
    for (const n of ['iResolution', 'iTime', 'iCurrentCursor', 'iPreviousCursor', 'iCurrentCursorColor', 'iPreviousCursorColor',
                     'iCurrentCursorStyle', 'iCursorVisible', 'iTimeCursorChange', 'iFocus', 'iPalette', 'iBackgroundColor',
                     'iForegroundColor', 'iCursorText', 'iChannel0']) u[n] = gl.getUniformLocation(prog, n);
    this.progs[name] = { prog, u, pos: gl.getAttribLocation(prog, 'pos') };
  }

  // term: the painted screen (canvas); s: { time, change, cur, prev (rects), color, signal, bg, fg, curText }.
  // signal: 'start' (Enter, blue bit set now), 'done' (green bit), null.
  draw(name, term, s) {
    const gl = this.gl, P = this.progs[name], u = P.u;
    const W = term.width, H = term.height;
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
    gl.viewport(0, 0, W, H);
    gl.useProgram(P.prog);
    gl.enableVertexAttribArray(P.pos); gl.vertexAttribPointer(P.pos, 2, gl.FLOAT, false, 0, 0);
    const base = hex(s.color);
    const odd = [base[0], base[1], (Math.round(base[2] * 255) | 1) / 255];
    const oddG = [base[0], (Math.round(base[1] * 255) | 1) / 255, base[2]];
    gl.uniform3f(u.iResolution, W, H, 1);
    gl.uniform1f(u.iTime, s.time);
    gl.uniform1f(u.iTimeCursorChange, s.change);
    gl.uniform4f(u.iCurrentCursor, ...s.cur);
    gl.uniform4f(u.iPreviousCursor, ...s.prev);
    gl.uniform4f(u.iCurrentCursorColor, ...(s.signal === 'start' ? odd : s.signal === 'done' ? oddG : base), 1);
    gl.uniform4f(u.iPreviousCursorColor, ...base, 1);
    gl.uniform1i(u.iCurrentCursorStyle, 0);
    gl.uniform1i(u.iCursorVisible, 1);
    gl.uniform1i(u.iFocus, 1);
    const pal = new Float32Array(48);
    pal.set(hex('#d69de7'), 13 * 3); pal.set(hex('#6eceda'), 14 * 3);
    gl.uniform3fv(u.iPalette, pal);
    gl.uniform3f(u.iBackgroundColor, ...hex(s.bg));
    gl.uniform3f(u.iForegroundColor, ...hex(s.fg));
    gl.uniform3f(u.iCursorText, ...hex(s.curText));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, term);
    gl.uniform1i(u.iChannel0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return this.canvas;
  }
}
