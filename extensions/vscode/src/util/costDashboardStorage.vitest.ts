import { CostDashboardEvent } from "core";
import { describe, expect, it } from "vitest";
import {
  clearCostDashboardEvents,
  getCostDashboardEvents,
  getCostDashboardTrimMarker,
  recordCostDashboardEvent,
} from "./costDashboardStorage";

function fakeContext() {
  const stored = new Map<string, unknown>();
  return {
    globalState: {
      get: (key: string, defaultValue: unknown) =>
        stored.has(key) ? stored.get(key) : defaultValue,
      update: async (key: string, value: unknown) => {
        // Mirrors real vscode.Memento behavior: passing undefined removes
        // the key rather than storing it.
        if (value === undefined) {
          stored.delete(key);
        } else {
          stored.set(key, value);
        }
      },
    },
  } as any;
}

function event(overrides: Partial<CostDashboardEvent>): CostDashboardEvent {
  return {
    sessionId: "session-1",
    sessionTitle: "Session 1",
    timestamp: Date.now(),
    modelProvider: "anthropic",
    modelTitle: "Claude Sonnet",
    promptTokens: 1000,
    completionTokens: 500,
    cost: 0.01,
    isPriced: true,
    historySlotIndex: 1,
    startOfTurn: true,
    ...overrides,
  };
}

describe("costDashboardStorage", () => {
  it("accumulates events within the same turn (startOfTurn: false)", () => {
    const context = fakeContext();
    recordCostDashboardEvent(context, event({ startOfTurn: true, cost: 0.01 }));
    recordCostDashboardEvent(
      context,
      event({ startOfTurn: false, cost: 0.02 }),
    );

    const events = getCostDashboardEvents(context);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.cost)).toEqual([0.01, 0.02]);
  });

  it("replaces prior events for the same slot when a turn is regenerated", () => {
    const context = fakeContext();
    // Original response: two tool-call round trips at slot 1.
    recordCostDashboardEvent(context, event({ startOfTurn: true, cost: 0.01 }));
    recordCostDashboardEvent(
      context,
      event({ startOfTurn: false, cost: 0.02 }),
    );

    // Regenerate that same turn - fresh promptLogs, same slot.
    recordCostDashboardEvent(context, event({ startOfTurn: true, cost: 0.05 }));

    const events = getCostDashboardEvents(context);
    expect(events).toHaveLength(1);
    expect(events[0].cost).toBe(0.05);
  });

  it("does not affect events recorded for a different session or slot", () => {
    const context = fakeContext();
    recordCostDashboardEvent(
      context,
      event({ sessionId: "session-1", historySlotIndex: 1, cost: 0.01 }),
    );
    recordCostDashboardEvent(
      context,
      event({ sessionId: "session-1", historySlotIndex: 3, cost: 0.02 }),
    );
    recordCostDashboardEvent(
      context,
      event({ sessionId: "session-2", historySlotIndex: 1, cost: 0.03 }),
    );

    // Regenerating session-1's slot 1 turn.
    recordCostDashboardEvent(
      context,
      event({ sessionId: "session-1", historySlotIndex: 1, cost: 0.09 }),
    );

    const events = getCostDashboardEvents(context);
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.cost).sort()).toEqual([0.02, 0.03, 0.09]);
  });

  it("clearCostDashboardEvents empties the ledger", () => {
    const context = fakeContext();
    recordCostDashboardEvent(context, event({}));
    recordCostDashboardEvent(context, event({ sessionId: "session-2" }));
    expect(getCostDashboardEvents(context)).toHaveLength(2);

    clearCostDashboardEvents(context);

    expect(getCostDashboardEvents(context)).toEqual([]);
  });

  it("records a trim marker once history grows past MAX_EVENTS, instead of silently dropping the oldest events", () => {
    const context = fakeContext();
    expect(getCostDashboardTrimMarker(context)).toBeNull();

    // MAX_EVENTS is 5000 (module-private) - push one more than that so a
    // trim actually happens, distinguishing each event by timestamp.
    for (let i = 0; i < 5001; i++) {
      recordCostDashboardEvent(
        context,
        event({
          sessionId: `session-${i}`,
          historySlotIndex: 0,
          timestamp: i,
        }),
      );
    }

    const events = getCostDashboardEvents(context);
    expect(events).toHaveLength(5000);
    // The oldest surviving event (timestamp 1, since timestamp 0 was
    // dropped) is the trim cutoff.
    expect(events[0].timestamp).toBe(1);
    expect(getCostDashboardTrimMarker(context)).toBe(1);
  });

  it("clearCostDashboardEvents also resets the trim marker", () => {
    const context = fakeContext();
    for (let i = 0; i < 5001; i++) {
      recordCostDashboardEvent(
        context,
        event({ sessionId: `session-${i}`, historySlotIndex: 0, timestamp: i }),
      );
    }
    expect(getCostDashboardTrimMarker(context)).not.toBeNull();

    clearCostDashboardEvents(context);

    expect(getCostDashboardTrimMarker(context)).toBeNull();
  });
});
