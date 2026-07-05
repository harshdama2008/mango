import {
  EVERYDAY_MODEL_OPTIONS,
  findConfiguredMatch,
  findRecommendedModel,
  matchesRecommendedModel,
  POWERFUL_MODEL_OPTIONS,
  resolveModelForTier,
} from "./recommendedModels";

describe("recommendedModels", () => {
  it("findRecommendedModel looks up by key across both lists", () => {
    expect(findRecommendedModel("claude-haiku")?.displayName).toBe(
      "Claude Haiku",
    );
    expect(findRecommendedModel("gpt-4o")?.displayName).toBe("GPT-4o");
    expect(findRecommendedModel("nonexistent")).toBeUndefined();
    expect(findRecommendedModel(null)).toBeUndefined();
  });

  describe("matchesRecommendedModel", () => {
    const sonnet = POWERFUL_MODEL_OPTIONS.find(
      (m) => m.key === "claude-sonnet",
    )!;
    const gpt4o = POWERFUL_MODEL_OPTIONS.find((m) => m.key === "gpt-4o")!;
    const gpt4oMini = EVERYDAY_MODEL_OPTIONS.find(
      (m) => m.key === "gpt-4o-mini",
    )!;
    const geminiPro = POWERFUL_MODEL_OPTIONS.find(
      (m) => m.key === "gemini-1.5-pro",
    )!;
    const geminiFlash = EVERYDAY_MODEL_OPTIONS.find(
      (m) => m.key === "gemini-1.5-flash",
    )!;

    it("matches a configured model in the same family", () => {
      expect(
        matchesRecommendedModel(
          { provider: "anthropic", model: "claude-sonnet-4-6-20250514" },
          sonnet,
        ),
      ).toBe(true);
    });

    it("does not match a different provider even with the same model keyword", () => {
      expect(
        matchesRecommendedModel(
          { provider: "openrouter", model: "claude-sonnet-4-6" },
          sonnet,
        ),
      ).toBe(false);
    });

    it("distinguishes GPT-4o from GPT-4o mini", () => {
      expect(
        matchesRecommendedModel({ provider: "openai", model: "gpt-4o" }, gpt4o),
      ).toBe(true);
      expect(
        matchesRecommendedModel(
          { provider: "openai", model: "gpt-4o-mini" },
          gpt4o,
        ),
      ).toBe(false);
      expect(
        matchesRecommendedModel(
          { provider: "openai", model: "gpt-4o-mini" },
          gpt4oMini,
        ),
      ).toBe(true);
    });

    it("distinguishes Gemini 1.5 Pro from Gemini 1.5 Flash", () => {
      expect(
        matchesRecommendedModel(
          { provider: "gemini", model: "gemini-1.5-pro" },
          geminiPro,
        ),
      ).toBe(true);
      expect(
        matchesRecommendedModel(
          { provider: "gemini", model: "gemini-1.5-flash" },
          geminiPro,
        ),
      ).toBe(false);
      expect(
        matchesRecommendedModel(
          { provider: "gemini", model: "gemini-1.5-flash" },
          geminiFlash,
        ),
      ).toBe(true);
    });

    it("does not match a newer Gemini generation against the 1.5 recommendation", () => {
      expect(
        matchesRecommendedModel(
          { provider: "gemini", model: "gemini-2.5-pro" },
          geminiPro,
        ),
      ).toBe(false);
    });
  });

  describe("findConfiguredMatch", () => {
    it("returns the first configured model matching the recommendation", () => {
      const sonnet = POWERFUL_MODEL_OPTIONS.find(
        (m) => m.key === "claude-sonnet",
      )!;
      const models = [
        { title: "My GPT", provider: "openai", model: "gpt-4o" },
        {
          title: "My Sonnet",
          provider: "anthropic",
          model: "claude-sonnet-4-6",
        },
      ];

      const match = findConfiguredMatch(models, sonnet);
      expect(match?.title).toBe("My Sonnet");
    });

    it("returns undefined when nothing matches", () => {
      const sonnet = POWERFUL_MODEL_OPTIONS.find(
        (m) => m.key === "claude-sonnet",
      )!;
      const models = [{ title: "My GPT", provider: "openai", model: "gpt-4o" }];

      expect(findConfiguredMatch(models, sonnet)).toBeUndefined();
    });
  });

  describe("resolveModelForTier", () => {
    const chatModels = [
      { title: "My Haiku", provider: "anthropic", model: "claude-haiku-4-5" },
      {
        title: "My Sonnet",
        provider: "anthropic",
        model: "claude-sonnet-4-6",
      },
    ];

    it("resolves the everyday tier using the saved everyday key", () => {
      const match = resolveModelForTier(
        "everyday",
        "claude-haiku",
        "claude-sonnet",
        chatModels,
      );
      expect(match?.title).toBe("My Haiku");
    });

    it("resolves the powerful tier using the saved powerful key", () => {
      const match = resolveModelForTier(
        "powerful",
        "claude-haiku",
        "claude-sonnet",
        chatModels,
      );
      expect(match?.title).toBe("My Sonnet");
    });

    it("returns undefined when no preference has been saved for that tier", () => {
      expect(
        resolveModelForTier("everyday", null, "claude-sonnet", chatModels),
      ).toBeUndefined();
    });

    it("returns undefined when the preferred model isn't configured", () => {
      expect(
        resolveModelForTier("everyday", "gemini-1.5-flash", null, chatModels),
      ).toBeUndefined();
    });
  });
});
