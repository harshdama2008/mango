import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import {
  ChatHistoryItemWithMessageId,
  sessionSlice,
} from "../../../redux/slices/sessionSlice";
import { SessionCostIndicator } from "./SessionCostIndicator";

function historyItem(usage?: {
  promptTokens: number;
  completionTokens: number;
}): ChatHistoryItemWithMessageId {
  return {
    message: { role: "assistant", content: "", id: "1" },
    contextItems: [],
    promptLogs: usage
      ? [
          {
            modelTitle: "Claude Sonnet",
            modelProvider: "anthropic",
            prompt: "",
            completion: "",
            usage,
          },
        ]
      : undefined,
  };
}

function renderWithHistory(history: ChatHistoryItemWithMessageId[]) {
  const store = configureStore({
    reducer: { session: sessionSlice.reducer },
    preloadedState: {
      session: {
        ...sessionSlice.getInitialState(),
        history,
      },
    },
  });
  return render(
    <Provider store={store}>
      <SessionCostIndicator />
    </Provider>,
  );
}

describe("SessionCostIndicator", () => {
  it("renders nothing for an empty session", () => {
    const { container } = renderWithHistory([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when total cost is 0", () => {
    const { container } = renderWithHistory([historyItem()]);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the formatted session cost once usage accumulates", () => {
    renderWithHistory([
      historyItem({ promptTokens: 1_000_000, completionTokens: 0 }), // $3 (Claude Sonnet input)
    ]);

    const el = screen.getByTestId("session-cost-indicator");
    expect(el.textContent).toBe("Session cost: $3.00");
  });

  it("sums across multiple messages in the session", () => {
    renderWithHistory([
      historyItem({ promptTokens: 1_000_000, completionTokens: 0 }),
      historyItem({ promptTokens: 1_000_000, completionTokens: 0 }),
    ]);

    const el = screen.getByTestId("session-cost-indicator");
    expect(el.textContent).toBe("Session cost: $6.00");
  });
});
