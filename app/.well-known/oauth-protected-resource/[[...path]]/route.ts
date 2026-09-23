import { auth } from "@/lib/auth";

// RFC 9728 protected-resource metadata for /api/mcp (011-agent-access-mcp) —
// the URL the 401 challenge of /api/mcp points agents to. The mcp() plugin
// builds the document from this request's path, so the request is handed to
// Better Auth as-is.
export function GET(request: Request) {
  return auth.handler(request);
}
