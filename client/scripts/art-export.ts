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
  /** Left edge and width in CSS px. The crop always keeps the full canvas height. */
  x: number;
  width: number;
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

async function exportAsset(spec: AssetSpec): Promise<void> {
  const outDir = path.join(OUT, spec.asset);
  await mkdir(outDir, { recursive: true });
  const sizes: Record<string, { width: number; height: number; bytes2x: number }> = {};
  for (const crop of spec.crops) {
    const source = path.join(RENDERS, spec.asset, `${crop.layer}.png`);
    const region = {
      left: crop.x * RENDER_SCALE,
      top: 0,
      width: crop.width * RENDER_SCALE,
      height: spec.canvas.height * RENDER_SCALE,
    };
    let bytes2x = 0;
    for (const n of DENSITIES) {
      let img = sharp(source).extract(region);
      if (crop.flip) img = img.flop();
      const file = path.join(outDir, `${crop.name}@${n}x.webp`);
      const info = await img
        .resize(crop.width * n, spec.canvas.height * n, { kernel: "lanczos3" })
        .webp({ quality: 82, alphaQuality: 90, effort: 6, smartSubsample: true })
        .toFile(file);
      if (n === 2) bytes2x = info.size;
    }
    sizes[crop.name] = { width: crop.width, height: spec.canvas.height, bytes2x };
  }
  await writeFile(path.join(outDir, "layers.json"), `${JSON.stringify({ canvas: spec.canvas, pieces: sizes, ...spec.meta }, null, 2)}\n`);
  for (const [name, s] of Object.entries(sizes)) {
    const kb = (s.bytes2x / 1024).toFixed(1);
    const warn = s.bytes2x > 12 * 1024 ? "  over the 12 KB budget" : "";
    console.log(`${spec.asset}/${name}: ${s.width}x${s.height}, ${kb} KB at 2x${warn}`);
  }
}

await exportAsset(RAIL);
