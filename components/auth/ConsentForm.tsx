"use client";

import { useState } from "react";
import { Bot, Check, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

// FR-016 of 011-agent-access-mcp: say plainly who is asking and what they'll be
// able to do — the same thing the user can do in each project, minus
// administration — with Allow and Deny side by side, same size.
export function ConsentForm({
  agentName,
  agentUri,
  clientId,
  userName,
  userEmail,
}: {
  agentName: string;
  agentUri: string | null;
  clientId: string;
  userName: string;
  userEmail: string;
}) {
  const [submitting, setSubmitting] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function answer(accept: boolean) {
    setError(null);
    setSubmitting(accept ? "allow" : "deny");
    // oauthProviderClient attaches the signed request from this page's address.
    const { data, error: consentError } = await authClient.oauth2.consent({ accept });
    if (consentError) {
      setSubmitting(null);
      setError(consentError.message ?? "Something went wrong. Please try again from your assistant.");
      return;
    }
    const next = (data as { redirect_uri?: string; url?: string } | null)?.redirect_uri ?? (data as { url?: string })?.url;
    if (next) window.location.href = next;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div className="space-y-2">
        <span className="bg-muted inline-flex h-10 w-10 items-center justify-center rounded-full" aria-hidden>
          <Bot className="h-5 w-5" />
        </span>
        <h1 className="text-2xl font-semibold">Allow {agentName} to access your Kanban?</h1>
        <p className="text-muted-foreground text-sm">
          Signed in as <strong>{userName}</strong> ({userEmail}).
          {agentUri && (
            <>
              {" "}
              The agent says it is from (self-declared, not verified){" "}
              <a href={agentUri} className="underline underline-offset-4" target="_blank" rel="noreferrer noopener">
                {agentUri}
              </a>
              .
            </>
          )}
        </p>
      </div>

      <div className="space-y-3 text-sm">
        <p className="font-medium">It will act as you, with your role in each project:</p>
        <ul className="space-y-1.5">
          {[
            "See all your projects, personal and shared, and their members",
            "Create, edit, assign, move and relate Work Items",
            "Delete Work Items, and create, rename, reorder or delete columns",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <p className="font-medium">It won&apos;t be able to:</p>
        <ul className="space-y-1.5">
          {[
            "Invite or remove people, or change anyone's role",
            "Rename, delete or leave a project",
            "Do anything your role in a project doesn't allow",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <X className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs">
          Its changes appear in each Work Item&apos;s history as made by you via {agentName}. You can revoke access
          at any time from Settings → Connected agents.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => answer(false)} disabled={submitting !== null}>
          {submitting === "deny" ? "Denying..." : "Deny"}
        </Button>
        <Button onClick={() => answer(true)} disabled={submitting !== null}>
          {submitting === "allow" ? "Allowing..." : "Allow"}
        </Button>
      </div>
      <p className="text-muted-foreground truncate text-center text-xs" title={clientId}>
        Client ID: {clientId}
      </p>
    </main>
  );
}
