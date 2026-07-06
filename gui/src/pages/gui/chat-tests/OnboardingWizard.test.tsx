import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../util/test/render";
import { getElementByTestId } from "../../../util/test/utils";
import { Chat } from "../Chat";

beforeEach(() => {
  localStorage.clear();
});

describe("First-run onboarding wizard", () => {
  it("shows automatically on first run, starting at step 1", async () => {
    await renderWithProviders(<Chat />);

    await getElementByTestId("onboarding-wizard");
    await getElementByTestId("onboarding-provider-anthropic");
    await getElementByTestId("onboarding-provider-openai");
    await getElementByTestId("onboarding-provider-gemini");
    await getElementByTestId("onboarding-provider-openrouter");
    await getElementByTestId("onboarding-provider-ollama");
  });

  it("walks through choose provider -> connect -> pick models -> start coding for a cloud provider", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    const postSpy = vi.spyOn(ideMessenger, "post");

    const anthropicButton = await getElementByTestId(
      "onboarding-provider-anthropic",
    );
    await act(async () => {
      anthropicButton.click();
    });

    const apiKeyInput = await getElementByTestId("onboarding-api-key-input");
    await act(async () => {
      fireEvent.change(apiKeyInput, { target: { value: "sk-test-key" } });
    });

    const testButton = await getElementByTestId("onboarding-test-connection");
    await act(async () => {
      testButton.click();
    });

    await waitFor(async () => {
      expect(
        await getElementByTestId("onboarding-test-success"),
      ).toBeInTheDocument();
    });

    const continueButton = await getElementByTestId(
      "onboarding-connect-continue",
    );
    await act(async () => {
      continueButton.click();
    });

    const everydaySelect = await getElementByTestId(
      "onboarding-everyday-select",
    );
    const powerfulSelect = await getElementByTestId(
      "onboarding-powerful-select",
    );
    await act(async () => {
      fireEvent.change(everydaySelect, { target: { value: "claude-haiku" } });
      fireEvent.change(powerfulSelect, { target: { value: "claude-sonnet" } });
    });

    const startButton = await getElementByTestId("onboarding-start-coding");
    await act(async () => {
      startButton.click();
    });

    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-wizard")).not.toBeInTheDocument();
    });

    expect(localStorage.getItem("onboardingStatus")).toBe('"Completed"');
    expect(store.getState().ui.everydayModelKey).toBe("claude-haiku");
    expect(store.getState().ui.powerfulModelKey).toBe("claude-sonnet");

    const addModelCalls = postSpy.mock.calls.filter(
      ([type]) => type === "config/addModel",
    );
    expect(addModelCalls).toHaveLength(2);
    expect(addModelCalls[0][1]).toMatchObject({
      model: {
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        apiKey: "sk-test-key",
      },
    });
    expect(addModelCalls[1][1]).toMatchObject({
      model: {
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        apiKey: "sk-test-key",
      },
    });
  });

  it("shows 'Test local connection' for Ollama and does not require an API key", async () => {
    const { ideMessenger } = await renderWithProviders(<Chat />);
    ideMessenger.responses["llm/listModels"] = ["llama3.1:8b"];

    const ollamaButton = await getElementByTestId("onboarding-provider-ollama");
    await act(async () => {
      ollamaButton.click();
    });

    expect(
      screen.queryByTestId("onboarding-api-key-input"),
    ).not.toBeInTheDocument();

    const testButton = await getElementByTestId("onboarding-test-connection");
    expect(testButton.textContent).toBe("Test local connection");
    await act(async () => {
      testButton.click();
    });

    await waitFor(async () => {
      expect(
        await getElementByTestId("onboarding-test-success"),
      ).toBeInTheDocument();
    });

    // Continue should already be enabled without an API key.
    const continueButton = await getElementByTestId(
      "onboarding-connect-continue",
    );
    expect(continueButton).not.toBeDisabled();
  });

  it("hides the wizard when skipped, and shows a banner offering to complete setup", async () => {
    await renderWithProviders(<Chat />);

    const skipLink = await getElementByTestId("onboarding-skip");
    await act(async () => {
      skipLink.click();
    });

    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-wizard")).not.toBeInTheDocument();
    });

    await getElementByTestId("complete-setup-banner");
    expect(localStorage.getItem("onboardingStatus")).not.toBe('"Completed"');
  });

  it("reopens the wizard when the complete-setup banner button is clicked", async () => {
    await renderWithProviders(<Chat />);

    const skipLink = await getElementByTestId("onboarding-skip");
    await act(async () => {
      skipLink.click();
    });

    const bannerButton = await getElementByTestId(
      "complete-setup-banner-button",
    );
    await act(async () => {
      bannerButton.click();
    });

    await getElementByTestId("onboarding-wizard");
    expect(
      screen.queryByTestId("complete-setup-banner"),
    ).not.toBeInTheDocument();
  });
});
