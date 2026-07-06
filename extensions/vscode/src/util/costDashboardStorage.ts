import { CostDashboardEvent } from "core";
import * as vscode from "vscode";

const STORAGE_KEY = "mango.costDashboard.events";

// Caps local storage growth; ~5000 priced responses is a generous amount of
// history for a single-machine, single-user cost ledger.
const MAX_EVENTS = 5000;

// Timestamp of the oldest surviving event as of the most recent trim, or
// null if nothing has ever been trimmed. Lets the dashboard warn that its
// totals may be incomplete instead of silently under-counting once history
// grows past MAX_EVENTS.
const TRIM_MARKER_KEY = "mango.costDashboard.trimmedBefore";

export function recordCostDashboardEvent(
  context: vscode.ExtensionContext,
  event: CostDashboardEvent,
): void {
  let events = context.globalState.get<CostDashboardEvent[]>(STORAGE_KEY, []);

  // A regenerated/edited response reuses the same session+slot with a fresh
  // set of prompt logs - drop whatever was previously recorded there so its
  // cost isn't double-counted alongside the new response.
  if (event.startOfTurn) {
    events = events.filter(
      (e) =>
        !(
          e.sessionId === event.sessionId &&
          e.historySlotIndex === event.historySlotIndex
        ),
    );
  }

  events.push(event);

  const trimmed =
    events.length > MAX_EVENTS
      ? events.slice(events.length - MAX_EVENTS)
      : events;

  if (trimmed.length < events.length) {
    void context.globalState.update(TRIM_MARKER_KEY, trimmed[0].timestamp);
  }

  void context.globalState.update(STORAGE_KEY, trimmed);
}

export function getCostDashboardEvents(
  context: vscode.ExtensionContext,
): CostDashboardEvent[] {
  return context.globalState.get<CostDashboardEvent[]>(STORAGE_KEY, []);
}

export function getCostDashboardTrimMarker(
  context: vscode.ExtensionContext,
): number | null {
  return context.globalState.get<number | null>(TRIM_MARKER_KEY, null);
}

// Deleting a chat session or clearing history intentionally does NOT clear
// this ledger - a cost dashboard's whole point is to track spend even after
// the underlying conversations are gone. This is the explicit, user-initiated
// reset instead (see the "Clear cost history" control in the dashboard UI).
export function clearCostDashboardEvents(
  context: vscode.ExtensionContext,
): void {
  void context.globalState.update(STORAGE_KEY, []);
  void context.globalState.update(TRIM_MARKER_KEY, undefined);
}
