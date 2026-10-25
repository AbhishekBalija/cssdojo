// Generates the brand asset set into client/public/brand: SVG mark, logos and belt
// badges written by hand from the approved tokens, plus PNG icons and the default
// share image rendered with Playwright from HTML templates. No generated imagery.
// Run: bun run brand
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve(import.meta.dirname, "../public/brand");
const FONTS = path.resolve(import.meta.dirname, "../../scorer/fonts");

const T = {
  dark: { bg: "#0C0D10", panel: "#131519", line: "#22252C", fg: "#ECEAE4", sub: "#9A9DA6", faint: "#6B6F79", accent: "#A99CFF" },
  light: { bg: "#F1F2F4", panel: "#FFFFFF", line: "#E0E2E7", fg: "#16181D", sub: "#545862", faint: "#80848E", accent: "#5F4AE6" },
};
const BELTS = { white: "#ECEAE4", yellow: "#F2C94C", green: "#4CAF7A", brown: "#8A5A3C", black: "#0C0D10" } as const;

/** The mark: a square mat with a belt across it. */
function mark(fg: string, accent: string, size = 32, bg?: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${bg ? `<rect width="32" height="32" rx="7" fill="${bg}"/>` : ""}<rect x="8" y="8" width="16" height="16" rx="3" fill="none" stroke="${fg}" stroke-width="2.5"/><rect x="5" y="14" width="22" height="4" rx="1" fill="${accent}"/></svg>`;
}

function logo(theme: keyof typeof T): string {
  const t = T[theme];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="176" height="40" viewBox="0 0 176 40" role="img" aria-label="CSS Dojo"><g transform="translate(4 4)"><rect x="8" y="8" width="16" height="16" rx="3" fill="none" stroke="${t.fg}" stroke-width="2.5"/><rect x="5" y="14" width="22" height="4" rx="1" fill="${t.accent}"/></g><text x="44" y="27" font-family="'Martian Mono', ui-monospace, monospace" font-size="19" font-weight="600" letter-spacing="-0.4"><tspan fill="${t.faint}">css</tspan><tspan fill="${t.fg}">dojo</tspan></text></svg>`;
}

/** Belt badge: the belt with its knot, and the belt name. */
function beltBadge(belt: keyof typeof BELTS, theme: keyof typeof T): string {
  const t = T[theme];
  const c = BELTS[belt];
  const label = `${belt.toUpperCase()} BELT`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="132" height="28" viewBox="0 0 132 28" role="img" aria-label="${belt} belt"><rect x=".5" y=".5" width="131" height="27" rx="13.5" fill="${t.panel}" stroke="${t.line}"/><rect x="8.5" y="10.5" width="24" height="7" rx="2" fill="${c}" stroke="${t.faint}" stroke-opacity=".6"/><rect x="18.5" y="7" width="4" height="14" rx="1" fill="${c}" stroke="${t.faint}" stroke-opacity=".6"/><text x="40" y="18" font-family="'Martian Mono', ui-monospace, monospace" font-size="10" font-weight="500" letter-spacing=".6" fill="${t.sub}">${label}</text></svg>`;
}

async function fontCss(): Promise<string> {
  const face = async (family: string, file: string, extra = "") =>
    `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${(await readFile(path.join(FONTS, file))).toString("base64")}) format("woff2");${extra}}`;
  return [await face("Onest", "onest.woff2", "font-weight:100 900;"), await face("Martian Mono", "martian-mono.woff2", "font-weight:100 800;"), await face("Instrument Serif", "instrument-serif-italic.woff2", "font-style:italic;")].join("");
}

/** Default share image (1200 x 630). Per-challenge images reuse the same template with a target thumbnail. */
export function shareHtml(fonts: string, title = "Rebuild small,<br>real UI.", sub = "Write HTML and CSS, get scored on look and behaviour. Daily kata, belts, leaderboards."): string {
  const t = T.dark;
  return `<!doctype html><html><head><style>${fonts}
*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;background:${t.bg};color:${t.fg};font-family:Onest,sans-serif;display:grid;grid-template-columns:1fr 420px;gap:56px;padding:72px 80px;align-items:center;overflow:hidden}
.word{display:flex;align-items:center;gap:16px;font:600 30px/1 "Martian Mono",monospace;letter-spacing:-.02em}.word .css{color:${t.faint}}
h1{font:italic 400 76px/1.02 "Instrument Serif",serif;margin:44px 0 20px;letter-spacing:-.01em}p{font-size:24px;line-height:1.4;color:${t.sub};max-width:560px}
.mat{width:420px;height:420px;border:1px solid ${t.line};border-radius:28px;background:${t.panel};display:grid;place-items:center;position:relative}
.mat .sq{width:220px;height:220px;border:14px solid ${t.fg};border-radius:36px}.mat .belt{position:absolute;left:60px;right:60px;top:50%;height:34px;translate:0 -50%;background:${t.accent};border-radius:8px}
.url{position:absolute;left:80px;bottom:48px;font:500 18px/1 "Martian Mono",monospace;color:${t.faint}}
</style></head><body><div><div class="word">${mark(t.fg, t.accent, 40)}<span><span class="css">css</span>dojo</span></div><h1>${title}</h1><p>${sub}</p></div><div class="mat"><div class="sq"></div><div class="belt"></div></div><span class="url">github.com/AbhishekBalija/cssdojo</span></body></html>`;
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const files: Record<string, string> = {
    "mark.svg": mark(T.dark.fg, T.dark.accent),
    "mark-light.svg": mark(T.light.fg, T.light.accent),
    "logo-dark.svg": logo("dark"),
    "logo-light.svg": logo("light"),
    "app-icon.svg": mark(T.dark.fg, T.dark.accent, 32, T.dark.bg),
  };
  for (const b of Object.keys(BELTS) as (keyof typeof BELTS)[]) {
    files[`belt-${b}.svg`] = beltBadge(b, "dark");
    files[`belt-${b}-light.svg`] = beltBadge(b, "light");
  }
  for (const [name, svg] of Object.entries(files)) await writeFile(path.join(OUT, name), `${svg}\n`);
  await writeFile(path.resolve(OUT, "../favicon.svg"), `${files["app-icon.svg"]}\n`);

  const fonts = await fontCss();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const size of [32, 180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>*{margin:0}svg{display:block}</style>${mark(T.dark.fg, T.dark.accent, size, T.dark.bg)}`);
    const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
    await page.screenshot({ path: path.join(OUT, name), omitBackground: true });
  }
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(shareHtml(fonts));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, "og-default.png") });
  await writeFile(path.join(OUT, "share-template.html"), shareHtml("/* fonts are inlined at render time by client/scripts/brand.ts */"));
  await browser.close();
  console.log(`brand assets written to ${OUT}`);
}

await main();
