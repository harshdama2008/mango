import { ModelRole } from "@mangodev/config-yaml";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { ProfileDescription } from "core/config/ProfileLifecycleManager";
import { updateConfig } from "../slices/configSlice";
import { ThunkApiType } from "../store";

export const updateSelectedModelByRole = createAsyncThunk<
  void,
  {
    role: ModelRole;
    modelTitle: string;
    selectedProfile: ProfileDescription | null;
    /**
     * Whether to write this selection to config.yaml (via config/updateSelectedModel)
     * in addition to updating in-session redux state. Defaults to true for
     * explicit user picks (e.g. the model dropdown). Automatic Everyday/Powerful
     * routing passes false, since a per-message routing decision shouldn't
     * overwrite the user's persisted model preference - see Chat.tsx's sendInput.
     */
    persist?: boolean;
  },
  ThunkApiType
>(
  "config/updateSelectedModel",
  async (
    { role, modelTitle, selectedProfile, persist = true },
    { dispatch, extra, getState },
  ) => {
    if (!selectedProfile) {
      return;
    }

    const state = getState();

    const {
      config: { config },
    } = state;

    const model = state.config.config.modelsByRole[role]?.find(
      (m) => m.title === modelTitle,
    );

    if (!model) {
      console.error(
        `Model with title "${modelTitle}" not found for role "${role}"`,
      );
      return;
    }

    dispatch(
      updateConfig({
        ...config,
        selectedModelByRole: {
          ...config.selectedModelByRole,
          [role]: model,
        },
      }),
    );

    if (persist) {
      extra.ideMessenger.post("config/updateSelectedModel", {
        role,
        profileId: selectedProfile.id,
        title: modelTitle,
      });
    }
  },
);
