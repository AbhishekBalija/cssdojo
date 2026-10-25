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
  BETTER_AUTH_SECRET: z.string().min(16).optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ENABLE_TEST_LOGIN: z.enum(["true", "false"]).default("false"),
  RUN_SCORER_IN_PROCESS: z.enum(["true", "false"]).default("true"),
  CLIENT_DIST: z.string().default("../client/dist"),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
