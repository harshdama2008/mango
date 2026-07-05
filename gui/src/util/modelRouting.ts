export type ModelTier = "everyday" | "powerful";

export const SIMPLE_MESSAGE_CHAR_LIMIT = 200;

export interface RoutingInput {
  /** The session mode at the time of sending */
  mode: "chat" | "agent" | "plan" | "background";
  /** Plain-text length of the draft message (not counting attached context) */
  messageLength: number;
  /** Number of distinct files attached as context to the draft message */
  attachedFileCount: number;
}

export interface RoutingDecision {
  tier: ModelTier;
  /** Human-readable explanation, shown in the indicator's tooltip */
  reason: string;
}

/**
 * Deterministic routing rules (no LLM classification involved):
 *   1. Agent (and plan/background) mode always uses the Powerful Model.
 *   2. A multi-file edit (2+ files attached as context) always uses the
 *      Powerful Model, even in plain chat mode.
 *   3. Chat messages over 200 characters use the Powerful Model.
 *   4. Everything else (short chat messages) uses the Everyday Model.
 *
 * Note: inline autocomplete doesn't go through this function at all - it
 * always uses whatever is configured for the "autocomplete" role, which is
 * exactly what the Everyday Model picker sets (see ModelTierRow).
 */
export function computeAutoRoutedTier(input: RoutingInput): RoutingDecision {
  if (input.mode !== "chat") {
    return {
      tier: "powerful",
      reason:
        input.mode === "agent"
          ? "Agent mode always uses the Powerful Model"
          : "This mode always uses the Powerful Model",
    };
  }

  if (input.attachedFileCount >= 2) {
    return {
      tier: "powerful",
      reason: `Multi-file edits always use the Powerful Model (${input.attachedFileCount} files attached)`,
    };
  }

  if (input.messageLength > SIMPLE_MESSAGE_CHAR_LIMIT) {
    return {
      tier: "powerful",
      reason: `Messages over ${SIMPLE_MESSAGE_CHAR_LIMIT} characters use the Powerful Model`,
    };
  }

  return {
    tier: "everyday",
    reason: `Messages under ${SIMPLE_MESSAGE_CHAR_LIMIT} characters use the Everyday Model`,
  };
}
