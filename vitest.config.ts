import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Scorer tests launch Chromium; give them room.
    testTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["{shared,scorer,server,client}/src/**/*.test.{ts,tsx}"],
          exclude: ["**/*.db.test.ts", "**/node_modules/**"],
        },
      },
      {
        // Postgres tests share one test database and empty its tables, so they run one file at a time.
        extends: true,
        test: { name: "db", include: ["server/src/**/*.db.test.ts"], fileParallelism: false },
      },
    ],
  },
});
