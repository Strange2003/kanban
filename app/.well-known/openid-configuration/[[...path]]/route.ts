import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth";

// OpenID Connect discovery at the origin root, for AI agent clients that
// look there instead of under /api/auth (011-agent-access-mcp).
export const GET = oauthProviderOpenIdConfigMetadata(auth);
