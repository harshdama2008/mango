import { Usage } from "../..";

export interface CostBreakdown {
  cost: number;
  breakdown: string;
}

interface ModelPricing {
  displayName: string;
  input: number;
  output: number;
}

/**
 * Hardcoded per-million-token pricing. Models not represented here (or not
 * matched by matchPricing below) intentionally have no cost - callers should
 * fall back to showing token counts only.
 */
const PRICING_TABLE: ModelPricing[] = [
  { displayName: "Claude Sonnet", input: 3, output: 15 },
  { displayName: "Claude Haiku", input: 0.25, output: 1.25 },
  { displayName: "GPT-4o mini", input: 0.15, output: 0.6 },
  { displayName: "GPT-4o", input: 5, output: 15 },
  { displayName: "Gemini 1.5 Pro", input: 3.5, output: 10.5 },
  { displayName: "Gemini 1.5 Flash", input: 0.075, output: 0.3 },
  { displayName: "DeepSeek Coder", input: 0.14, output: 0.28 },
];

function matchPricing(provider: string, model: string): ModelPricing | null {
  const p = provider.toLowerCase();
  const m = model.toLowerCase();

  switch (p) {
    case "anthropic":
      if (m.includes("haiku")) {
        return PRICING_TABLE.find((e) => e.displayName === "Claude Haiku")!;
      }
      if (m.includes("sonnet")) {
        return PRICING_TABLE.find((e) => e.displayName === "Claude Sonnet")!;
      }
      return null;
    case "openai":
      // Check "mini" before the base "gpt-4o" so it doesn't get matched first
      if (m.includes("gpt-4o") && m.includes("mini")) {
        return PRICING_TABLE.find((e) => e.displayName === "GPT-4o mini")!;
      }
      if (m.includes("gpt-4o")) {
        return PRICING_TABLE.find((e) => e.displayName === "GPT-4o")!;
      }
      return null;
    case "gemini":
      if (m.includes("1.5") && m.includes("flash")) {
        return PRICING_TABLE.find((e) => e.displayName === "Gemini 1.5 Flash")!;
      }
      if (m.includes("1.5") && m.includes("pro")) {
        return PRICING_TABLE.find((e) => e.displayName === "Gemini 1.5 Pro")!;
      }
      return null;
    case "deepseek":
      if (m.includes("coder")) {
        return PRICING_TABLE.find((e) => e.displayName === "DeepSeek Coder")!;
      }
      return null;
    default:
      return null;
  }
}

export function calculateRequestCost(
  provider: string,
  model: string,
  usage: Usage,
): CostBreakdown | null {
  const pricing = matchPricing(provider, model);
  if (!pricing) {
    return null;
  }

  // Some providers omit a usage field entirely rather than sending 0 - guard
  // against that here so it can't turn into NaN and render as the literal
  // text "$NaN" in the cost UI.
  const promptTokens = usage.promptTokens ?? 0;
  const completionTokens = usage.completionTokens ?? 0;

  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  const breakdownParts: string[] = [];
  if (promptTokens > 0) {
    breakdownParts.push(
      `Input: ${promptTokens.toLocaleString()} tokens × $${pricing.input}/MTok = $${inputCost.toFixed(6)}`,
    );
  }
  if (completionTokens > 0) {
    breakdownParts.push(
      `Output: ${completionTokens.toLocaleString()} tokens × $${pricing.output}/MTok = $${outputCost.toFixed(6)}`,
    );
  }

  let breakdown = `Model: ${pricing.displayName}\n`;
  breakdown += breakdownParts.join("\n");
  if (breakdownParts.length > 1) {
    breakdown += `\nTotal: $${totalCost.toFixed(6)}`;
  }

  return {
    cost: totalCost,
    breakdown,
  };
}
