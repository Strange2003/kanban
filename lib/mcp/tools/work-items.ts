import type { McpServer } from "@modelcontextprotocol/server";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { workItems } from "@/db/schema";
import {
  createWorkItems,
  deleteWorkItem,
  moveWorkItem,
  updateWorkItem,
  type WorkItemFieldsInput,
} from "@/lib/actions/work-items";
import {
  linkRelatedWorkItems,
  removeWorkItemParent,
  setWorkItemParent,
  unlinkRelatedWorkItems,
} from "@/lib/actions/work-item-relationships";
import { WORK_ITEM_LEVELS } from "@/lib/work-item-fields";
import { DESTRUCTIVE, WRITE, defineTool } from "@/lib/mcp/define";
import { resolveColumn, resolveWorkItem } from "@/lib/mcp/resolve";
import { unwrap } from "@/lib/mcp/result";

// Work Item write tools of the Kanban MCP server (Historia 4 of
// 011-agent-access-mcp, contracts/mcp-tools.md § Escritura). Each one only
// resolves public ids and calls the SAME Server Action the UI uses — never
// `db` for writes — so permissions, validation, closing and history are
// identical (FR-033). The role check happens inside each action.

const projectId = z.string().min(1).describe("The project's id, from list_projects.");
const workItemId = z.string().min(1).describe('A Work Item ID such as "KAN-12".');
const level = z.enum(WORK_ITEM_LEVELS).nullable().optional();
const calendarDate = z.string().nullable().optional().describe('A calendar day, "YYYY-MM-DD"; null clears it.');

// The editable fields, named as the agent sees them; `undefined` = leave alone, `null` = clear.
const fieldShape = {
  description: z.string().optional().describe("Plain text."),
  assigneeId: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe("A memberId from list_members; null unassigns. The person gets a notification."),
  tags: z.array(z.string().min(1)).optional().describe("The full tag list (replaces it); new names are created."),
  priority: level,
  severity: level,
  area: z.string().nullable().optional().describe("Area name; created in the project if new; null clears it."),
  iteration: z.string().nullable().optional().describe("Iteration name; created if new; null clears it."),
  startDate: calendarDate,
  targetDate: calendarDate,
};

type FieldInput = { [K in keyof typeof fieldShape]?: z.infer<(typeof fieldShape)[K]> } & { title?: string };

function toActionFields(input: FieldInput): WorkItemFieldsInput {
  return {
    title: input.title,
    description: input.description,
    assigneeUserId: input.assigneeId,
    tagNames: input.tags,
    priority: input.priority,
    severity: input.severity,
    areaName: input.area,
    iterationName: input.iteration,
    startDate: input.startDate,
    targetDate: input.targetDate,
  };
}

export function registerWorkItemTools(server: McpServer) {
  defineTool(
    server,
    "create_work_items",
    {
      title: "Create Work Items",
      description:
        "Creates 1 to 50 Work Items at the end of one column, in order, all or nothing: if any item is invalid " +
        "nothing is created and the error names its index. Check search_work_items first to avoid duplicates.",
      inputSchema: z.object({
        projectId,
        columnId: z.string().min(1).describe("The column's id, from get_board."),
        items: z
          .array(z.object({ title: z.string().min(1), ...fieldShape }))
          .min(1)
          .max(50),
      }),
      annotations: WRITE,
    },
    async ({ projectId, columnId, items }) => {
      const { stage } = await resolveColumn(projectId, columnId);
      const created = unwrap(
        await createWorkItems({
          stagePublicId: stage.publicId,
          items: items.map((item) => ({ ...toActionFields(item), title: item.title })),
        }),
      );
      return { created: created.map((wi) => ({ workItemId: wi.displayId, title: wi.title })) };
    },
  );

  defineTool(
    server,
    "update_work_item",
    {
      title: "Update a Work Item",
      description:
        "Edits a Work Item's fields, including who it's assigned to. Only the fields you send change; " +
        "null clears a field. Moving between columns is move_work_item.",
      inputSchema: z.object({ projectId, workItemId, title: z.string().min(1).optional(), ...fieldShape }),
      annotations: WRITE,
    },
    async ({ projectId, workItemId, ...fields }) => {
      const { workItem } = await resolveWorkItem(projectId, workItemId);
      const updated = unwrap(await updateWorkItem({ workItemId: workItem.id, ...toActionFields(fields) }));
      return { workItemId: updated.displayId, title: updated.title };
    },
  );

  defineTool(
    server,
    "move_work_item",
    {
      title: "Move a Work Item",
      description:
        "Moves a Work Item to a column (its status), at the end or at a 0-based position. Moving into a closing " +
        "column closes it and out of one reopens it, exactly like dragging it on the board.",
      inputSchema: z.object({
        projectId,
        workItemId,
        columnId: z.string().min(1).describe("The destination column's id, from get_board."),
        position: z.number().int().min(0).optional().describe("0-based; omit to move it to the end."),
      }),
      annotations: WRITE,
    },
    async ({ projectId, workItemId, columnId, position }) => {
      const { workItem } = await resolveWorkItem(projectId, workItemId);
      const { stage } = await resolveColumn(projectId, columnId);
      // How many OTHER Work Items the destination holds — the last valid position.
      const [{ others } = { others: 0 }] = await db
        .select({ others: count() })
        .from(workItems)
        .where(and(eq(workItems.stageId, stage.id), ne(workItems.id, workItem.id)));
      const toPosition = Math.min(position ?? others, others);
      unwrap(await moveWorkItem({ workItemId: workItem.id, toStageId: stage.id, toPosition }));
      return { workItemId, columnId: stage.publicId, columnName: stage.name, isClosed: stage.isClosing };
    },
  );

  defineTool(
    server,
    "set_parent",
    {
      title: "Set or remove a parent",
      description:
        "Makes a Work Item the child of another in the same project, or removes its parent with null. A Work Item " +
        "has at most one parent (remove the current one first) and cycles are rejected.",
      inputSchema: z.object({
        projectId,
        workItemId,
        parentWorkItemId: z.string().min(1).nullable().describe('The parent\'s ID such as "KAN-3", or null.'),
      }),
      annotations: WRITE,
    },
    async ({ projectId, workItemId, parentWorkItemId }) => {
      const { workItem } = await resolveWorkItem(projectId, workItemId);
      if (parentWorkItemId === null) {
        unwrap(await removeWorkItemParent(workItem.id));
        return { workItemId, parent: null };
      }
      const { workItem: parent } = await resolveWorkItem(projectId, parentWorkItemId);
      unwrap(await setWorkItemParent({ workItemId: workItem.id, parentWorkItemId: parent.id }));
      return { workItemId, parent: parentWorkItemId };
    },
  );

  defineTool(
    server,
    "link_related",
    {
      title: "Link or unlink related Work Items",
      description: 'Adds (linked: true) or removes (linked: false) a symmetric "related to" link between two Work Items.',
      inputSchema: z.object({ projectId, workItemId, relatedWorkItemId: workItemId, linked: z.boolean() }),
      annotations: WRITE,
    },
    async ({ projectId, workItemId, relatedWorkItemId, linked }) => {
      const { workItem } = await resolveWorkItem(projectId, workItemId);
      const { workItem: other } = await resolveWorkItem(projectId, relatedWorkItemId);
      const input = { workItemIdX: workItem.id, workItemIdY: other.id };
      unwrap(linked ? await linkRelatedWorkItems(input) : await unlinkRelatedWorkItems(input));
      return { workItemId, relatedWorkItemId, linked };
    },
  );

  defineTool(
    server,
    "delete_work_item",
    {
      title: "Delete a Work Item",
      description:
        "Permanently deletes a Work Item (there is no trash). Its children stay as independent Work Items. " +
        "Confirm with the user before deleting.",
      inputSchema: z.object({ projectId, workItemId }),
      annotations: DESTRUCTIVE,
    },
    async ({ projectId, workItemId }) => {
      const { workItem } = await resolveWorkItem(projectId, workItemId);
      unwrap(await deleteWorkItem(workItem.id));
      return { deleted: workItemId };
    },
  );
}
