/** Re-indents the CSS inside <style> blocks: one declaration per line, two-space indent. */
export function formatCode(src: string): string {
  return src.replace(/<style>([\s\S]*?)<\/style>/g, (_m, css: string) => {
    let out = "";
    let depth = 1;
    let buf = "";
    const flush = () => {
      const t = buf.trim();
      if (t) out += "  ".repeat(depth) + t + ";\n";
      buf = "";
    };
    // Protect comments so their ; { } are not treated as CSS syntax.
    const safe = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/;/g, "\u0002").replace(/[{}]/g, (x) => (x === "{" ? "\u0003" : "\u0004")));
    for (const ch of safe) {
      if (ch === "{") {
        out += "  ".repeat(depth) + buf.trim() + " {\n";
        buf = "";
        depth++;
      } else if (ch === "}") {
        flush();
        depth = Math.max(1, depth - 1);
        out += "  ".repeat(depth) + "}\n";
      } else if (ch === ";") flush();
      else if (ch === "\n") buf += " ";
      else buf += ch;
    }
    flush();
    out = out.replaceAll("\u0002", ";").replaceAll("\u0003", "{").replaceAll("\u0004", "}").replace(/^(\s*)(\/\*.*?\*\/);$/gm, "$1$2");
    return "<style>\n" + out + "</style>";
  });
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

export function untilReset(now = new Date()): string {
  const r = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
  return `${Math.floor(r / 36e5)}h ${String(Math.floor((r % 36e5) / 6e4)).padStart(2, "0")}m`;
}
