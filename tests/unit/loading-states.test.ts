import { existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

// 015-loading-animations (contracts/loading-states.md): every page that loads
// data has its own loading.tsx. Without one, a page inherits the nearest
// parent's skeleton — which is how the Work Item detail ended up showing the
// board's columns.
const WORKSPACE = path.resolve(__dirname, "../../app/(workspace)");

const EXPECTED = [
  "projects/[projectPublicId]",
  "projects/[projectPublicId]/work-items/[displayNumber]",
  "projects/[projectPublicId]/list",
  "projects/[projectPublicId]/table",
  "projects/[projectPublicId]/settings",
  "projects/[projectPublicId]/settings/catalogs",
  "my-work",
  "settings/agents",
];

function pageDirs(dir: string, rel = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...pageDirs(full, rel ? `${rel}/${entry}` : entry));
    else if (entry === "page.tsx" && rel) found.push(rel);
  }
  return found;
}

describe("loading states", () => {
  it.each(EXPECTED)("%s has its own loading.tsx", (segment) => {
    expect(existsSync(path.join(WORKSPACE, segment, "loading.tsx"))).toBe(true);
  });

  it("every workspace page except the static home has a loading.tsx next to it", () => {
    const missing = pageDirs(WORKSPACE).filter((rel) => !existsSync(path.join(WORKSPACE, rel, "loading.tsx")));
    expect(missing).toEqual([]);
  });
});
