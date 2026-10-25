import type { Page } from "playwright";
import type { Box } from "./render";

// Canvas replay of the live target. At publish time we record the reference's
// real interaction frames (hover, press, focus and their transitions) by pausing
// Web Animations and scrubbing currentTime. The play screen replays them on a
// canvas, so the target's CSS never reaches the browser.

export interface Replay {
  box: Box;
  /** Frame spacing in ms within each sequence. */
  step: number;
  rest: string[];
  hover: string[];
  press: string[];
  focus: string[];
  focusHover: string[];
  focusPress: string[];
}

const STEP = 32;
const QUALITY = 82;

async function shot(page: Page): Promise<string> {
  const buf = await page.screenshot({ type: "jpeg", quality: QUALITY, caret: "hide" });
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

/** Runs an action, freezes every running animation and captures it frame by frame. */
async function sequence(page: Page, action: () => Promise<void>): Promise<string[]> {
  await action();
  const duration = await page.evaluate(() => {
    const anims = document.getAnimations();
    anims.forEach((a) => a.pause());
    let max = 0;
    for (const a of anims) {
      const t = a.effect?.getComputedTiming();
      const end = Number(t?.endTime ?? 0);
      if (Number.isFinite(end) && end > max) max = end;
    }
    return Math.min(max, 600);
  });
  const frames: string[] = [];
  for (let t = 0; t <= duration; t += STEP) {
    await page.evaluate((time) => document.getAnimations().forEach((a) => (a.currentTime = time)), t);
    frames.push(await shot(page));
  }
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  frames.push(await shot(page));
  return frames;
}

/** Records the full interaction replay for a reference page already loaded in `page`. */
export async function recordReplay(page: Page, hookSelector: string | undefined, focusSelector: string | undefined): Promise<Replay> {
  const rest = [await shot(page)];
  const empty = { box: { x: 0, y: 0, w: 0, h: 0 }, step: STEP, rest, hover: [], press: [], focus: [], focusHover: [], focusPress: [] };
  if (!hookSelector) return empty;
  const b = await page.locator(hookSelector).first().boundingBox();
  if (!b) return empty;
  const box = { x: b.x, y: b.y, w: b.width, h: b.height };
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;

  await page.mouse.move(1, 1);
  const hover = await sequence(page, () => page.mouse.move(cx, cy));
  const press = await sequence(page, () => page.mouse.down());
  await page.mouse.up();
  await page.mouse.move(1, 1);
  await sequence(page, async () => undefined);

  let focus: string[] = [];
  let focusHover: string[] = [];
  let focusPress: string[] = [];
  if (focusSelector) {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    let reached = false;
    for (let i = 0; i < 25 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate((sel) => !!document.activeElement?.matches(sel), focusSelector);
    }
    if (reached) {
      focus = await sequence(page, async () => undefined);
      focusHover = await sequence(page, () => page.mouse.move(cx, cy));
      focusPress = await sequence(page, () => page.mouse.down());
      await page.mouse.up();
    }
  }
  return { box, step: STEP, rest, hover, press, focus, focusHover, focusPress };
}
