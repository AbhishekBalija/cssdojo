import { useEffect, useRef } from "react";
import { staticUrl } from "@/lib/api";
import type { PreviewState } from "./OutputFrame";

// Live target: replays frames the server recorded from the reference (hover,
// press, focus and their transitions). Hover it, press it, Tab to it.

interface Replay {
  box: { x: number; y: number; w: number; h: number };
  rest: string[];
  hover: string[];
  press: string[];
  focus: string[];
  focusHover: string[];
  focusPress: string[];
}

type SeqName = "hover" | "press" | "focusHover" | "focusPress";

export function TargetCanvas({ challengeId, title, forced }: { challengeId: string; title: string; forced: PreviewState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const forcedRef = useRef(forced);
  const kickRef = useRef<() => void>(() => undefined);
  forcedRef.current = forced;

  useEffect(() => {
    kickRef.current();
  }, [forced]);

  useEffect(() => {
    const cv = canvasRef.current;
    const cx = cv?.getContext("2d");
    if (!cv || !cx) return;
    cv.width = 800;
    cv.height = 600;
    let cancelled = false;
    let R: Replay | null = null;
    const seqs: Record<SeqName | "rest" | "focus", HTMLImageElement[]> = { rest: [], hover: [], press: [], focus: [], focusHover: [], focusPress: [] };
    let hovered = false;
    let pressed = false;
    let focused = false;
    let kb = false;
    let hi = 0;
    let pi = 0;
    let raf = 0;

    const load = (srcs: string[]) =>
      srcs.map((src) => {
        const im = new Image();
        im.onload = () => draw();
        im.src = src;
        return im;
      });
    const isFocus = () => (focused || forcedRef.current === "focus") && seqs.focus.length > 0;
    function draw() {
      if (!cx) return;
      const H = isFocus() ? (seqs.focusHover.length ? seqs.focusHover : seqs.focus) : seqs.hover.length ? seqs.hover : seqs.rest;
      const P = isFocus() ? seqs.focusPress : seqs.press;
      let im: HTMLImageElement | undefined;
      if (pi > 0 && P.length) im = P[Math.min(pi, P.length - 1)];
      else if (hi > 0 || isFocus()) im = H[Math.min(hi, H.length - 1)];
      else im = seqs.rest[0];
      if (im?.complete && im.naturalWidth) cx.drawImage(im, 0, 0, 800, 600);
    }
    function step() {
      const hoverLen = Math.max(1, (isFocus() ? seqs.focusHover.length : seqs.hover.length) || 1);
      const pressLen = Math.max(1, (isFocus() ? seqs.focusPress.length : seqs.press.length) || 1);
      const wantH = hovered || forcedRef.current === "hover" ? hoverLen - 1 : 0;
      const wantP = pressed ? pressLen - 1 : 0;
      if (pi !== wantP) pi += pi < wantP ? 1 : -1;
      else if (hi !== wantH) hi += hi < wantH ? 1 : -1;
      draw();
      raf = pi !== wantP || hi !== wantH ? requestAnimationFrame(step) : 0;
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(step);
    };
    kickRef.current = () => {
      kick();
      draw();
    };
    const inBox = (e: PointerEvent) => {
      if (!R) return false;
      const r = cv.getBoundingClientRect();
      const k = r.width / 400;
      const x = (e.clientX - r.left) / k;
      const y = (e.clientY - r.top) / k;
      const b = R.box;
      return x >= b.x && x <= b.x + b.w && y >= b.y - 6 && y <= b.y + b.h + 6;
    };
    const onMove = (e: PointerEvent) => {
      const h = inBox(e);
      cv.style.cursor = h ? "pointer" : "default";
      if (h !== hovered) {
        hovered = h;
        if (!h) pressed = false;
        kick();
      }
    };
    const onLeave = () => {
      hovered = false;
      pressed = false;
      kick();
    };
    const onDown = (e: PointerEvent) => {
      kb = false;
      if (inBox(e)) {
        pressed = true;
        kick();
      }
    };
    const onUp = () => {
      if (pressed) {
        pressed = false;
        kick();
      }
    };
    const onTab = (e: KeyboardEvent) => {
      if (e.key === "Tab") kb = true;
    };
    const onFocus = () => {
      focused = kb;
      draw();
    };
    const onBlur = () => {
      focused = false;
      pressed = false;
      kick();
      draw();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // The code editor keeps Tab for indenting, so a keyboard user can rarely Tab
      // into the target from the page. Instead, the first Tab after clicking the
      // target shows its keyboard focus state; the next Tab moves on as usual.
      if (e.key === "Tab" && !e.shiftKey && !focused && seqs.focus.length > 0) {
        e.preventDefault();
        kb = true;
        focused = true;
        pressed = false;
        kick();
        draw();
        return;
      }
      if (focused && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        pressed = true;
        kick();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        pressed = false;
        kick();
      }
    };
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerleave", onLeave);
    cv.addEventListener("pointerdown", onDown);
    addEventListener("pointerup", onUp);
    addEventListener("keydown", onTab);
    cv.addEventListener("focus", onFocus);
    cv.addEventListener("blur", onBlur);
    cv.addEventListener("keydown", onKeyDown);
    cv.addEventListener("keyup", onKeyUp);

    fetch(staticUrl(`/targets/${challengeId}/replay.json`))
      .then((r) => r.json() as Promise<Replay>)
      .then((data) => {
        if (cancelled) return;
        R = data;
        seqs.rest = load(data.rest);
        seqs.focus = load(data.focus);
        seqs.hover = load(data.hover);
        seqs.press = load(data.press);
        seqs.focusHover = load(data.focusHover);
        seqs.focusPress = load(data.focusPress);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("pointerdown", onDown);
      removeEventListener("pointerup", onUp);
      removeEventListener("keydown", onTab);
      cv.removeEventListener("focus", onFocus);
      cv.removeEventListener("blur", onBlur);
      cv.removeEventListener("keydown", onKeyDown);
      cv.removeEventListener("keyup", onKeyUp);
    };
  }, [challengeId]);

  return (
    <div className="frame live">
      <div className="clip">
        <canvas ref={canvasRef} tabIndex={0} role="img" aria-label={`Live target: ${title}. Hover, click, or press Tab to try it.`} data-testid="target-canvas" />
      </div>
    </div>
  );
}
