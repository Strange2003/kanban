import { AsyncLocalStorage } from "node:async_hooks";
import { getSession } from "@/lib/auth";

/**
 * Who is performing the current request (011-agent-access-mcp research.md §
 * Contexto de actor). Server Actions called from the browser act as the
 * session's user; the MCP route (app/api/mcp/route.ts) runs the very same
 * actions on behalf of a user through an AI agent, after verifying its access
 * token and consent — so an agent goes through exactly the same permission
 * checks, validations and audit trail as the UI (FR-020, FR-033).
 *
 * Not a "use server" file: `runAsAgent` must never be reachable from the client.
 */

export type AgentInfo = { clientId: string; name: string };
export type Actor = { userId: string; agent: AgentInfo | null };

const agentActorStorage = new AsyncLocalStorage<Actor>();

/** Runs `fn` as `actor`. Only app/api/mcp/route.ts calls this, after authenticating the agent. */
export function runAsAgent<T>(actor: Actor & { agent: AgentInfo }, fn: () => Promise<T>): Promise<T> {
  return agentActorStorage.run(actor, fn);
}

/** The agent actor of this request if there is one, else the signed-in user, else null. */
export async function getActor(): Promise<Actor | null> {
  const agentActor = agentActorStorage.getStore();
  if (agentActor) return agentActor;

  const session = await getSession();
  if (!session) return null;
  return { userId: session.user.id, agent: null };
}
