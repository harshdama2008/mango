import { CostDashboardEvent } from "core";
import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({}));

import {
  getCostDashboardEvents,
  recordCostDashboardEvent,
} from "./costDashboardStorage";

function event(overrides: Partial<CostDashboardEvent>): CostDashboardEvent {
  return {
    sessionId: "session-1",
    sessionTitle: "Session 1",
    timestamp: Date.now(),
    modelProvider: "anthropic",
    modelTitle: "Claude Sonnet",
    promptTokens: 1000,
    completionTokens: 500,
    cost: 0.0105,
    ...overrides,
  };
}

function createFakeContext() {
  const store = new Map<string, unknown>();
  return {
    globalState: {
      get: (key: string, defaultValue?: unknown) =>
        store.has(key) ? store.get(key) : defaultValue,
      update: async (key: string, value: unknown) => {
        store.set(key, value);
      },
    },
  } as any;
}

describe("costDashboardStorage", () => {
  it("returns an empty array when nothing has been recorded", () => {
    const context = createFakeContext();
    expect(getCostDashboardEvents(context)).toEqual([]);
  });

  it("persists a recorded event and returns it", () => {
    const context = createFakeContext();
    const e = event({ sessionId: "a" });

    recordCostDashboardEvent(context, e);

    expect(getCostDashboardEvents(context)).toEqual([e]);
  });

  it("appends multiple events in order", () => {
    const context = createFakeContext();
    const e1 = event({ sessionId: "a", timestamp: 1 });
    const e2 = event({ sessionId: "b", timestamp: 2 });

    recordCostDashboardEvent(context, e1);
    recordCostDashboardEvent(context, e2);

    expect(getCostDashboardEvents(context)).toEqual([e1, e2]);
  });

  it("caps stored events at the maximum, dropping the oldest first", () => {
    const context = createFakeContext();

    for (let i = 0; i < 5010; i++) {
      recordCostDashboardEvent(context, event({ sessionId: `s${i}` }));
    }

    const stored = getCostDashboardEvents(context);
    expect(stored.length).toBe(5000);
    // The oldest 10 should have been dropped, so the first remaining one
    // is s10.
    expect(stored[0].sessionId).toBe("s10");
    expect(stored[stored.length - 1].sessionId).toBe("s5009");
  });
});
