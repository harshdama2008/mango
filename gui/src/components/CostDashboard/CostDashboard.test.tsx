import { screen, waitFor } from "@testing-library/react";
import { CostDashboardEvent } from "core";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { renderWithProviders } from "../../util/test/render";
import { CostDashboard } from "./index";

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

async function renderDashboard(events: CostDashboardEvent[]) {
  const ideMessenger = new MockIdeMessenger();
  ideMessenger.responses["costDashboard/getEvents"] = events;
  return renderWithProviders(<CostDashboard />, {
    mockIdeMessenger: ideMessenger,
  });
}

describe("CostDashboard", () => {
  it("shows an empty state when there is no cost data", async () => {
    await renderDashboard([]);

    await waitFor(() => {
      expect(screen.getByText("No cost data yet.")).toBeInTheDocument();
    });
  });

  it("renders summary totals, sessions, and model breakdown", async () => {
    await renderDashboard([
      event({
        sessionId: "a",
        sessionTitle: "Refactor auth module",
        modelTitle: "Claude Sonnet",
        modelProvider: "anthropic",
        cost: 1,
      }),
      event({
        sessionId: "b",
        sessionTitle: "Debug flaky test",
        modelTitle: "GPT-4o mini",
        modelProvider: "openai",
        cost: 5,
      }),
    ]);

    await waitFor(() => {
      expect(screen.getByText("Today")).toBeInTheDocument();
    });

    expect(screen.getByText("This Week")).toBeInTheDocument();
    expect(screen.getByText("This Month")).toBeInTheDocument();

    expect(screen.getByText("Most Expensive Session")).toBeInTheDocument();
    // "Debug flaky test" is the most expensive session, so it appears both
    // in the highlighted section and in the recent-sessions list.
    expect(screen.getAllByText("Debug flaky test").length).toBe(2);
    expect(screen.getByText("Refactor auth module")).toBeInTheDocument();

    expect(screen.getByText("Cost by Model")).toBeInTheDocument();
    expect(screen.getByText("Claude Sonnet")).toBeInTheDocument();
    expect(screen.getByText("GPT-4o mini")).toBeInTheDocument();
  });
});
