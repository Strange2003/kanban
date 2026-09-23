"use client";

import { createAuthClient } from "better-auth/react";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

// oauthProviderClient (011-agent-access-mcp): when /sign-in or /consent was
// reached from an AI agent's authorization request, it forwards that signed
// request with sign-in and consent calls, so the authorization picks up
// where it left off instead of landing on the home page.
export const authClient = createAuthClient({ plugins: [oauthProviderClient()] });
