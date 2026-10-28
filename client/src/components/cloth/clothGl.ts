// A cloth banner drawn with WebGL (docs/design/rendered-assets.md, "Cloth banners").
// No library: one grid, one shader pair. The cloth is pinned at the rod and moved by a few broad,
// slow folds that grow towards the bottom, which is how heavy fabric hangs. The look comes from a
// twill weave normal map made in Blender, a fabric (wrap) diffuse, a sheen that slides over the
// folds as they move, stitched hems, and a rod pocket at the top. Text is painted into a texture
// from the page's own layout, so it folds and catches the light with the cloth.

export interface ClothColors {
  /** Light, mid and dark tones of the cloth, and the ink colour, as CSS hex. */
  lt: string;
  md: string;
  dk: string;
  ink: string;
}

export interface ClothOptions {
  /** Banner size in CSS px. */
  width: number;
  height: number;
  colors: ClothColors;
  /** Extra canvas room around the banner, for the sway. */
  pad: number;
  weave: HTMLImageElement;
  /** Text and avatars, painted at device pixel scale, same size as the canvas. */
  print: HTMLCanvasElement;
  /** A different phase per banner, so they never move in step. */
  seed: number;
}

const VERT = `
attribute vec2 aGrid;            // 0..1 across, 0..1 down
uniform vec2 uSize;              // banner size, px
uniform vec2 uCanvas;            // canvas size, px
uniform float uPad;
uniform float uTime;
varying vec2 vPos;               // banner space, px (undisplaced, for the shape, hem and print)
varying vec3 vNormal;
varying float vDepth;

// Fold field, in px of depth towards the viewer. Mirrors design/blender (Banner Cloth).
float fold(vec2 g, float t) {
  // Pinned at the rod, freer towards the hem. Mostly vertical drapes (they vary across the
  // width), drifting slowly sideways, with a lazy breath in and out: heavy cloth, never flutter.
  float w = pow(g.y, 1.1);
  float drape = 0.55 * sin(g.x * 6.4 + t * 0.8 + g.y * 1.2)
              + 0.30 * sin(g.x * 11.3 - t * 1.1 + g.y * 2.4)
              + 0.15 * sin(g.x * 19.0 + t * 1.6 - g.y * 1.5);
  float z = 20.0 * w * drape;
  z += 6.0 * w * sin(t * 0.5 + g.x * 1.6);
  // A small rest fold right under the rod, where the cloth gathers on it.
  z += 2.0 * (1.0 - smoothstep(0.0, 0.12, g.y)) * sin(g.x * 26.0);
  return z;
}

void main() {
  vec2 g = aGrid;
  float z = fold(g, uTime);
  // Analytic-ish normal from two nearby samples (in px).
  float e = 0.01;
  float zx = (fold(g + vec2(e, 0.0), uTime) - z) / (e * uSize.x);
  float zy = (fold(g + vec2(0.0, e), uTime) - z) / (e * uSize.y);
  vNormal = normalize(vec3(-zx, zy, 1.0));
  vDepth = z;
  vPos = g * uSize;
  // A slow sideways sway at the hem, and a slight lift where the cloth bows out.
  vec2 p = vPos;
  p.x += 2.4 * pow(g.y, 1.5) * sin(uTime * 0.5 + 1.3);
  p.y -= 0.0025 * z * z;
  // Gentle perspective: nearer parts sit a touch further from the centre.
  float k = 1.0 + z / 900.0;
  p.x = (p.x - uSize.x * 0.5) * k + uSize.x * 0.5;
  vec2 c = (p + vec2(uPad, 0.0)) / uCanvas;
  gl_Position = vec4(c.x * 2.0 - 1.0, 1.0 - c.y * 2.0, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform vec2 uSize;
uniform vec2 uCanvas;
uniform float uPad;
uniform vec3 uLt;
uniform vec3 uMd;
uniform vec3 uDk;
uniform vec3 uInk;
uniform sampler2D uWeave;
uniform sampler2D uPrint;
varying vec2 vPos;
varying vec3 vNormal;
varying float vDepth;

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c) { return pow(c, vec3(1.0 / 2.2)); }

// Distance inside the banner outline (px; negative outside): straight sides and a chevron bottom,
// the same shape as the SVG banner (drawn on 200 wide units, scaled). The top is not an edge: the
// cloth wraps the rod there.
float shapeDist(vec2 p) {
  float sx = uSize.x / 200.0;
  float H = uSize.y;
  float left = p.x - 4.0 * sx;
  float right = (uSize.x - 4.0 * sx) - p.x;
  // Chevron: from (15, H-27) down to (100, H-2) and back up to (185, H-27).
  vec2 a = vec2(15.0 * sx, H - 27.0);
  vec2 b = vec2(uSize.x * 0.5, H - 2.0);
  vec2 c = vec2(185.0 * sx, H - 27.0);
  // Each edge's normal points into the cloth (up the page).
  vec2 d1 = normalize(b - a);
  vec2 d2 = normalize(c - b);
  float bottom = p.x < b.x ? dot(p - a, vec2(d1.y, -d1.x)) : dot(p - b, vec2(d2.y, -d2.x));
  return min(min(left, right), bottom);
}

void main() {
  float d = shapeDist(vPos);
  float aa = 0.75;
  float inside = smoothstep(-aa, aa, d);
  if (inside <= 0.0) discard;

  // Fine twill weave: one 16-thread tile per 14 px, so a thread is under 1 px.
  vec3 wn = texture2D(uWeave, vPos / 12.0).xyz * 2.0 - 1.0;
  vec3 N = normalize(vNormal + vec3(wn.xy * 0.55, 0.0));
  // Thread gaps sit lower and catch less light: darken where the weave normal tilts away.
  float gap = smoothstep(0.92, 0.6, wn.z);

  // Hem: the outer 5 px is folded back (thicker, a little darker), with a stitch line inside it.
  float hem = 1.0 - smoothstep(4.0, 5.5, d);
  // The fold at the very edge rolls away from the eye, so it catches less light.
  float roll = 1.0 - smoothstep(0.0, 2.0, d);
  N = normalize(N + roll * vec3(0.0, 0.0, -0.6));
  float stitchLine = 1.0 - smoothstep(0.35, 0.9, abs(d - 7.0));
  float along = vPos.y > uSize.y - 34.0 ? vPos.x : vPos.y;
  float dash = step(0.45, fract(along / 3.2));
  float stitch = stitchLine * dash * (vPos.y > 8.0 ? 1.0 : 0.0);

  // Rod pocket: the top 9 px wraps round the rod; a shadow line where it is sewn shut.
  float pocket = 1.0 - smoothstep(6.0, 9.0, vPos.y);
  float seam = 1.0 - smoothstep(0.4, 1.2, abs(vPos.y - 9.5));

  // Cloth colour: a soft light-to-mid fall, darker hems.
  vec3 lt = toLinear(uLt), md = toLinear(uMd), dk = toLinear(uDk);
  vec3 base = mix(lt, md, smoothstep(0.0, 1.0, vPos.y / uSize.y) * 0.55);
  base = mix(base, md, hem * 0.35);

  // Printed text and avatars (premultiplied colour + coverage).
  vec4 ink = texture2D(uPrint, (vPos + vec2(uPad, 0.0)) / uCanvas);
  base = base * (1.0 - ink.a) + toLinear(ink.rgb / max(ink.a, 0.001)) * ink.a;

  // Light: warm key from the top left and in front, cool fill from the right (the Blender studio).
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(-0.78, 0.42, 0.46));
  vec3 F = normalize(vec3(0.7, 0.1, 0.7));
  float wrap = 0.22;
  float diff = clamp((dot(N, L) + wrap) / (1.0 + wrap), 0.0, 1.0);
  float fill = clamp((dot(N, F) + wrap) / (1.0 + wrap), 0.0, 1.0);
  // Sheen: fabric glows softly where it turns away from the eye; it slides as the folds move.
  float sheen = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.6);
  // Satin highlight, soft and wide.
  vec3 Hh = normalize(L + V);
  float spec = pow(clamp(dot(N, Hh), 0.0, 1.0), 28.0);
  // Folds that recede are a little darker (cheap occlusion).
  float occl = 0.7 + 0.3 * smoothstep(-16.0, 12.0, vDepth);

  vec3 col = base * (0.26 + 0.86 * diff * vec3(1.0, 0.96, 0.9) + 0.18 * fill * vec3(0.88, 0.93, 1.0)) * occl;
  col *= 1.0 - gap * 0.16;
  col += lt * sheen * 0.55;
  col += vec3(1.0, 0.97, 0.92) * spec * 0.10;
  col = mix(col, col * 0.62, stitch * 0.7);
  col = mix(col, col * (0.86 + 0.18 * (1.0 - vPos.y / 9.0)), pocket);
  col = mix(col, col * 0.7, seam * 0.6);
  col = mix(col, col * 0.85, hem * 0.4);

  gl_FragColor = vec4(toSrgb(col) * inside, inside);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error("no shader");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader failed");
  return s;
}

export class ClothRenderer {
  private gl: WebGLRenderingContext;
  private count: number;
  private uni: Record<string, WebGLUniformLocation | null> = {};
  private printTex: WebGLTexture | null;
  private opts: ClothOptions;
  private dpr: number;

  constructor(canvas: HTMLCanvasElement, opts: ClothOptions, dpr: number) {
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!gl) throw new Error("WebGL unavailable");
    this.gl = gl;
    this.opts = opts;
    this.dpr = dpr;
    const prog = gl.createProgram();
    if (!prog) throw new Error("no program");
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link failed");
    gl.useProgram(prog);
    for (const n of ["uSize", "uCanvas", "uPad", "uTime", "uLt", "uMd", "uDk", "uInk", "uWeave", "uPrint"]) this.uni[n] = gl.getUniformLocation(prog, n);

    // Grid: 64 x 48 cells as triangles.
    const cols = 64;
    const rows = 48;
    const pts: number[] = [];
    const at = (i: number, j: number) => [i / cols, j / rows];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        pts.push(...at(i, j), ...at(i + 1, j), ...at(i, j + 1), ...at(i + 1, j), ...at(i + 1, j + 1), ...at(i, j + 1));
      }
    }
    this.count = pts.length / 2;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aGrid");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    // Weave: tiled, mipmapped (power-of-two image).
    const weave = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, weave);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, opts.weave);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.uniform1i(this.uni.uWeave ?? null, 0);

    this.printTex = gl.createTexture();
    this.setPrint(opts.print);
    gl.uniform1i(this.uni.uPrint ?? null, 1);

    const c = opts.colors;
    gl.uniform3fv(this.uni.uLt ?? null, hexToRgb(c.lt));
    gl.uniform3fv(this.uni.uMd ?? null, hexToRgb(c.md));
    gl.uniform3fv(this.uni.uDk ?? null, hexToRgb(c.dk));
    gl.uniform3fv(this.uni.uInk ?? null, hexToRgb(c.ink));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  /** Re-upload the printed text (after fonts load or the layout changes). */
  setPrint(print: HTMLCanvasElement): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.printTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, print);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  /** Draw one frame at time t (seconds, already slowed and offset by the caller). */
  draw(t: number): void {
    const gl = this.gl;
    const o = this.opts;
    const cw = o.width + o.pad * 2;
    const ch = o.height + o.pad;
    gl.viewport(0, 0, Math.round(cw * this.dpr), Math.round(ch * this.dpr));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.uni.uSize ?? null, o.width, o.height);
    gl.uniform2f(this.uni.uCanvas ?? null, cw, ch);
    gl.uniform1f(this.uni.uPad ?? null, o.pad);
    gl.uniform1f(this.uni.uTime ?? null, t + o.seed * 7.3);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
  }

  /** New size or device scale after a resize. */
  resize(width: number, height: number, dpr: number): void {
    this.opts = { ...this.opts, width, height };
    this.dpr = dpr;
  }
}
