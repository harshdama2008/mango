import { newSession } from "./sessionSlice";
import uiReducer, { DEFAULT_UI_SLICE, excludeContextItemKey } from "./uiSlice";

describe("uiSlice", () => {
  describe("excludedContextItemKeys", () => {
    it("clears excluded context item keys when a new session starts", () => {
      let state = uiReducer(
        DEFAULT_UI_SLICE,
        excludeContextItemKey("file:///a.ts"),
      );
      expect(state.excludedContextItemKeys).toEqual(["file:///a.ts"]);

      state = uiReducer(state, newSession());

      expect(state.excludedContextItemKeys).toEqual([]);
    });

    it("clears excluded context item keys when an existing session is loaded", () => {
      let state = uiReducer(
        DEFAULT_UI_SLICE,
        excludeContextItemKey("file:///a.ts"),
      );
      expect(state.excludedContextItemKeys).toEqual(["file:///a.ts"]);

      state = uiReducer(
        state,
        newSession({
          sessionId: "session-2",
          title: "Some other session",
          history: [],
          workspaceDirectory: "",
        } as any),
      );

      expect(state.excludedContextItemKeys).toEqual([]);
    });
  });
});
