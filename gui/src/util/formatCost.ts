export function formatCost(cost: number): string {
  if (cost === 0) {
    return "$0.00";
  }
  // Small costs (the common case for a single response) need more precision
  // than 2 decimal places, otherwise they'd all just read "$0.00".
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}
