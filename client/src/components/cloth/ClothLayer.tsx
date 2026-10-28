import { useEffect, useRef, type RefObject } from "react";
import type { ClothColors, ClothScene, ClothTextures } from "./clothScene";

// Puts a real cloth (clothScene.ts, three.js) behind a banner's content. The page still does the layout: every
// element marked data-cloth is painted onto the cloth at the spot the page laid it out, then hidden
// in the page (but kept, so links stay clickable and screen readers still read them). If WebGL is
// missing or fails, nothing changes and the SVG banner stays.

const PAD = 14;
// One scene per canvas for its whole life: a canvas keeps its WebGL context, so recreating (or
// losing) it on every resize or remount would leave a dead context behind.
const scenes = new WeakMap<HTMLCanvasElement, ClothScene>();
let texturesPromise: Promise<ClothTextures> | null = null;

function loadRequired(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`${src} did not load`));
    img.src = src;
  });
}

function loadTextures(): Promise<ClothTextures> {
  texturesPromise ??= Promise.all([loadRequired("/art/cloth/linen-normal.webp"), loadRequired("/art/cloth/linen-rough.webp"), loadRequired("/art/cloth/linen-detail.webp")]).then(
    ([normal, rough, detail]) => ({ normal, rough, detail }),
  );
  return texturesPromise;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Without CORS the canvas would be tainted and WebGL could not read it.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Paints every [data-cloth] element of the box into a banner-sized canvas, at device pixel scale. */
async function paintPrint(box: HTMLElement, canvas: HTMLCanvasElement, dpr: number): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const origin = box.getBoundingClientRect();
  for (const el of box.querySelectorAll<HTMLElement>("[data-cloth]")) {
    const kind = el.dataset.cloth;
    if (kind === "avatar") {
      // The player token (Token.tsx): colour, enamel face blended in with overlay, initials,
      // brass rim on top. A photo replaces the enamel and the initials.
      const tok = el.querySelector<HTMLElement>(".d-token");
      if (!tok) continue;
      const r = tok.getBoundingClientRect();
      const x = r.left - origin.left;
      const y = r.top - origin.top;
      const size = r.width;
      const photo = tok.querySelector("img");
      const [face, rim, pic] = await Promise.all([
        loadImage("/art/token/face@2x.webp"),
        loadImage("/art/token/rim@2x.webp"),
        photo ? loadImage(photo.currentSrc || photo.src) : Promise.resolve(null),
      ]);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      if (pic) {
        const inset = size * 0.09;
        ctx.drawImage(pic, x + inset, y + inset, size - inset * 2, size - inset * 2);
      } else {
        ctx.fillStyle = getComputedStyle(tok).getPropertyValue("--tok").trim() || "#2E323A";
        ctx.fillRect(x, y, size, size);
        if (face) {
          ctx.globalCompositeOperation = "overlay";
          ctx.drawImage(face, x, y, size, size);
          ctx.globalCompositeOperation = "source-over";
        }
        const ini = tok.querySelector<HTMLElement>(".ini");
        if (ini?.textContent) {
          const s = getComputedStyle(ini);
          ctx.fillStyle = s.color;
          ctx.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ini.textContent, x + size / 2, y + size / 2 + 0.5);
        }
      }
      ctx.restore();
      if (rim) ctx.drawImage(rim, x, y, size, size);
      continue;
    }
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    let text = el.textContent?.trim() ?? "";
    // Skip what the page does not show (display: none, or squeezed to nothing).
    if (!text || r.width === 0 || r.height === 0) continue;
    if (s.textTransform === "uppercase") text = text.toUpperCase();
    ctx.save();
    ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = s.letterSpacing === "normal" ? "0px" : s.letterSpacing;
    ctx.fillStyle = s.color;
    ctx.globalAlpha = Number(s.opacity) || 1;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    // The page cut this text with an ellipsis: cut it the same way, to the element's width.
    if (el.scrollWidth > el.clientWidth + 1) {
      while (text.length > 1 && ctx.measureText(`${text}…`).width > r.width) text = text.slice(0, -1);
      text = `${text}…`;
    }
    const m = ctx.measureText(text);
    const asc = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent;
    const desc = m.fontBoundingBoxDescent || m.actualBoundingBoxDescent;
    const y = r.top - origin.top + r.height / 2 + (asc - desc) / 2;
    ctx.fillText(text, r.left - origin.left, y);
    ctx.restore();
  }
}

export function ClothLayer({ box, colors, seed }: { box: RefObject<HTMLDivElement | null>; colors: ClothColors; seed: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { lt, md, dk, ink } = colors;

  useEffect(() => {
    const el = box.current;
    const canvas = ref.current;
    if (!el || !canvas) return;
    let scene: ClothScene | null = scenes.get(canvas) ?? null;
    let raf = 0;
    let visible = false;
    let cancelled = false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const print = document.createElement("canvas");

    // Physics steps at a fixed 60 per second inside the scene; drawing every other frame (30 fps) is
    // plenty for slow, heavy cloth and halves the cost.
    let last = 0;
    const frame = (now: number) => {
      if (now - last >= 32) {
        const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 30;
        last = now;
        scene?.frame(dt);
      }
      if (visible && !reduced.matches) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      last = 0;
      if (reduced.matches) scene?.still();
      else raf = requestAnimationFrame(frame);
    };

    const build = async () => {
      // three.js and the scene load only when a banner is on the page.
      const [{ ClothScene: Scene }, textures] = await Promise.all([import("./clothScene"), loadTextures()]);
      await document.fonts.ready;
      if (cancelled) return;
      const { width, height } = el.getBoundingClientRect();
      if (width < 10 || height < 10) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      print.width = Math.round(width * dpr);
      print.height = Math.round(height * dpr);
      canvas.style.width = `${width + PAD * 2}px`;
      canvas.style.height = `${height + PAD}px`;
      await paintPrint(el, print, dpr);
      if (cancelled) return;
      const opts = { width, height, pad: PAD, colors: { lt, md, dk, ink }, textures, print, seed };
      if (scene) scene.update(opts, dpr);
      else {
        scene = new Scene(canvas, opts, dpr);
        scenes.set(canvas, scene);
      }
      el.classList.add("cloth-on");
      start();
    };

    const fallBack = (err: unknown) => {
      // No WebGL or a failed load: leave the SVG banner as it is.
      console.warn("cloth banner fell back to SVG", err);
      el.classList.remove("cloth-on");
    };
    build().catch(fallBack);

    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) start();
      else cancelAnimationFrame(raf);
    });
    io.observe(el);
    let resizeTimer = 0;
    let firstResize = true;
    const ro = new ResizeObserver(() => {
      // The observer fires once on start; the first build already covers that.
      if (firstResize) {
        firstResize = false;
        return;
      }
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => void build().catch(fallBack), 150);
    });
    ro.observe(el);
    reduced.addEventListener("change", start);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      io.disconnect();
      ro.disconnect();
      reduced.removeEventListener("change", start);
      el.classList.remove("cloth-on");
    };
  }, [box, lt, md, dk, ink, seed]);

  return <canvas ref={ref} className="w-cloth" aria-hidden="true" />;
}
