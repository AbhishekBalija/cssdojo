import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Cuts the Blender renders in design/renders/ into the small WebP pieces the site uses,
// at 1x, 2x and 3x, plus a layers.json with sizes and pivots (docs/design/rendered-assets.md).
// Renders are 4x of the CSS size, so every crop below is in CSS px and multiplied by RENDER_SCALE.
//
// Run: bun run art

const RENDER_SCALE = 4;
const DENSITIES = [1, 2, 3] as const;
const ROOT = path.resolve(import.meta.dirname, "../..");
const RENDERS = path.join(ROOT, "design/renders");
const OUT = path.join(ROOT, "client/public/art");

interface Crop {
  /** Output name, for example "cap-left". */
  name: string;
  /** Render layer file in design/renders/<asset>/. */
  layer: string;
  /** Left edge and width in CSS px. */
  x: number;
  width: number;
  /** Top edge and height in CSS px. Defaults to the full canvas height. */
  y?: number;
  height?: number;
  flip?: boolean;
}

interface AssetSpec {
  asset: string;
  /** Canvas size in CSS px, the same for every layer of the asset. */
  canvas: { width: number; height: number };
  crops: Crop[];
  /** Anything the CSS needs to place the pieces, in CSS px. */
  meta: Record<string, unknown>;
}

// The brass rail: canvas 360 x 50, the rod's centre line is 17px from the top.
const RAIL: AssetSpec = {
  asset: "rail",
  canvas: { width: 360, height: 50 },
  crops: [
    { name: "cap-left", layer: "rodset", x: 0, width: 32 },
    { name: "cap-right", layer: "rodset", x: 328, width: 32 },
    // One CSS px of rod, repeated across the card, so it joins without a seam at any width.
    { name: "rod", layer: "rodset", x: 80, width: 1 },
    { name: "hook", layer: "hook", x: 172, width: 16 },
    { name: "wire", layer: "wire", x: 94, width: 12 },
  ],
  meta: {
    rodCentreY: 17,
    // The wire swings from its sleeve on the rod: top centre of the wire piece.
    wirePivot: { x: "50%", y: "36%" },
  },
};

// The streak tag: canvas 72 x 132. Two full-canvas layers; the tag hangs inside the cord, so it
// swings with the cord around the nail and a little more around its own eyelet.
const STREAK: AssetSpec = {
  asset: "streak",
  canvas: { width: 72, height: 132 },
  crops: [
    { name: "cord", layer: "cord", x: 0, width: 72 },
    { name: "tag", layer: "tag", x: 0, width: 72 },
  ],
  meta: {
    cordPivot: { x: "36px", y: "4px" },
    tagPivot: { x: "36px", y: "44px" },
    // Free face for the live icon and number.
    face: { top: 58, left: 9, right: 9 },
  },
};

// The belt pillars: black marble plinths, one whole image per belt, each rendered at its own height
// so the veins never stretch. Canvas is 120 wide (the plinth is the middle 100). Heights come from
// the renders: 4x pixel height / 4. medalY is the top face centre as a share of the image height.
const PILLARS = {
  white: { height: 121.5, medalY: 0.1012 },
  yellow: { height: 150.5, medalY: 0.0817 },
  green: { height: 179.25, medalY: 0.0685 },
  brown: { height: 208.25, medalY: 0.059 },
  black: { height: 237.25, medalY: 0.0518 },
};
const PILLAR: AssetSpec = {
  asset: "pillar",
  canvas: { width: 120, height: 237.25 },
  crops: Object.entries(PILLARS).map(([belt, p]): Crop => ({ name: belt, layer: belt, x: 0, width: 120, y: 0, height: p.height })),
  meta: { plinthWidth: 100, pillars: PILLARS },
};

// The player token: 48 x 48. A grey enamel face (each player's colour is blended in by CSS, so one
// render covers everyone) and a brass rim on top. The face was rendered with the rim as a holdout,
// so the rim's contact shadow on the enamel is kept.
const TOKEN: AssetSpec = {
  asset: "token",
  canvas: { width: 48, height: 48 },
  crops: [
    { name: "face", layer: "face", x: 0, width: 48 },
    { name: "rim", layer: "rim", x: 0, width: 48 },
  ],
  meta: { faceRadius: 19.2, rimRadius: 23.5 },
};

async function exportAsset(spec: AssetSpec): Promise<void> {
  const outDir = path.join(OUT, spec.asset);
  await mkdir(outDir, { recursive: true });
  const sizes: Record<string, { width: number; height: number; bytes2x: number }> = {};
  for (const crop of spec.crops) {
    const source = path.join(RENDERS, spec.asset, `${crop.layer}.png`);
    const cropHeight = crop.height ?? spec.canvas.height;
    const region = {
      left: crop.x * RENDER_SCALE,
      top: (crop.y ?? 0) * RENDER_SCALE,
      width: crop.width * RENDER_SCALE,
      height: cropHeight * RENDER_SCALE,
    };
    let bytes2x = 0;
    for (const n of DENSITIES) {
      let img = sharp(source).extract(region);
      if (crop.flip) img = img.flop();
      const file = path.join(outDir, `${crop.name}@${n}x.webp`);
      const info = await img
        .resize(Math.round(crop.width * n), Math.round(cropHeight * n), { kernel: "lanczos3" })
        .webp({ quality: 82, alphaQuality: 90, effort: 6, smartSubsample: true })
        .toFile(file);
      if (n === 2) bytes2x = info.size;
    }
    sizes[crop.name] = { width: crop.width, height: cropHeight, bytes2x };
  }
  await writeFile(path.join(outDir, "layers.json"), `${JSON.stringify({ canvas: spec.canvas, pieces: sizes, ...spec.meta }, null, 2)}\n`);
  for (const [name, s] of Object.entries(sizes)) {
    const kb = (s.bytes2x / 1024).toFixed(1);
    const warn = s.bytes2x > 12 * 1024 ? "  over the 12 KB budget" : "";
    console.log(`${spec.asset}/${name}: ${s.width}x${s.height}, ${kb} KB at 2x${warn}`);
  }
}

await exportAsset(RAIL);
await exportAsset(STREAK);
await exportAsset(PILLAR);
await exportAsset(TOKEN);

// Banner fabric from a real scan: Poly Haven "Rough Linen" (CC0, polyhaven.com/a/rough_linen).
// The scan is blue linen, so only its structure is kept: the normal map (thread relief), the
// roughness map (threads catch light unevenly) and a detail map (the scan's brightness only, centred
// on mid grey so it can tint any belt colour). All three tile.
{
  const src = path.join(RENDERS, "cloth", "polyhaven");
  const outDir = path.join(OUT, "cloth");
  await mkdir(outDir, { recursive: true });
  const size = 512;
  const normal = await sharp(path.join(src, "rough_linen_nor_gl_1k.png")).resize(size, size).webp({ quality: 88, effort: 6 }).toFile(path.join(outDir, "linen-normal.webp"));
  // Roughness only needs its broad variation, so half size and softer compression is plenty.
  const rough = await sharp(path.join(src, "rough_linen_rough_1k.png")).resize(size / 2, size / 2).greyscale().blur(0.6).webp({ quality: 70, effort: 6 }).toFile(path.join(outDir, "linen-rough.webp"));
  // Detail: greyscale, contrast stretched, then centred on 128 so multiplying by it keeps the colour.
  const { data, info } = await sharp(path.join(src, "rough_linen_diff_1k.png")).resize(size, size).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (const v of data) sum += v;
  const mean = sum / data.length;
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(128 + ((data[i] ?? 0) - mean) * 1.6)));
  const detail = await sharp(out, { raw: { width: info.width, height: info.height, channels: 1 } }).webp({ quality: 85, effort: 6 }).toFile(path.join(outDir, "linen-detail.webp"));
  for (const [name, i] of [["linen-normal", normal], ["linen-rough", rough], ["linen-detail", detail]] as const) console.log(`cloth/${name}: ${i.width}x${i.height}, ${(i.size / 1024).toFixed(1)} KB`);
}

