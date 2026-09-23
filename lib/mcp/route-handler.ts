import { requireMcpAuth } from "@better-auth/mcp";
import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agentLastUsed } from "@/db/schema";
import { oauthClient, oauthConsent, user } from "@/db/auth-schema";
import { runAsAgent } from "@/lib/actor";
import { auth } from "@/lib/auth";
import { MCP_RESOURCE } from "@/lib/mcp/config";
import { createKanbanMcpHandler } from "@/lib/mcp/server";

/**
 * POST /api/mcp (011-agent-access-mcp, contracts/mcp-tools.md § Autorización):
 *
 * 1. `requireMcpAuth` verifies the bearer JWT (signature, issuer, audience =
 *    MCP_RESOURCE, expiry) or answers 401 + the RFC 9728 challenge that makes
 *    the client start OAuth.
 * 2. On EVERY request, the user's consent for this client must still exist and
 *    the user must still exist — JWTs can't be revoked, so this is what makes
 *    "Revoke" take effect on the agent's very next call (FR-036, FR-037).
 * 3. The MCP server then runs as that user through that agent (lib/actor.ts),
 *    so every tool goes through the same permission checks as the UI.
 *
 * Kept out of the route file so tests can swap the token verification.
 */

type Claims = { sub?: unknown; azp?: unknown; client_id?: unknown };
type Verify = (
  request: Request,
  onVerified: (request: Request, claims: Claims) => Promise<Response>,
) => Promise<Response>;

const defaultVerify: Verify = (request, onVerified) =>
  requireMcpAuth(auth, (req, claims) => onVerified(req, claims as Claims), { resource: MCP_RESOURCE })(request);

/** The same JSON-RPC 401 + WWW-Authenticate that requireMcpAuth sends for a bad token. */
function unauthorized(message: string): Response {
  const challenge = createResourceServerChallenge(new APIError("UNAUTHORIZED", { message }), MCP_RESOURCE);
  const headers = new Headers(challenge?.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }), {
    status: 401,
    headers,
  });
}

// FR-035: "Last used" for the Connected agents page, written at most once a
// minute per agent connection instead of on every call.
const LAST_USED_WRITE_INTERVAL_MS = 60_000;
const lastUsedWrites = new Map<string, number>();

async function touchAgentLastUsed(userId: string, clientId: string) {
  const key = `${userId}:${clientId}`;
  const now = Date.now();
  if (now - (lastUsedWrites.get(key) ?? 0) < LAST_USED_WRITE_INTERVAL_MS) return;
  lastUsedWrites.set(key, now);
  await db
    .insert(agentLastUsed)
    .values({ userId, clientId, lastUsedAt: new Date(now) })
    .onConflictDoUpdate({ target: [agentLastUsed.userId, agentLastUsed.clientId], set: { lastUsedAt: new Date(now) } });
}

/** Forget the throttle for a revoked agent, so a re-authorized one shows up right away. */
export function forgetAgentLastUsed(userId: string, clientId: string) {
  lastUsedWrites.delete(`${userId}:${clientId}`);
}

export function createMcpRoute({ verify = defaultVerify }: { verify?: Verify } = {}) {
  const mcpHandler = createKanbanMcpHandler();

  return (request: Request) =>
    verify(request, async (req, claims) => {
      const userId = typeof claims.sub === "string" ? claims.sub : null;
      const clientIdClaim = claims.azp ?? claims.client_id;
      const clientId = typeof clientIdClaim === "string" ? clientIdClaim : null;
      if (!userId || !clientId) return unauthorized("The access token doesn't identify a user and a client.");

      const [[consent], [account], [client]] = await Promise.all([
        db
          .select({ id: oauthConsent.id })
          .from(oauthConsent)
          .where(and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, clientId)))
          .limit(1),
        db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1),
        db.select({ name: oauthClient.name }).from(oauthClient).where(eq(oauthClient.clientId, clientId)).limit(1),
      ]);
      if (!consent || !account) return unauthorized("This agent's access was revoked. Authorize it again.");

      await touchAgentLastUsed(userId, clientId);
      const agent = { clientId, name: client?.name?.trim() || "AI agent" };
      return runAsAgent({ userId, agent }, () => mcpHandler.fetch(req));
    });
}
