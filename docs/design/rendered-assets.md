# Rendered assets: spec

Status: in progress, 2026-10-28. Done: brass rail, streak tag, belt pillars, cloth banners, player tokens, belt knot, achievement badges (pilot: belts, pack cleared, streaks). Next: the other 9 badges. Replaces the hand-drawn SVG and CSS objects (belt knot, belt band, brass rail, streak tag, belt pillars) with images rendered in Blender, because brass shine and cloth folds need real light and reflections.

## Art direction (same for every asset, so they read as one set)

- **Camera:** orthographic, straight-on front view. No perspective, so pieces line up with the flat UI around them.
- **Key light:** one large soft area light, top left at about 45 degrees, warm white (4500K).
- **Fill:** a faint cool fill from the right, about 15% of the key, so shadow sides never go black.
- **Reflections:** a studio HDRI (Poly Haven, CC0) for the brass only, so it shows the same soft highlight bands as the reference.
- **Materials:**
  - Satin brushed brass: metallic, roughness about 0.35, anisotropic along the rod.
  - Matte cotton belt cloth with stitch rows. The base colour is the `CLOTH.md` token for each belt in `client/src/components/Craft.tsx`.
  - Dark enamel with a polished metal rim for the streak tag.
  - Honed stone for the pillars.
- **Colour management:** AgX view, sRGB output. Each rendered mid-tone is checked against its `CLOTH` token so the art and the UI colours agree.
- **No baked shadows:** objects render on a transparent background. The cast shadow is a CSS `drop-shadow` from theme tokens, so one render works in light and dark mode. Contact shading inside the object (folds, where pieces meet) stays baked in.
- **No text in renders:** numbers, names and counts stay live HTML on top of the image.

## Assets, sizes and slicing

Sizes are CSS pixels as used today. Every asset is exported at 1x, 2x and 3x. Sources render at 4x and are scaled down for clean edges.

| Asset | Used in | Display size | Pieces |
|---|---|---|---|
| Belt knot + tails | `Knot` (card bands, profile at 1.25x), sidebar belt card | 44 x 58, and 55 x 73 on the profile | One sprite per belt (5) |
| Belt band | `BeltBand` across the top of cards | full card width x 22 | One seamless horizontal tile per belt (5), repeated with `background-repeat: repeat-x` |
| Brass rail | `Hang` above pack cards | full card width x about 26 | Left cap (ball + collar), seamless rod tile, right cap, hook, wire tile (repeat-y), wire end. Joined in CSS so it fits any width |
| Streak tag | header, `Shell.tsx` | 72 x 132 including the cord | One sprite with an empty face. The number is live text |
| Belt pillars | Wall, `Leaderboards.tsx` | 55 to 92 wide (capped), heights rise in equal steps and scale with the width | Square black marble plinth, one whole image per belt at its own height (veins would distort if stretched). No belt on the plinth; the detailed belt knot is its own asset. Labels on a plaque row below |
| Player token | boards, Packs page, pack cards, Wall, cloth banners | 18 to 38 | Brass rim + neutral grey enamel face, 48 px canvas. CSS blends the player colour into the face (overlay), so one render covers everyone. Initials live; a photo replaces the enamel |

## Cloth banners (live, real physics)

The top 3 on the Wall are real cloth, simulated and drawn live, because cloth bends and CSS layers cannot.

- **Why not video:** a Blender cloth loop would weigh about 1 MB for three banners, needs two formats for transparency (HEVC for Safari, VP9 for the rest), and the live text would sit still on moving cloth.
- **Fabric:** a real scan, Poly Haven "Rough Linen" (CC0, polyhaven.com/a/rough_linen). Only its structure is used, tinted to each belt:
  - normal map: 512 px, 33 KB
  - roughness map: 256 px, 1 KB
  - detail map: brightness only, 512 px, 37 KB
  - The weave is drawn about 3.5x larger than true scale on purpose. At true scale a thread is a tenth of a pixel.
- **Physics** (`client/src/components/cloth/clothScene.ts`): a Verlet simulation of about 30 x 20 points, run at a fixed 60 steps a second.
  - The top row is sewn onto the rod 12% narrower than the cloth, so the slack falls into real drapes.
  - Springs resist stretching hard but squashing hardly at all, so the cloth buckles into folds instead of fanning out.
  - Long-range tethers keep every point within its length of the rod, so it never sags.
  - Gusting wind pushes each triangle by how squarely it faces the wind.
- **Look:** three.js physical material (fabric sheen, normal and roughness maps), studio reflections (RoomEnvironment), a key raking in from the left with soft self-shadows into the folds, and Neutral tone mapping so light colours stay true.
- **Surface:** belt colour, linen detail (multiply), the print, a rod pocket, and turned, stitched hems, painted into one texture. The chevron is a soft alpha mask.
- **Text:** the page still lays out the rank, name, points and token. The painter draws each `[data-cloth]` element onto the cloth, so print folds with the fabric. The page copy stays (transparent fill), so links work and screen readers read it.
- **Cost and safety:**
  - three.js and the scene are one lazy chunk (136 KB gzipped), loaded only when a banner is on screen.
  - Draws at 30 fps only while on screen.
  - Settles and draws one still frame under reduced motion.
  - One WebGL context per canvas for its life.
  - No WebGL, or a failed load, leaves the SVG banner.
- **Later:** when HTML-in-Canvas ships beyond Chrome's origin trial, the real DOM can be drawn onto the cloth instead of the painter.

## Export and budgets

- **Format:** WebP with alpha, at quality 82 and alpha quality 90. Lossless only if a piece shows banding.
- **Budget:** each image is at most 12 KB at 2x. The whole set is at most 250 KB across all densities, and a page loads only its own pieces.
- **Markup:** `<img>` with fixed `width`/`height` (no layout shift), `srcset` 1x/2x/3x, `decoding="async"`, `alt=""` (the art is decorative; labels carry the meaning). Tiles are CSS backgrounds with `image-set()`.
- **Naming:** `client/public/art/<asset>/<variant>@<n>x.webp`, for example `art/belt-knot/green@2x.webp` and `art/rail/rod@3x.webp`.
- **Pipeline:**
  - Blender renders 4x PNGs into `design/renders/`, which is not committed.
  - A Bun script, `scripts/art-export.ts`, makes the WebP sizes with `sharp`. That is a new dev dependency and needs approval first.
  - Source `.blend` file: `design/blender/cssdojo-studio.blend`, committed if it stays under 20 MB.

## Built for animation

Motion on the site is CSS `transform` and `opacity` only (`motion/approved-polish.md`). So anything that moves must be its own image layer, and its pivot must be known.

- **Each moving part is modelled as its own object** and rendered as its own layer. All layers share one camera and one canvas size, so stacking them in CSS lines them up exactly.
- **The pivot is set in Blender at the real hinge point.** Its position is exported as a `transform-origin` percentage in a small JSON file next to the images (`art/<asset>/layers.json`).
- **Each layer is rendered with the others hidden but still casting light and shadow on it** (holdout), so the layers stack cleanly without double shadows.
- **The planned moving parts:**

| Asset | Layers (back to front) | Pivot | Motion it allows |
|---|---|---|---|
| Streak tag | cord, tag | cord: the nail at the top; tag: the eyelet | the swing when the streak grows |
| Belt knot | back tail, front tail, knot | each tail: where it leaves the knot | a small tail sway on hover |
| Brass rail | rod set (static), hook, wires | wires: their top sleeve | none planned; wires can swing if a card is dragged later |
| Belt pillars | body, top with belt | none (moves straight up) | the rise on first view |
| Avatar ring | ring, face (live) | ring centre | a slow turn on hover |

- No sprite sheets or video: they are heavier, and transforms on still layers stay sharp and cheap.

## Fallback and motion

- The current SVG components stay as the fallback until each image ships. They are swapped one asset at a time, each in its own PR.
- No new motion without approval. Existing hover and swing rules from `motion/approved-polish.md` apply to the image versions, and all motion stays off under `prefers-reduced-motion`.

## Belt knot and achievement badges

Built in the studio file with their own light rig ("Badge Lights": key, fill, rim, top), not the shared one, so every badge has the same contrasty look. Rendered by the text `badge_render.py` in the .blend; `bun run art` cuts them. Each layer names the objects it draws, the objects in front of it (holdouts), the objects that only catch its shadow (shadow catchers) and the objects left out. Everything else is hidden from the camera but still casts its shadow, so stacked layers match the full render.

| Asset | Size | Layers (back to front) | Motion |
|---|---|---|---|
| Belt knot (`knot`), one set per belt | 56 x 64, band top 10px, 22px band | shadow on the band, left tail, right tail, knot | tails swing when the card is hovered |
| Belt badges (`badge-belt`), one set per belt | 64 x 64 | belt ring and knot, left tail, right tail | tails sway slowly, out of step |
| Pack cleared (`badge-scroll`) | 64 x 64 | scroll (indigo brocade, gold lattice, lacquer rod, braided cord), seal | the seal stamps on in the earn toast and gives a little on hover |
| Streaks 3, 7, 30 (`badge-lantern`) | 64 x 64 | lit, dim, unlit | sways from its ring; dim fades over lit like a flame; unlit is the locked look; lights up in the earn toast |

The cotton is one procedural material: 8 stitch rows, dashed thread, woven noise, a stitched hem on the tail ends. The lantern number is the site's Instrument Serif, drawn by headless Chromium (Blender cannot read woff2) and projected onto the washi as ink.

Used on: profile badges, the earn toast and the bell, the result card, the belt earned card, the Assets page (badges); pack cards, the pack page, the belt record and the sidebar belt (knot). Locked badges are greyscale in CSS; lanterns use their unlit render.

## Order

1. **Brass rail first.** It is the simplest shape and proves the whole pipeline: HDRI reflections, slicing, export, CSS joining.
2. **Streak tag**, then the **pillars**.
3. **Belt knot and band** last. Cloth folds are the hardest part, and by then the light and pipeline are settled.

## Done means

- Each asset matches its reference in shape, light and material, checked side by side.
- It is checked in light and dark mode at 1x and 3x, and on a 375px phone.
- It stays within its file budget.
- Lighthouse performance is not worse than before.
- `bun run ci` passes.
