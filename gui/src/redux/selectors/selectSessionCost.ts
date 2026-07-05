import { createSelector } from "@reduxjs/toolkit";
import { calculateRequestCost } from "core/llm/utils/calculateRequestCost";
import { RootState } from "../store";

export const selectSessionCost = createSelector(
  [(state: RootState) => state.session.history],
  (history): number => {
    let totalCost = 0;

    for (const item of history) {
      for (const log of item.promptLogs ?? []) {
        if (!log.usage) {
          continue;
        }
        const costBreakdown = calculateRequestCost(
          log.modelProvider,
          log.modelTitle,
          log.usage,
        );
        if (costBreakdown) {
          totalCost += costBreakdown.cost;
        }
      }
    }

    return totalCost;
  },
);
