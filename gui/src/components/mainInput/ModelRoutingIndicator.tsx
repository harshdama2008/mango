import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setMessageModelOverride } from "../../redux/slices/uiSlice";
import { countDistinctAttachedFiles } from "../../util/countAttachedFiles";
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
      setMessageLength(mainEditor.getText().trim().length);
      setAttachedFileCount(countDistinctAttachedFiles(mainEditor.getJSON()));
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

  const tooltipContent = (
    <div className="flex flex-col gap-1 text-left">
      <span>{reason}</span>
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
        className="text-description hover:text-foreground flex cursor-pointer select-none items-center gap-1 whitespace-nowrap"
      >
        <span>{TIER_ICON[effectiveTier]}</span>
        <span>
          {TIER_LABEL[effectiveTier]}
          {resolvedModel ? `: ${resolvedModel.title}` : ""}
        </span>
      </div>
    </ToolTip>
  );
}
