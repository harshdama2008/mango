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

      // addPromptCompletionPair always appends to the current last history
      // item (see sessionSlice.ts), so its index is this event's stable
      // "slot" - regenerating a turn reuses the same slot with a fresh
      // (empty) promptLogs array, while additional tool-call round trips
      // within the same still-in-progress turn keep appending to it.
      const historySlotIndex = state.session.history.length - 1;
      const totalLogsAtSlot =
        state.session.history[historySlotIndex]?.promptLogs?.length ?? 0;
      const priorLogCount = totalLogsAtSlot - action.payload.length;
      let isFirstLogInBatch = true;

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
          isPriced: costBreakdown !== null,
          historySlotIndex,
          // Only the very first log recorded for a freshly-started response
          // at this slot should tell storage to clear out whatever was
          // recorded there before (i.e. the superseded regenerated response).
          startOfTurn: isFirstLogInBatch && priorLogCount <= 0,
        });
        isFirstLogInBatch = false;
      }
    }

    return result;
  };
}
