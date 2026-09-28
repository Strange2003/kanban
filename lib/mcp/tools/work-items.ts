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
import { TAG_COLORS, type TagColor } from "@/lib/tag-colors";
import { listWorkItemTags } from "@/lib/work-item-catalogs";
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
const tagColor = z.enum(TAG_COLORS).describe(`One of: ${TAG_COLORS.join(", ")}.`);
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
  tags: z
    .array(z.union([z.string().min(1), z.strictObject({ name: z.string().min(1), color: tagColor })]))
    .optional()
    .describe(
      "The full tag list (replaces it). Each tag is a name, or { name, color } to give a NEW tag a color " +
        "(an existing tag keeps its own; change it with set_tag_color). New names are created. " +
        "Call list_catalogs first to reuse existing tags.",
    ),
  priority: level,
  severity: level,
  area: z.string().nullable().optional().describe("Area name; created in the project if new; null clears it."),
  size: z.string().nullable().optional().describe("Size name (e.g. S, M, L); created if new; null clears it."),
  startDate: calendarDate,
  targetDate: calendarDate,
};

type FieldInput = { [K in keyof typeof fieldShape]?: z.infer<(typeof fieldShape)[K]> } & { title?: string };

// `tags` as the Server Action takes them: the names, plus the color of each
// tag that may be created — the first color given for a name wins (014 FR-016).
function toActionTags(tags: FieldInput["tags"]): Pick<WorkItemFieldsInput, "tagNames" | "newTagColors"> {
  if (tags === undefined) return {};
  const newTagColors: Record<string, TagColor> = {};
  for (const tag of tags) {
    if (typeof tag === "string") continue;
    const key = tag.name.trim().toLowerCase();
    if (!(key in newTagColors)) newTagColors[key] = tag.color;
  }
  return {
    tagNames: tags.map((tag) => (typeof tag === "string" ? tag : tag.name)),
    newTagColors: Object.keys(newTagColors).length > 0 ? newTagColors : undefined,
  };
}

function toActionFields(input: FieldInput): WorkItemFieldsInput {
  return {
    title: input.title,
    description: input.description,
    assigneeUserId: input.assigneeId,
    ...toActionTags(input.tags),
    priority: input.priority,
    severity: input.severity,
    areaName: input.area,
    sizeName: input.size,
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
      inputSchema: z.strictObject({
        projectId,
        columnId: z.string().min(1).describe("The column's id, from get_board."),
        items: z
          .array(z.strictObject({ title: z.string().min(1), ...fieldShape }))
          .min(1)
          .max(50),
      }),
      annotations: WRITE,
    },
    async ({ projectId, columnId, items }) => {
      const { project, stage } = await resolveColumn(projectId, columnId);
      const created = unwrap(
        await createWorkItems({
          stagePublicId: stage.publicId,
          items: items.map((item) => ({ ...toActionFields(item), title: item.title })),
        }),
      );
      // What was actually stored, with each tag's real color (FR-017 of 014).
      const tagsOf = await listWorkItemTags(project.id, created.map((wi) => wi.id));
      return {
        created: created.map((wi) => ({ workItemId: wi.displayId, title: wi.title, tags: tagsOf.get(wi.id) ?? [] })),
      };
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
      inputSchema: z.strictObject({ projectId, workItemId, title: z.string().min(1).optional(), ...fieldShape }),
      annotations: WRITE,
    },
    async ({ projectId, workItemId, ...fields }) => {
      const { project, workItem } = await resolveWorkItem(projectId, workItemId);
      const updated = unwrap(await updateWorkItem({ workItemId: workItem.id, ...toActionFields(fields) }));
      const tagsOf = await listWorkItemTags(project.id, [workItem.id]);
      return { workItemId: updated.displayId, title: updated.title, tags: tagsOf.get(workItem.id) ?? [] };
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
      inputSchema: z.strictObject({
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
      inputSchema: z.strictObject({
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
      inputSchema: z.strictObject({ projectId, workItemId, relatedWorkItemId: workItemId, linked: z.boolean() }),
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
      inputSchema: z.strictObject({ projectId, workItemId }),
      annotations: DESTRUCTIVE,
    },
    async ({ projectId, workItemId }) => {
      const { workItem } = await resolveWorkItem(projectId, workItemId);
      unwrap(await deleteWorkItem(workItem.id));
      return { deleted: workItemId };
    },
  );
}
