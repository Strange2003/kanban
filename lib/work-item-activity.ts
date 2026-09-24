import { LEVEL_LABELS, type WorkItemLevel } from "./work-item-fields";

/**
 * One line of a Work Item's history, in words. Pure — shared by the detail
 * view (which formats dates for the viewer's locale) and the MCP server's
 * get_work_item (011-agent-access-mcp), so a person and an agent read the
 * same history.
 */

export type WorkItemActivityEntryView = {
  id: number;
  type: string;
  payload: unknown;
  createdAt: Date;
  // 011-agent-access-mcp FR-034: who made the change, and through which AI agent.
  actorName: string | null;
  agentName: string | null;
};

type PersonRef = { userId: string; name: string } | null;

// 008-work-item-fields (FR-020): these fields are shown with their previous
// and new value; the older ones keep the "Edited …" summary.
const FIELD_LABELS: Record<string, string> = {
  priority: "Priority",
  severity: "Severity",
  area: "Area",
  iteration: "Iteration",
  startDate: "Start date",
  targetDate: "Target date",
  estimateMinutes: "Estimate",
};

function formatFieldValue(field: string, value: unknown, formatDate: (value: string) => string): string {
  if (value === null || value === undefined || value === "") return "None";
  if (field === "priority" || field === "severity") return LEVEL_LABELS[value as WorkItemLevel] ?? String(value);
  if (field === "startDate" || field === "targetDate") return formatDate(String(value));
  if (field === "estimateMinutes") {
    const minutes = Number(value);
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }
  return String(value);
}

export function describeWorkItemActivity(
  entry: Pick<WorkItemActivityEntryView, "type" | "payload">,
  formatDate: (value: string) => string = (value) => value,
): string {
  if (entry.type === "stage_changed") return "Moved to a different column";
  if (entry.type === "fields_edited") {
    const payload = entry.payload as { fields?: Record<string, { from: unknown; to: unknown }> };
    const fields = payload.fields ?? {};
    const legacy = Object.keys(fields).filter((f) => !(f in FIELD_LABELS));
    const parts = [
      ...(legacy.length > 0 ? [`Edited ${legacy.join(", ")}`] : []),
      ...Object.entries(fields)
        .filter(([f]) => f in FIELD_LABELS)
        .map(
          ([f, c]) =>
            `${FIELD_LABELS[f]}: ${formatFieldValue(f, c.from, formatDate)} → ${formatFieldValue(f, c.to, formatDate)}`,
        ),
    ];
    return parts.length > 0 ? parts.join("; ") : "Edited";
  }
  if (entry.type === "closed") {
    const { stageName, via } = entry.payload as { stageName: string; via: string };
    if (via === "stage_marked") return `Closed: column ${stageName} marked as closing`;
    if (via === "created") return `Closed (created in ${stageName})`;
    return `Closed (moved to ${stageName})`;
  }
  if (entry.type === "reopened") {
    const { stageName, via } = entry.payload as { stageName: string; via: string };
    if (via === "stage_unmarked") return `Reopened: column ${stageName} unmarked as closing`;
    return `Reopened (moved to ${stageName})`;
  }
  if (entry.type === "assignee_changed") {
    const { from, to, reason } = entry.payload as { from: PersonRef; to: PersonRef; reason?: string };
    if (reason === "member_left") return `Unassigned (${from?.name ?? "the assignee"} left the project)`;
    return to ? `Assigned to ${to.name}` : "Unassigned";
  }
  if (entry.type === "created") return "Created";
  if (entry.type === "comment_added") return "Comment added";
  if (entry.type === "time_entry_added") return "Time logged";
  if (entry.type === "time_entry_deleted") return "Time entry removed";
  if (entry.type === "parent_linked") return "Linked to a parent Work Item";
  if (entry.type === "parent_unlinked") return "Unlinked from its parent Work Item";
  if (entry.type === "related_linked") return "Linked to a related Work Item";
  if (entry.type === "related_unlinked") return "Unlinked from a related Work Item";
  return entry.type;
}
