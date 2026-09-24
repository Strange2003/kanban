import { test, expect } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { oauthClient, oauthConsent, user } from "@/db/auth-schema";
import { signUpNewUser } from "./helpers";

// quickstart.md § 5 of 011-agent-access-mcp: Settings → Connected agents (Historia 5).
// The authorization itself is seeded: the OAuth flow with a real assistant is
// checked by hand (quickstart § 2).
test.describe("Connected agents (011-agent-access-mcp US5)", () => {
  test("lists an authorized agent, revokes it, and shows the connection address when empty", async ({ page }) => {
    const email = await signUpNewUser(page, "Ana");
    const [ana] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    const clientId = `test-client-${Date.now()}`;
    const now = new Date();
    await db.insert(oauthClient).values({
      id: clientId,
      clientId,
      name: "Claude Code",
      redirectUris: ["http://localhost:9999/callback"],
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(oauthConsent).values({
      id: `consent-${clientId}`,
      clientId,
      userId: ana!.id,
      scopes: ["openid", "offline_access"],
      createdAt: now,
      updatedAt: now,
    });

    await page.goto("/");
    await page.getByRole("link", { name: "Connected agents" }).click();
    await expect(page).toHaveURL(/\/settings\/agents$/);
    const agent = page.getByTestId("connected-agent");
    await expect(agent).toHaveCount(1);
    await expect(agent).toContainText("Claude Code");
    await expect(agent).toContainText("Last used never");

    await agent.getByRole("button", { name: "Revoke" }).click();
    await agent.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByTestId("agents-empty")).toBeVisible();
    await expect(page.getByTestId("mcp-url")).toHaveText(/\/api\/mcp$/);

    const remaining = await db
      .select()
      .from(oauthConsent)
      .where(and(eq(oauthConsent.userId, ana!.id), eq(oauthConsent.clientId, clientId)));
    expect(remaining).toEqual([]);
  });
});
