import { screen, waitFor } from "@testing-library/react";
import { CostDashboardEvent, PromptLog } from "core";
import { calculateRequestCost } from "core/llm/utils/calculateRequestCost";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { setupStore } from "../../redux/store";
import {
  newSession,
  addPromptCompletionPair,
} from "../../redux/slices/sessionSlice";
import { summarizeCostEvents } from "../../util/costDashboard";
import { renderWithProviders } from "../../util/test/render";
import { CostDashboard } from "./index";

function promptLog(overrides: Partial<PromptLog>): PromptLog {
  return {
    modelTitle: "Claude Sonnet",
    modelProvider: "anthropic",
    prompt: "",
    completion: "",
    ...overrides,
  };
}

/**
 * Drives the real store + costDashboardMiddleware (no mocking of the
 * middleware itself) through two sessions worth of chat responses, and
 * captures every event the middleware posts to the IDE - i.e. exactly what
 * would be persisted to VS Code globalState in the real extension.
 */
function recordResponsesAcrossTwoSessions(): CostDashboardEvent[] {
  const ideMessenger = new MockIdeMessenger();
  const postedEvents: CostDashboardEvent[] = [];
  const originalPost = ideMessenger.post.bind(ideMessenger);
  ideMessenger.post = ((messageType: any, data: any, ...rest: any[]) => {
    if (messageType === "costDashboard/recordEvent") {
      postedEvents.push(data as CostDashboardEvent);
    }
    return originalPost(messageType, data, ...rest);
  }) as typeof ideMessenger.post;

  const store = setupStore({ ideMessenger });

  // --- Session A: 6 messages ---
  store.dispatch(newSession());

  // 3 Claude Sonnet responses
  for (let i = 0; i < 3; i++) {
    store.dispatch(
      addPromptCompletionPair([
        promptLog({
          modelTitle: "Claude Sonnet",
          modelProvider: "anthropic",
          usage: { promptTokens: 1000, completionTokens: 500 },
        }),
      ]),
    );
  }

  // 3 GPT-4o mini responses
  for (let i = 0; i < 3; i++) {
    store.dispatch(
      addPromptCompletionPair([
        promptLog({
          modelTitle: "GPT-4o mini",
          modelProvider: "openai",
          usage: { promptTokens: 2000, completionTokens: 1000 },
        }),
      ]),
    );
  }

  // --- Session B: 4 messages ---
  store.dispatch(newSession());

  // 2 Claude Sonnet responses
  for (let i = 0; i < 2; i++) {
    store.dispatch(
      addPromptCompletionPair([
        promptLog({
          modelTitle: "Claude Sonnet",
          modelProvider: "anthropic",
          usage: { promptTokens: 1000, completionTokens: 500 },
        }),
      ]),
    );
  }

  // 2 DeepSeek Coder responses
  for (let i = 0; i < 2; i++) {
    store.dispatch(
      addPromptCompletionPair([
        promptLog({
          modelTitle: "DeepSeek Coder",
          modelProvider: "deepseek",
          usage: { promptTokens: 5000, completionTokens: 2000 },
        }),
      ]),
    );
  }

  return postedEvents;
}

describe("Cost Dashboard end-to-end: logging + display", () => {
  it("logs exactly one event per priced response, tagged with the correct session", () => {
    const events = recordResponsesAcrossTwoSessions();

    expect(events).toHaveLength(10);

    const sessionIds = new Set(events.map((e) => e.sessionId));
    expect(sessionIds.size).toBe(2);

    const [sessionAEvents, sessionBEvents] = (() => {
      const bySession = new Map<string, CostDashboardEvent[]>();
      for (const e of events) {
        bySession.set(e.sessionId, [...(bySession.get(e.sessionId) ?? []), e]);
      }
      return Array.from(bySession.values());
    })();

    expect(sessionAEvents).toHaveLength(6);
    expect(sessionBEvents).toHaveLength(4);
  });

  it("records timestamp, session ID, model, tokens, and correctly calculated cost on every event", () => {
    const events = recordResponsesAcrossTwoSessions();

    for (const e of events) {
      expect(e.sessionId).toBeTruthy();
      expect(e.timestamp).toBeGreaterThan(0);
      expect(e.modelTitle).toBeTruthy();
      expect(e.modelProvider).toBeTruthy();
      expect(e.promptTokens).toBeGreaterThan(0);
      expect(e.completionTokens).toBeGreaterThan(0);

      const expected = calculateRequestCost(e.modelProvider, e.modelTitle, {
        promptTokens: e.promptTokens,
        completionTokens: e.completionTokens,
      });
      expect(e.cost).toBeCloseTo(expected?.cost ?? 0, 10);
    }
  });

  it("produces correct aggregate totals from the logged events", () => {
    const events = recordResponsesAcrossTwoSessions();
    const summary = summarizeCostEvents(events);

    // Session A: 3 * Claude Sonnet (0.0105 each) + 3 * GPT-4o mini (0.0009 each)
    const sessionATotal = 3 * 0.0105 + 3 * 0.0009;
    // Session B: 2 * Claude Sonnet (0.0105 each) + 2 * DeepSeek Coder (0.00126 each)
    const sessionBTotal = 2 * 0.0105 + 2 * 0.00126;
    const grandTotal = sessionATotal + sessionBTotal;

    expect(summary.sessions).toHaveLength(2);
    expect(summary.totalToday).toBeCloseTo(grandTotal, 6);
    expect(summary.totalThisWeek).toBeCloseTo(grandTotal, 6);
    expect(summary.totalThisMonth).toBeCloseTo(grandTotal, 6);

    const totalsBySession = new Map(
      summary.sessions.map((s) => [s.sessionId, s.totalCost]),
    );
    const totalsSorted = Array.from(totalsBySession.values()).sort(
      (a, b) => a - b,
    );
    expect(totalsSorted[0]).toBeCloseTo(
      Math.min(sessionATotal, sessionBTotal),
      6,
    );
    expect(totalsSorted[1]).toBeCloseTo(
      Math.max(sessionATotal, sessionBTotal),
      6,
    );

    // Session A (0.0342) is more expensive than Session B (0.02352)
    expect(summary.mostExpensiveSession?.totalCost).toBeCloseTo(
      sessionATotal,
      6,
    );

    // Model breakdown: Claude Sonnet used 5 times total (3 + 2)
    const sonnet = summary.models.find((m) => m.modelTitle === "Claude Sonnet");
    expect(sonnet?.responseCount).toBe(5);
    expect(sonnet?.totalCost).toBeCloseTo(5 * 0.0105, 6);

    const gpt4oMini = summary.models.find(
      (m) => m.modelTitle === "GPT-4o mini",
    );
    expect(gpt4oMini?.responseCount).toBe(3);
    expect(gpt4oMini?.totalCost).toBeCloseTo(3 * 0.0009, 6);

    const deepseek = summary.models.find(
      (m) => m.modelTitle === "DeepSeek Coder",
    );
    expect(deepseek?.responseCount).toBe(2);
    expect(deepseek?.totalCost).toBeCloseTo(2 * 0.00126, 6);
  });

  it("renders the correct totals in the dashboard UI when fed the logged events", async () => {
    const events = recordResponsesAcrossTwoSessions();

    const ideMessenger = new MockIdeMessenger();
    ideMessenger.responses["costDashboard/getEvents"] = {
      events,
      trimmedBefore: null,
    };

    await renderWithProviders(<CostDashboard />, {
      mockIdeMessenger: ideMessenger,
    });

    const sessionATotal = 3 * 0.0105 + 3 * 0.0009;
    const sessionBTotal = 2 * 0.0105 + 2 * 0.00126;
    const grandTotal = sessionATotal + sessionBTotal;

    // Today / This Week / This Month all show the same grand total, since
    // every event in this test was just recorded "now".
    await waitFor(() => {
      expect(screen.getAllByText(`$${grandTotal.toFixed(2)}`)).toHaveLength(3);
    });

    // Two distinct sessions should be listed
    expect(
      screen.getAllByTestId("cost-dashboard-session-row").length,
    ).toBeGreaterThanOrEqual(2);

    // Three distinct models should be listed in the breakdown
    expect(screen.getAllByTestId("cost-dashboard-model-row")).toHaveLength(3);
  });
});
