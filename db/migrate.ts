import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { db } from "./client";

async function main() {
  console.log("Applying migrations from db/migrations ...");
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
