// Renders everything the client shows for each challenge into .generated/targets/<id>/:
//   rest.png, hover.png, focus.png  2x target frames (slide and diff overlays)
//   thumb.png                       1x rest frame (lists and gallery)
//   replay.json                     canvas replay of the live target
// Runs at Docker build time and locally with `bun run targets`.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { VIEWPORT, sanitizeCode, wrapDocument } from "@cssdojo/shared";
import { loadAllChallenges } from "./challenges";
import { Renderer } from "./render";
import { recordReplay } from "./replay";

export const TARGETS_DIR = process.env.TARGETS_DIR ?? path.resolve(import.meta.dirname, "../../.generated/targets");

const only = process.argv[2];
const challenges = (await loadAllChallenges()).filter((c) => !only || c.meta.id.includes(only));
const renderer = new Renderer();
const browser = await chromium.launch();
const fontsDir = path.resolve(import.meta.dirname, "../fonts");

for (const c of challenges) {
  const dir = path.join(TARGETS_DIR, c.meta.id);
  await mkdir(dir, { recursive: true });
  const { code } = sanitizeCode(c.reference);
  const out = await renderer.render(code, { frames: c.meta.frames, hooks: c.meta.hooks, states: c.meta.states });
  for (const [name, png] of Object.entries(out.frames)) {
    if (png) await writeFile(path.join(dir, `${name}.png`), PNG.sync.write(png));
  }

  // Replay recording needs a page with fonts served from disk.
  const ctx = await browser.newContext({ viewport: { ...VIEWPORT }, deviceScaleFactor: 2, javaScriptEnabled: false });
  await ctx.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://fonts.dojo.local") {
      await route.fulfill({ path: path.join(fontsDir, url.pathname), headers: { "access-control-allow-origin": "*", "content-type": "font/woff2" } });
    } else await route.abort();
  });
  const page = await ctx.newPage();
  await page.setContent(wrapDocument(code, "http://fonts.dojo.local"), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const hover = c.meta.states.hover ? c.meta.hooks[c.meta.states.hover] : undefined;
  const focus = c.meta.states.focus ? c.meta.hooks[c.meta.states.focus] : undefined;
  const replay = await recordReplay(page, hover ?? focus, focus);
  await writeFile(path.join(dir, "replay.json"), JSON.stringify(replay));

  const thumbCtx = await browser.newContext({ viewport: { ...VIEWPORT }, deviceScaleFactor: 1, javaScriptEnabled: false });
  await thumbCtx.route("**/*", (route) => route.abort());
  const tp = await thumbCtx.newPage();
  const rest = out.frames.rest;
  if (rest) {
    // Downscale the 2x rest frame by drawing it into a 1x page.
    const b64 = PNG.sync.write(rest).toString("base64");
    await tp.setContent(`<body style="margin:0"><img src="data:image/png;base64,${b64}" width="400" height="300" style="display:block">`);
    await writeFile(path.join(dir, "thumb.png"), await tp.screenshot({ clip: { x: 0, y: 0, ...VIEWPORT } }));
  }
  await thumbCtx.close();
  await ctx.close();
  const frames = Object.values(replay).filter(Array.isArray).reduce((n, a) => n + a.length, 0);
  console.log(`${c.meta.id}: ${Object.keys(out.frames).join(", ")}; replay ${frames} frames`);
}
await browser.close();
await renderer.close();
console.log(`built targets for ${challenges.length} challenges in ${TARGETS_DIR}`);
