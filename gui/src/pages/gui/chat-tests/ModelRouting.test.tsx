import { act, screen, waitFor } from "@testing-library/react";
import { setMode } from "../../../redux/slices/sessionSlice";
import {
  setEverydayModelKey,
  setPowerfulModelKey,
} from "../../../redux/slices/uiSlice";
import { setProfiles } from "../../../redux/slices/profilesSlice";
import { addAndSelectChatModel } from "../../../util/test/config";
import { renderWithProviders } from "../../../util/test/render";
import {
  getElementByTestId,
  getElementByText,
  getMainEditor,
  sendInputWithMockedResponse,
} from "../../../util/test/utils";
import { Chat } from "../Chat";

const EVERYDAY_MODEL = {
  model: "claude-haiku-4-5-20251001",
  provider: "anthropic",
  title: "My Everyday Haiku",
  underlyingProviderName: "anthropic",
};

const POWERFUL_MODEL = {
  model: "claude-sonnet-4-6",
  provider: "anthropic",
  title: "My Powerful Sonnet",
  underlyingProviderName: "anthropic",
};

async function setupTierModels(store: any, ideMessenger: any) {
  await act(async () => {
    // MockIdeMessenger's default profile response sets selectedProfileId
    // to "local" but leaves `profiles` empty, so selectSelectedProfile
    // resolves to null. updateSelectedModelByRole requires a real
    // selectedProfile, so give it one matching "local".
    store.dispatch(
      setProfiles([
        { title: "Main Config", id: "local", errors: [], uri: "", iconUrl: "" },
      ]),
    );
    addAndSelectChatModel(store, ideMessenger, EVERYDAY_MODEL);
    addAndSelectChatModel(store, ideMessenger, POWERFUL_MODEL);
    store.dispatch(setEverydayModelKey("claude-haiku"));
    store.dispatch(setPowerfulModelKey("claude-sonnet"));
    // The session defaults to "agent" mode - most of these tests are
    // specifically about plain chat-mode routing, so start from "chat"
    // unless a test explicitly switches modes itself.
    store.dispatch(setMode("chat"));
  });
}

describe("Everyday/Powerful automatic model routing", () => {
  it("routes a short chat message to the Everyday Model", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    await setupTierModels(store, ideMessenger);

    await sendInputWithMockedResponse(ideMessenger, "hi there", [
      { role: "assistant", content: "hello" },
    ]);

    expect(store.getState().config.config.selectedModelByRole.chat?.title).toBe(
      EVERYDAY_MODEL.title,
    );
  });

  it("routes a long chat message (>200 chars) to the Powerful Model", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    await setupTierModels(store, ideMessenger);

    const longMessage = "x".repeat(201);

    await sendInputWithMockedResponse(ideMessenger, longMessage, [
      { role: "assistant", content: "hello" },
    ]);

    expect(store.getState().config.config.selectedModelByRole.chat?.title).toBe(
      POWERFUL_MODEL.title,
    );
  });

  it("routes agent mode to the Powerful Model regardless of message length", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    await setupTierModels(store, ideMessenger);

    await act(async () => {
      store.dispatch(setMode("agent"));
    });

    await sendInputWithMockedResponse(ideMessenger, "hi", [
      { role: "assistant", content: "hello" },
    ]);

    expect(store.getState().config.config.selectedModelByRole.chat?.title).toBe(
      POWERFUL_MODEL.title,
    );
  });

  it("routes a short message with 2+ attached files to the Powerful Model", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    await setupTierModels(store, ideMessenger);

    const editor = await getMainEditor();
    const sendButton = await getElementByTestId("submit-input-button");

    ideMessenger.chatResponse = [{ role: "assistant", content: "hello" }];

    await act(async () => {
      editor.commands.insertContent([
        { type: "text", text: "check " },
        {
          type: "mention",
          attrs: { id: "file:///a.ts", label: "a.ts", itemType: "file" },
        },
        { type: "text", text: " and " },
        {
          type: "mention",
          attrs: { id: "file:///b.ts", label: "b.ts", itemType: "file" },
        },
      ]);
    });

    await act(async () => {
      sendButton.click();
    });

    expect(store.getState().config.config.selectedModelByRole.chat?.title).toBe(
      POWERFUL_MODEL.title,
    );
  });

  it("lets the user manually override routing for a single message via the indicator", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    await setupTierModels(store, ideMessenger);

    // Short message would normally route to Everyday - click the indicator
    // to force Powerful for this one send.
    const indicator = await getElementByTestId("model-routing-indicator");
    await waitFor(() => {
      expect(indicator.textContent).toMatch(/Everyday/);
    });

    await act(async () => {
      indicator.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("model-routing-indicator").textContent).toMatch(
        /Powerful/,
      );
    });

    await sendInputWithMockedResponse(ideMessenger, "hi", [
      { role: "assistant", content: "hello" },
    ]);

    expect(store.getState().config.config.selectedModelByRole.chat?.title).toBe(
      POWERFUL_MODEL.title,
    );

    // The override should only apply to that one message - the indicator
    // should fall back to auto-routing (Everyday, for this short message).
    await waitFor(() => {
      expect(screen.getByTestId("model-routing-indicator").textContent).toMatch(
        /Everyday/,
      );
    });
  });
});
