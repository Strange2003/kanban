import { jwt } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
// Relative (not "@/") so the Better Auth CLI can load this file through
// db/auth-schema.config.ts, which doesn't know the tsconfig path alias.
import { MCP_RESOURCE } from "./mcp/config";

/**
 * 011-agent-access-mcp (research.md § Servidor de autorización): this same
 * Better Auth instance is the OAuth 2.1 authorization server for AI agents
 * connecting to /api/mcp. jwt() signs access tokens and serves /jwks; mcp()
 * binds tokens to MCP_RESOURCE and serves the discovery metadata; cimd()
 * accepts Client ID Metadata Documents (MCP 2026-07-28). Dynamic client
 * registration stays on for clients of the previous MCP revision —
 * registering a client grants nothing: every access needs the user's consent
 * on /consent (FR-015).
 *
 * Shared by lib/auth.ts and db/auth-schema.config.ts so the generated schema
 * always matches the plugins the app actually runs.
 */
export const authPlugins = [
  jwt(),
  mcp({
    loginPage: "/sign-in",
    consentPage: "/consent",
    resource: MCP_RESOURCE,
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
  }),
  cimd({
    fetchClientMetadataResource,
    metadataProfile: "mcp-2026-07-28",
  }),
];
