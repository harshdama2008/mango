import { act, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { ACTIVE_FILE_POLL_MS } from "../../../components/mainInput/ContextInspectorPanel";
import {
  addAndSelectMockLlm,
  triggerConfigUpdate,
} from "../../../util/test/config";
import { renderWithProviders } from "../../../util/test/render";
import {
  getElementByTestId,
  getMainEditor,
  sendInputWithMockedResponse,
} from "../../../util/test/utils";
import { Chat } from "../Chat";

const MOCK_FILE_ITEM = {
  id: { providerTitle: "file", itemId: "does-not-matter" },
  name: "a.ts",
  description: "src/a.ts",
  content: "x".repeat(40), // ~10 estimated tokens
  uri: { type: "file" as const, value: "file:///a.ts" },
};

async function attachMentionToMainEditor() {
  const editor = await getMainEditor();
  await act(async () => {
    editor.commands.insertContent([
      {
        type: "mention",
        attrs: {
          id: "file:///a.ts",
          label: "a.ts",
          itemType: "file",
          query: "a.ts",
        },
      },
    ]);
  });
}

function mentionNode(fileLabel: string) {
  return {
    type: "mention",
    attrs: {
      id: `file:///${fileLabel}`,
      label: fileLabel,
      itemType: "file",
      query: fileLabel,
    },
  };
}

describe("Context inspector panel", () => {
  it("stays collapsed by default and shows an estimated token count once context resolves", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    addAndSelectMockLlm(store, ideMessenger);
    ideMessenger.responseHandlers["context/getContextItems"] = async ({
      name,
      query,
    }) => (name === "file" && query === "a.ts" ? [MOCK_FILE_ITEM] : []);

    await attachMentionToMainEditor();

    const panel = await getElementByTestId("context-inspector-panel");
    await waitFor(() => {
      expect(panel.textContent).toMatch(/~10 tokens \(1 item\)/);
    });
  });

  it("expands to show file name, line range, and per-item token count", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    addAndSelectMockLlm(store, ideMessenger);
    ideMessenger.responseHandlers["context/getContextItems"] = async ({
      name,
      query,
    }) => (name === "file" && query === "a.ts" ? [MOCK_FILE_ITEM] : []);

    await attachMentionToMainEditor();

    const toggle = await getElementByTestId("context-inspector-toggle");
    await waitFor(() => {
      expect(toggle.textContent).toMatch(/~10 tokens/);
    });

    await act(async () => {
      toggle.click();
    });

    const row = await getElementByTestId("context-inspector-item");
    expect(row.textContent).toContain("a.ts");
    expect(row.textContent).toContain("Whole file");
    expect(row.textContent).toContain("~10 tok");
  });

  it("removing an item via the X button excludes it from the next request", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    addAndSelectMockLlm(store, ideMessenger);
    ideMessenger.responseHandlers["context/getContextItems"] = async ({
      name,
      query,
    }) => (name === "file" && query === "a.ts" ? [MOCK_FILE_ITEM] : []);

    await attachMentionToMainEditor();

    const toggle = await getElementByTestId("context-inspector-toggle");
    await waitFor(() => {
      expect(toggle.textContent).toMatch(/1 item/);
    });
    await act(async () => {
      toggle.click();
    });

    const removeButton = await getElementByTestId(
      "context-inspector-item-remove",
    );
    await act(async () => {
      removeButton.click();
    });

    // With the only context item excluded, the panel has nothing left to show.
    await waitFor(() => {
      expect(
        screen.queryByTestId("context-inspector-panel"),
      ).not.toBeInTheDocument();
    });

    await sendInputWithMockedResponse(ideMessenger, "hello", [
      { role: "assistant", content: "hi" },
    ]);

    const userHistoryItem = store.getState().session.history.at(-2);
    expect(userHistoryItem?.contextItems ?? []).toHaveLength(0);
  });

  it("shows a soft warning once context exceeds 5000 tokens but stays under the 8000 limit", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    addAndSelectMockLlm(store, ideMessenger);
    const bigItem = {
      id: { providerTitle: "file", itemId: "does-not-matter" },
      name: "big.ts",
      description: "src/big.ts",
      content: "x".repeat(6000 * 4), // ~6000 estimated tokens
      uri: { type: "file" as const, value: "file:///big.ts" },
    };
    ideMessenger.responseHandlers["context/getContextItems"] = async ({
      name,
      query,
    }) => (name === "file" && query === "big.ts" ? [bigItem] : []);

    const editor = await getMainEditor();
    await act(async () => {
      editor.commands.insertContent([mentionNode("big.ts")]);
    });

    const warning = await getElementByTestId("context-inspector-token-warning");
    // Comma-grouped, matching the hard-limit warning's "8,000" formatting.
    expect(warning.textContent).toMatch(/~6,000 tokens/);
    // The soft warning must read as milder than the over-limit warning
    // below, not use the identical color (see the over-limit test).
    expect(warning.className).toContain("text-warning");
    expect(
      screen.queryByTestId("context-inspector-over-limit-warning"),
    ).not.toBeInTheDocument();
  });

  it("shows an over-limit warning and auto-excludes items beyond the 8000 token limit before sending", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    addAndSelectMockLlm(store, ideMessenger);
    const itemA = {
      id: { providerTitle: "file", itemId: "a" },
      name: "a.ts",
      description: "src/a.ts",
      content: "x".repeat(5000 * 4), // ~5000 estimated tokens
      uri: { type: "file" as const, value: "file:///a.ts" },
    };
    const itemB = {
      id: { providerTitle: "file", itemId: "b" },
      name: "b.ts",
      description: "src/b.ts",
      content: "x".repeat(5000 * 4), // ~5000 estimated tokens
      uri: { type: "file" as const, value: "file:///b.ts" },
    };
    ideMessenger.responseHandlers["context/getContextItems"] = async ({
      name,
      query,
    }) => {
      if (name === "file" && query === "a.ts") return [itemA];
      if (name === "file" && query === "b.ts") return [itemB];
      return [];
    };

    const editor = await getMainEditor();
    await act(async () => {
      editor.commands.insertContent([
        mentionNode("a.ts"),
        { type: "text", text: " " },
        mentionNode("b.ts"),
      ]);
    });

    const warning = await getElementByTestId(
      "context-inspector-over-limit-warning",
    );
    expect(warning.textContent).toMatch(/over the 8,000 token limit/);
    expect(warning.textContent).toMatch(/1 item/);
    // This is the more severe state (items get silently dropped) - it must
    // be visually distinct from the softer "consider trimming" warning,
    // which uses text-warning.
    expect(warning.className).toContain("text-error");
    expect(warning.className).not.toContain("text-warning");

    await sendInputWithMockedResponse(ideMessenger, "hello", [
      { role: "assistant", content: "hi" },
    ]);

    const userHistoryItem = store.getState().session.history.at(-2);
    const keptNames = (userHistoryItem?.contextItems ?? []).map(
      (item) => item.name,
    );
    expect(keptNames).toEqual(["a.ts"]);
  });

  it("never previews @codebase (avoids triggering a reindex on every keystroke/poll), but still resolves it at actual send time", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    addAndSelectMockLlm(store, ideMessenger);
    const requestSpy = vi.spyOn(ideMessenger, "request");
    ideMessenger.responseHandlers["context/getContextItems"] = async ({
      name,
    }) =>
      name === "codebase"
        ? [
            {
              id: { providerTitle: "codebase", itemId: "does-not-matter" },
              name: "Codebase results",
              description: "3 relevant files",
              content: "x".repeat(40),
            },
          ]
        : [];

    const editor = await getMainEditor();
    await act(async () => {
      editor.commands.insertContent([
        {
          type: "mention",
          attrs: {
            id: "codebase",
            label: "codebase",
            itemType: "contextProvider",
            query: "",
          },
        },
      ]);
    });

    // Give the debounced preview + at least one poll tick a chance to fire.
    await new Promise((resolve) => setTimeout(resolve, 500));

    const previewCodebaseCalls = requestSpy.mock.calls.filter(
      ([type, data]) =>
        type === "context/getContextItems" &&
        (data as any)?.name === "codebase",
    );
    expect(previewCodebaseCalls).toHaveLength(0);

    await sendInputWithMockedResponse(ideMessenger, "hello", [
      { role: "assistant", content: "hi" },
    ]);

    const sendCodebaseCalls = requestSpy.mock.calls.filter(
      ([type, data]) =>
        type === "context/getContextItems" &&
        (data as any)?.name === "codebase",
    );
    expect(sendCodebaseCalls.length).toBeGreaterThan(0);

    const userHistoryItem = store.getState().session.history.at(-2);
    expect(
      (userHistoryItem?.contextItems ?? []).map((item) => item.name),
    ).toContain("Codebase results");
  });

  it("explains why the first @codebase use is slow instead of silently looking hung", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);
    addAndSelectMockLlm(store, ideMessenger);

    const editor = await getMainEditor();
    await act(async () => {
      editor.commands.insertContent([
        {
          type: "mention",
          attrs: {
            id: "codebase",
            label: "codebase",
            itemType: "contextProvider",
            query: "",
          },
        },
      ]);
    });

    // No notice yet - core hasn't reported an in-progress build.
    expect(
      screen.queryByTestId("context-inspector-codebase-indexing-notice"),
    ).not.toBeInTheDocument();

    await act(async () => {
      ideMessenger.mockMessageToWebview("indexProgress", {
        progress: 0.4,
        desc: "Indexing repository",
        status: "indexing",
      });
    });

    const notice = await getElementByTestId(
      "context-inspector-codebase-indexing-notice",
    );
    expect(notice.textContent).toMatch(/first time/);

    await act(async () => {
      ideMessenger.mockMessageToWebview("indexProgress", {
        progress: 1,
        desc: "Indexing complete",
        status: "done",
      });
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId("context-inspector-codebase-indexing-notice"),
      ).not.toBeInTheDocument();
    });
  });

  describe("active-file poll (regression: shouldn't run forever while idle)", () => {
    const originalVisibilityState = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState",
    );

    function setVisibility(state: "visible" | "hidden") {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => state,
      });
    }

    afterEach(() => {
      if (originalVisibilityState) {
        Object.defineProperty(
          document,
          "visibilityState",
          originalVisibilityState,
        );
      }
    });

    it("stops polling while the webview is hidden, and refreshes immediately on regaining visibility", async () => {
      const { ideMessenger, store } = await renderWithProviders(<Chat />);
      addAndSelectMockLlm(store, ideMessenger);
      // selectUseActiveFile reads experimental.defaultContext for the
      // literal string "activeFile" - force that shape directly since
      // nothing in the app actually sets it this way (see the note in the
      // fix report: this looks like a separate, pre-existing dead selector).
      await act(async () => {
        triggerConfigUpdate({
          store,
          ideMessenger,
          editConfig: (current) => {
            current.experimental = {
              ...current.experimental,
              defaultContext: ["activeFile"] as any,
            };
            return current;
          },
        });
      });
      const requestSpy = vi.spyOn(ideMessenger, "request");

      // Let the initial preview resolve settle before measuring.
      await new Promise((resolve) => setTimeout(resolve, 400));
      const callsBeforeHidden = requestSpy.mock.calls.filter(
        ([type]) => type === "context/getContextItems",
      ).length;

      setVisibility("hidden");
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Wait past a full poll interval - no new resolution should fire.
      await new Promise((resolve) =>
        setTimeout(resolve, ACTIVE_FILE_POLL_MS + 300),
      );
      const callsWhileHidden = requestSpy.mock.calls.filter(
        ([type]) => type === "context/getContextItems",
      ).length;
      expect(callsWhileHidden).toBe(callsBeforeHidden);

      setVisibility("visible");
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      await waitFor(() => {
        const callsAfterVisible = requestSpy.mock.calls.filter(
          ([type]) => type === "context/getContextItems",
        ).length;
        expect(callsAfterVisible).toBeGreaterThan(callsWhileHidden);
      });
    });
  });
});
