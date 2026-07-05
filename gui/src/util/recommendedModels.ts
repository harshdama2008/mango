export interface RecommendedModel {
  /** Stable id, also used as the persisted preference value */
  key: string;
  displayName: string;
  provider: string;
  /** The exact model string to use when adding this model via Add Model */
  model: string;
}

/**
 * Fast, cheap models recommended for autocomplete and everyday questions.
 * Kept in sync with the pricing table in core/llm/utils/calculateRequestCost.ts.
 */
export const EVERYDAY_MODEL_OPTIONS: RecommendedModel[] = [
  {
    key: "claude-haiku",
    displayName: "Claude Haiku",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
  },
  {
    key: "gpt-4o-mini",
    displayName: "GPT-4o mini",
    provider: "openai",
    model: "gpt-4o-mini",
  },
  {
    key: "gemini-1.5-flash",
    displayName: "Gemini 1.5 Flash",
    provider: "gemini",
    model: "gemini-1.5-flash",
  },
  {
    key: "deepseek-coder",
    displayName: "DeepSeek Coder",
    provider: "deepseek",
    model: "deepseek-coder",
  },
];

/**
 * Stronger models recommended for complex tasks and agent mode.
 * Kept in sync with the pricing table in core/llm/utils/calculateRequestCost.ts.
 */
export const POWERFUL_MODEL_OPTIONS: RecommendedModel[] = [
  {
    key: "claude-sonnet",
    displayName: "Claude Sonnet",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
  },
  {
    key: "gpt-4o",
    displayName: "GPT-4o",
    provider: "openai",
    model: "gpt-4o",
  },
  {
    key: "gemini-1.5-pro",
    displayName: "Gemini 1.5 Pro",
    provider: "gemini",
    model: "gemini-1.5-pro",
  },
];

export function findRecommendedModel(
  key: string | null,
): RecommendedModel | undefined {
  if (!key) {
    return undefined;
  }
  return [...EVERYDAY_MODEL_OPTIONS, ...POWERFUL_MODEL_OPTIONS].find(
    (m) => m.key === key,
  );
}

/**
 * True if a configured model (identified by its provider + underlying model
 * string) matches a recommended catalog entry's family. Uses the same
 * keyword matching as calculateRequestCost, so "configured" here means the
 * same model family that would receive that entry's pricing.
 */
export function matchesRecommendedModel(
  configured: { provider: string; model: string },
  recommended: RecommendedModel,
): boolean {
  if (configured.provider.toLowerCase() !== recommended.provider) {
    return false;
  }

  const m = configured.model.toLowerCase();

  switch (recommended.key) {
    case "claude-haiku":
      return m.includes("haiku");
    case "claude-sonnet":
      return m.includes("sonnet");
    case "gpt-4o-mini":
      return m.includes("gpt-4o") && m.includes("mini");
    case "gpt-4o":
      return m.includes("gpt-4o") && !m.includes("mini");
    case "gemini-1.5-flash":
      return m.includes("1.5") && m.includes("flash");
    case "gemini-1.5-pro":
      return m.includes("1.5") && m.includes("pro");
    case "deepseek-coder":
      return m.includes("coder");
    default:
      return false;
  }
}

export function findConfiguredMatch<
  T extends { provider: string; model: string },
>(models: T[], recommended: RecommendedModel): T | undefined {
  return models.find((m) => matchesRecommendedModel(m, recommended));
}

/**
 * Resolves a routing tier ("everyday"/"powerful") to the user's actually
 * configured chat model for that tier, based on their saved Everyday/
 * Powerful Model preference (see ModelsSection). Returns undefined if the
 * user hasn't picked a model for that tier yet, or hasn't configured it.
 */
export function resolveModelForTier<
  T extends { provider: string; model: string },
>(
  tier: "everyday" | "powerful",
  everydayModelKey: string | null,
  powerfulModelKey: string | null,
  chatModels: T[],
): T | undefined {
  const key = tier === "everyday" ? everydayModelKey : powerfulModelKey;
  const recommended = findRecommendedModel(key);
  if (!recommended) {
    return undefined;
  }
  return findConfiguredMatch(chatModels, recommended);
}
