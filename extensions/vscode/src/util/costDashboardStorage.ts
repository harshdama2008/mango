import { CostDashboardEvent } from "core";
import * as vscode from "vscode";

const STORAGE_KEY = "mango.costDashboard.events";

// Caps local storage growth; ~5000 priced responses is a generous amount of
// history for a single-machine, single-user cost ledger.
const MAX_EVENTS = 5000;

export function recordCostDashboardEvent(
  context: vscode.ExtensionContext,
  event: CostDashboardEvent,
): void {
  const events = context.globalState.get<CostDashboardEvent[]>(STORAGE_KEY, []);
  events.push(event);

  const trimmed =
    events.length > MAX_EVENTS
      ? events.slice(events.length - MAX_EVENTS)
      : events;

  void context.globalState.update(STORAGE_KEY, trimmed);
}

export function getCostDashboardEvents(
  context: vscode.ExtensionContext,
): CostDashboardEvent[] {
  return context.globalState.get<CostDashboardEvent[]>(STORAGE_KEY, []);
}
