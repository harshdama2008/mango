import { SessionCostSummary } from "../../util/costDashboard";
import { formatCost } from "../../util/formatCost";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SessionRow({
  session,
  highlighted,
}: {
  session: SessionCostSummary;
  highlighted?: boolean;
}) {
  return (
    <div
      data-testid="cost-dashboard-session-row"
      className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ${
        highlighted ? "bg-editor border-border border border-solid" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-1 break-all text-sm font-medium">
          {session.sessionTitle}
          {highlighted && (
            <span className="text-warning ml-2 text-xs font-normal">
              Most expensive session
            </span>
          )}
        </span>
        <span className="text-description-muted text-xs">
          {formatDate(session.lastActivity)} · {session.messageCount} priced{" "}
          {session.messageCount === 1 ? "response" : "responses"}
        </span>
      </div>
      <span className="shrink-0 text-sm font-semibold">
        {formatCost(session.totalCost)}
      </span>
    </div>
  );
}
