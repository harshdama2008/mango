import { configureStore } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import sessionReducer, {
  addPromptCompletionPair,
  INITIAL_SESSION_STATE,
  updateHistoryItemAtIndex,
} from "../slices/sessionSlice";
import { createCostDashboardMiddleware } from "./costDashboardMiddleware";

function buildStore(ideMessenger: MockIdeMessenger) {
  return configureStore({
    reducer: { session: sessionReducer },
    preloadedState: {
      session: {
        ...INITIAL_SESSION_STATE,
        id: "session-123",
        title: "My Session",
        history: [
          {
            message: { id: "user-1", role: "user" as const, content: "hi" },
            contextItems: [],
          },
          {
            message: { id: uuidv4(), role: "assistant" as const, content: "" },
            contextItems: [],
          },
        ],
      },
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }).concat(
        createCostDashboardMiddleware(ideMessenger) as any,
      ),
  });
}

function replaceLastMessageWithFreshAssistant(
  store: ReturnType<typeof buildStore>,
) {
  const state = store.getState();
  store.dispatch(
    updateHistoryItemAtIndex({
      index: state.session.history.length - 1,
      updates: {
        message: { id: uuidv4(), role: "assistant", content: "" },
        promptLogs: undefined,
      },
    }),
  );
}

const LOG = {
  modelProvider: "anthropic",
  modelTitle: "Claude Sonnet",
  prompt: "hi",
  completion: "hello",
  usage: { promptTokens: 100, completionTokens: 50 },
};

describe("costDashboardMiddleware", () => {
  it("marks the first logged response for a fresh slot as startOfTurn", () => {
    const ideMessenger = new MockIdeMessenger();
    const postSpy = vi.spyOn(ideMessenger, "post");
    const store = buildStore(ideMessenger);

    store.dispatch(addPromptCompletionPair([LOG]));

    const recorded = postSpy.mock.calls.filter(
      ([type]) => type === "costDashboard/recordEvent",
    );
    expect(recorded).toHaveLength(1);
    expect(recorded[0][1]).toMatchObject({
      historySlotIndex: 1,
      startOfTurn: true,
    });
  });

  it("marks a follow-up tool-call round trip on the same slot as a continuation, not a new turn", () => {
    const ideMessenger = new MockIdeMessenger();
    const postSpy = vi.spyOn(ideMessenger, "post");
    const store = buildStore(ideMessenger);

    store.dispatch(addPromptCompletionPair([LOG]));
    store.dispatch(addPromptCompletionPair([LOG]));

    const recorded = postSpy.mock.calls.filter(
      ([type]) => type === "costDashboard/recordEvent",
    );
    expect(recorded).toHaveLength(2);
    expect(recorded[0][1]).toMatchObject({ startOfTurn: true });
    expect(recorded[1][1]).toMatchObject({
      historySlotIndex: 1,
      startOfTurn: false,
    });
  });

  it("marks a regenerated turn at the same slot as startOfTurn again", () => {
    const ideMessenger = new MockIdeMessenger();
    const postSpy = vi.spyOn(ideMessenger, "post");
    const store = buildStore(ideMessenger);

    // Original response, possibly with a tool-call round trip.
    store.dispatch(addPromptCompletionPair([LOG]));
    store.dispatch(addPromptCompletionPair([LOG]));

    // Regenerate: same slot, brand-new assistant message with no promptLogs.
    replaceLastMessageWithFreshAssistant(store);
    store.dispatch(addPromptCompletionPair([LOG]));

    const recorded = postSpy.mock.calls.filter(
      ([type]) => type === "costDashboard/recordEvent",
    );
    expect(recorded).toHaveLength(3);
    expect(recorded[2][1]).toMatchObject({
      historySlotIndex: 1,
      startOfTurn: true,
    });
  });
});
