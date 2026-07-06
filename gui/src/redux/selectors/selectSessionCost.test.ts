import { ChatHistoryItem, PromptLog } from "core";
import * as costModule from "core/llm/utils/calculateRequestCost";
import { vi } from "vitest";
import { selectSessionCost } from "./selectSessionCost";
import { RootState } from "../store";

function historyItem(promptLogs?: PromptLog[]): ChatHistoryItem {
  return {
    message: { role: "assistant", content: "", id: "1" } as any,
    contextItems: [],
    promptLogs,
  };
}

function stateWithHistory(history: ChatHistoryItem[]): RootState {
  return { session: { history } } as unknown as RootState;
}

describe("selectSessionCost", () => {
  it("returns 0 for an empty session", () => {
    expect(selectSessionCost(stateWithHistory([]))).toBe(0);
  });

  it("returns 0 when no promptLogs have usage", () => {
    const state = stateWithHistory([
      historyItem([
        {
          modelTitle: "Claude Sonnet",
          modelProvider: "anthropic",
          prompt: "",
          completion: "",
        },
      ]),
    ]);
    expect(selectSessionCost(state)).toBe(0);
  });

  it("sums cost across multiple history items and multiple logs", () => {
    const state = stateWithHistory([
      historyItem([
        {
          modelTitle: "Claude Sonnet",
          modelProvider: "anthropic",
          prompt: "",
          completion: "",
          usage: { promptTokens: 1_000_000, completionTokens: 0 },
        },
      ]),
      historyItem([
        {
          modelTitle: "GPT-4o mini",
          modelProvider: "openai",
          prompt: "",
          completion: "",
          usage: { promptTokens: 1_000_000, completionTokens: 0 },
        },
      ]),
    ]);
    // 1M tokens * $3/MTok (Claude Sonnet) + 1M tokens * $0.15/MTok (GPT-4o mini)
    expect(selectSessionCost(state)).toBeCloseTo(3.15, 6);
  });

  it("ignores usage from models not in the pricing table", () => {
    const state = stateWithHistory([
      historyItem([
        {
          modelTitle: "llama3.1:8b",
          modelProvider: "ollama",
          prompt: "",
          completion: "",
          usage: { promptTokens: 1_000_000, completionTokens: 1_000_000 },
        },
      ]),
    ]);
    expect(selectSessionCost(state)).toBe(0);
  });

  it("caches per-item cost by promptLogs reference, so unchanged earlier items aren't recomputed", () => {
    const spy = vi.spyOn(costModule, "calculateRequestCost");
    const historyA = historyItem([
      {
        modelTitle: "Claude Sonnet",
        modelProvider: "anthropic",
        prompt: "",
        completion: "",
        usage: { promptTokens: 1000, completionTokens: 500 },
      },
    ]);
    const historyB = historyItem([
      {
        modelTitle: "GPT-4o mini",
        modelProvider: "openai",
        prompt: "",
        completion: "",
        usage: { promptTokens: 1000, completionTokens: 500 },
      },
    ]);

    selectSessionCost(stateWithHistory([historyA]));
    expect(spy).toHaveBeenCalledTimes(1);

    // A new history array (new reference, so reselect's own memoization
    // can't short-circuit) containing the same historyA object plus a new
    // historyB - only historyB's log should trigger fresh cost calculation.
    spy.mockClear();
    selectSessionCost(stateWithHistory([historyA, historyB]));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("resets to 0 when history is empty (new session)", () => {
    const withCost = stateWithHistory([
      historyItem([
        {
          modelTitle: "Claude Sonnet",
          modelProvider: "anthropic",
          prompt: "",
          completion: "",
          usage: { promptTokens: 1000, completionTokens: 500 },
        },
      ]),
    ]);
    expect(selectSessionCost(withCost)).toBeGreaterThan(0);
    expect(selectSessionCost(stateWithHistory([]))).toBe(0);
  });
});
