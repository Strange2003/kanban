import type { CallToolResult, McpServer, ToolAnnotations, ToolCallback } from "@modelcontextprotocol/server";
import type { z } from "zod";
import { getActor } from "@/lib/actor";
import { consumeRateLimit } from "@/lib/mcp/rate-limit";
import { runTool, toolError } from "@/lib/mcp/result";

/**
 * Registers one tool of the Kanban MCP server (contracts/mcp-tools.md §
 * Herramientas). Every tool: is rate limited per agent connection (FR-038),
 * runs as the agent's user through lib/actor.ts (set by app/api/mcp/route.ts),
 * and converts Server Action results and errors via runTool. `openWorldHint`
 * is always false: the tools only touch this instance's data.
 */
export function defineTool<Schema extends z.ZodObject>(
  server: McpServer,
  name: string,
  config: { title: string; description: string; inputSchema: Schema; annotations: Omit<ToolAnnotations, "openWorldHint"> },
  body: (input: z.infer<Schema>) => Promise<Record<string, unknown>>,
) {
  server.registerTool(
    name,
    {
      title: config.title,
      description: config.description,
      inputSchema: config.inputSchema,
      annotations: { title: config.title, ...config.annotations, openWorldHint: false },
    },
    // The SDK's callback type is a conditional on the schema, which TypeScript
    // can't resolve for a generic Schema; the input is already validated
    // against `inputSchema` by the SDK before this runs.
    (async (input: z.infer<Schema>): Promise<CallToolResult> => {
      const actor = await getActor();
      const limit = consumeRateLimit(`${actor?.userId ?? "?"}:${actor?.agent?.clientId ?? "?"}`);
      if (!limit.ok) {
        return toolError("RATE_LIMITED", `Too many calls. Try again in ${limit.retryAfterSeconds}s.`, {
          retryAfterSeconds: limit.retryAfterSeconds,
        });
      }
      return runTool(() => body(input));
    }) as unknown as ToolCallback<Schema>,
  );
}

export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;
export const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false } as const;
export const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: false } as const;
