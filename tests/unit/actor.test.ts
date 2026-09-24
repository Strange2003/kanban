import { beforeEach, describe, expect, it, vi } from "vitest";

// 011-agent-access-mcp research.md § Contexto de actor: an agent request runs
// the same Server Actions as the UI, as the user it acts for.
const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: mockGetSession }));

import { getActor, runAsAgent } from "@/lib/actor";

const agentActor = { userId: "agent-user", agent: { clientId: "client-1", name: "Claude" } };

beforeEach(() => {
  mockGetSession.mockReset();
});

describe("getActor", () => {
  it("returns the session user when no agent context is active", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } });
    await expect(getActor()).resolves.toEqual({ userId: "u1", agent: null });
  });

  it("returns null without a session or agent context", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(getActor()).resolves.toBeNull();
  });

  it("prefers the agent actor over any session inside runAsAgent", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "someone-else" } });
    const seen = await runAsAgent(agentActor, () => getActor());
    expect(seen).toEqual(agentActor);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("keeps the agent actor across awaits inside runAsAgent", async () => {
    const seen = await runAsAgent(agentActor, async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return getActor();
    });
    expect(seen).toEqual(agentActor);
  });

  it("does not leak the agent actor after runAsAgent resolves", async () => {
    mockGetSession.mockResolvedValue(null);
    await runAsAgent(agentActor, async () => undefined);
    await expect(getActor()).resolves.toBeNull();
  });
});
