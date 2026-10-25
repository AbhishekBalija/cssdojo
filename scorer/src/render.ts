import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { PNG } from "pngjs";
import { FONT_FILES, VIEWPORT, wrapDocument, type FrameName } from "@cssdojo/shared";

// The renderer: one shared Chromium, one page at a time (the free host has 512 MB).
// Every render gets a fresh context with JavaScript off and every request blocked
// except our bundled fonts, so a Submit cannot reach the network.

const FONT_ORIGIN = "http://fonts.dojo.local";
const FONTS_DIR = path.resolve(import.meta.dirname, "../fonts");
export const RENDER_TIMEOUT_MS = 5000;
const DPR = 2;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HookInfo {
  name: string;
  selector: string;
  found: boolean;
  visible: boolean;
  box: Box | null;
  /** Native role: "button", "link", "checkbox", "textbox", ... or "none". */
  role: string;
  /** Inputs only: has a <label>, aria-label or aria-labelledby. */
  labelled: boolean;
}

export interface TextInfo {
  box: Box;
  color: string;
  fontSize: number;
  fontWeight: number;
}

export interface DomSnapshot {
  hooks: HookInfo[];
  texts: TextInfo[];
  /** Visible text of the page, whitespace collapsed. */
  text: string;
}

export interface RenderSpec {
  frames: readonly FrameName[];
  hooks: Record<string, string>;
  states: { hover?: string | undefined; focus?: string | undefined };
}

export interface RenderOutput {
  frames: Partial<Record<FrameName, PNG>>;
  snapshot: DomSnapshot;
  /** True when Tab reached the focus hook. */
  focusReached: boolean;
}

let fontCache: Map<string, Buffer> | null = null;
async function fonts(): Promise<Map<string, Buffer>> {
  if (fontCache) return fontCache;
  const map = new Map<string, Buffer>();
  for (const f of FONT_FILES) map.set(`/${f.file}`, await readFile(path.join(FONTS_DIR, f.file)));
  fontCache = map;
  return map;
}

/** Runs one task at a time. Learning note: a tiny promise-chain mutex. */
class Mutex {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task, task);
    this.tail = next.catch(() => undefined);
    return next;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new Error(`Render took longer than ${ms / 1000}s`));
    }, ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export class Renderer {
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;
  private readonly mutex = new Mutex();

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;
    if (!this.launching) {
      this.launching = chromium
        .launch({ args: ["--font-render-hinting=none", "--disable-gpu", "--disable-lcd-text"] })
        .then((b) => {
          this.browser = b;
          this.launching = null;
          return b;
        });
    }
    return this.launching;
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }

  /** Renders every frame of one answer and takes a DOM snapshot from the rest frame. */
  render(code: string, spec: RenderSpec): Promise<RenderOutput> {
    return this.mutex.run(async () => {
      const browser = await this.getBrowser();
      const context = await browser.newContext({
        viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
        deviceScaleFactor: DPR,
        javaScriptEnabled: false,
        reducedMotion: "no-preference",
        colorScheme: "light",
      });
      try {
        return await withTimeout(this.renderIn(context, code, spec), RENDER_TIMEOUT_MS, () => void context.close().catch(() => undefined));
      } finally {
        await context.close().catch(() => undefined);
      }
    });
  }

  private async renderIn(context: BrowserContext, code: string, spec: RenderSpec): Promise<RenderOutput> {
    const fontMap = await fonts();
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      const body = url.origin === FONT_ORIGIN ? fontMap.get(url.pathname) : undefined;
      if (body) {
        await route.fulfill({ status: 200, body, headers: { "content-type": "font/woff2", "access-control-allow-origin": "*" } });
      } else {
        await route.abort();
      }
    });
    const html = wrapDocument(code, FONT_ORIGIN);
    const out: RenderOutput = { frames: {}, snapshot: { hooks: [], texts: [], text: "" }, focusReached: false };

    for (const frame of spec.frames) {
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      if (frame === "rest") {
        out.snapshot = await snapshot(page, spec.hooks);
      } else if (frame === "hover") {
        const sel = spec.states.hover ? spec.hooks[spec.states.hover] : undefined;
        const box = sel ? await page.locator(sel).first().boundingBox({ timeout: 500 }).catch(() => null) : null;
        if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      } else if (frame === "focus") {
        const sel = spec.states.focus ? spec.hooks[spec.states.focus] : undefined;
        if (sel) out.focusReached = await tabTo(page, sel);
      }
      out.frames[frame] = await shot(page);
      await page.close();
    }
    return out;
  }
}

async function shot(page: Page): Promise<PNG> {
  const buf = await page.screenshot({ animations: "disabled", caret: "hide", clip: { x: 0, y: 0, ...VIEWPORT } });
  return PNG.sync.read(buf);
}

/** Presses Tab until the element matching `selector` has keyboard focus (so :focus-visible applies). */
async function tabTo(page: Page, selector: string): Promise<boolean> {
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const hit = await page.evaluate((sel) => {
      const el = document.activeElement;
      return !!el && el !== document.body && (el.matches(sel) || !!el.closest(sel) || !!document.querySelector(sel)?.contains(el));
    }, selector);
    if (hit) return true;
  }
  return false;
}

async function snapshot(page: Page, hooks: Record<string, string>): Promise<DomSnapshot> {
  return page.evaluate((hookList) => {
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const isVisible = (el: Element) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0 && r.width > 0 && r.height > 0;
    };
    const roleOf = (el: Element): string => {
      const explicit = el.getAttribute("role");
      if (explicit) return explicit;
      const tag = el.tagName.toLowerCase();
      if (tag === "button") return "button";
      if (tag === "a" && el.hasAttribute("href")) return "link";
      if (tag === "input") {
        const t = (el.getAttribute("type") ?? "text").toLowerCase();
        if (t === "checkbox" || t === "radio" || t === "range") return t;
        if (t === "submit" || t === "button" || t === "reset") return "button";
        return "textbox";
      }
      if (tag === "textarea") return "textbox";
      if (tag === "select") return "combobox";
      if (tag === "summary") return "button";
      return "none";
    };
    const labelled = (el: Element) => {
      if (el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby")) return true;
      const labels = (el as HTMLInputElement).labels;
      return !!labels && labels.length > 0;
    };
    const hooksOut = hookList.map(([name, selector]) => {
      let el: Element | null;
      try {
        el = document.querySelector(selector);
      } catch {
        el = null;
      }
      return {
        name,
        selector,
        found: !!el,
        visible: !!el && isVisible(el),
        box: el ? rect(el) : null,
        role: el ? roleOf(el) : "none",
        labelled: !!el && labelled(el),
      };
    });
    const texts: { box: { x: number; y: number; w: number; h: number }; color: string; fontSize: number; fontWeight: number }[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
      if (!own || !isVisible(el) || el.tagName === "STYLE") continue;
      const s = getComputedStyle(el);
      texts.push({ box: rect(el), color: s.color, fontSize: parseFloat(s.fontSize), fontWeight: Number(s.fontWeight) || 400 });
    }
    const text = (document.body.innerText || "").replace(/\s+/g, " ").trim();
    return { hooks: hooksOut, texts, text };
  }, Object.entries(hooks));
}
