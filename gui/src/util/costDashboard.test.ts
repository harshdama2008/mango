import { CostDashboardEvent } from "core";
import { summarizeCostEvents } from "./costDashboard";

const NOW = new Date("2026-07-15T12:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function event(overrides: Partial<CostDashboardEvent>): CostDashboardEvent {
  return {
    sessionId: "session-1",
    sessionTitle: "Session 1",
    timestamp: NOW,
    modelProvider: "anthropic",
    modelTitle: "Claude Sonnet",
    promptTokens: 1000,
    completionTokens: 500,
    cost: 0.0105,
    ...overrides,
  };
}

describe("summarizeCostEvents", () => {
  it("returns all-zero, empty summary for no events", () => {
    const summary = summarizeCostEvents([], NOW);
    expect(summary.totalToday).toBe(0);
    expect(summary.totalThisWeek).toBe(0);
    expect(summary.totalThisMonth).toBe(0);
    expect(summary.sessions).toEqual([]);
    expect(summary.models).toEqual([]);
    expect(summary.mostExpensiveSession).toBeNull();
  });

  it("buckets totals into today/week/month rolling windows", () => {
    const events = [
      event({ timestamp: NOW - 1 * HOUR, cost: 1 }), // within all three
      event({ timestamp: NOW - 3 * DAY, cost: 2 }), // within week+month, not today
      event({ timestamp: NOW - 20 * DAY, cost: 4 }), // within month only
      event({ timestamp: NOW - 40 * DAY, cost: 8 }), // outside all windows
    ];

    const summary = summarizeCostEvents(events, NOW);

    expect(summary.totalToday).toBeCloseTo(1, 6);
    expect(summary.totalThisWeek).toBeCloseTo(3, 6);
    expect(summary.totalThisMonth).toBeCloseTo(7, 6);
  });

  it("groups events by session and sums cost and message count", () => {
    const events = [
      event({ sessionId: "a", sessionTitle: "Chat A", cost: 1 }),
      event({ sessionId: "a", sessionTitle: "Chat A", cost: 2 }),
      event({ sessionId: "b", sessionTitle: "Chat B", cost: 5 }),
    ];

    const summary = summarizeCostEvents(events, NOW);

    expect(summary.sessions).toHaveLength(2);
    const sessionA = summary.sessions.find((s) => s.sessionId === "a")!;
    expect(sessionA.totalCost).toBeCloseTo(3, 6);
    expect(sessionA.messageCount).toBe(2);

    const sessionB = summary.sessions.find((s) => s.sessionId === "b")!;
    expect(sessionB.totalCost).toBeCloseTo(5, 6);
    expect(sessionB.messageCount).toBe(1);
  });

  it("sorts sessions by most recent activity first", () => {
    const events = [
      event({ sessionId: "old", timestamp: NOW - 2 * DAY }),
      event({ sessionId: "new", timestamp: NOW }),
      event({ sessionId: "mid", timestamp: NOW - 1 * DAY }),
    ];

    const summary = summarizeCostEvents(events, NOW);

    expect(summary.sessions.map((s) => s.sessionId)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("uses the most recent event's title for a session (rename handling)", () => {
    const events = [
      event({
        sessionId: "a",
        sessionTitle: "Old Title",
        timestamp: NOW - HOUR,
      }),
      event({ sessionId: "a", sessionTitle: "New Title", timestamp: NOW }),
    ];

    const summary = summarizeCostEvents(events, NOW);

    expect(summary.sessions[0].sessionTitle).toBe("New Title");
  });

  it("groups events by model (provider + title) and sums cost/tokens", () => {
    const events = [
      event({
        modelProvider: "anthropic",
        modelTitle: "Claude Sonnet",
        cost: 1,
        promptTokens: 100,
        completionTokens: 50,
      }),
      event({
        modelProvider: "anthropic",
        modelTitle: "Claude Sonnet",
        cost: 2,
        promptTokens: 200,
        completionTokens: 100,
      }),
      event({
        modelProvider: "openai",
        modelTitle: "GPT-4o",
        cost: 5,
        promptTokens: 300,
        completionTokens: 150,
      }),
    ];

    const summary = summarizeCostEvents(events, NOW);

    expect(summary.models).toHaveLength(2);
    // Sorted by cost desc: GPT-4o (5) before Claude Sonnet (3)
    expect(summary.models[0].modelTitle).toBe("GPT-4o");
    expect(summary.models[0].totalCost).toBeCloseTo(5, 6);
    expect(summary.models[1].modelTitle).toBe("Claude Sonnet");
    expect(summary.models[1].totalCost).toBeCloseTo(3, 6);
    expect(summary.models[1].totalPromptTokens).toBe(300);
    expect(summary.models[1].totalCompletionTokens).toBe(150);
    expect(summary.models[1].responseCount).toBe(2);
  });

  it("treats the same model title under different providers as distinct", () => {
    const events = [
      event({ modelProvider: "openai", modelTitle: "Custom", cost: 1 }),
      event({ modelProvider: "ollama", modelTitle: "Custom", cost: 2 }),
    ];

    const summary = summarizeCostEvents(events, NOW);

    expect(summary.models).toHaveLength(2);
  });

  it("identifies the single most expensive session", () => {
    const events = [
      event({ sessionId: "a", sessionTitle: "A", cost: 1 }),
      event({ sessionId: "b", sessionTitle: "B", cost: 10 }),
      event({ sessionId: "c", sessionTitle: "C", cost: 5 }),
    ];

    const summary = summarizeCostEvents(events, NOW);

    expect(summary.mostExpensiveSession?.sessionId).toBe("b");
    expect(summary.mostExpensiveSession?.totalCost).toBeCloseTo(10, 6);
  });
});
