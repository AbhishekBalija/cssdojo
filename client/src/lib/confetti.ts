// Confetti on a solve. Skipped entirely when the player prefers reduced motion.
export function confetti(): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  c.id = "confetti";
  c.setAttribute("aria-hidden", "true");
  document.body.appendChild(c);
  const x = c.getContext("2d");
  if (!x) return;
  const dpr = devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  x.scale(dpr, dpr);
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  const cols = [accent, "#F2C94C", "#4CAF7A", "#ECEAE4", "#F59AC5", "#8FB2FF"];
  const ps: { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string }[] = [];
  const end = performance.now() + 2600;
  const spawn = () => {
    for (let i = 0; i < 4; i++)
      ps.push({ x: Math.random() * innerWidth, y: -10, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, c: cols[Math.floor(Math.random() * cols.length)] ?? accent });
  };
  const frame = (now: number) => {
    x.clearRect(0, 0, innerWidth, innerHeight);
    if (now < end) spawn();
    for (const p of ps) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.04;
      p.r += p.vr;
      x.save();
      x.translate(p.x, p.y);
      x.rotate(p.r);
      x.fillStyle = p.c;
      x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      x.restore();
    }
    for (let i = ps.length - 1; i >= 0; i--) if ((ps[i]?.y ?? 0) > innerHeight + 20) ps.splice(i, 1);
    if (ps.length || now < end) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}
