import { reducedMotion } from "./prefs";

// Full-screen confetti for the first 90+ solve of a challenge. About 700ms,
// decorative only, and skipped when the player asks for less motion.
const RUN_MS = 750;

export function confetti(): void {
  if (reducedMotion()) return;
  const c = document.createElement("canvas");
  c.id = "confetti";
  c.setAttribute("aria-hidden", "true");
  document.body.appendChild(c);
  const x = c.getContext("2d");
  if (!x) {
    c.remove();
    return;
  }
  const dpr = devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  x.scale(dpr, dpr);
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  const cols = [accent, "#F2C94C", "#4CAF7A", "#ECEAE4", "#F59AC5", "#8FB2FF"];
  const ps = Array.from({ length: Math.min(260, Math.round((innerWidth * innerHeight) / 5200)) }, () => ({
    x: Math.random() * innerWidth,
    y: -20 - Math.random() * innerHeight * 0.4,
    vx: (Math.random() - 0.5) * 4,
    vy: 9 + Math.random() * 9,
    r: Math.random() * 6.28,
    vr: (Math.random() - 0.5) * 0.4,
    w: 6 + Math.random() * 7,
    h: 3 + Math.random() * 4,
    c: cols[Math.floor(Math.random() * cols.length)] ?? accent,
  }));
  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    x.clearRect(0, 0, innerWidth, innerHeight);
    x.globalAlpha = t < RUN_MS - 220 ? 1 : Math.max(0, (RUN_MS - t) / 220);
    for (const p of ps) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25;
      p.r += p.vr;
      x.save();
      x.translate(p.x, p.y);
      x.rotate(p.r);
      x.fillStyle = p.c;
      x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      x.restore();
    }
    if (t < RUN_MS) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}
