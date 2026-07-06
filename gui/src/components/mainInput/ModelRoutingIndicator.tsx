import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setMessageModelOverride } from "../../redux/slices/uiSlice";
import {
  countDistinctAttachedFiles,
  getMessageTextLength,
} from "../../util/countAttachedFiles";
import { computeAutoRoutedTier, ModelTier } from "../../util/modelRouting";
import { resolveModelForTier } from "../../util/recommendedModels";
import { ToolTip } from "../gui/Tooltip";
import { useMainEditor } from "./TipTapEditor";

const TIER_LABEL: Record<ModelTier, string> = {
  everyday: "Everyday",
  powerful: "Powerful",
};

const TIER_ICON: Record<ModelTier, string> = {
  everyday: "⚡",
  powerful: "🔥",
};

export function ModelRoutingIndicator() {
  const dispatch = useAppDispatch();
  const { mainEditor } = useMainEditor();

  const mode = useAppSelector((state) => state.session.mode);
  const isInEdit = useAppSelector((state) => state.session.isInEdit);
  const everydayModelKey = useAppSelector((state) => state.ui.everydayModelKey);
  const powerfulModelKey = useAppSelector((state) => state.ui.powerfulModelKey);
  const override = useAppSelector((state) => state.ui.messageModelOverride);
  const chatModels = useAppSelector(
    (state) => state.config.config.modelsByRole.chat,
  );

  const [messageLength, setMessageLength] = useState(0);
  const [attachedFileCount, setAttachedFileCount] = useState(0);

  useEffect(() => {
    if (!mainEditor) {
      return;
    }

    const update = () => {
      // Use the same measurement sendInput uses at actual send time (which
      // counts mention labels too), so the preview never disagrees with
      // what routing decision the send will actually make.
      const editorState = mainEditor.getJSON();
      setMessageLength(getMessageTextLength(editorState));
      setAttachedFileCount(countDistinctAttachedFiles(editorState));
    };

    update();
    mainEditor.on("update", update);
    return () => {
      mainEditor.off("update", update);
    };
  }, [mainEditor]);

  if (isInEdit) {
    // Edit mode uses its own dedicated model role, unrelated to Everyday/Powerful routing
    return null;
  }

  const autoRouted = computeAutoRoutedTier({
    mode,
    messageLength,
    attachedFileCount,
  });
  const effectiveTier = override ?? autoRouted.tier;
  const otherTier: ModelTier =
    effectiveTier === "everyday" ? "powerful" : "everyday";

  const resolvedModel = resolveModelForTier(
    effectiveTier,
    everydayModelKey,
    powerfulModelKey,
    chatModels,
  );

  const reason = override
    ? `Manually set to ${TIER_LABEL[override]} for this message. Click to use ${TIER_LABEL[otherTier]} instead.`
    : `${autoRouted.reason}. Click to override for this message.`;

  // Overriding away from a mode-forced tier (e.g. downgrading an agent task
  // to the Everyday Model) is easy to do by accident with a single click and
  // easy to miss since it only shows up in a hover tooltip - call it out
  // directly on the indicator instead of leaving it silent.
  const isDowngradingModeForcedTask =
    override !== null &&
    autoRouted.isModeForced &&
    override !== autoRouted.tier;

  const tooltipContent = (
    <div className="flex flex-col gap-1 text-left">
      <span>{reason}</span>
      {resolvedModel && (
        <span className="text-description-muted">{resolvedModel.title}</span>
      )}
      {isDowngradingModeForcedTask && (
        <span className="text-warning">
          ⚠ {autoRouted.reason.replace(/\.$/, "")} — this message will use{" "}
          {TIER_LABEL[effectiveTier]} instead.
        </span>
      )}
      {!resolvedModel && (
        <span className="text-warning">
          No {TIER_LABEL[effectiveTier]} Model configured yet — set one in
          Settings
        </span>
      )}
    </div>
  );

  return (
    <ToolTip place="top" content={tooltipContent}>
      <div
        data-testid="model-routing-indicator"
        onClick={() => dispatch(setMessageModelOverride(otherTier))}
        className={`flex cursor-pointer select-none items-center gap-1 whitespace-nowrap ${
          isDowngradingModeForcedTask
            ? "text-warning"
            : "text-description hover:text-foreground"
        }`}
      >
        {isDowngradingModeForcedTask && (
          <span data-testid="model-routing-override-warning">⚠</span>
        )}
        <span>{TIER_ICON[effectiveTier]}</span>
        {/* The resolved model's title is shown in the tooltip, not here -
            ModelSelect right next to this indicator already displays the
            active chat model's name, so repeating it here just duplicates
            it and risks overflowing the toolbar on a narrow panel. */}
        <span>{TIER_LABEL[effectiveTier]}</span>
      </div>
    </ToolTip>
  );
}
