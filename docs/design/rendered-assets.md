# Rendered assets: spec

Status: in progress, 2026-10-28. Done: brass rail, streak tag, belt pillars. Next: belt knot and band. Replaces the hand-drawn SVG and CSS objects (belt knot, belt band, brass rail, streak tag, belt pillars) with images rendered in Blender, because brass shine and cloth folds need real light and reflections.

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
| Belt pillars | Wall, `Leaderboards.tsx` | 55 to 92 wide (capped), 94 to 206 tall in 28px steps | Square stone plinth: a top per belt (top face and tied belt), one shared body that stretches, one shared base with a brass foot. Labels on a plaque row below |
| Avatar ring | boards, LIVE line | 20 to 40 | Later. Ring only; the face stays generated per player |

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
