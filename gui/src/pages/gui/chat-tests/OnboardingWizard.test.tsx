import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ONBOARDING_PROVIDERS } from "../../../components/onboarding/onboardingProviders";
import {
  setProfiles,
  setSelectedProfile,
} from "../../../redux/slices/profilesSlice";
import { getModelOptionsForProvider } from "../../../util/recommendedModels";
import { addAndSelectChatModel } from "../../../util/test/config";
import { renderWithProviders } from "../../../util/test/render";
import { getElementByTestId } from "../../../util/test/utils";
import { Chat } from "../Chat";

beforeEach(() => {
  localStorage.clear();
});

async function goToStep2(providerId: string) {
  const button = await getElementByTestId(`onboarding-provider-${providerId}`);
  await act(async () => {
    button.click();
  });
}

async function goToStep3(providerId: string, ideMessenger: any) {
  await goToStep2(providerId);
  if (providerId === "ollama") {
    ideMessenger.responses["llm/listModels"] = ["llama3.1:8b"];
  } else {
    const apiKeyInput = await getElementByTestId("onboarding-api-key-input");
    await act(async () => {
      fireEvent.change(apiKeyInput, { target: { value: "sk-test-key" } });
    });
  }
  const continueButton = await getElementByTestId(
    "onboarding-connect-continue",
  );
  await act(async () => {
    continueButton.click();
  });
}

describe("First-run onboarding wizard", () => {
  it("shows automatically on first run, starting at step 1", async () => {
    await renderWithProviders(<Chat />);

    await getElementByTestId("onboarding-wizard");
    for (const provider of ONBOARDING_PROVIDERS) {
      await getElementByTestId(`onboarding-provider-${provider.id}`);
    }
  });

  it("has only one way to dismiss the wizard - the labeled 'Skip for now' link, not a redundant icon-only close button", async () => {
    await renderWithProviders(<Chat />);
    const wizard = await getElementByTestId("onboarding-wizard");

    expect(screen.getByTestId("onboarding-skip")).toBeInTheDocument();
    const iconOnlyButtons = Array.from(
      wizard.querySelectorAll("button"),
    ).filter((btn) => btn.textContent?.trim() === "");
    expect(iconOnlyButtons).toHaveLength(0);
  });

  describe("(1) each provider button shows the right step 2", () => {
    for (const provider of ONBOARDING_PROVIDERS) {
      it(`${provider.id} -> "Connect to ${provider.displayName}"`, async () => {
        await renderWithProviders(<Chat />);
        await goToStep2(provider.id);

        expect(
          screen.getByText(`Connect to ${provider.displayName}`),
        ).toBeInTheDocument();

        const apiKeyInput = screen.queryByTestId("onboarding-api-key-input");
        if (provider.isLocal) {
          expect(apiKeyInput).not.toBeInTheDocument();
        } else {
          expect(apiKeyInput).toBeInTheDocument();
        }

        const testButton = await getElementByTestId(
          "onboarding-test-connection",
        );
        expect(testButton.textContent).toBe(
          provider.isLocal ? "Test local connection" : "Test connection",
        );
      });
    }
  });

  describe("(2) API key test connection actually validates the key", () => {
    it("shows success for a valid key", async () => {
      const { ideMessenger } = await renderWithProviders(<Chat />);
      ideMessenger.responseHandlers["llm/testConnection"] = async () => ({
        success: true,
        message: "Connection successful",
      });

      await goToStep2("anthropic");
      const apiKeyInput = await getElementByTestId("onboarding-api-key-input");
      await act(async () => {
        fireEvent.change(apiKeyInput, { target: { value: "sk-good-key" } });
      });
      const testButton = await getElementByTestId("onboarding-test-connection");
      await act(async () => {
        testButton.click();
      });

      const success = await getElementByTestId("onboarding-test-success");
      expect(success.textContent).toContain("Connection successful");
      expect(
        screen.queryByTestId("onboarding-test-error"),
      ).not.toBeInTheDocument();
    });

    it("shows an error for an invalid key, without blocking the user from continuing", async () => {
      const { ideMessenger } = await renderWithProviders(<Chat />);
      ideMessenger.responseHandlers["llm/testConnection"] = async () => ({
        success: false,
        message: "HTTP 401 Unauthorized",
      });

      await goToStep2("anthropic");
      const apiKeyInput = await getElementByTestId("onboarding-api-key-input");
      await act(async () => {
        fireEvent.change(apiKeyInput, { target: { value: "sk-bad-key" } });
      });
      const testButton = await getElementByTestId("onboarding-test-connection");
      await act(async () => {
        testButton.click();
      });

      const error = await getElementByTestId("onboarding-test-error");
      expect(error.textContent).toContain("HTTP 401 Unauthorized");
      expect(
        screen.queryByTestId("onboarding-test-success"),
      ).not.toBeInTheDocument();

      // A failed test is informational, not a hard gate - the user can still
      // proceed (e.g. if they believe the key is fine and want to move on).
      const continueButton = await getElementByTestId(
        "onboarding-connect-continue",
      );
      expect(continueButton).not.toBeDisabled();
    });

    it("shows an error instead of getting stuck on 'Testing…' when the request itself fails", async () => {
      // Regression: the cloud-provider test path had no try/catch (unlike
      // the Ollama path below), so a rejected request left the button
      // disabled on "Testing…" forever with no feedback.
      const { ideMessenger } = await renderWithProviders(<Chat />);
      ideMessenger.responseHandlers["llm/testConnection"] = async () => {
        throw new Error("core did not respond");
      };

      await goToStep2("anthropic");
      const apiKeyInput = await getElementByTestId("onboarding-api-key-input");
      await act(async () => {
        fireEvent.change(apiKeyInput, { target: { value: "sk-test-key" } });
      });
      const testButton = await getElementByTestId("onboarding-test-connection");
      await act(async () => {
        testButton.click();
      });

      const error = await getElementByTestId("onboarding-test-error");
      expect(error.textContent).toContain("Connection test failed");
      expect(testButton).not.toBeDisabled();
      expect(testButton.textContent).not.toMatch(/Testing/);
    });

    it("disables Continue while a test is in flight, so advancing can't unmount ConnectStep before the response arrives", async () => {
      const { ideMessenger } = await renderWithProviders(<Chat />);
      let resolveTest: (result: {
        success: boolean;
        message: string;
      }) => void = () => {};
      ideMessenger.responseHandlers["llm/testConnection"] = () =>
        new Promise((resolve) => {
          resolveTest = resolve;
        });

      await goToStep2("anthropic");
      const apiKeyInput = await getElementByTestId("onboarding-api-key-input");
      await act(async () => {
        fireEvent.change(apiKeyInput, { target: { value: "sk-test-key" } });
      });
      const testButton = await getElementByTestId("onboarding-test-connection");
      const continueButton = await getElementByTestId(
        "onboarding-connect-continue",
      );
      expect(continueButton).not.toBeDisabled();

      await act(async () => {
        testButton.click();
      });
      expect(continueButton).toBeDisabled();

      await act(async () => {
        resolveTest({ success: true, message: "Connection successful" });
      });
      expect(continueButton).not.toBeDisabled();
    });
  });

  describe("(3) Ollama connection test", () => {
    it("shows success when Ollama is running locally", async () => {
      const { ideMessenger } = await renderWithProviders(<Chat />);
      ideMessenger.responses["llm/listModels"] = ["llama3.1:8b"];

      await goToStep2("ollama");
      expect(
        screen.queryByTestId("onboarding-api-key-input"),
      ).not.toBeInTheDocument();

      const testButton = await getElementByTestId("onboarding-test-connection");
      expect(testButton.textContent).toBe("Test local connection");
      await act(async () => {
        testButton.click();
      });

      const success = await getElementByTestId("onboarding-test-success");
      expect(success.textContent).toContain("http://localhost:11434");

      const continueButton = await getElementByTestId(
        "onboarding-connect-continue",
      );
      expect(continueButton).not.toBeDisabled();
    });

    it("shows an error when Ollama is not reachable", async () => {
      const { ideMessenger } = await renderWithProviders(<Chat />);
      ideMessenger.responseHandlers["llm/listModels"] = async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:11434");
      };

      await goToStep2("ollama");
      const testButton = await getElementByTestId("onboarding-test-connection");
      await act(async () => {
        testButton.click();
      });

      const error = await getElementByTestId("onboarding-test-error");
      expect(error.textContent).toContain("localhost:11434");
      expect(
        screen.queryByTestId("onboarding-test-success"),
      ).not.toBeInTheDocument();
    });
  });

  describe("(4) model dropdowns show the right options for the chosen provider", () => {
    for (const provider of ONBOARDING_PROVIDERS) {
      it(`shows ${provider.id}'s recommended everyday + powerful models`, async () => {
        const { ideMessenger } = await renderWithProviders(<Chat />);
        await goToStep3(provider.id, ideMessenger);

        const everydaySelect = (await getElementByTestId(
          "onboarding-everyday-select",
        )) as HTMLSelectElement;
        const powerfulSelect = (await getElementByTestId(
          "onboarding-powerful-select",
        )) as HTMLSelectElement;

        const { everyday, powerful } = getModelOptionsForProvider(provider.id);

        const everydayOptionLabels = Array.from(
          everydaySelect.querySelectorAll("option"),
        )
          .map((o) => o.textContent)
          .filter((text) => text !== "Select a model...");
        const powerfulOptionLabels = Array.from(
          powerfulSelect.querySelectorAll("option"),
        )
          .map((o) => o.textContent)
          .filter((text) => text !== "Select a model...");

        expect(everydayOptionLabels).toEqual(
          everyday.map((m) => m.displayName),
        );
        expect(powerfulOptionLabels).toEqual(
          powerful.map((m) => m.displayName),
        );
      });
    }
  });

  describe("single-option dropdowns are preselected (regression)", () => {
    for (const provider of ONBOARDING_PROVIDERS) {
      it(`preselects ${provider.id}'s sole everyday + powerful model, so "Start coding" doesn't require a pointless manual pick`, async () => {
        const { ideMessenger } = await renderWithProviders(<Chat />);
        await goToStep3(provider.id, ideMessenger);

        const { everyday, powerful } = getModelOptionsForProvider(provider.id);

        const everydaySelect = (await getElementByTestId(
          "onboarding-everyday-select",
        )) as HTMLSelectElement;
        const powerfulSelect = (await getElementByTestId(
          "onboarding-powerful-select",
        )) as HTMLSelectElement;

        expect(everydaySelect.value).toBe(everyday[0].key);
        expect(powerfulSelect.value).toBe(powerful[0].key);

        const startButton = await getElementByTestId("onboarding-start-coding");
        expect(startButton).not.toBeDisabled();
      });
    }
  });

  describe("provider switching resets stale state (regression)", () => {
    it("clears the API key and model selections when the user goes back and picks a different provider", async () => {
      const { ideMessenger, store } = await renderWithProviders(<Chat />);
      ideMessenger.responses["config/addModel"] = undefined;
      ideMessenger.responses["config/updateSelectedModel"] = undefined;
      const requestSpy = vi.spyOn(ideMessenger, "request");
      store.dispatch(
        setProfiles([
          {
            title: "Main Config",
            id: "local",
            errors: [],
            uri: "",
            iconUrl: "",
          },
        ]),
      );
      store.dispatch(setSelectedProfile("local"));

      // Pick Anthropic, fill in a key, and select both tiers.
      await goToStep3("anthropic", ideMessenger);
      const everydaySelect = await getElementByTestId(
        "onboarding-everyday-select",
      );
      const powerfulSelect = await getElementByTestId(
        "onboarding-powerful-select",
      );
      await act(async () => {
        fireEvent.change(everydaySelect, { target: { value: "claude-haiku" } });
        fireEvent.change(powerfulSelect, {
          target: { value: "claude-sonnet" },
        });
      });

      // Go back to step 1 and pick a different provider.
      await act(async () => {
        screen.getByText("Back").click();
      });
      await act(async () => {
        screen.getByText("Back").click();
      });
      await goToStep3("openai", ideMessenger);

      // The dropdowns should not carry over Anthropic's selections - OpenAI's
      // own (sole) options get preselected instead, not the stale Anthropic
      // ones, and "Start coding" is enabled since both tiers already have a
      // selection.
      const startButton = await getElementByTestId("onboarding-start-coding");
      expect(startButton).not.toBeDisabled();
      expect(
        (
          (await getElementByTestId(
            "onboarding-everyday-select",
          )) as HTMLSelectElement
        ).value,
      ).toBe("gpt-4o-mini");
      expect(
        (
          (await getElementByTestId(
            "onboarding-powerful-select",
          )) as HTMLSelectElement
        ).value,
      ).toBe("gpt-4o");

      // Completing onboarding for OpenAI should only ever add OpenAI models,
      // never the abandoned Anthropic selection or its API key.
      await act(async () => {
        startButton.click();
      });

      // Completion waits for the chat model it just configured to actually
      // land in redux before closing - simulate core's async "configUpdate"
      // push (see the onboarding-completion-race fix) so it can proceed.
      await act(async () => {
        addAndSelectChatModel(store, ideMessenger, {
          title: "GPT-4o mini",
          provider: "openai",
          model: "gpt-4o-mini",
          underlyingProviderName: "openai",
        });
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId("onboarding-wizard"),
        ).not.toBeInTheDocument();
      });

      const addModelCalls = requestSpy.mock.calls.filter(
        ([type]) => type === "config/addModel",
      );
      expect(addModelCalls).toHaveLength(2);
      for (const call of addModelCalls) {
        expect((call[1] as any).model.provider).toBe("openai");
      }
    });
  });

  describe("(5) chat is immediately ready to use after finishing", () => {
    it("adds both models, selects the everyday model as the active chat model, and saves tier keys", async () => {
      const { ideMessenger, store } = await renderWithProviders(<Chat />);
      // A real first-time user already has a resolved "local" profile by the
      // time they reach step 3 (see ParallelListeners' initial config load).
      // MockIdeMessenger's default config/getSerializedProfileInfo response
      // sets profileId "local" but leaves `profiles` empty, so
      // selectSelectedProfile resolves to null unless we give it a matching
      // profile entry explicitly, same as ModelRouting.test.tsx does.
      await act(async () => {
        store.dispatch(
          setProfiles([
            {
              title: "Main Config",
              id: "local",
              errors: [],
              uri: "",
              iconUrl: "",
            },
          ]),
        );
        store.dispatch(setSelectedProfile("local"));
      });

      ideMessenger.responses["config/addModel"] = undefined;
      ideMessenger.responses["config/updateSelectedModel"] = undefined;
      const requestSpy = vi.spyOn(ideMessenger, "request");

      await goToStep3("anthropic", ideMessenger);

      const everydaySelect = await getElementByTestId(
        "onboarding-everyday-select",
      );
      const powerfulSelect = await getElementByTestId(
        "onboarding-powerful-select",
      );
      await act(async () => {
        fireEvent.change(everydaySelect, { target: { value: "claude-haiku" } });
        fireEvent.change(powerfulSelect, {
          target: { value: "claude-sonnet" },
        });
      });

      const startButton = await getElementByTestId("onboarding-start-coding");
      await act(async () => {
        startButton.click();
      });

      // Completion waits for the chat model it just configured to actually
      // land in redux before closing - simulate core's async "configUpdate"
      // push (see the onboarding-completion-race fix) so the wizard proceeds.
      await act(async () => {
        addAndSelectChatModel(store, ideMessenger, {
          title: "Claude Haiku",
          provider: "anthropic",
          model: "claude-haiku-4-5-20251001",
          underlyingProviderName: "anthropic",
        });
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId("onboarding-wizard"),
        ).not.toBeInTheDocument();
      });

      const addModelCalls = requestSpy.mock.calls.filter(
        ([type]) => type === "config/addModel",
      );
      expect(addModelCalls).toHaveLength(2);
      expect(addModelCalls[0][1]).toMatchObject({
        model: { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
      });
      expect(addModelCalls[1][1]).toMatchObject({
        model: { provider: "anthropic", model: "claude-sonnet-4-6" },
      });

      // The everyday model becomes the initial active chat model so the very
      // first send doesn't hit "No chat model selected" - automatic routing
      // takes over from there based on message content.
      const selectModelCalls = requestSpy.mock.calls.filter(
        ([type]) => type === "config/updateSelectedModel",
      );
      expect(selectModelCalls).toHaveLength(1);
      expect(selectModelCalls[0][1]).toMatchObject({
        profileId: "local",
        role: "chat",
        title: "Claude Haiku",
      });

      expect(store.getState().ui.everydayModelKey).toBe("claude-haiku");
      expect(store.getState().ui.powerfulModelKey).toBe("claude-sonnet");
      expect(localStorage.getItem("onboardingStatus")).toBe('"Completed"');
    });
  });

  describe("completion race (regression): the wizard never closes into a config-not-ready state", () => {
    it("stays open, with 'Start coding' disabled, until the configured chat model actually lands in redux", async () => {
      const { ideMessenger, store } = await renderWithProviders(<Chat />);
      ideMessenger.responses["config/addModel"] = undefined;
      ideMessenger.responses["config/updateSelectedModel"] = undefined;
      store.dispatch(
        setProfiles([
          {
            title: "Main Config",
            id: "local",
            errors: [],
            uri: "",
            iconUrl: "",
          },
        ]),
      );
      store.dispatch(setSelectedProfile("local"));

      await goToStep3("anthropic", ideMessenger);
      const everydaySelect = await getElementByTestId(
        "onboarding-everyday-select",
      );
      const powerfulSelect = await getElementByTestId(
        "onboarding-powerful-select",
      );
      await act(async () => {
        fireEvent.change(everydaySelect, { target: { value: "claude-haiku" } });
        fireEvent.change(powerfulSelect, {
          target: { value: "claude-sonnet" },
        });
      });

      const startButton = await getElementByTestId("onboarding-start-coding");
      await act(async () => {
        startButton.click();
      });

      // Core hasn't pushed the configUpdate yet - the wizard must stay open
      // and the button must show it's still working, not silently re-enable
      // and let the user type into a chat with no model selected.
      expect(screen.getByTestId("onboarding-wizard")).toBeInTheDocument();
      expect(screen.getByText("Starting...")).toBeInTheDocument();
      expect(
        await getElementByTestId("onboarding-start-coding"),
      ).toBeDisabled();

      // Now simulate core's async config push landing.
      await act(async () => {
        addAndSelectChatModel(store, ideMessenger, {
          title: "Claude Haiku",
          provider: "anthropic",
          model: "claude-haiku-4-5-20251001",
          underlyingProviderName: "anthropic",
        });
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId("onboarding-wizard"),
        ).not.toBeInTheDocument();
      });
      expect(
        store.getState().config.config.selectedModelByRole.chat?.title,
      ).toBe("Claude Haiku");
    });
  });

  describe("(6) relaunching after completing onboarding skips it", () => {
    it("does not show the wizard on a fresh render once onboarding is marked Completed", async () => {
      localStorage.setItem("onboardingStatus", JSON.stringify("Completed"));

      await renderWithProviders(<Chat />);

      expect(screen.queryByTestId("onboarding-wizard")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("complete-setup-banner"),
      ).not.toBeInTheDocument();
    });
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

    const banner = await getElementByTestId("complete-setup-banner");
    // The banner must say what's actually missing (no model configured, chat
    // won't work) rather than reading like an optional nice-to-have.
    expect(banner.textContent).toContain("No model is configured");
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
