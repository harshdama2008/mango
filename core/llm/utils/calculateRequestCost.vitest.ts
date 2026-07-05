import { describe, expect, it } from "vitest";

import type { Usage } from "../..";

import { calculateRequestCost } from "./calculateRequestCost";

interface TestCase {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  expectedCost: number | null;
  description?: string;
}

describe("calculateRequestCost", () => {
  const testCases: TestCase[] = [
    // Claude Sonnet: $3 input, $15 output
    {
      provider: "anthropic",
      model: "claude-sonnet-4-6-20250514",
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      expectedCost: 18,
      description: "Claude Sonnet full pricing",
    },
    {
      provider: "anthropic",
      model: "Claude Sonnet",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0105,
      description: "Claude Sonnet basic usage",
    },

    // Claude Haiku: $0.25 input, $1.25 output
    {
      provider: "anthropic",
      model: "claude-3-5-haiku-20241022",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.000875,
      description: "Claude Haiku basic usage",
    },

    // GPT-4o: $5 input, $15 output
    {
      provider: "openai",
      model: "gpt-4o",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0125,
      description: "GPT-4o basic usage",
    },

    // GPT-4o mini: $0.15 input, $0.60 output
    {
      provider: "openai",
      model: "gpt-4o-mini",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.00045,
      description: "GPT-4o mini basic usage",
    },

    // Gemini 1.5 Pro: $3.50 input, $10.50 output
    {
      provider: "gemini",
      model: "gemini-1.5-pro",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.00875,
      description: "Gemini 1.5 Pro basic usage",
    },

    // Gemini 1.5 Flash: $0.075 input, $0.30 output
    {
      provider: "gemini",
      model: "gemini-1.5-flash",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.000225,
      description: "Gemini 1.5 Flash basic usage",
    },

    // DeepSeek Coder: $0.14 input, $0.28 output
    {
      provider: "deepseek",
      model: "deepseek-coder",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.00028,
      description: "DeepSeek Coder basic usage",
    },

    // Edge cases
    {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      promptTokens: 0,
      completionTokens: 0,
      expectedCost: 0,
      description: "Zero tokens",
    },
    {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      promptTokens: 1000,
      completionTokens: 0,
      expectedCost: 0.003,
      description: "Only input tokens",
    },
    {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      promptTokens: 0,
      completionTokens: 500,
      expectedCost: 0.0075,
      description: "Only output tokens",
    },

    // Case insensitivity
    {
      provider: "ANTHROPIC",
      model: "Claude Sonnet 4.6",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: 0.0105,
      description: "Provider and model name case insensitive",
    },

    // Models/providers not in the hardcoded table should skip cost entirely
    {
      provider: "anthropic",
      model: "claude-3-opus-20240229",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: null,
      description: "Claude Opus is not in the hardcoded table",
    },
    {
      provider: "openai",
      model: "gpt-4-turbo",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: null,
      description: "GPT-4 Turbo is not in the hardcoded table",
    },
    {
      provider: "openai",
      model: "gpt-3.5-turbo",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: null,
      description: "GPT-3.5 is not in the hardcoded table",
    },
    {
      provider: "gemini",
      model: "gemini-2.0-flash",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: null,
      description: "Gemini 2.0 is not in the hardcoded table",
    },
    {
      provider: "deepseek",
      model: "deepseek-chat",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: null,
      description: "DeepSeek Chat (non-Coder) is not in the hardcoded table",
    },
    {
      provider: "ollama",
      model: "llama3.1:8b",
      promptTokens: 1000,
      completionTokens: 500,
      expectedCost: null,
      description: "Unsupported provider",
    },
  ];

  testCases.forEach(
    ({
      provider,
      model,
      promptTokens,
      completionTokens,
      expectedCost,
      description,
    }) => {
      it(description || `${provider}/${model}`, () => {
        const usage: Usage = { promptTokens, completionTokens };

        const result = calculateRequestCost(provider, model, usage);

        if (expectedCost === null) {
          expect(result).toBeNull();
        } else {
          expect(result).not.toBeNull();
          expect(result!.cost).toBeCloseTo(expectedCost, 6);
        }
      });
    },
  );
});
