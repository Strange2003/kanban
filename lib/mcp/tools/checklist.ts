import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  addChecklistItem,
  editChecklistItemText,
  moveChecklistItem,
  removeChecklistItem,
  setChecklistItemDone,
} from "@/lib/actions/work-item-checklist";
import { CHECKLIST_MAX_ITEMS, CHECKLIST_TEXT_MAX, checklistProgress, type ChecklistItemView } from "@/lib/work-item-checklist";
import { listWorkItemChecklist } from "@/lib/work-item-queries";
import { DESTRUCTIVE, WRITE, defineTool } from "@/lib/mcp/define";
import { resolveWorkItem } from "@/lib/mcp/resolve";
import { unwrap } from "@/lib/mcp/result";
import { AppError } from "@/lib/errors";

// Checklist tools of the Kanban MCP server (KAN-9). Like every write tool, each
// one only resolves the public ids and calls the SAME Server Action the detail
// view uses, so the role check, the item cap and the history are identical.
// Every tool answers with the whole checklist, so the agent never works from a
// stale copy.

const projectId = z.string().min(1).describe("The project's id, from list_projects.");
const workItemId = z.string().min(1).describe('A Work Item ID such as "KAN-12".');
const checklistItemId = z.string().min(1).describe("A step's checklistItemId, from get_work_item.");
const text = z.string().min(1).max(CHECKLIST_TEXT_MAX).describe(`Plain text, up to ${CHECKLIST_TEXT_MAX} characters.`);

/** The shape get_work_item and every checklist tool return. */
export function checklistOutput(items: ChecklistItemView[]) {
  const { done, total } = checklistProgress(items);
  return {
    progress: { done, total },
    items: items.map((item) => ({ checklistItemId: item.publicId, text: item.text, done: item.done })),
  };
}

async function target(projectPublicId: string, displayId: string) {
  const { workItem } = await resolveWorkItem(projectPublicId, displayId);
  return { workItem, ref: { projectPublicId, displayNumber: workItem.displayNumber } };
}

export function registerChecklistTools(server: McpServer) {
  defineTool(
    server,
    "add_checklist_item",
    {
      title: "Add a checklist step",
      description:
        "Adds a step to a Work Item's checklist (small steps that don't deserve a child Work Item), at the end " +
        `or at a 0-based position. At most ${CHECKLIST_MAX_ITEMS} steps per Work Item. Returns the whole checklist.`,
      inputSchema: z.strictObject({
        projectId,
        workItemId,
        text,
        position: z.number().int().min(0).optional().describe("0-based; omit to add it at the end."),
      }),
      annotations: WRITE,
    },
    async ({ projectId, workItemId, text, position }) => {
      const { workItem, ref } = await target(projectId, workItemId);
      const added = unwrap(await addChecklistItem({ ...ref, text }));
      if (position !== undefined) {
        unwrap(await moveChecklistItem({ ...ref, itemPublicId: added.publicId, toPosition: position }));
      }
      return { workItemId, checklistItemId: added.publicId, checklist: checklistOutput(await listWorkItemChecklist(workItem.id)) };
    },
  );

  defineTool(
    server,
    "update_checklist_item",
    {
      title: "Edit or check off a checklist step",
      description:
        "Changes a checklist step's text and/or marks it done (done: true) or not done (done: false). " +
        "Send at least one of them. Returns the whole checklist.",
      inputSchema: z.strictObject({
        projectId,
        workItemId,
        checklistItemId,
        text: text.optional(),
        done: z.boolean().optional(),
      }),
      annotations: WRITE,
    },
    async ({ projectId, workItemId, checklistItemId, text, done }) => {
      if (text === undefined && done === undefined) {
        throw new AppError("VALIDATION_ERROR", "Send text, done, or both.");
      }
      const { workItem, ref } = await target(projectId, workItemId);
      if (text !== undefined) unwrap(await editChecklistItemText({ ...ref, itemPublicId: checklistItemId, text }));
      if (done !== undefined) unwrap(await setChecklistItemDone({ ...ref, itemPublicId: checklistItemId, done }));
      return { workItemId, checklist: checklistOutput(await listWorkItemChecklist(workItem.id)) };
    },
  );

  defineTool(
    server,
    "move_checklist_item",
    {
      title: "Reorder a checklist step",
      description:
        "Moves a checklist step to a 0-based position (a position past the end moves it last). " +
        "Returns the whole checklist in its new order.",
      inputSchema: z.strictObject({
        projectId,
        workItemId,
        checklistItemId,
        position: z.number().int().min(0).describe("0-based."),
      }),
      annotations: WRITE,
    },
    async ({ projectId, workItemId, checklistItemId, position }) => {
      const { ref } = await target(projectId, workItemId);
      const ordered = unwrap(await moveChecklistItem({ ...ref, itemPublicId: checklistItemId, toPosition: position }));
      return { workItemId, checklist: checklistOutput(ordered) };
    },
  );

  defineTool(
    server,
    "delete_checklist_item",
    {
      title: "Delete a checklist step",
      description: "Permanently removes a step from a Work Item's checklist. Returns the whole checklist.",
      inputSchema: z.strictObject({ projectId, workItemId, checklistItemId }),
      annotations: DESTRUCTIVE,
    },
    async ({ projectId, workItemId, checklistItemId }) => {
      const { workItem, ref } = await target(projectId, workItemId);
      unwrap(await removeChecklistItem({ ...ref, itemPublicId: checklistItemId }));
      return { workItemId, deleted: checklistItemId, checklist: checklistOutput(await listWorkItemChecklist(workItem.id)) };
    },
  );
}
