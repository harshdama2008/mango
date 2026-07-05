import { Card } from "../ui";
import { formatCost } from "../../util/formatCost";

export function SummaryCard({ label, cost }: { label: string; cost: number }) {
  return (
    <Card className="flex flex-1 flex-col items-center gap-1 py-4">
      <span className="text-description text-xs uppercase tracking-wide">
        {label}
      </span>
      <span className="text-2xl font-bold">{formatCost(cost)}</span>
    </Card>
  );
}
