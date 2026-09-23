import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createStage, deleteStage, renameStage, reorderStages, setStageClosing } from "@/lib/actions/board";
import { DESTRUCTIVE, WRITE, defineTool } from "@/lib/mcp/define";
import { resolveColumn } from "@/lib/mcp/resolve";
import { unwrap } from "@/lib/mcp/result";

// Column tools of the Kanban MCP server (Historia 4, escenario 9 of
// 011-agent-access-mcp; contracts/mcp-tools.md § Columnas). Same Server
// Actions as the board UI (FR-032, FR-033).

const projectId = z.string().min(1).describe("The project's id, from list_projects.");
const columnId = z.string().min(1).describe("The column's id, from get_board.");

export function registerColumnTools(server: McpServer) {
  defineTool(
    server,
    "create_column",
    {
      title: "Create a column",
      description: "Adds a column (a status) at the end of the board.",
      inputSchema: z.object({ projectId, name: z.string().min(1) }),
      annotations: WRITE,
    },
    async ({ projectId, name }) => {
      const created = unwrap(await createStage({ projectPublicId: projectId, name }));
      return { columnId: created.publicId, name: created.name };
    },
  );

  defineTool(
    server,
    "rename_column",
    {
      title: "Rename a column",
      description: "Renames a column.",
      inputSchema: z.object({ projectId, columnId, name: z.string().min(1) }),
      annotations: WRITE,
    },
    async ({ projectId, columnId, name }) => {
      await resolveColumn(projectId, columnId);
      unwrap(await renameStage({ projectPublicId: projectId, stageId: columnId, name }));
      return { columnId, name };
    },
  );

  defineTool(
    server,
    "reorder_columns",
    {
      title: "Reorder columns",
      description: "Sets the left-to-right order of the board's columns. Send every columnId, in the new order.",
      inputSchema: z.object({ projectId, columnIds: z.array(z.string().min(1)).min(1) }),
      annotations: WRITE,
    },
    async ({ projectId, columnIds }) => {
      unwrap(await reorderStages({ projectPublicId: projectId, orderedStageIds: columnIds }));
      return { columnIds };
    },
  );

  defineTool(
    server,
    "set_column_closing",
    {
      title: "Mark a column as closing",
      description:
        "Marks (true) or unmarks (false) a column as a closing column. Work Items in a closing column count as " +
        "closed, so this closes or reopens every Work Item in it.",
      inputSchema: z.object({ projectId, columnId, isClosing: z.boolean() }),
      annotations: WRITE,
    },
    async ({ projectId, columnId, isClosing }) => {
      await resolveColumn(projectId, columnId);
      unwrap(await setStageClosing({ projectPublicId: projectId, stagePublicId: columnId, isClosing }));
      return { columnId, isClosing };
    },
  );

  defineTool(
    server,
    "delete_column",
    {
      title: "Delete a column",
      description:
        "Deletes an EMPTY column; a column that still has Work Items is rejected (STAGE_NOT_EMPTY) — move them " +
        "first. Confirm with the user before deleting.",
      inputSchema: z.object({ projectId, columnId }),
      annotations: DESTRUCTIVE,
    },
    async ({ projectId, columnId }) => {
      await resolveColumn(projectId, columnId);
      unwrap(await deleteStage({ projectPublicId: projectId, stageId: columnId }));
      return { deleted: columnId };
    },
  );
}
