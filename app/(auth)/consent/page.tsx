import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { oauthClient } from "@/db/auth-schema";
import { getSession } from "@/lib/auth";
import { ConsentForm } from "@/components/auth/ConsentForm";

// The consent screen of 011-agent-access-mcp (FR-015, FR-016): Better Auth
// sends the user here, signed in, when an AI agent asks for access. The query
// carries the agent's signed authorization request; ConsentForm answers it.
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v ? [[k, v]] : [])),
  );

  const session = await getSession();
  // Normally Better Auth only sends signed-in users here; keep the request if not.
  if (!session) redirect(`/sign-in?${query.toString()}`);

  const clientId = query.get("client_id") ?? "";
  const [client] = clientId
    ? await db
        .select({ name: oauthClient.name, uri: oauthClient.uri })
        .from(oauthClient)
        .where(eq(oauthClient.clientId, clientId))
        .limit(1)
    : [];

  return (
    <ConsentForm
      agentName={client?.name?.trim() || "An AI agent"}
      agentUri={client?.uri ?? null}
      clientId={clientId}
      userName={session.user.name}
      userEmail={session.user.email}
    />
  );
}
