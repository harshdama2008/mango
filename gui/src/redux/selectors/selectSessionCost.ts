import { createSelector } from "@reduxjs/toolkit";
import { PromptLog } from "core";
import { calculateRequestCost } from "core/llm/utils/calculateRequestCost";
import { RootState } from "../store";

// Redux/immer only replaces a history item's `promptLogs` reference when
// that item's logs actually change - completed earlier items keep the same
// reference across renders. Caching per-item cost by that reference means a
// new response only costs O(1 item) instead of re-summing every prior log
// on every history change (was quadratic over a session's lifetime).
const itemCostCache = new WeakMap<PromptLog[], number>();

function getItemCost(promptLogs: PromptLog[] | undefined): number {
  if (!promptLogs || promptLogs.length === 0) {
    return 0;
  }

  const cached = itemCostCache.get(promptLogs);
  if (cached !== undefined) {
    return cached;
  }

  let cost = 0;
  for (const log of promptLogs) {
    if (!log.usage) {
      continue;
    }
    const costBreakdown = calculateRequestCost(
      log.modelProvider,
      log.modelTitle,
      log.usage,
    );
    if (costBreakdown) {
      cost += costBreakdown.cost;
    }
  }

  itemCostCache.set(promptLogs, cost);
  return cost;
}

export const selectSessionCost = createSelector(
  [(state: RootState) => state.session.history],
  (history): number => {
    let totalCost = 0;

    for (const item of history) {
      totalCost += getItemCost(item.promptLogs);
    }

    return totalCost;
  },
);
