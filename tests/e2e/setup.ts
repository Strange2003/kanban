import { sql } from "drizzle-orm";
import { db } from "@/db/client";

/**
 * Playwright global setup: truncates every app + auth table before the e2e
 * suite runs, so each run starts from a clean slate.
 *
 * Point `DATABASE_URL` at a disposable Neon branch when running this (Neon
 * branches are cheap and exactly built for this — never point it at a
 * database with real data).
 */
export default async function globalSetup() {
  await db.execute(sql`
    TRUNCATE TABLE
      work_item_activity,
      work_item_related_links,
      work_item_tags,
      tags,
      work_items,
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
