import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { CostDashboardEvent } from "core";
import { vi } from "vitest";
import TextDialog from "../dialogs";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setShowDialog } from "../../redux/slices/uiSlice";
import { renderWithProviders } from "../../util/test/render";
import { CostDashboard } from "./index";

// Mirrors how Layout.tsx wires up the global dialog, so tests can exercise
// the full "click -> confirmation dialog -> confirm" flow.
function CostDashboardWithDialog() {
  const dispatch = useAppDispatch();
  const showDialog = useAppSelector((state) => state.ui.showDialog);
  const dialogMessage = useAppSelector((state) => state.ui.dialogMessage);
  return (
    <>
      <CostDashboard />
      <TextDialog
        showDialog={showDialog}
        onEnter={() => dispatch(setShowDialog(false))}
        onClose={() => dispatch(setShowDialog(false))}
        message={dialogMessage}
      />
    </>
  );
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
    cost: 0.0105,
    isPriced: true,
    historySlotIndex: 1,
    startOfTurn: true,
    ...overrides,
  };
}

async function renderDashboard(
  events: CostDashboardEvent[],
  trimmedBefore: number | null = null,
) {
  const ideMessenger = new MockIdeMessenger();
  ideMessenger.responses["costDashboard/getEvents"] = { events, trimmedBefore };
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
      expect(screen.getByText("Last 24h")).toBeInTheDocument();
    });

    expect(screen.getByText("Last 7 Days")).toBeInTheDocument();
    expect(screen.getByText("Last 30 Days")).toBeInTheDocument();

    expect(screen.getByText("Most Expensive Session")).toBeInTheDocument();
    // "Debug flaky test" is the most expensive session - it should be shown
    // once, via the highlight, not duplicated into Recent Sessions too.
    expect(screen.getAllByText("Debug flaky test").length).toBe(1);
    expect(screen.getByText("Refactor auth module")).toBeInTheDocument();

    expect(screen.getByText("Cost by Model")).toBeInTheDocument();
    expect(screen.getByText("Claude Sonnet")).toBeInTheDocument();
    expect(screen.getByText("GPT-4o mini")).toBeInTheDocument();
  });

  it("doesn't show a 'Most Expensive Session' highlight, or duplicate the session, when there's only one session", async () => {
    await renderDashboard([
      event({ sessionId: "a", sessionTitle: "Refactor auth module", cost: 1 }),
    ]);

    await waitFor(() => {
      expect(screen.getByText("Refactor auth module")).toBeInTheDocument();
    });
    expect(
      screen.queryByText("Most Expensive Session"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Refactor auth module").length).toBe(1);
  });

  it("warns when history has been trimmed, so totals aren't silently incomplete", async () => {
    const trimmedBefore = new Date("2026-01-01T00:00:00Z").getTime();
    await renderDashboard([event({ cost: 1 })], trimmedBefore);

    await waitFor(() => {
      expect(
        screen.getByTestId("cost-dashboard-trim-notice"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId("cost-dashboard-trim-notice").textContent,
    ).toContain(new Date(trimmedBefore).toLocaleDateString());
  });

  it("shows no trim notice when nothing has been trimmed", async () => {
    await renderDashboard([event({ cost: 1 })], null);

    await waitFor(() => {
      expect(screen.getByText("Last 24h")).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("cost-dashboard-trim-notice"),
    ).not.toBeInTheDocument();
  });

  it("clears cost history after confirming, without touching chat sessions", async () => {
    const ideMessenger = new MockIdeMessenger();
    ideMessenger.responses["costDashboard/getEvents"] = {
      events: [event({ sessionId: "a", sessionTitle: "Refactor auth module" })],
      trimmedBefore: null,
    };
    const postSpy = vi.spyOn(ideMessenger, "post");

    await renderWithProviders(<CostDashboardWithDialog />, {
      mockIdeMessenger: ideMessenger,
    });

    await waitFor(() => {
      // With only one session, there's nothing to highlight as "most
      // expensive" (see the duplicate-session fix) - it shows once, in
      // Recent Sessions.
      expect(screen.getAllByText("Refactor auth module").length).toBe(1);
    });
    expect(
      screen.queryByText("Most Expensive Session"),
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("cost-dashboard-clear-history"));
    });

    // Clicking alone must not clear anything yet - it should ask first.
    expect(screen.getByText("Clear cost history?")).toBeInTheDocument();
    expect(
      postSpy.mock.calls.some(([type]) => type === "costDashboard/clearEvents"),
    ).toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByText("Clear history"));
    });

    expect(
      postSpy.mock.calls.some(([type]) => type === "costDashboard/clearEvents"),
    ).toBe(true);
    await waitFor(() => {
      expect(screen.getByText("No cost data yet.")).toBeInTheDocument();
    });

    // Only the cost ledger is touched - no session/history deletion is posted.
    expect(postSpy.mock.calls.some(([type]) => type === "history/delete")).toBe(
      false,
    );
  });
});
