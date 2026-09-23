import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// FR-034 of 011-agent-access-mcp and the constitution's audit standard: every
// activity event must carry its actor (and agent), which only logActivity
// (lib/activity.ts) stamps. Any direct insert elsewhere would silently write
// anonymous history, so this sweep forbids it.
const ROOT = join(__dirname, "..", "..");
const ALLOWED = "lib/activity.ts";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("work_item_activity writes", () => {
  it("only lib/activity.ts inserts into workItemActivity", () => {
    const offenders = ["lib", "app", "components"]
      .flatMap((dir) => sourceFiles(join(ROOT, dir)))
      .filter((path) => relative(ROOT, path) !== ALLOWED)
      .filter((path) => /insert\(\s*workItemActivity\s*\)/.test(readFileSync(path, "utf8")))
      .map((path) => relative(ROOT, path));

    expect(offenders).toEqual([]);
  });
});
