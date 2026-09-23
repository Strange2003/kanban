/**
 * The canonical URL of this instance's MCP server (011-agent-access-mcp,
 * contracts/mcp-tools.md § Autorización). Access tokens are audience-bound to
 * it, it's published as the protected resource in the RFC 9728 metadata, and
 * it's the address a user gives their AI assistant. Derived from
 * BETTER_AUTH_URL so a self-hosted instance needs no extra configuration.
 *
 * Deliberately imports nothing (lib/auth.ts imports this file).
 */
export const APP_BASE_URL = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
export const MCP_RESOURCE = `${APP_BASE_URL}/api/mcp`;
