import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as appSchema from "./schema";
import * as authSchema from "./auth-schema";

const schema = { ...appSchema, ...authSchema };

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// Pool-based (WebSocket) driver, not the one-shot HTTP `neon()` client —
// several Server Actions (reorderStages, moveWorkItem, createWorkItem's
// atomic display-number increment) need real transactions, which the HTTP
// driver doesn't support.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
