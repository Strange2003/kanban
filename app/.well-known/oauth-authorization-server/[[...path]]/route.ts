import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth";

// OAuth discovery for AI agents (011-agent-access-mcp, contracts/mcp-tools.md §
// Autorización). Better Auth serves the authorization-server metadata under
// /api/auth; RFC 8414 clients look for it at the origin root, with the issuer
// path appended (/.well-known/oauth-authorization-server/api/auth) or not.
export const GET = oauthProviderAuthServerMetadata(auth);
