import { NEW_SESSION_TITLE } from "core/util/constants";
import { v4 as uuidv4 } from "uuid";
import { createMockStore, getEmptyRootState } from "../../util/test/mockStore";
import { RootState } from "../store";
import { saveCurrentSession } from "./session";

const MOCK_MODEL = {
  title: "My Chat Model",
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  underlyingProviderName: "anthropic",
};

function historyItem(role: "user" | "assistant", content: string) {
  return {
    message: { role, content, id: uuidv4() },
    contextItems: [],
  };
}

describe("saveCurrentSession", () => {
  it("writes the generated title to redux, not just to disk", async () => {
    const initialState = getEmptyRootState();
    initialState.session.title = NEW_SESSION_TITLE;
    initialState.session.history = [
      historyItem("user", "hello") as any,
      historyItem("assistant", "hi there") as any,
    ];
    initialState.config.config.selectedModelByRole.chat = MOCK_MODEL as any;
    const store = createMockStore(initialState);

    await store.dispatch(
      saveCurrentSession({ openNewSession: false, generateTitle: true }) as any,
    );

    // MockIdeMessenger's default "chatDescriber/describe" response is
    // "Session summary" - confirms the title reaches redux, not just the
    // history/save payload written to disk.
    expect((store.getState() as RootState).session.title).toBe(
      "Session summary",
    );
  });

  it("does not overwrite the title of a session the user has since switched to", async () => {
    const oldSessionId = "old-session";
    const initialState = getEmptyRootState();
    initialState.session.id = oldSessionId;
    initialState.session.title = NEW_SESSION_TITLE;
    initialState.session.history = [
      historyItem("user", "hello") as any,
      historyItem("assistant", "hi there") as any,
    ];
    initialState.config.config.selectedModelByRole.chat = MOCK_MODEL as any;
    const store = createMockStore(initialState);

    // saveCurrentSession's own openNewSession:true path dispatches newSession()
    // partway through, which is exactly the race this guards against.
    await store.dispatch(
      saveCurrentSession({ openNewSession: true, generateTitle: true }) as any,
    );

    // The new (now-active) session should keep its own fresh title, not
    // inherit the old session's generated one.
    const finalState = store.getState() as RootState;
    expect(finalState.session.id).not.toBe(oldSessionId);
    expect(finalState.session.title).toBe(NEW_SESSION_TITLE);
  });
});
