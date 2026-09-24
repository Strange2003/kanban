import { McpServer, createMcpHandler, type McpHttpHandler } from "@modelcontextprotocol/server";
import { registerColumnTools } from "@/lib/mcp/tools/columns";
import { registerReadTools } from "@/lib/mcp/tools/read";
import { registerWorkItemTools } from "@/lib/mcp/tools/work-items";

/**
 * The Kanban MCP server (011-agent-access-mcp, contracts/mcp-tools.md). A fresh
 * McpServer per request (stateless — nothing to share between Render
 * instances); `legacy: "stateless"` also answers clients still on the previous
 * MCP revision (research.md § Compatibilidad de protocolo).
 *
 * It only ever runs inside app/api/mcp/route.ts, after the agent's access
 * token and the user's consent were verified and lib/actor.ts was set.
 */

export const MCP_SERVER_INSTRUCTIONS = [
  "This is a Kanban board: projects contain columns (statuses) and Work Items (tasks).",
  "You act as the signed-in user, with exactly their role in each project (owner, member or viewer; a viewer can only read).",
  "Identifiers: projectId comes from list_projects; columnId from get_board; Work Items are named like KAN-12 and always",
  "go with their projectId; memberId (to assign people) comes from list_members.",
  "Before creating Work Items, use search_work_items to check which already exist.",
  "Deleting a Work Item or a column is permanent: confirm with the user first.",
  "You can't manage members, invitations, roles or the project itself — the user does that in the app.",
].join(" ");

export function buildKanbanMcpServer(): McpServer {
  const server = new McpServer(
    { name: "kanban", version: "1.0.0" },
    { instructions: MCP_SERVER_INSTRUCTIONS },
  );
  registerReadTools(server);
  registerWorkItemTools(server);
  registerColumnTools(server);
  return server;
}

export function createKanbanMcpHandler(): McpHttpHandler {
  return createMcpHandler(() => buildKanbanMcpServer(), { legacy: "stateless" });
}
