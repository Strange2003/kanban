import { sql } from "drizzle-orm";
import { db } from "@/db/client";

/**
 * Playwright global setup: truncates every app + auth table before the e2e
 * suite runs, so each run starts from a clean slate.
 *
 * Point `DATABASE_URL` at a disposable Neon branch when running this (Neon
 * branches are cheap and exactly built for this — never point it at a
 * database with real data). The OAuth tables of 011-agent-access-mcp are
 * emptied too, but not `jwks` (the signing key can outlive a run) nor
 * `oauth_resource` (Better Auth registers /api/mcp there once).
 */
export default async function globalSetup() {
  await db.execute(sql`
    TRUNCATE TABLE
      agent_last_used,
      oauth_client_assertion,
      oauth_access_token,
      oauth_refresh_token,
      oauth_consent,
      oauth_client_resource,
      oauth_client,
      work_item_activity,
      work_item_related_links,
      work_item_tags,
      tags,
      work_items,
      areas,
      iterations,
      stages,
      notifications,
      invitations,
      project_members,
      projects,
      "verification",
      "account",
      "session",
      "user"
    RESTART IDENTITY CASCADE
  `);
}
