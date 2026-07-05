import { Middleware } from "@reduxjs/toolkit";
import { calculateRequestCost } from "core/llm/utils/calculateRequestCost";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { addPromptCompletionPair } from "../slices/sessionSlice";
import { RootState } from "../store";

/**
 * Forwards every priced assistant response to the extension host so it can
 * be appended to the local Cost Dashboard ledger (VS Code globalState).
 * Listens for addPromptCompletionPair rather than hooking into individual
 * thunks so it captures responses regardless of which thunk dispatched them
 * (normal turns, tool-call follow-ups, edit mode, etc.).
 */
export function createCostDashboardMiddleware(
  ideMessenger: IIdeMessenger,
): Middleware<{}, RootState> {
  return (storeApi) => (next) => (action) => {
    const result = next(action);

    if (addPromptCompletionPair.match(action)) {
      const state = storeApi.getState();
      const sessionId = state.session.id;
      const sessionTitle = state.session.title;

      for (const log of action.payload) {
        if (!log.usage) {
          continue;
        }

        const costBreakdown = calculateRequestCost(
          log.modelProvider,
          log.modelTitle,
          log.usage,
        );

        ideMessenger.post("costDashboard/recordEvent", {
          sessionId,
          sessionTitle,
          timestamp: Date.now(),
          modelProvider: log.modelProvider,
          modelTitle: log.modelTitle,
          promptTokens: log.usage.promptTokens,
          completionTokens: log.usage.completionTokens,
          cost: costBreakdown?.cost ?? 0,
        });
      }
    }

    return result;
  };
}
