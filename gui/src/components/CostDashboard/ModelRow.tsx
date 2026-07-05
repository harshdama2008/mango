import { ModelCostSummary } from "../../util/costDashboard";
import { formatCost } from "../../util/formatCost";

export function ModelRow({ model }: { model: ModelCostSummary }) {
  return (
    <div
      data-testid="cost-dashboard-model-row"
      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-1 break-all text-sm font-medium">
          {model.modelTitle}
        </span>
        <span className="text-description-muted text-xs">
          {model.responseCount}{" "}
          {model.responseCount === 1 ? "response" : "responses"} ·{" "}
          {model.totalPromptTokens.toLocaleString()} in /{" "}
          {model.totalCompletionTokens.toLocaleString()} out
        </span>
      </div>
      <span className="shrink-0 text-sm font-semibold">
        {formatCost(model.totalCost)}
      </span>
    </div>
  );
}
