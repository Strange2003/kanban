import { beforeEach, describe, expect, it } from "vitest";
import { consumeRateLimit, resetRateLimits } from "@/lib/mcp/rate-limit";

// FR-038 of 011-agent-access-mcp: bursts of 30, then 2 calls a second.
beforeEach(() => resetRateLimits());

describe("consumeRateLimit", () => {
  it("allows a burst of 30, then tells how long to wait", () => {
    const now = 1_000_000;
    for (let i = 0; i < 30; i++) expect(consumeRateLimit("a", now).ok).toBe(true);
    expect(consumeRateLimit("a", now)).toEqual({ ok: false, retryAfterSeconds: 1 });
  });

  it("refills over time and keeps each agent connection separate", () => {
    const now = 1_000_000;
    for (let i = 0; i < 30; i++) consumeRateLimit("a", now);
    expect(consumeRateLimit("b", now).ok).toBe(true);
    expect(consumeRateLimit("a", now + 1_000).ok).toBe(true);
  });
});
