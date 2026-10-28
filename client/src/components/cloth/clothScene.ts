import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// A cloth banner with real physics (docs/design/rendered-assets.md, "Cloth banners"). A Verlet
// simulation hangs a grid of points from the rod and moves it with gusting wind that pushes on each
// triangle by how much it faces the wind, which is what makes folds bunch, buckle and release and the
// outline swing. three.js draws it with its physical material: fabric sheen, a scanned linen normal
// and roughness map (Poly Haven "Rough Linen", CC0), studio reflections, and a key light whose soft
// self-shadows fall into the folds. Units are CSS px; y is up, z points at the viewer.

export interface ClothColors {
  lt: string;
  md: string;
  dk: string;
  ink: string;
}

export interface ClothTextures {
  normal: HTMLImageElement;
  rough: HTMLImageElement;
  detail: HTMLImageElement;
}

export interface ClothSceneOptions {
  width: number;
  height: number;
  pad: number;
  colors: ClothColors;
  textures: ClothTextures;
  /** Printed text and avatars at device scale, covering the banner (no padding). */
  print: HTMLCanvasElement;
  /** A different gust pattern per banner. */
  seed: number;
}

/** One linen tile spans this many CSS px. */
// Larger than true scale on purpose: at real scale a thread is a tenth of a pixel and the weave
// cannot be seen, let alone felt.
const TILE = 220;
/** Gravity for a banner about a metre tall: 150 px per metre. */
const GRAVITY = 9.8 * 150;
const STEP = 1 / 60;

// ---------- Physics ----------

class Sim {
  readonly nx: number;
  readonly ny: number;
  readonly pos: Float32Array;
  private prev: Float32Array;
  private rest: Float32Array;
  private links: Int32Array;
  private lengths: Float32Array;
  private stiff: Float32Array;
  private force: Float32Array;
  private time: number;
  private seed: number;
  private w: number;
  private h: number;

  constructor(w: number, h: number, seed: number) {
    this.seed = seed;
    this.w = w;
    this.h = h;
    this.nx = 30;
    this.ny = Math.min(26, Math.max(16, Math.round((30 * h) / w)));
    const n = this.nx * this.ny;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.rest = new Float32Array(n * 3);
    this.force = new Float32Array(n * 3);
    this.time = seed * 3.7;
    for (let j = 0; j < this.ny; j++) {
      for (let i = 0; i < this.nx; i++) {
        const k = (j * this.nx + i) * 3;
        this.rest[k] = (i / (this.nx - 1)) * w;
        this.rest[k + 1] = -(j / (this.ny - 1)) * h;
        this.rest[k + 2] = 0;
      }
    }
    this.pos.set(this.rest);
    // The cloth is gathered on the rod: the top is sewn 12% narrower than the fabric, so the slack
    // falls into soft vertical drapes, the way a real banner hangs.
    for (let i = 0; i < this.nx; i++) {
      const k = i * 3;
      this.pos[k] = w / 2 + ((this.rest[k] ?? 0) - w / 2) * 0.88;
      // A tiny alternating offset in depth starts the folds the same way on every load.
      this.pos[k + 2] = Math.sin(i * 1.9 + seed) * 0.6;
    }
    for (let j = 1; j < this.ny; j++) {
      for (let i = 0; i < this.nx; i++) {
        const k = (j * this.nx + i) * 3;
        this.pos[k] = w / 2 + ((this.rest[k] ?? 0) - w / 2) * 0.88;
        this.pos[k + 2] = Math.sin(i * 1.9 + seed) * 2.5 * (j / this.ny);
      }
    }
    this.prev.set(this.pos);
    // Springs: structural (no stretch), shear (no skew), bend (stiffness of heavy cloth).
    const links: number[] = [];
    const stiff: number[] = [];
    const add = (i: number, j: number, di: number, dj: number, s: number) => {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || a >= this.nx || b >= this.ny) return;
      links.push(j * this.nx + i, b * this.nx + a);
      stiff.push(s);
    };
    for (let j = 0; j < this.ny; j++) {
      for (let i = 0; i < this.nx; i++) {
        add(i, j, 1, 0, 1);
        add(i, j, 0, 1, 1);
        add(i, j, 1, 1, 0.6);
        add(i, j, -1, 1, 0.6);
        add(i, j, 2, 0, 0.12);
        add(i, j, 0, 2, 0.12);
      }
    }
    this.links = new Int32Array(links);
    this.stiff = new Float32Array(stiff);
    this.lengths = new Float32Array(stiff.length);
    for (let c = 0; c < stiff.length; c++) {
      const a = (this.links[c * 2] ?? 0) * 3;
      const b = (this.links[c * 2 + 1] ?? 0) * 3;
      this.lengths[c] = Math.hypot((this.rest[a] ?? 0) - (this.rest[b] ?? 0), (this.rest[a + 1] ?? 0) - (this.rest[b + 1] ?? 0));
    }
  }

  /** Slow, layered gusts: never fully still, never fluttering. */
  private gust(t: number): number {
    return 0.55 + 0.25 * Math.sin(t * 0.43 + this.seed) + 0.14 * Math.sin(t * 1.07 + this.seed * 2.1) + 0.06 * Math.sin(t * 2.9);
  }

  step(): void {
    const { nx, ny, pos, prev, force } = this;
    this.time += STEP;
    const t = this.time;
    force.fill(0);
    // Wind blows from behind and a little from the side, towards the viewer. Its pressure on each
    // triangle depends on how squarely the triangle faces it.
    const g = this.gust(t);
    const wx = 0.22 * Math.sin(t * 0.31 + this.seed);
    const wz = 1;
    const strength = 1.6 * g;
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        for (const [p, q, r] of [
          [a, a + 1, a + nx],
          [a + 1, a + nx + 1, a + nx],
        ] as const) {
          const p3 = p * 3;
          const q3 = q * 3;
          const r3 = r * 3;
          const ux = (pos[q3] ?? 0) - (pos[p3] ?? 0);
          const uy = (pos[q3 + 1] ?? 0) - (pos[p3 + 1] ?? 0);
          const uz = (pos[q3 + 2] ?? 0) - (pos[p3 + 2] ?? 0);
          const vx = (pos[r3] ?? 0) - (pos[p3] ?? 0);
          const vy = (pos[r3 + 1] ?? 0) - (pos[p3 + 1] ?? 0);
          const vz = (pos[r3 + 2] ?? 0) - (pos[p3 + 2] ?? 0);
          // Area-weighted normal.
          const n0 = uy * vz - uz * vy;
          const n1 = uz * vx - ux * vz;
          const n2 = ux * vy - uy * vx;
          const len = Math.hypot(n0, n1, n2) || 1;
          // Rolling gusts: the air pushes some parts harder than others, and the pattern drifts.
          const cx = (pos[p3] ?? 0) / this.w;
          const cy = -(pos[p3 + 1] ?? 0) / this.h;
          const local = 0.6 + 0.4 * Math.sin(cx * 7.0 - t * 1.3 + this.seed) * Math.sin(cy * 4.0 + t * 0.7) + 0.25 * Math.sin(cx * 13.0 + cy * 5.0 + t * 2.1);
          const push = ((n0 * wx + n2 * wz) / len) * strength * local;
          const fx = (n0 / len) * push * len * 0.02;
          const fy = (n1 / len) * push * len * 0.02;
          const fz = (n2 / len) * push * len * 0.02;
          for (const k of [p3, q3, r3]) {
            force[k] = (force[k] ?? 0) + fx;
            force[k + 1] = (force[k + 1] ?? 0) + fy;
            force[k + 2] = (force[k + 2] ?? 0) + fz;
          }
        }
      }
    }
    // Verlet: carry on moving, slowed by air, pulled by gravity and pushed by the wind.
    const damp = 0.985;
    const dt2 = STEP * STEP;
    for (let k = 0; k < pos.length; k += 3) {
      if (k < nx * 3) continue; // top row is sewn onto the rod
      const x = pos[k] ?? 0;
      const y = pos[k + 1] ?? 0;
      const z = pos[k + 2] ?? 0;
      pos[k] = x + (x - (prev[k] ?? 0)) * damp + (force[k] ?? 0) * dt2 * 60;
      pos[k + 1] = y + (y - (prev[k + 1] ?? 0)) * damp + ((force[k + 1] ?? 0) * 60 - GRAVITY) * dt2;
      pos[k + 2] = z + (z - (prev[k + 2] ?? 0)) * damp + (force[k + 2] ?? 0) * dt2 * 60;
      prev[k] = x;
      prev[k + 1] = y;
      prev[k + 2] = z;
    }
    // Springs, a few rounds so the cloth keeps its size.
    for (let it = 0; it < 5; it++) {
      for (let c = 0; c < this.lengths.length; c++) {
        const a = (this.links[c * 2] ?? 0) * 3;
        const b = (this.links[c * 2 + 1] ?? 0) * 3;
        const dx = (pos[b] ?? 0) - (pos[a] ?? 0);
        const dy = (pos[b + 1] ?? 0) - (pos[a + 1] ?? 0);
        const dz = (pos[b + 2] ?? 0) - (pos[a + 2] ?? 0);
        const d = Math.hypot(dx, dy, dz) || 1;
        // Cloth resists stretching hard but squashing hardly at all, so instead of fanning out it
        // buckles, and that buckling is what makes real folds.
        const stretch = d - (this.lengths[c] ?? 0);
        const give = stretch < 0 ? 0.12 : 1;
        const diff = (stretch / d) * 0.5 * (this.stiff[c] ?? 1) * give;
        const aPinned = a < nx * 3;
        const bPinned = b < nx * 3;
        const sa = aPinned ? 0 : bPinned ? 2 : 1;
        const sb = bPinned ? 0 : aPinned ? 2 : 1;
        pos[a] = (pos[a] ?? 0) + dx * diff * sa;
        pos[a + 1] = (pos[a + 1] ?? 0) + dy * diff * sa;
        pos[a + 2] = (pos[a + 2] ?? 0) + dz * diff * sa;
        pos[b] = (pos[b] ?? 0) - dx * diff * sb;
        pos[b + 1] = (pos[b + 1] ?? 0) - dy * diff * sb;
        pos[b + 2] = (pos[b + 2] ?? 0) - dz * diff * sb;
      }
      // Long-range tethers: no point may hang further from its pin on the rod than its own length
      // (plus a little give), so the cloth never sags or stretches, however many rows it has.
      for (let j = 1; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const k = (j * nx + i) * 3;
          const pin = i * 3;
          const dx = (pos[k] ?? 0) - (pos[pin] ?? 0);
          const dy = (pos[k + 1] ?? 0) - (pos[pin + 1] ?? 0);
          const dz = (pos[k + 2] ?? 0) - (pos[pin + 2] ?? 0);
          const d = Math.hypot(dx, dy, dz);
          const max = (j / (ny - 1)) * this.h * 1.02;
          if (d > max) {
            const f = max / d;
            pos[k] = (pos[pin] ?? 0) + dx * f;
            pos[k + 1] = (pos[pin + 1] ?? 0) + dy * f;
            pos[k + 2] = (pos[pin + 2] ?? 0) + dz * f;
          }
        }
      }
      // The cloth hangs in front of the wall: it can billow out, not push back through it.
      for (let k = 2; k < pos.length; k += 3) if ((pos[k] ?? 0) < -18) pos[k] = -18;
    }
  }
}

// ---------- Drawing ----------

function shapePath(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Same outline as the SVG banner, drawn on 200-wide units.
  const sx = w / 200;
  ctx.beginPath();
  ctx.moveTo(4 * sx, 0);
  ctx.lineTo(w - 4 * sx, 0);
  ctx.lineTo(w - 8 * sx, h - 34);
  ctx.quadraticCurveTo(w - 9 * sx, h - 28, w - 15 * sx, h - 27);
  ctx.lineTo(w / 2, h - 2);
  ctx.lineTo(15 * sx, h - 27);
  ctx.quadraticCurveTo(9 * sx, h - 28, 8 * sx, h - 34);
  ctx.closePath();
}

/** The cloth's surface: belt colour, real linen detail, print, hems and stitching. */
function paintSurface(o: ClothSceneOptions, dpr: number): { map: HTMLCanvasElement; alpha: HTMLCanvasElement } {
  const W = Math.round(o.width * dpr);
  const H = Math.round(o.height * dpr);
  const map = document.createElement("canvas");
  map.width = W;
  map.height = H;
  const ctx = map.getContext("2d");
  const alpha = document.createElement("canvas");
  alpha.width = W;
  alpha.height = H;
  const actx = alpha.getContext("2d");
  if (!ctx || !actx) return { map, alpha };
  ctx.scale(dpr, dpr);
  actx.scale(dpr, dpr);
  const { width: w, height: h, colors: c } = o;
  // Base: a soft fall from the light tone to the mid tone.
  const fall = ctx.createLinearGradient(0, 0, 0, h);
  fall.addColorStop(0, c.lt);
  fall.addColorStop(1, c.md);
  ctx.fillStyle = fall;
  ctx.fillRect(0, 0, w, h);
  // Real linen: slubs, uneven threads and colour drift, blended in without shifting the colour.
  const pat = ctx.createPattern(o.textures.detail, "repeat");
  if (pat) {
    pat.setTransform(new DOMMatrix().scale(TILE / o.textures.detail.width));
    // Multiply shows slubs and uneven threads even on ivory (overlay barely touches light colours).
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  // Print: text and avatars, laid out by the page.
  ctx.drawImage(o.print, 0, 0, w, h);
  // Rod pocket: the top is folded over the rod and sewn shut.
  const pocket = ctx.createLinearGradient(0, 0, 0, 11);
  pocket.addColorStop(0, "rgba(255,255,255,0.10)");
  pocket.addColorStop(0.75, "rgba(0,0,0,0.05)");
  pocket.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = pocket;
  ctx.fillRect(0, 0, w, 11);
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.setLineDash([2.2, 1.6]);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, 10.5);
  ctx.lineTo(w, 10.5);
  ctx.stroke();
  // Hem: the edge is turned and stitched. A darker band, then a stitch line just inside it.
  ctx.save();
  shapePath(ctx, w, h);
  ctx.clip();
  ctx.setLineDash([]);
  ctx.lineWidth = 9;
  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  shapePath(ctx, w, h);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale((w - 14) / w, (h - 12) / h);
  ctx.translate(-w / 2, -h / 2 + 2);
  ctx.setLineDash([2.4, 1.8]);
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = c.dk;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  // Only the sides and chevron are hemmed; the top is the rod pocket.
  const sx = (w / 200);
  ctx.moveTo(8 * sx, 12);
  ctx.lineTo(8 * sx, h - 34);
  ctx.quadraticCurveTo(9 * sx, h - 28, 15 * sx, h - 27);
  ctx.lineTo(w / 2, h - 2);
  ctx.lineTo(w - 15 * sx, h - 27);
  ctx.quadraticCurveTo(w - 9 * sx, h - 28, w - 8 * sx, h - 34);
  ctx.lineTo(w - 8 * sx, 12);
  ctx.stroke();
  ctx.restore();
  // Outline mask, with a soft edge so the silhouette is clean.
  actx.fillStyle = "#000";
  actx.fillRect(0, 0, w, h);
  actx.fillStyle = "#fff";
  shapePath(actx, w, h);
  actx.fill();
  return { map, alpha };
}

function tex(img: HTMLImageElement | HTMLCanvasElement, srgb: boolean, repeat?: [number, number]): THREE.Texture {
  const t = img instanceof HTMLCanvasElement ? new THREE.CanvasTexture(img) : new THREE.Texture(img);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.needsUpdate = true;
  return t;
}

export class ClothScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial> | null = null;
  private sim: Sim | null = null;
  private key = new THREE.DirectionalLight(0xfff1dd, 3.2);
  private opts: ClothSceneOptions;
  private dpr: number;
  private acc = 0;

  constructor(canvas: HTMLCanvasElement, opts: ClothSceneOptions, dpr: number) {
    this.opts = opts;
    this.dpr = dpr;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
    this.renderer.setClearColor(0x000000, 0);
    // Neutral tone mapping keeps light cloth colours true (AgX greys them).
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Soft studio reflections for the sheen, plus a warm key from the top left and a cool fill.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.85;
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.radius = 6;
    this.key.shadow.bias = -0.002;
    this.scene.add(this.key, this.key.target);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.35);
    fill.position.set(400, 50, 300);
    this.scene.add(fill);
    this.build();
  }

  private build(): void {
    const o = this.opts;
    const { width: w, height: h, pad } = o;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w + pad * 2, h + pad, false);
    this.camera.left = -pad;
    this.camera.right = w + pad;
    this.camera.top = 0;
    this.camera.bottom = -(h + pad);
    this.camera.near = -2000;
    this.camera.far = 2000;
    this.camera.position.set(0, 0, 500);
    this.camera.updateProjectionMatrix();
    // The key rakes in from the left, low, the way fabric is photographed to show its folds and weave.
    this.key.position.set(w / 2 - 620, 260, 300);
    this.key.target.position.set(w / 2, -h / 2, 0);
    const sc = this.key.shadow.camera;
    sc.left = -w;
    sc.right = w;
    sc.top = h;
    sc.bottom = -h;
    sc.near = 1;
    sc.far = 2000;
    sc.updateProjectionMatrix();

    this.sim = new Sim(w, h, o.seed);
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    const geo = new THREE.PlaneGeometry(w, h, this.sim.nx - 1, this.sim.ny - 1);
    const { map, alpha } = paintSurface(o, this.dpr);
    const rep: [number, number] = [w / TILE, h / TILE];
    const mat = new THREE.MeshPhysicalMaterial({
      map: tex(map, true),
      alphaMap: tex(alpha, false),
      transparent: true,
      normalMap: tex(o.textures.normal, false, rep),
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughnessMap: tex(o.textures.rough, false, rep),
      roughness: 0.92,
      sheen: 1,
      sheenRoughness: 0.55,
      sheenColor: new THREE.Color(o.colors.lt),
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
    // Let the cloth settle under gravity before the first frame, so it never starts flat.
    for (let i = 0; i < 90; i++) this.sim.step();
    this.sync();
  }

  private sync(): void {
    const sim = this.sim;
    const mesh = this.mesh;
    if (!sim || !mesh) return;
    const attr = mesh.geometry.attributes.position as THREE.BufferAttribute;
    (attr.array as Float32Array).set(sim.pos);
    attr.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingSphere();
  }

  /** New size, print or device scale: rebuild the cloth and its surface. */
  update(opts: Partial<ClothSceneOptions>, dpr: number): void {
    this.opts = { ...this.opts, ...opts };
    this.dpr = dpr;
    this.build();
  }

  /** Advance real time (seconds) in fixed physics steps, then draw. */
  frame(dt: number): void {
    this.acc = Math.min(this.acc + dt, STEP * 6);
    while (this.acc >= STEP) {
      this.sim?.step();
      this.acc -= STEP;
    }
    this.sync();
    this.renderer.render(this.scene, this.camera);
  }

  /** For reduced motion: let it hang, draw once. */
  still(): void {
    for (let i = 0; i < 120; i++) this.sim?.step();
    this.sync();
    this.renderer.render(this.scene, this.camera);
  }
}
