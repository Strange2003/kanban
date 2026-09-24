import type { CallToolResult } from "@modelcontextprotocol/server";
import { AppError, type Result } from "@/lib/errors";

/**
 * Turns Server Action results into MCP tool results (contracts/mcp-tools.md §
 * Errores de herramienta). A tool body calls `unwrap()` on every action result
 * and returns plain data; `runTool` serializes it, or reports the error code
 * the agent needs to tell apart (FR-022).
 */

/** The data of an ok Result, or throws its error as an AppError. */
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new AppError(result.error.code, result.error.message);
  return result.data;
}

export function toolError(code: string, message: string, extra: Record<string, unknown> = {}): CallToolResult {
  const body = { code, message, ...extra };
  return { isError: true, content: [{ type: "text", text: JSON.stringify(body) }], structuredContent: body };
}

// FORBIDDEN means "not a member" — to an agent that must look exactly like a
// project that doesn't exist, so it never learns another project exists (FR-021, SC-007).
const HIDDEN_AS_NOT_FOUND = new Set(["FORBIDDEN", "NOT_FOUND"]);

export async function runTool(body: () => Promise<Record<string, unknown>>): Promise<CallToolResult> {
  try {
    const data = await body();
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  } catch (error) {
    if (error instanceof AppError) {
      if (HIDDEN_AS_NOT_FOUND.has(error.code)) {
        return toolError("NOT_FOUND", error.code === "FORBIDDEN" ? "Not found." : error.message);
      }
      return toolError(error.code, error.message);
    }
    console.error(error);
    return toolError("UNKNOWN_ERROR", "Something went wrong. Please try again.");
  }
}
