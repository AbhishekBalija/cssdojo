import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

// One small pool per process. Neon's pooled URL handles many clients well;
// `prepare: false` keeps it compatible with PgBouncer-style poolers.
export const sqlClient = postgres(env.DATABASE_URL, { max: 5, prepare: false });
export const db = drizzle(sqlClient, { schema });
export type Db = typeof db;
