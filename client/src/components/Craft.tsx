import type { Belt } from "@cssdojo/shared";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Roll } from "./Roll";

// Shared pieces of the dojo craft (mockup v49): mountain, lit rod, cloth belt band, chips, countdown.

/** Cloth colours per belt: dark, mid, light, ink on cloth, accent for chips and marks. */
export const CLOTH: Record<Belt, { dk: string; md: string; lt: string; ink: string; acc: string }> = {
  white: { dk: "#A9A49A", md: "#DDD8CE", lt: "#FBF8F1", ink: "#1A1B1F", acc: "#ECEAE4" },
  yellow: { dk: "#8C6B12", md: "#D4A72C", lt: "#F5D468", ink: "#2A2205", acc: "#F2C94C" },
  green: { dk: "#17583A", md: "#2F8F5B", lt: "#56C48A", ink: "#F0FFF6", acc: "#5ED39A" },
  brown: { dk: "#5A3622", md: "#8A5A3C", lt: "#B5805A", ink: "#FFF4EA", acc: "#D49A6A" },
  black: { dk: "#1A1B20", md: "#363944", lt: "#5E626E", ink: "#ECEAE4", acc: "#A8AEBB" },
};

export function Mountain() {
  const id = useId();
  return (
    <svg className="d-mtn" viewBox="0 0 640 240" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset=".35" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}m`}>
          <rect width="640" height="240" fill={`url(#${id}f)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}m)`}>
        <path d="M40 240 L170 120 L215 150 L260 112 L330 240Z" fill="var(--d-mtn-1)" />
        <path d="M170 120 L200 240 L40 240Z" fill="var(--d-mtn-2)" />
        <path d="M230 240 L400 34 L470 120 L505 96 L640 240Z" fill="var(--d-mtn-3)" />
        <path d="M400 34 L380 240 L230 240Z" fill="var(--d-mtn-4)" />
        <path d="M400 34 L430 240 L380 240Z" fill="var(--d-mtn-5)" />
        <path d="M505 96 L520 240 L470 240 L470 120Z" fill="var(--d-mtn-6)" />
        <path d="M400 34 L414 52 L404 50 L396 66 L388 50Z" fill="var(--d-snow)" />
        <path d="M505 96 L514 108 L506 107 L499 116 L495 107Z" fill="var(--d-snow)" opacity=".85" />
        <path d="M170 120 L180 131 L172 130 L166 138 L162 130Z" fill="var(--d-snow)" opacity=".8" />
      </g>
    </svg>
  );
}

/** The page frame: grain, glow and mountain behind a kicker + serif title. */
export function Page({ kicker, title, sub, right, tabs, children }: { kicker: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; tabs?: ReactNode; children: ReactNode }) {
  return (
    <div className="d-pg">
      <div className="d-glow" />
      <Mountain />
      <div className="d-ph">
        <span className="d-kick">{kicker}</span>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
          <h1 style={{ flex: 1 }}>{title}</h1>
          {right}
        </div>
        {sub ? <p className="sub">{sub}</p> : null}
        {tabs}
      </div>
      {children}
    </div>
  );
}

/** The rendered brass rail (docs/design/rendered-assets.md), with or without hanging wires. */
export function RailArt({ cords = false }: { cords?: boolean }) {
  return (
    <span className="d-rail" aria-hidden="true">
      {cords ? (
        <>
          <span className="d-rail-wire" style={{ left: "22%" }} />
          <span className="d-rail-wire" style={{ left: "78%" }} />
        </>
      ) : null}
      <span className="d-rail-cap l" />
      <span className="d-rail-rod" />
      <span className="d-rail-cap r" />
      <span className="d-rail-hook" />
    </span>
  );
}

export function Hang({ children, cords = true, lamp = true }: { children: ReactNode; cords?: boolean; lamp?: boolean }) {
  return (
    <div className="d-hang">
      {lamp ? <span className="lamp" /> : null}
      <RailArt cords={cords} />
      {children}
    </div>
  );
}

/** The belt knot (docs/design/rendered-assets.md): rendered cotton, front on, in layers: the
 *  knot's shadow on the band, the two tails (they sway on hover) and the knot. `x` is where the
 *  old 44px-wide knot started, so callers keep their spacing; the band is 22px at scale 1. */
export function Knot({ belt, x = 64, scale = 1 }: { belt: Belt; x?: number | string; scale?: number }) {
  const left = typeof x === "number" ? x - 6 * scale : `calc(${x} - ${6 * scale}px)`;
  const base = `/art/knot/${belt}`;
  return (
    <span className="d-knot" aria-hidden="true" style={{ left, top: -10 * scale, width: 56 * scale, height: 64 * scale }}>
      {["shadow", "tail-l", "tail-r", "knot"].map((l) => (
        <img key={l} className={l} src={`${base}-${l}@1x.webp`} srcSet={`${base}-${l}@2x.webp 2x, ${base}-${l}@3x.webp 3x`} alt="" draggable={false} />
      ))}
    </span>
  );
}

/** A cloth belt across the top of a card, tied with a knot. */
export function BeltBand({ belt, height = 22, knotX = 64 }: { belt: Belt; height?: number; knotX?: number | string }) {
  const c = CLOTH[belt];
  const id = useId();
  const stitch = belt === "black" ? "rgba(236,234,228,.28)" : "rgba(12,13,16,.30)";
  return (
    <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height }}>
      {/* The card does not clip (the knot rises above the band), so the band follows the card's corners itself. */}
      <span style={{ display: "block", overflow: "hidden", borderRadius: "15px 15px 0 0" }}>
        <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c.lt} />
              <stop offset=".5" stopColor={c.md} />
              <stop offset="1" stopColor={c.dk} />
            </linearGradient>
          </defs>
          <rect width="100" height={height} fill={`url(#${id})`} />
          <path d={`M0 ${height / 2} H100`} stroke={stitch} strokeDasharray="1.2 1" vectorEffect="non-scaling-stroke" />
          <path d="M0 .5 H100" stroke="#fff" strokeOpacity=".3" vectorEffect="non-scaling-stroke" />
          <path d={`M0 ${height - 0.5} H100`} stroke="#000" strokeOpacity=".45" vectorEffect="non-scaling-stroke" />
        </svg>
      </span>
      <Knot belt={belt} x={knotX} scale={height / 22} />
    </span>
  );
}

export function BeltChip({ belt }: { belt: Belt }) {
  return (
    <span className="d-chip">
      <span className="bd" style={{ background: CLOTH[belt].acc }} />
      {belt} belt
    </span>
  );
}

function parts(ms: number): { d: number; h: number; m: number; s: number } {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}
const two = (n: number) => String(n).padStart(2, "0");

/** Ticks every second until `to`. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** "27d 21h" style label for chips. */
export function untilLabel(to: string | number, now: number): string {
  const p = parts(new Date(to).getTime() - now);
  if (p.d > 0) return `${p.d}d ${two(p.h)}h`;
  if (p.h > 0) return `${p.h}h ${two(p.m)}m`;
  return `${p.m}m ${two(p.s)}s`;
}

/** Digit-box countdown, HH:MM:SS (or DD:HH:MM when more than a day away). */
export function Countdown({ to }: { to: string | number }) {
  const now = useNow();
  const p = parts(new Date(to).getTime() - now);
  // Under a day, show seconds so the clock visibly ticks. Farther out, minutes are enough.
  const text = p.d > 0 ? `${two(p.d)}:${two(p.h)}:${two(p.m)}` : `${two(p.h)}:${two(p.m)}:${two(p.s)}`;
  const label = p.d > 0 ? `${p.d} days ${p.h} hours ${p.m} minutes` : `${p.h} hours ${p.m} minutes ${p.s} seconds`;
  return (
    <span className="d-clock" role="timer" aria-label={label}>
      <Roll text={text} ms={200} />
    </span>
  );
}

export const I = {
  grid: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  cal: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  trophy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3a3 3 0 0 1-3 4M7 5H4a3 3 0 0 0 3 4" />
    </svg>
  ),
  arrow: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  play: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  lock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
};

/** Four labelled boxes (days, hours, minutes, seconds) for a pack that has not opened yet. */
export function BigCountdown({ to }: { to: string | number }) {
  const now = useNow();
  const left = new Date(to).getTime() - now;
  const p = parts(left);
  // Seconds only show in the last hour.
  const cells: [number, string][] =
    left < 3_600_000
      ? [
          [p.m, "Min"],
          [p.s, "Sec"],
        ]
      : [
          [p.d, "Days"],
          [p.h, "Hrs"],
          [p.m, "Min"],
        ];
  return (
    <span className="d-bigclock" role="timer" aria-label={`${p.d} days ${p.h} hours ${p.m} minutes`}>
      {cells.map(([v, l]) => (
        <span key={l}>
          <b>
            <Roll text={two(v)} ms={200} />
          </b>
          <i>{l}</i>
        </span>
      ))}
    </span>
  );
}

// Where the glide line last sat, so it can glide from there when a tab is its own route.
let lastGlide: { x: number; s: number; top: string } | null = null;

/** Pill tabs with an accent line that glides to the active one. */
export function GlideTabs({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  const path = useRouterState({ select: (st) => st.location.href });
  useLayoutEffect(() => {
    const set = (l: HTMLSpanElement, g: { x: number; s: number; top: string }) => {
      l.style.setProperty("--gx", `${g.x}px`);
      l.style.setProperty("--gs", String(g.s));
      l.style.top = g.top;
    };
    const place = (still: boolean) => {
      const a = box.current?.querySelector<HTMLElement>('[aria-selected="true"],[data-status="active"]');
      const l = line.current;
      if (!l) return;
      const g = a ? { x: a.offsetLeft, s: a.offsetWidth / 100, top: `${a.offsetTop + a.offsetHeight + 5}px` } : { x: 0, s: 0, top: "" };
      if (!placed.current && lastGlide && !still) {
        l.classList.add("still");
        set(l, lastGlide);
        void l.offsetWidth;
      }
      l.classList.toggle("still", still);
      set(l, g);
      lastGlide = g;
      placed.current = true;
    };
    place(false);
    const onResize = () => place(true);
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, [path, children]);
  return (
    <div ref={box} className="d-tabs" role="tablist">
      {children}
      <span ref={line} className="glide" aria-hidden="true" />
    </div>
  );
}

/** Provider marks for "Continue with" and "Signed in with". */
export const GitHubMark = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

export const GoogleMark = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d="M20.5 12.2c0 4.7-3.6 8.3-8.5 8.3a8.5 8.5 0 1 1 5.7-14.8" />
    <path d="M12.3 12.2h8.2" />
  </svg>
);
