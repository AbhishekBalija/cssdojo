import pixelmatch from "pixelmatch";
import type { PNG } from "pngjs";

// Visual metric from the scoring spec:
//   frame = 100 * S^2 * C^2, with C = 1 - meanDeltaE / DE_SCALE
// measured only over the component region (pixels that differ from the target's
// background in either image, grown a little), so empty background never hides
// a small component's mistakes.

/**
 * Mean colour error (CIE76) at which the colour factor reaches zero. A right
 * shape in the wrong fill lands around 40 for that frame; exact colours are
 * given on the brief, so a visible colour miss should cost.
 */
const DE_SCALE = 12;
/** Region growth in device pixels (2 CSS px at 2x). */
const GROW = 4;
/** pixelmatch threshold: low, so a pixel covered in one image and empty in the other counts. */
const PM_THRESHOLD = 0.05;
/**
 * Looser threshold used where BOTH images cover the pixel (neither is
 * background). There a difference is mostly a wrong colour, which the colour
 * term scores; counting it as missing shape too dropped a right-shaped button
 * with the wrong fill to 8/100 for that state.
 */
const PM_FILL_THRESHOLD = 0.15;
/** A pixel is "not background" when its RGB distance from the background exceeds this. */
const BG_TOLERANCE = 6;
/** Width of the band around the target's shape edges, in device pixels. */
const EDGE_RADIUS = 2;
/**
 * Edge penalty: any visible mistake along the shape's outline (corner radius,
 * border, outline) costs up to EDGE_MAX of the frame. It saturates quickly
 * (EDGE_SCALE), so a small radius error costs nearly as much as a big one.
 * Tuned with the golden set: radius 4px vs 8px must stay under 90.
 */
const EDGE_MAX = 0.15;
const EDGE_SCALE = 0.01;
/** Drift forgiven, in device pixels. */
const SHIFT = 1;
/** Colour distance under which a neighbouring pixel counts as "the same colour". */
const SHIFT_DE = Number(process.env.DOJO_SHIFT_DE ?? 6);

export type Rgb = [number, number, number];

export interface FrameMetric {
  score: number;
  shape: number;
  deltaE: number;
  regionPixels: number;
  diffPixels: number;
}

/** The most common colour along the image border, taken as the background. */
export function backgroundColor(img: PNG): Rgb {
  const counts = new Map<number, number>();
  const { width: w, height: h, data } = img;
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const key = ((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (let x = 0; x < w; x++) {
    add(x, 0);
    add(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    add(0, y);
    add(w - 1, y);
  }
  let best = 0;
  let bestN = -1;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return [(best >> 16) & 255, (best >> 8) & 255, best & 255];
}

function toLinear(v: number): number {
  const c = v / 255;
  return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
}

/** sRGB to CIE Lab (D65). */
export function rgbToLab(r: number, g: number, b: number): Rgb {
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  // Two passes (rows, then columns) of a square dilation: O(w*h*r) instead of O(w*h*r^2).
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dx = -r; dx <= r; dx++) {
        const X = x + dx;
        if (X >= 0 && X < w) tmp[y * w + X] = 1;
      }
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!tmp[y * w + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        const Y = y + dy;
        if (Y >= 0 && Y < h) out[Y * w + x] = 1;
      }
    }
  }
  return out;
}

/** Pixels where the target's colour changes sharply: shape edges. */
function edgeMask(img: PNG): Uint8Array {
  const { width: w, height: h, data } = img;
  const edges = new Uint8Array(w * h);
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const j = i + 4;
      const k = i + w * 4;
      const d1 = Math.abs((data[i] ?? 0) - (data[j] ?? 0)) + Math.abs((data[i + 1] ?? 0) - (data[j + 1] ?? 0)) + Math.abs((data[i + 2] ?? 0) - (data[j + 2] ?? 0));
      const d2 = Math.abs((data[i] ?? 0) - (data[k] ?? 0)) + Math.abs((data[i + 1] ?? 0) - (data[k + 1] ?? 0)) + Math.abs((data[i + 2] ?? 0) - (data[k + 2] ?? 0));
      if (d1 > 60 || d2 > 60) edges[y * w + x] = 1;
    }
  }
  return dilate(edges, w, h, EDGE_RADIUS);
}

function labImage(img: PNG): Float32Array {
  const n = img.width * img.height;
  const out = new Float32Array(n * 3);
  const cache = new Map<number, Rgb>();
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const key = ((img.data[i] ?? 0) << 16) | ((img.data[i + 1] ?? 0) << 8) | (img.data[i + 2] ?? 0);
    let lab = cache.get(key);
    if (!lab) {
      lab = rgbToLab(img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0);
      cache.set(key, lab);
    }
    out[p * 3] = lab[0];
    out[p * 3 + 1] = lab[1];
    out[p * 3 + 2] = lab[2];
  }
  return out;
}

function labDist(a: Float32Array, i: number, b: Float32Array, j: number): number {
  return Math.hypot((a[i * 3] ?? 0) - (b[j * 3] ?? 0), (a[i * 3 + 1] ?? 0) - (b[j * 3 + 1] ?? 0), (a[i * 3 + 2] ?? 0) - (b[j * 3 + 2] ?? 0));
}

/** Smallest colour distance from `a` at p to `b` anywhere in p's 3x3 neighbourhood. */
function nearDist(a: Float32Array, b: Float32Array, p: number, w: number, h: number): number {
  const x = p % w;
  const y = (p - x) / w;
  let best = Infinity;
  for (let dy = -SHIFT; dy <= SHIFT; dy++) {
    const Y = y + dy;
    if (Y < 0 || Y >= h) continue;
    for (let dx = -SHIFT; dx <= SHIFT; dx++) {
      const X = x + dx;
      if (X < 0 || X >= w) continue;
      const d = labDist(a, p, b, Y * w + X);
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * Compares one frame. Sub-pixel drift (one device pixel, half a CSS pixel) is
 * forgiven, because different but correct techniques can land text on a
 * slightly different sub-pixel. Anything larger counts.
 */
export function compareFrames(target: PNG, candidate: PNG, bg: Rgb = backgroundColor(target)): FrameMetric {
  const { width: w, height: h } = target;
  if (candidate.width !== w || candidate.height !== h) throw new Error("Frame sizes differ");
  const diffOut = new Uint8Array(w * h * 4);
  pixelmatch(target.data, candidate.data, diffOut, w, h, { threshold: PM_THRESHOLD, includeAA: false, diffMask: true, alpha: 0 });
  const fillDiff = new Uint8Array(w * h * 4);
  pixelmatch(target.data, candidate.data, fillDiff, w, h, { threshold: PM_FILL_THRESHOLD, includeAA: false, diffMask: true, alpha: 0 });
  // Second pass that keeps anti-aliased pixels: a different corner radius only
  // shows up in the soft edge pixels, which the first pass ignores.
  const edgeDiff = new Uint8Array(w * h * 4);
  pixelmatch(target.data, candidate.data, edgeDiff, w, h, { threshold: 0.1, includeAA: true, diffMask: true, alpha: 0 });

  const fg = new Uint8Array(w * h);
  const notBg = (img: PNG, i: number) =>
    Math.abs((img.data[i] ?? 0) - bg[0]) + Math.abs((img.data[i + 1] ?? 0) - bg[1]) + Math.abs((img.data[i + 2] ?? 0) - bg[2]) > BG_TOLERANCE;
  for (let p = 0; p < w * h; p++) if (notBg(target, p * 4) || notBg(candidate, p * 4)) fg[p] = 1;
  const region = dilate(fg, w, h, GROW);
  const edges = edgeMask(target);
  const tLab = labImage(target);
  const cLab = labImage(candidate);
  // A flagged pixel is forgiven when each image has the other's colour within one pixel.
  const forgiven = (p: number) => nearDist(cLab, tLab, p, w, h) < SHIFT_DE && nearDist(tLab, cLab, p, w, h) < SHIFT_DE;
  const flagged = (mask: Uint8Array, p: number) => (mask[p * 4] ?? 0) === 255 && (mask[p * 4 + 1] ?? 0) === 0;

  let regionN = 0;
  let diffN = 0;
  let edgeN = 0;
  let edgeDiffN = 0;
  let de = 0;
  for (let p = 0; p < w * h; p++) {
    if (!region[p]) continue;
    regionN++;
    const covered = notBg(target, p * 4) && notBg(candidate, p * 4);
    const d1 = covered ? flagged(fillDiff, p) : flagged(diffOut, p);
    const d2 = edges[p] ? flagged(edgeDiff, p) : false;
    const ok = (d1 || d2) && forgiven(p);
    if (d1 && !ok) diffN++;
    if (edges[p]) {
      edgeN++;
      if (d2 && !ok) edgeDiffN++;
    }
    const direct = labDist(tLab, p, cLab, p);
    de += Math.min(20, direct < 1 ? direct : Math.max(Math.min(nearDist(cLab, tLab, p, w, h), nearDist(tLab, cLab, p, w, h)), 0));
  }
  if (regionN === 0) return { score: 100, shape: 1, deltaE: 0, regionPixels: 0, diffPixels: 0 };
  const shape = 1 - diffN / regionN;
  const edgeError = edgeN === 0 ? 0 : edgeDiffN / edgeN;
  const edge = 1 - EDGE_MAX * (1 - Math.exp(-edgeError / EDGE_SCALE));
  const deltaE = de / regionN;
  const colour = Math.max(0, 1 - deltaE / DE_SCALE);
  const score = 100 * shape * shape * edge * colour * colour;
  return { score: Math.max(0, score), shape, deltaE, regionPixels: regionN, diffPixels: diffN + edgeDiffN };
}

/** Number of pixels that differ between two frames of the same answer. */
export function countChangedPixels(a: PNG, b: PNG): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const d = Math.abs((a.data[i] ?? 0) - (b.data[i] ?? 0)) + Math.abs((a.data[i + 1] ?? 0) - (b.data[i + 1] ?? 0)) + Math.abs((a.data[i + 2] ?? 0) - (b.data[i + 2] ?? 0));
    if (d > 12) n++;
  }
  return n;
}
