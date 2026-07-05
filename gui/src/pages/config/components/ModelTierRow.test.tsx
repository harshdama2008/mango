import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ModelDescription } from "core";
import { Provider } from "react-redux";
import { AuthProvider } from "../../../context/Auth";
import { IdeMessengerProvider } from "../../../context/IdeMessenger";
import { MockIdeMessenger } from "../../../context/MockIdeMessenger";
import {
  configSlice,
  EMPTY_CONFIG,
  updateConfig,
} from "../../../redux/slices/configSlice";
import { profilesSlice } from "../../../redux/slices/profilesSlice";
import { uiSlice } from "../../../redux/slices/uiSlice";
import { EVERYDAY_MODEL_OPTIONS } from "../../../util/recommendedModels";
import { ModelTierRow } from "./ModelTierRow";

function configuredModel(
  overrides: Partial<ModelDescription>,
): ModelDescription {
  return {
    title: "My Model",
    provider: "anthropic",
    underlyingProviderName: "anthropic",
    model: "claude-haiku-4-5-20251001",
    ...overrides,
  };
}

function renderRow({
  selectedKey = null,
  configuredModels = [],
}: {
  selectedKey?: string | null;
  configuredModels?: ModelDescription[];
} = {}) {
  const ideMessenger = new MockIdeMessenger();

  const store = configureStore({
    reducer: {
      config: configSlice.reducer,
      profiles: profilesSlice.reducer,
      ui: uiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: { extraArgument: { ideMessenger } },
        serializableCheck: false,
      }),
    preloadedState: {
      profiles: {
        ...profilesSlice.getInitialState(),
        selectedProfileId: "local",
      },
      config: {
        configError: undefined,
        loading: false,
        config: {
          ...EMPTY_CONFIG,
          modelsByRole: {
            ...EMPTY_CONFIG.modelsByRole,
            autocomplete: configuredModels,
          },
        },
      },
    },
  });

  const onSelectKey = vi.fn();

  const rendered = render(
    <Provider store={store as any}>
      <IdeMessengerProvider messenger={ideMessenger}>
        <AuthProvider>
          <ModelTierRow
            title="Everyday Model"
            description="A fast, low-cost model used for autocomplete and simple questions"
            role="autocomplete"
            options={EVERYDAY_MODEL_OPTIONS}
            selectedKey={selectedKey}
            onSelectKey={onSelectKey}
          />
        </AuthProvider>
      </IdeMessengerProvider>
    </Provider>,
  );

  return { ...rendered, store, onSelectKey };
}

describe("ModelTierRow", () => {
  it("calls onSelectKey when a new option is chosen", () => {
    const { onSelectKey } = renderRow();

    const select = screen.getByTestId("model-tier-select-autocomplete");
    fireEvent.change(select, { target: { value: "gpt-4o-mini" } });

    expect(onSelectKey).toHaveBeenCalledWith("gpt-4o-mini");
  });

  it("shows the configured model when a matching one already exists", async () => {
    renderRow({
      selectedKey: "claude-haiku",
      configuredModels: [
        configuredModel({
          title: "My Claude Haiku",
          provider: "anthropic",
          model: "claude-haiku-4-5-20251001",
        }),
      ],
    });

    await waitFor(() => {
      expect(screen.getByText(/Using My Claude Haiku/)).toBeInTheDocument();
    });
  });

  it("shows a 'not configured' hint when no matching model exists", async () => {
    renderRow({ selectedKey: "gemini-1.5-flash", configuredModels: [] });

    await waitFor(() => {
      expect(screen.getByText(/Not yet configured/)).toBeInTheDocument();
    });
  });

  it("opens the Add Model dialog when the 'not configured' link is clicked", async () => {
    const { store } = renderRow({
      selectedKey: "deepseek-coder",
      configuredModels: [],
    });

    await waitFor(() => {
      expect(screen.getByText(/add your deepseek API key/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/add your deepseek API key/));

    expect(store.getState().ui.showDialog).toBe(true);
  });

  it("automatically applies the role once a matching model becomes configured", async () => {
    const { store } = renderRow({
      selectedKey: "claude-haiku",
      configuredModels: [],
    });

    expect(
      store.getState().config.config.selectedModelByRole.autocomplete,
    ).toBeNull();

    // Simulate the user adding a matching model afterwards
    store.dispatch(
      updateConfig({
        ...store.getState().config.config,
        modelsByRole: {
          ...store.getState().config.config.modelsByRole,
          autocomplete: [
            configuredModel({
              title: "Freshly Added Haiku",
              provider: "anthropic",
              model: "claude-haiku-4-5-20251001",
            }),
          ],
        },
      }),
    );

    await waitFor(() => {
      expect(
        store.getState().config.config.selectedModelByRole.autocomplete?.title,
      ).toBe("Freshly Added Haiku");
    });
  });
});
