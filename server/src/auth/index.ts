import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import * as schema from "../db/schema";
import { allowedOrigins, authUrl, env } from "../env";
import { setSessionResolver } from "../lib/session";
import { baseHandle } from "./handle";

// Learning note: Better Auth owns sign-in, sessions and OAuth. It stores users and
// sessions in our Postgres through the Drizzle adapter, so there is no separate auth service.

const crossSite = new URL(env.CLIENT_URL).origin !== new URL(authUrl).origin;
const secure = authUrl.startsWith("https://");
export const testLoginEnabled = env.ENABLE_TEST_LOGIN === "true";
if (testLoginEnabled && secure) throw new Error("ENABLE_TEST_LOGIN must be false on a public https deploy");

async function uniqueHandle(name: string, email: string): Promise<string> {
  const base = baseHandle(name, email);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    const [taken] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.handle, candidate));
    if (!taken) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

const socialProviders: BetterAuthOptions["socialProviders"] = {};
if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET };
}
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
}

export const auth = betterAuth({
  baseURL: authUrl,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET ?? "local-dev-secret-change-me-please",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  trustedOrigins: allowedOrigins,
  socialProviders,
  // Email and password exists only to back the dev test login; it is off in production.
  emailAndPassword: { enabled: testLoginEnabled },
  user: { additionalFields: { handle: { type: "string", required: false, input: false } } },
  databaseHooks: {
    user: {
      create: {
        before: async (u) => ({ data: { ...u, handle: await uniqueHandle(u.name, u.email) } }),
      },
    },
  },
  advanced: {
    useSecureCookies: secure,
    // The client and API live on different onrender.com hosts in the split deploy, so
    // the session cookie has to be sent cross-site. Same-origin deploys keep Lax.
    defaultCookieAttributes: crossSite && secure ? { sameSite: "none", secure: true } : { sameSite: "lax" },
  },
  telemetry: { enabled: false },
});

setSessionResolver(async (c) => {
  const s = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!s) return null;
  const handle = (s.user as { handle?: string | null }).handle ?? null;
  return { id: s.user.id, name: s.user.name, email: s.user.email, image: s.user.image ?? null, handle };
});
