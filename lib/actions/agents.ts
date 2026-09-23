"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agentLastUsed } from "@/db/schema";
import { oauthAccessToken, oauthClient, oauthConsent, oauthRefreshToken } from "@/db/auth-schema";
import { getSession } from "@/lib/auth";
import { AppError, runAction, type Result } from "@/lib/errors";
import { forgetAgentLastUsed } from "@/lib/mcp/last-used";

// Connected agents (Historia 5 of 011-agent-access-mcp, FR-035/FR-036). Both
// actions only ever touch the signed-in user's own authorizations — an agent
// can't call them (they need a browser session, and the MCP server has no
// tool for them).

export type ConnectedAgent = {
  clientId: string;
  name: string;
  uri: string | null;
  authorizedAt: Date;
  lastUsedAt: Date | null;
};

export async function listConnectedAgents(): Promise<Result<ConnectedAgent[]>> {
  return runAction(async () => {
    const session = await getSession();
    if (!session) throw new AppError("UNAUTHENTICATED", "You must be signed in.");

    const rows = await db
      .select({
        clientId: oauthConsent.clientId,
        name: oauthClient.name,
        uri: oauthClient.uri,
        authorizedAt: oauthConsent.createdAt,
        lastUsedAt: agentLastUsed.lastUsedAt,
      })
      .from(oauthConsent)
      .leftJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
      .leftJoin(
        agentLastUsed,
        and(eq(agentLastUsed.userId, oauthConsent.userId), eq(agentLastUsed.clientId, oauthConsent.clientId)),
      )
      .where(eq(oauthConsent.userId, session.user.id))
      .orderBy(desc(oauthConsent.createdAt));

    return rows.map((row) => ({
      clientId: row.clientId,
      name: row.name?.trim() || "AI agent",
      uri: row.uri,
      authorizedAt: row.authorizedAt,
      lastUsedAt: row.lastUsedAt,
    }));
  });
}

/**
 * FR-036: the agent's very next call fails — /api/mcp checks the consent on
 * every request — and its refresh tokens are gone, so it has to ask again.
 * The OAuth client itself stays: other users may have authorized it too.
 */
export async function revokeAgent(clientId: string): Promise<Result<void>> {
  return runAction(async () => {
    const session = await getSession();
    if (!session) throw new AppError("UNAUTHENTICATED", "You must be signed in.");
    if (typeof clientId !== "string" || clientId.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Choose an agent to revoke.");
    }
    const userId = session.user.id;

    await db.transaction(async (tx) => {
      await tx
        .delete(oauthConsent)
        .where(and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, clientId)));
      await tx
        .delete(oauthAccessToken)
        .where(and(eq(oauthAccessToken.userId, userId), eq(oauthAccessToken.clientId, clientId)));
      await tx
        .delete(oauthRefreshToken)
        .where(and(eq(oauthRefreshToken.userId, userId), eq(oauthRefreshToken.clientId, clientId)));
      await tx
        .delete(agentLastUsed)
        .where(and(eq(agentLastUsed.userId, userId), eq(agentLastUsed.clientId, clientId)));
    });
    forgetAgentLastUsed(userId, clientId);

    revalidatePath("/settings/agents");
  });
}
