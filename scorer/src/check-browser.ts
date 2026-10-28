// Fails the Docker build if the pinned Chromium cannot start.
import { chromium } from "playwright";

const browser = await chromium.launch();
console.log(`chromium ${browser.version()} ok`);
await browser.close();
