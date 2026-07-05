import { CostDashboardEvent } from "core";
import { useContext, useEffect, useMemo, useState } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { summarizeCostEvents } from "../../util/costDashboard";
import { getFontSize } from "../../util";
import { ModelRow } from "./ModelRow";
import { SessionRow } from "./SessionRow";
import { SummaryCard } from "./SummaryCard";

export function CostDashboard() {
  const ideMessenger = useContext(IdeMessengerContext);
  const [events, setEvents] = useState<CostDashboardEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    void ideMessenger
      .request("costDashboard/getEvents", undefined)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.status === "success") {
          setEvents(result.content);
        } else {
          setEvents([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ideMessenger]);

  const summary = useMemo(() => summarizeCostEvents(events ?? []), [events]);

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
      <div className="flex gap-2">
        <SummaryCard label="Today" cost={summary.totalToday} />
        <SummaryCard label="This Week" cost={summary.totalThisWeek} />
        <SummaryCard label="This Month" cost={summary.totalThisMonth} />
      </div>

      {summary.mostExpensiveSession && (
        <div className="flex flex-col gap-1">
          <h3 className="m-0 text-sm font-semibold">Most Expensive Session</h3>
          <SessionRow session={summary.mostExpensiveSession} highlighted />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-sm font-semibold">Recent Sessions</h3>
        <div className="flex flex-col gap-0.5">
          {summary.sessions.slice(0, 20).map((session) => (
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
