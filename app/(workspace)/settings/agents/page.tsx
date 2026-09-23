import { listConnectedAgents } from "@/lib/actions/agents";
import { MCP_RESOURCE } from "@/lib/mcp/config";
import { ConnectedAgentsList } from "@/components/settings/ConnectedAgentsList";

// Settings → Connected agents (Historia 5 of 011-agent-access-mcp, FR-035/FR-036).
export default async function ConnectedAgentsPage() {
  const result = await listConnectedAgents();
  if (!result.ok) throw new Error(result.error.message);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Connected agents</h1>
          <p className="text-muted-foreground text-sm">
            AI assistants you allowed to work in your Kanban. Each one acts as you, with your role in each project,
            and can&apos;t manage members or projects. Revoking takes effect on its very next request.
          </p>
        </div>
        <ConnectedAgentsList agents={result.data} connectionUrl={MCP_RESOURCE} />
      </div>
    </main>
  );
}
