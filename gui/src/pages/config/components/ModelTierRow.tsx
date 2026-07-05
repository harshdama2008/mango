import { ModelRole } from "@mangodev/config-yaml";
import { useEffect } from "react";
import { useAuth } from "../../../context/Auth";
import { AddModelForm } from "../../../forms/AddModelForm";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { updateSelectedModelByRole } from "../../../redux/thunks/updateSelectedModelByRole";
import {
  findConfiguredMatch,
  findRecommendedModel,
  RecommendedModel,
} from "../../../util/recommendedModels";

export interface ModelTierRowProps {
  title: string;
  description: string;
  role: ModelRole;
  options: RecommendedModel[];
  selectedKey: string | null;
  onSelectKey: (key: string) => void;
}

// Models added via ModelTierRow should work everywhere (autocomplete, chat,
// and the automatic Everyday/Powerful message routing), not just whichever
// role prompted the add. Default new-model roles are
// ["chat", "summarize", "apply", "edit"] - "autocomplete" is NOT included
// unless requested (see core/config/yaml/loadYaml.ts), so it must be added
// explicitly here.
const FULL_MODEL_ROLES: ModelRole[] = [
  "chat",
  "autocomplete",
  "edit",
  "apply",
  "summarize",
];

export function ModelTierRow({
  title,
  description,
  role,
  options,
  selectedKey,
  onSelectKey,
}: ModelTierRowProps) {
  const dispatch = useAppDispatch();
  const { selectedProfile } = useAuth();

  const configuredModels = useAppSelector(
    (state) => state.config.config.modelsByRole[role],
  );
  const activeModel = useAppSelector(
    (state) => state.config.config.selectedModelByRole[role],
  );

  const selectedRecommendation = findRecommendedModel(selectedKey);
  const configuredMatch = selectedRecommendation
    ? findConfiguredMatch(configuredModels, selectedRecommendation)
    : undefined;

  function applyMatch(matchTitle: string) {
    void dispatch(
      updateSelectedModelByRole({
        role,
        modelTitle: matchTitle,
        selectedProfile,
      }),
    );
  }

  // If the saved preference now has a matching configured model (e.g. the
  // user just added the API key) and it isn't already the active model for
  // this role, apply it automatically.
  useEffect(() => {
    if (configuredMatch && activeModel?.title !== configuredMatch.title) {
      applyMatch(configuredMatch.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuredMatch?.title]);

  function handleChange(key: string) {
    onSelectKey(key);

    const recommended = findRecommendedModel(key);
    if (!recommended) {
      return;
    }

    const match = findConfiguredMatch(configuredModels, recommended);
    if (match) {
      applyMatch(match.title);
    }
  }

  function handleAddModel() {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddModelForm
          forceRoles={FULL_MODEL_ROLES}
          onDone={() => {
            dispatch(setShowDialog(false));
          }}
        />,
      ),
    );
  }

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="mb-2">
        <span className="text-base font-medium">{title}</span>
        <p className="text-description mt-1 text-xs">{description}</p>
      </div>

      <div className="flex items-center gap-2">
        <select
          data-testid={`model-tier-select-${role}`}
          className="bg-vsc-input-background text-vsc-foreground flex-1 rounded-md border border-none px-2 py-1.5 text-sm outline-none focus:outline-none"
          value={selectedKey ?? ""}
          onChange={(e) => handleChange(e.target.value)}
        >
          <option value="" disabled>
            Select a model...
          </option>
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.displayName}
            </option>
          ))}
        </select>
      </div>

      {selectedRecommendation && (
        <p className="mt-1.5 text-xs" data-testid={`model-tier-status-${role}`}>
          {configuredMatch ? (
            <span className="text-success">
              ✓ Using {configuredMatch.title}
            </span>
          ) : (
            <span className="text-description-muted">
              Not yet configured —{" "}
              <span
                className="text-foreground cursor-pointer underline hover:brightness-125"
                onClick={handleAddModel}
              >
                add your {selectedRecommendation.provider} API key
              </span>
            </span>
          )}
        </p>
      )}
    </div>
  );
}
