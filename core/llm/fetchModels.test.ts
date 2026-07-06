import { testProviderConnection } from "./fetchModels";

describe("testProviderConnection", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("resolves for Anthropic when the API key is valid", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: [] }),
    });

    await expect(
      testProviderConnection("anthropic", "sk-ant-good"),
    ).resolves.toBeUndefined();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.anthropic.com"),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": "sk-ant-good" }),
      }),
    );
  });

  it("throws for Anthropic when the API key is invalid", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(
      testProviderConnection("anthropic", "sk-ant-bad"),
    ).rejects.toThrow(/401/);
  });

  it("resolves for Gemini when the API key is valid", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ models: [] }),
    });

    await expect(
      testProviderConnection("gemini", "good-key"),
    ).resolves.toBeUndefined();
  });

  it("throws for Gemini when the API key is invalid", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
    });

    await expect(testProviderConnection("gemini", "bad-key")).rejects.toThrow(
      /403/,
    );
  });

  it("throws a descriptive error for the default (OpenAI-compatible) path on failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({}),
      text: jest.fn().mockResolvedValue("Unauthorized"),
    });

    await expect(testProviderConnection("openai", "sk-bad")).rejects.toThrow();
  });
});
