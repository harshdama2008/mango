import { useAppSelector } from "../../../redux/hooks";
import { selectSessionCost } from "../../../redux/selectors/selectSessionCost";
import { formatCost } from "../../../util/formatCost";

export function SessionCostIndicator() {
  const sessionCost = useAppSelector(selectSessionCost);

  if (sessionCost <= 0) {
    return null;
  }

  return (
    <span
      data-testid="session-cost-indicator"
      className="text-description select-none text-xs"
    >
      Session cost: {formatCost(sessionCost)}
    </span>
  );
}
