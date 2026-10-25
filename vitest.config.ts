import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{shared,scorer,server,client}/src/**/*.test.{ts,tsx}"],
    // Scorer tests launch Chromium; give them room.
    testTimeout: 30_000,
  },
});
