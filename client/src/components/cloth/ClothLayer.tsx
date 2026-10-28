import { useEffect, useRef, type RefObject } from "react";
import { ClothRenderer, type ClothColors } from "./clothGl";

// Puts a WebGL cloth behind a banner's content (clothGl.ts). The page still does the layout: every
// element marked data-cloth is painted onto the cloth at the spot the page laid it out, then hidden
// in the page (but kept, so links stay clickable and screen readers still read them). If WebGL is
// missing or fails, nothing changes and the SVG banner stays.

const PAD = 14;
const renderers = new WeakMap<HTMLCanvasElement, ClothRenderer>();

function rendererFor(canvas: HTMLCanvasElement, make: () => ClothRenderer): ClothRenderer {
  let r = renderers.get(canvas);
  if (!r) {
    r = make();
    renderers.set(canvas, r);
  }
  return r;
}
let weavePromise: Promise<HTMLImageElement> | null = null;

function loadWeave(): Promise<HTMLImageElement> {
  weavePromise ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("weave did not load"));
    img.src = "/art/cloth/weave.webp";
  });
  return weavePromise;
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

/** Paints every [data-cloth] element of the box into a canvas, at device pixel scale. */
async function paintPrint(box: HTMLElement, canvas: HTMLCanvasElement, dpr: number): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, PAD * dpr, 0);
  const origin = box.getBoundingClientRect();
  for (const el of box.querySelectorAll<HTMLElement>("[data-cloth]")) {
    const kind = el.dataset.cloth;
    if (kind === "avatar") {
      const img = el.querySelector("img");
      const dot = el.querySelector<HTMLElement>(".d-av");
      const target = img ?? dot;
      if (!target) continue;
      const r = target.getBoundingClientRect();
      const x = r.left - origin.left;
      const y = r.top - origin.top;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + r.width / 2, y + r.height / 2, r.width / 2, 0, Math.PI * 2);
      ctx.clip();
      const pic = img ? await loadImage(img.currentSrc || img.src) : null;
      if (pic) ctx.drawImage(pic, x, y, r.width, r.height);
      else if (dot) {
        const s = getComputedStyle(dot);
        ctx.fillStyle = s.backgroundColor;
        ctx.fillRect(x, y, r.width, r.height);
        const t = dot.textContent?.trim();
        if (t) {
          ctx.fillStyle = s.color;
          ctx.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(t, x + r.width / 2, y + r.height / 2 + 0.5);
        }
      }
      ctx.restore();
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
    let renderer: ClothRenderer | null = null;
    let raf = 0;
    let visible = false;
    let cancelled = false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const print = document.createElement("canvas");

    // Heavy cloth moves slowly, so 30 frames a second look the same as 60 and cost half.
    let last = 0;
    const frame = (now: number) => {
      if (now - last >= 32) {
        last = now;
        renderer?.draw((now / 1000) * 0.9);
      }
      if (visible && !reduced.matches) raf = requestAnimationFrame(frame);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      if (reduced.matches) renderer?.draw(2);
      else raf = requestAnimationFrame(frame);
    };

    const build = async () => {
      const weave = await loadWeave();
      await document.fonts.ready;
      if (cancelled) return;
      const { width, height } = el.getBoundingClientRect();
      if (width < 10 || height < 10) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = width + PAD * 2;
      const ch = height + PAD;
      for (const c of [canvas, print]) {
        c.width = Math.round(cw * dpr);
        c.height = Math.round(ch * dpr);
      }
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      await paintPrint(el, print, dpr);
      if (cancelled) return;
      // One renderer per canvas for its whole life: a canvas keeps the same WebGL context, so
      // rebuilding (or losing) it on every resize or remount would leave a dead context behind.
      renderer ??= rendererFor(canvas, () => new ClothRenderer(canvas, { width, height, colors: { lt, md, dk, ink }, pad: PAD, weave, print, seed }, dpr));
      renderer.resize(width, height, dpr);
      renderer.setPrint(print);
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
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => void build().catch(fallBack), 120);
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
