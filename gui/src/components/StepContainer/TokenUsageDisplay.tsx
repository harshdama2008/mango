import { PromptLog } from "core";
import { calculateRequestCost } from "core/llm/utils/calculateRequestCost";
import { formatCost } from "../../util/formatCost";
import { ToolTip } from "../gui/Tooltip";

export interface TokenUsageDisplayProps {
  promptLogs?: PromptLog[];
}

export default function TokenUsageDisplay({
  promptLogs,
}: TokenUsageDisplayProps) {
  const entriesWithUsage = (promptLogs ?? []).filter((log) => log.usage);
  if (entriesWithUsage.length === 0) {
    return null;
  }

  let promptTokens = 0;
  let completionTokens = 0;
  let totalCost = 0;
  let hasCost = false;
  const breakdowns: string[] = [];
  const modelTitles = new Set<string>();

  for (const log of entriesWithUsage) {
    const usage = log.usage!;
    promptTokens += usage.promptTokens;
    completionTokens += usage.completionTokens;
    modelTitles.add(log.modelTitle);

    const costBreakdown = calculateRequestCost(
      log.modelProvider,
      log.modelTitle,
      usage,
    );
    if (costBreakdown) {
      totalCost += costBreakdown.cost;
      hasCost = true;
      breakdowns.push(costBreakdown.breakdown);
    }
  }

  const modelLabel = Array.from(modelTitles).join(", ");
  const summary = `${modelLabel} · ${promptTokens.toLocaleString()} in / ${completionTokens.toLocaleString()} out${
    hasCost ? ` · ${formatCost(totalCost)}` : ""
  }`;

  return (
    <ToolTip
      content={
        <div className="whitespace-pre-line text-left">
          {breakdowns.length > 0
            ? breakdowns.join("\n\n")
            : "Cost estimate unavailable for this model"}
        </div>
      }
    >
      <div
        data-testid="token-usage-display"
        className="text-description mx-2 mt-1 w-fit cursor-default select-none text-xs"
      >
        {summary}
      </div>
    </ToolTip>
  );
}
