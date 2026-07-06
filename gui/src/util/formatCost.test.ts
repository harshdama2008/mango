import { formatCost } from "./formatCost";

describe("formatCost", () => {
  it("formats zero as $0.00", () => {
    expect(formatCost(0)).toBe("$0.00");
  });

  it("formats small costs with extra precision", () => {
    expect(formatCost(0.0075)).toBe("$0.0075");
  });

  it("formats larger costs with 2 decimal places", () => {
    expect(formatCost(1.5)).toBe("$1.50");
  });

  it("adds a thousands separator for large totals, matching adjacent token counts", () => {
    expect(formatCost(1234.5)).toBe("$1,234.50");
    expect(formatCost(1234567.89)).toBe("$1,234,567.89");
  });

  it("falls back to $0.00 for NaN instead of rendering the literal text '$NaN'", () => {
    expect(formatCost(NaN)).toBe("$0.00");
  });

  it("falls back to $0.00 for Infinity", () => {
    expect(formatCost(Infinity)).toBe("$0.00");
    expect(formatCost(-Infinity)).toBe("$0.00");
  });
});
