import { createMcpRoute } from "@/lib/mcp/route-handler";

// The MCP server for AI agents (011-agent-access-mcp). POST only: the protocol
// handles each request independently, so GET/DELETE (legacy session streams)
// get Next.js's 405. See lib/mcp/route-handler.ts for the authorization steps.
export const POST = createMcpRoute();
