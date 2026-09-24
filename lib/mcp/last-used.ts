import { db } from "@/db/client";
import { agentLastUsed } from "@/db/schema";

// FR-035 of 011-agent-access-mcp: "Last used" on the Connected agents page,
// written at most once a minute per agent connection (user + OAuth client)
// instead of on every MCP call.
const WRITE_INTERVAL_MS = 60_000;
const lastWrites = new Map<string, number>();

export async function touchAgentLastUsed(userId: string, clientId: string) {
  const key = `${userId}:${clientId}`;
  const now = Date.now();
  if (now - (lastWrites.get(key) ?? 0) < WRITE_INTERVAL_MS) return;
  lastWrites.set(key, now);
  await db
    .insert(agentLastUsed)
    .values({ userId, clientId, lastUsedAt: new Date(now) })
    .onConflictDoUpdate({ target: [agentLastUsed.userId, agentLastUsed.clientId], set: { lastUsedAt: new Date(now) } });
}

/** After a revoke, so a re-authorized agent's first call shows up right away. */
export function forgetAgentLastUsed(userId: string, clientId: string) {
  lastWrites.delete(`${userId}:${clientId}`);
}
