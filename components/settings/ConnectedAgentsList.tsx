"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, Copy } from "lucide-react";
import { revokeAgent, type ConnectedAgent } from "@/lib/actions/agents";
import { Button } from "@/components/ui/button";
import { LocalDate } from "@/components/ui/local-date";

// FR-035/FR-036 of 011-agent-access-mcp: every authorized agent with when it was
// allowed and last used, and a Revoke that asks for confirmation first.
export function ConnectedAgentsList({ agents, connectionUrl }: { agents: ConnectedAgent[]; connectionUrl: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleRevoke(clientId: string) {
    setError(null);
    setRevoking(clientId);
    const result = await revokeAgent(clientId);
    setRevoking(null);
    setConfirming(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(connectionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the address is still visible to copy by hand.
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {agents.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed border-border p-4 text-sm" data-testid="agents-empty">
          No agents are connected. Add the address below to your AI assistant (for example Claude) as a remote MCP
          server; it will ask you to sign in here and allow it.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border" aria-label="Connected agents">
          {agents.map((agent) => (
            <li key={agent.clientId} className="flex flex-wrap items-center gap-3 p-3" data-testid="connected-agent">
              <span className="bg-muted inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full" aria-hidden>
                <Bot className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{agent.name}</p>
                <p className="text-muted-foreground text-xs">
                  Authorized on <LocalDate value={agent.authorizedAt} /> · Last used{" "}
                  {agent.lastUsedAt ? <LocalDate value={agent.lastUsedAt} /> : "never"}
                </p>
              </div>
              {confirming === agent.clientId ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">Revoke {agent.name}&apos;s access?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRevoke(agent.clientId)}
                    disabled={revoking === agent.clientId}
                  >
                    {revoking === agent.clientId ? "Revoking..." : "Confirm"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirming(agent.clientId)}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Connect an agent</h2>
        <p className="text-muted-foreground text-sm">Give your assistant this address:</p>
        <div className="flex items-center gap-2">
          <code className="bg-muted flex-1 truncate rounded-md px-3 py-2 text-sm" data-testid="mcp-url">
            {connectionUrl}
          </code>
          <Button size="sm" variant="outline" onClick={copyUrl} aria-label="Copy the connection address">
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          With Claude Code: <code>claude mcp add --transport http kanban {connectionUrl}</code>
        </p>
      </section>
    </div>
  );
}
