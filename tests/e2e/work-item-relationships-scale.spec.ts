import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, stages, workItems } from "@/db/schema";
import { generatePublicId } from "@/lib/ids";
import { workItemIsAncestorOf } from "@/lib/work-item-queries";
import { signUpNewUser, createProjectViaUi, selectRelationOption } from "./helpers";

// T020 of 005-work-item-relationships: a Work Item with ~50 direct children and a
// ~20-level parent chain, seeded straight into the DB (building them through the UI
// would only measure the UI). Checks that cycle detection (the recursive CTE in
// workItemIsAncestorOf) and the detail view's relations (getWorkItemRelations) stay
// usable at that size — SC-001 to SC-004 of that spec.
//
// The budgets are deliberately loose: the DB is a remote Neon branch and the app runs
// under `next dev`, so they catch a pathological slowdown (e.g. an N+1 per child or a
// CTE that doesn't terminate), not a few hundred milliseconds of network jitter.
const CHILDREN = 50;
const CHAIN_DEPTH = 20;
const CYCLE_CHECK_BUDGET_MS = 2000;
const DETAIL_VIEW_BUDGET_MS = 10000;

const pad = (n: number) => String(n).padStart(2, "0");

test.describe("Work Item Relationships — scale (T020)", () => {
  test("50 children and a 20-level chain: relations render and cycles are still caught", async ({ page }) => {
    test.setTimeout(90000);

    await signUpNewUser(page);
    const projectUrl = await createProjectViaUi(page, "Relations Scale");
    const projectPublicId = new URL(projectUrl).pathname.split("/").pop()!;
    const [project] = await db.select().from(projects).where(eq(projects.publicId, projectPublicId)).limit(1);
    if (!project) throw new Error("The project created through the UI isn't in the database.");

    const [stage] = await db
      .insert(stages)
      .values({ publicId: generatePublicId(), projectId: project.id, name: "To do", position: 0 })
      .returning();
    if (!stage) throw new Error("Could not insert the test column.");

    let displayNumber = 0;
    const insertWorkItem = async (title: string, parentWorkItemId: number | null) => {
      displayNumber += 1;
      const [row] = await db
        .insert(workItems)
        .values({
          projectId: project.id,
          stageId: stage.id,
          displayNumber,
          title,
          position: displayNumber,
          parentWorkItemId,
        })
        .returning();
      if (!row) throw new Error(`Could not insert "${title}".`);
      return row;
    };

    const root = await insertWorkItem("Scale root", null);
    await db.insert(workItems).values(
      Array.from({ length: CHILDREN }, (_, i) => ({
        projectId: project.id,
        stageId: stage.id,
        displayNumber: displayNumber + i + 1,
        title: `Scale child ${pad(i + 1)}`,
        position: displayNumber + i + 1,
        parentWorkItemId: root.id,
      })),
    );
    displayNumber += CHILDREN;

    // Chain level 01 is the top; each next level is a child of the previous one.
    const chain = [await insertWorkItem("Chain level 01", null)];
    for (let level = 2; level <= CHAIN_DEPTH; level++) {
      chain.push(await insertWorkItem(`Chain level ${pad(level)}`, chain[chain.length - 1]!.id));
    }
    await db.update(projects).set({ nextWorkItemNumber: displayNumber }).where(eq(projects.id, project.id));

    const top = chain[0]!;
    const bottom = chain[chain.length - 1]!;

    // Cycle detection walks the full 20-level chain in one query, both ways.
    let started = performance.now();
    expect(await workItemIsAncestorOf(top.id, bottom.id)).toBe(true);
    expect(await workItemIsAncestorOf(bottom.id, top.id)).toBe(false);
    const cycleCheckMs = performance.now() - started;
    test.info().annotations.push({ type: "cycle check (2 queries)", description: `${Math.round(cycleCheckMs)} ms` });
    expect(cycleCheckMs).toBeLessThan(CYCLE_CHECK_BUDGET_MS);

    // The root's detail view lists all 50 children.
    started = performance.now();
    await page.goto(`${projectUrl}/work-items/${root.displayNumber}`);
    await expect(page.getByRole("link", { name: /^Go to child / })).toHaveCount(CHILDREN);
    const detailMs = performance.now() - started;
    test.info().annotations.push({ type: "detail view with 50 children", description: `${Math.round(detailMs)} ms` });
    expect(detailMs).toBeLessThan(DETAIL_VIEW_BUDGET_MS);

    // The deepest level shows its parent; the top of the chain can't become its child.
    await page.goto(`${projectUrl}/work-items/${bottom.displayNumber}`);
    await expect(page.getByRole("link", { name: /Chain level 19/ })).toBeVisible();

    await page.goto(`${projectUrl}/work-items/${top.displayNumber}`);
    await selectRelationOption(page, "Convert into a child of", `Chain level ${pad(CHAIN_DEPTH)}`);
    await page.getByRole("button", { name: "Set" }).click();
    await expect(page.getByText(/cycle/i)).toBeVisible({ timeout: 15000 });
    const [topAfter] = await db.select().from(workItems).where(eq(workItems.id, top.id));
    expect(topAfter?.parentWorkItemId).toBeNull();
  });
});
