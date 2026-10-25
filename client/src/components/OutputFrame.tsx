import { useEffect, useRef, useState } from "react";
import { sanitizeCode, wrapDocument, type FrameName } from "@cssdojo/shared";
import { staticUrl } from "@/lib/api";

// The player's live output at 1:1 (400x300), with the target's recorded PNG
// frame laid over it for slide-and-compare and diff. No target CSS is used.

export type PreviewState = FrameName;

/** Lets a state be previewed without a real mouse or keyboard: :hover also matches .dj-hover, etc. */
function prepForStates(code: string): string {
  return code
    .replace(/:hover/g, ":is(:hover,.dj-hover)")
    .replace(/:focus-visible/g, ":is(:focus-visible,.dj-focus)")
    .replace(/:focus(?![-\w])/g, ":is(:focus,.dj-focus)");
}

function fontBase(): string {
  return new URL(staticUrl("/fonts"), location.href).href.replace(/\/$/, "");
}

export function OutputFrame({
  code,
  challengeId,
  state,
  slide,
  diff,
  onSlide,
}: {
  code: string;
  challengeId: string;
  state: PreviewState;
  slide: boolean;
  diff: boolean;
  onSlide?: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState("");
  const [pos, setPos] = useState<{ x: number; y: number; vertical: boolean } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSrcDoc(wrapDocument(prepForStates(sanitizeCode(code).code), fontBase())), 150);
    return () => clearTimeout(t);
  }, [code]);

  // Apply the previewed state to every element once the document loads.
  useEffect(() => {
    const f = iframeRef.current;
    if (!f) return;
    const apply = () => {
      try {
        const d = f.contentDocument;
        d?.querySelectorAll("body *").forEach((el) => {
          el.classList.toggle("dj-hover", state === "hover");
          el.classList.toggle("dj-focus", state === "focus");
        });
      } catch {
        /* cross-origin: ignore */
      }
    };
    apply();
    f.addEventListener("load", apply);
    return () => f.removeEventListener("load", apply);
  }, [state, srcDoc]);

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Shift") setPos((p) => (p ? { ...p, vertical: e.type === "keydown" } : p));
    };
    addEventListener("keydown", onKey);
    addEventListener("keyup", onKey);
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("keyup", onKey);
    };
  }, [pos]);

  const move = (e: React.PointerEvent) => {
    if (!slide || diff || !frameRef.current) return;
    const r = frameRef.current.getBoundingClientRect();
    setPos({ x: Math.max(0, Math.min(r.width, e.clientX - r.left)), y: Math.max(0, Math.min(r.height, e.clientY - r.top)), vertical: e.shiftKey });
    onSlide?.();
  };

  const k = frameRef.current ? frameRef.current.clientWidth / 400 || 1 : 1;
  const sliding = !!pos && slide && !diff;
  const clip = diff ? "none" : sliding ? (pos.vertical ? `inset(${pos.y}px 0 0 0)` : `inset(0 0 0 ${pos.x}px)`) : "inset(0 0 0 100%)";
  const targetSrc = staticUrl(`/targets/${challengeId}/${state}.png`);

  return (
    <div ref={frameRef} className={`frame${sliding ? " sliding" : ""}${diff ? " diff" : ""}`} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setPos(null)} data-testid="output-frame">
      <div className="clip">
        <iframe ref={iframeRef} title="Your output" sandbox="allow-same-origin" srcDoc={srcDoc} style={k === 1 ? undefined : { transform: `scale(${k})` }} />
        <div className="over" style={{ clipPath: clip }}>
          <img src={targetSrc} alt="" width={400} height={300} style={{ width: "100%", height: "100%", display: "block" }} draggable={false} />
        </div>
      </div>
      {sliding ? (
        <>
          <div className={`handle ${pos.vertical ? "h" : "v"}`} style={pos.vertical ? { top: pos.y } : { left: pos.x }} />
          <span className={`px ${pos.vertical ? "y" : "x"}`} style={pos.vertical ? { top: pos.y } : { left: pos.x }}>
            {Math.round((pos.vertical ? pos.y : pos.x) / k)}
          </span>
        </>
      ) : null}
    </div>
  );
}
