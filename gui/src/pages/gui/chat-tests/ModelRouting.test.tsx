import { act, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { setCodeToEdit } from "../../../redux/slices/editState";
import { setIsInEdit, setMode } from "../../../redux/slices/sessionSlice";
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

  it("doesn't repeat the resolved model's title inline (ModelSelect already shows it, and long titles can overflow the toolbar)", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    await setupTierModels(store, ideMessenger);

    const indicator = await getElementByTestId("model-routing-indicator");
    await waitFor(() => {
      expect(indicator.textContent).toMatch(/Everyday/);
    });
    expect(indicator.textContent).not.toContain(EVERYDAY_MODEL.title);
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

  it("keeps the indicator's preview consistent with the actual routing decision for a mention-heavy message", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    await setupTierModels(store, ideMessenger);

    const editor = await getMainEditor();
    // The typed text alone is short, but the mention's label pushes the
    // message over 200 characters once counted the way sendInput counts it -
    // the indicator must agree, not just show "Everyday" and then actually
    // route to Powerful once sent.
    await act(async () => {
      editor.commands.insertContent([
        {
          type: "mention",
          attrs: {
            id: "file:///a.ts",
            label: "a".repeat(210),
            itemType: "file",
          },
        },
      ]);
    });

    const indicator = await getElementByTestId("model-routing-indicator");
    await waitFor(() => {
      expect(indicator.textContent).toMatch(/Powerful/);
    });

    ideMessenger.chatResponse = [{ role: "assistant", content: "hello" }];
    const sendButton = await getElementByTestId("submit-input-button");
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

  it("clears a manual override on an Edit-mode send too, so it doesn't leak into the next chat message", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    await setupTierModels(store, ideMessenger);
    ideMessenger.responses["edit/sendPrompt"] = undefined;

    // Set an override while still in chat mode.
    const indicator = await getElementByTestId("model-routing-indicator");
    await waitFor(() => {
      expect(indicator.textContent).toMatch(/Everyday/);
    });
    await act(async () => {
      indicator.click();
    });
    await waitFor(() => {
      expect(store.getState().ui.messageModelOverride).not.toBeNull();
    });

    // Switch to Edit mode (the override-clearing logic used to live inside
    // an "only if not in Edit mode" branch, so it never ran for these sends)
    // and send.
    await act(async () => {
      store.dispatch(setIsInEdit(true));
      store.dispatch(
        setCodeToEdit({
          codeToEdit: { filepath: "file:///a.ts", contents: "const a = 1;" },
        }),
      );
    });

    const editor = await getMainEditor();
    await act(async () => {
      editor.commands.insertContent("edit this");
    });
    const sendButton = await getElementByTestId("submit-input-button");
    await act(async () => {
      sendButton.click();
    });

    await waitFor(() => {
      expect(store.getState().ui.messageModelOverride).toBeNull();
    });
  });

  it("visibly warns when overriding downgrades a mode-forced agent task to Everyday", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    await setupTierModels(store, ideMessenger);
    await act(async () => {
      store.dispatch(setMode("agent"));
    });

    const indicator = await getElementByTestId("model-routing-indicator");
    await waitFor(() => {
      expect(indicator.textContent).toMatch(/Powerful/);
    });
    expect(
      screen.queryByTestId("model-routing-override-warning"),
    ).not.toBeInTheDocument();

    // Overriding agent mode's forced Powerful down to Everyday should be
    // visibly flagged, not silent.
    await act(async () => {
      indicator.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("model-routing-indicator").textContent).toMatch(
        /Everyday/,
      );
    });
    expect(
      screen.getByTestId("model-routing-override-warning"),
    ).toBeInTheDocument();
  });

  it("switches the active chat model in-session without persisting the change to config.yaml", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    await setupTierModels(store, ideMessenger);
    const postSpy = vi.spyOn(ideMessenger, "post");

    const longMessage = "x".repeat(201);
    await sendInputWithMockedResponse(ideMessenger, longMessage, [
      { role: "assistant", content: "hello" },
    ]);

    // Routing did switch the in-session active model...
    expect(store.getState().config.config.selectedModelByRole.chat?.title).toBe(
      POWERFUL_MODEL.title,
    );

    // ...but it must not have written that switch back to config.yaml - only
    // an explicit user pick (e.g. the model dropdown) should persist.
    const persistedSelectionCalls = postSpy.mock.calls.filter(
      ([type]) => type === "config/updateSelectedModel",
    );
    expect(persistedSelectionCalls).toHaveLength(0);
  });
});
