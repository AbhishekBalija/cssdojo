import path from "node:path";
import { z } from "zod";

// All configuration comes from environment variables, validated once at start.
// Learning note: parsing env with zod means a typo or missing value fails fast
// with a clear message instead of a confusing error deep in the app.
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().url().optional(),
  API_URL: z.string().url().default("http://localhost:8787"),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  // Origin browsers use for sign-in when the client proxies /api to us (Vercel).
  // OAuth callbacks and cookies live there. Defaults to API_URL.
  AUTH_URL: z.string().url().optional(),
  // "true" sends page requests on this host to CLIENT_URL, so the API host is not a second app.
  PAGES_REDIRECT_TO_CLIENT: z.enum(["true", "false"]).default("false"),
  BETTER_AUTH_SECRET: z.string().min(16).optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ENABLE_TEST_LOGIN: z.enum(["true", "false"]).default("false"),
  RUN_SCORER_IN_PROCESS: z.enum(["true", "false"]).default("true"),
  CLIENT_DIST: z.string().default(path.resolve(import.meta.dirname, "../../client/dist")),
  TARGETS_DIR: z.string().default(path.resolve(import.meta.dirname, "../../.generated/targets")),
  FONTS_DIR: z.string().default(path.resolve(import.meta.dirname, "../../scorer/fonts")),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);

/** Public origin for sign-in: the client's proxy when there is one, else the API. */
export const authUrl = env.AUTH_URL ?? env.API_URL;
/** Every origin a browser may call the API from. */
export const allowedOrigins = [...new Set([env.CLIENT_URL, env.API_URL, authUrl].map((u) => new URL(u).origin))];
