import { db } from "@/db/client";
import { workItemActivity } from "@/db/schema";
import { getActor } from "@/lib/actor";

/**
 * The ONLY way to write to `work_item_activity` (Estándares de Producto y
 * Datos § Auditoría of the constitution; FR-034 of 011-agent-access-mcp).
 * Stamps every event with who made the change and, when it came through an AI
 * agent, which agent — so the history reads "by Ana via Claude" for every
 * event type without each action remembering to do it.
 * tests/unit/activity-logging.test.ts fails if anything inserts elsewhere.
 *
 * Server-only, not "use server": callers check access before logging.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ActivityEvent = { workItemId: number; type: string; payload: unknown };

export async function logActivity(tx: Tx | typeof db, events: ActivityEvent | ActivityEvent[]): Promise<void> {
  const list = Array.isArray(events) ? events : [events];
  if (list.length === 0) return;

  const actor = await getActor();
  const rows = list.map((event) => ({
    workItemId: event.workItemId,
    type: event.type,
    payload: event.payload,
    actorUserId: actor?.userId ?? null,
    agentClientId: actor?.agent?.clientId ?? null,
    agentName: actor?.agent?.name ?? null,
  }));
  // A single event is inserted as a single row value (not a one-element array)
  // purely so its shape matches what the action wrote before logActivity existed.
  if (Array.isArray(events)) await tx.insert(workItemActivity).values(rows);
  else await tx.insert(workItemActivity).values(rows[0]!);
}
