import { CostDashboardEvent } from "core";
import { useContext, useEffect, useMemo, useState } from "react";
import ConfirmationDialog from "../dialogs/ConfirmationDialog";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch } from "../../redux/hooks";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { summarizeCostEvents } from "../../util/costDashboard";
import { getFontSize } from "../../util";
import { ModelRow } from "./ModelRow";
import { SessionRow } from "./SessionRow";
import { SummaryCard } from "./SummaryCard";

export function CostDashboard() {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();
  const [events, setEvents] = useState<CostDashboardEvent[] | null>(null);
  const [trimmedBefore, setTrimmedBefore] = useState<number | null>(null);

  function handleClearHistory() {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          title="Clear cost history?"
          text="This permanently deletes all recorded cost data. It doesn't affect your chat sessions."
          confirmText="Clear history"
          onConfirm={() => {
            ideMessenger.post("costDashboard/clearEvents", undefined);
            setEvents([]);
            setTrimmedBefore(null);
          }}
        />,
      ),
    );
  }

  useEffect(() => {
    let cancelled = false;

    void ideMessenger
      .request("costDashboard/getEvents", undefined)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.status === "success") {
          setEvents(result.content.events);
          setTrimmedBefore(result.content.trimmedBefore);
        } else {
          setEvents([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ideMessenger]);

  const summary = useMemo(() => summarizeCostEvents(events ?? []), [events]);

  // "Most expensive" is only a meaningful highlight when there's something
  // to compare against - with a single session it's trivially that session,
  // so skip the highlight and just show it once, in Recent Sessions.
  const showMostExpensiveHighlight = summary.sessions.length > 1;
  const recentSessions = showMostExpensiveHighlight
    ? summary.sessions.filter(
        (s) => s.sessionId !== summary.mostExpensiveSession?.sessionId,
      )
    : summary.sessions;

  if (events === null) {
    return (
      <div
        className="text-description flex flex-1 items-center justify-center text-sm"
        style={{ fontSize: getFontSize() }}
      >
        Loading cost data...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div
        className="text-description flex flex-1 flex-col items-center justify-center gap-1 px-4 text-center text-sm"
        style={{ fontSize: getFontSize() }}
      >
        <span>No cost data yet.</span>
        <span className="text-description-muted text-xs">
          Send a chat message with a priced model and it will show up here.
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-3"
      style={{ fontSize: getFontSize() }}
    >
      <div className="flex justify-end">
        <span
          data-testid="cost-dashboard-clear-history"
          className="text-description-muted hover:text-foreground cursor-pointer text-xs underline"
          onClick={handleClearHistory}
        >
          Clear cost history
        </span>
      </div>

      {trimmedBefore !== null && (
        <div
          data-testid="cost-dashboard-trim-notice"
          className="text-description-muted text-xs"
        >
          Cost history older than {new Date(trimmedBefore).toLocaleDateString()}{" "}
          was trimmed to limit storage - totals before that date may be
          incomplete.
        </div>
      )}

      <div className="flex gap-2">
        {/* These are rolling windows (last N hours/days from now), not
            calendar-boundary "today"/"this week"/"this month" - the labels
            say so explicitly rather than promising something the underlying
            math (costDashboard.ts's DAY_MS/WEEK_MS/MONTH_MS) doesn't do. */}
        <SummaryCard label="Last 24h" cost={summary.totalToday} />
        <SummaryCard label="Last 7 Days" cost={summary.totalThisWeek} />
        <SummaryCard label="Last 30 Days" cost={summary.totalThisMonth} />
      </div>

      {showMostExpensiveHighlight && summary.mostExpensiveSession && (
        <div className="flex flex-col gap-1">
          <h3 className="m-0 text-sm font-semibold">Most Expensive Session</h3>
          <SessionRow session={summary.mostExpensiveSession} highlighted />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-sm font-semibold">Recent Sessions</h3>
        <div className="flex flex-col gap-0.5">
          {recentSessions.slice(0, 20).map((session) => (
            <SessionRow key={session.sessionId} session={session} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-sm font-semibold">Cost by Model</h3>
        <div className="flex flex-col gap-0.5">
          {summary.models.map((model) => (
            <ModelRow
              key={`${model.modelProvider}::${model.modelTitle}`}
              model={model}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
