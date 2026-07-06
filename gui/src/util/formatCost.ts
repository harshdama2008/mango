export function formatCost(cost: number): string {
  if (!Number.isFinite(cost)) {
    return "$0.00";
  }
  if (cost === 0) {
    return "$0.00";
  }
  // Small costs (the common case for a single response) need more precision
  // than 2 decimal places, otherwise they'd all just read "$0.00".
  const digits = cost < 0.01 ? 4 : 2;
  // toLocaleString adds a thousands separator, matching the token counts
  // shown alongside these costs elsewhere in the UI.
  return `$${cost.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}
