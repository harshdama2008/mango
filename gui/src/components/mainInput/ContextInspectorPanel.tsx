import { XMarkIcon } from "@heroicons/react/24/outline";
import { ContextItemWithId, IndexingProgressUpdate } from "core";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "react-redux";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  selectDefaultContextProviders,
  selectUseActiveFile,
} from "../../redux/selectors";
import { excludeContextItemKey } from "../../redux/slices/uiSlice";
import { RootState } from "../../redux/store";
import { getContextItemDisplayInfo } from "../../util/contextItemDisplay";
import { getContextItemKey } from "../../util/contextItemKey";
import {
  CONTEXT_TOKEN_WARNING_THRESHOLD,
  DEFAULT_MAX_CONTEXT_TOKENS,
  trimContextItemsToTokenBudget,
} from "../../util/contextTokenBudget";
import { estimateTokenCount } from "../../util/estimateTokens";
import ToggleDiv from "../ToggleDiv";
import { useDebouncedEffect } from "../find/useDebounce";
import { useMainEditor } from "./TipTapEditor";
import { processEditorContent } from "./TipTapEditor/utils/processEditorContent";
import { gatherContextItems } from "./TipTapEditor/utils/resolveEditorContent";

// No push event exists for "active file changed" (see ideMessenger protocol),
// so poll at a low frequency to keep the preview in sync with file switches.
// Exported for tests.
export const ACTIVE_FILE_POLL_MS = 2000;

// These providers are expensive or side-effecting (network fetches, and for
// "codebase" specifically, triggering a full index build/refresh - see
// core.ts's getContextItems). Re-resolving them on every debounced keystroke
// and every poll tick would repeatedly abort and restart that work, so the
// live preview skips them entirely; they're still resolved normally, once,
// at actual send time in resolveEditorContent.ts.
const PREVIEW_EXCLUDED_PROVIDERS = new Set(["codebase", "url"]);

export function ContextInspectorPanel() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const reduxStore = useStore<RootState>();
  const { mainEditor } = useMainEditor();

  const useActiveFile = useAppSelector(selectUseActiveFile);
  const defaultContextProviders = useAppSelector(selectDefaultContextProviders);
  const mode = useAppSelector((state) => state.session.mode);
  const excludedKeys = useAppSelector(
    (state) => state.ui.excludedContextItemKeys,
  );

  const [items, setItems] = useState<ContextItemWithId[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [hasCodebaseMention, setHasCodebaseMention] = useState(false);
  const [indexingStatus, setIndexingStatus] = useState<
    IndexingProgressUpdate["status"] | null
  >(null);
  const requestIdRef = useRef(0);

  // core.ts's getContextItems blocks a real @codebase send on a full index
  // build the first time it's used - with nothing explaining why, that looks
  // like a hang. Surface the same indexProgress push Settings' indexing
  // section already listens to, right where the user is waiting.
  useWebviewListener("indexProgress", async (update) => {
    setIndexingStatus(update.status);
  });

  useEffect(() => {
    if (!mainEditor) {
      return;
    }
    const bump = () => setRefreshTick((t) => t + 1);
    mainEditor.on("update", bump);
    return () => {
      mainEditor.off("update", bump);
    };
  }, [mainEditor]);

  useEffect(() => {
    // The poll exists only to catch active-file switches, which only affect
    // the preview when active-file inclusion is on - and there's no reason
    // to keep polling (reading the active file's content over the IDE
    // bridge every 2s, forever) while this webview isn't even visible.
    if (!useActiveFile) {
      return;
    }

    const bump = () => setRefreshTick((t) => t + 1);

    let interval: ReturnType<typeof setInterval> | undefined;
    const startPolling = () => {
      if (interval === undefined) {
        interval = setInterval(bump, ACTIVE_FILE_POLL_MS);
      }
    };
    const stopPolling = () => {
      if (interval !== undefined) {
        clearInterval(interval);
        interval = undefined;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Refresh immediately rather than waiting up to another
        // ACTIVE_FILE_POLL_MS - the active file may well have changed while
        // this webview was hidden.
        bump();
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === "visible") {
      startPolling();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [useActiveFile]);

  useDebouncedEffect(
    () => {
      if (!mainEditor) {
        return;
      }
      const requestId = ++requestIdRef.current;
      const { contextRequests, parts, selectedCode } = processEditorContent(
        mainEditor.getJSON(),
      );
      const previewableRequests = contextRequests.filter(
        (request) => !PREVIEW_EXCLUDED_PROVIDERS.has(request.provider),
      );
      const previewableDefaultProviders = defaultContextProviders.filter(
        (provider) => !PREVIEW_EXCLUDED_PROVIDERS.has(provider.name),
      );
      setHasCodebaseMention(
        contextRequests.some((request) => request.provider === "codebase") ||
          defaultContextProviders.some(
            (provider) => provider.name === "codebase",
          ),
      );

      setIsLoading(true);
      gatherContextItems({
        contextRequests: previewableRequests,
        modifiers: { useCodebase: false, noContext: !useActiveFile },
        ideMessenger,
        defaultContextProviders: previewableDefaultProviders,
        parts,
        selectedCode,
        getState: () => reduxStore.getState(),
      })
        .then((resolved) => {
          if (requestId === requestIdRef.current) {
            setItems(resolved);
          }
        })
        .catch(() => {
          if (requestId === requestIdRef.current) {
            setItems([]);
          }
        })
        .finally(() => {
          if (requestId === requestIdRef.current) {
            setIsLoading(false);
          }
        });
    },
    300,
    [refreshTick, useActiveFile, mode, defaultContextProviders],
  );

  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => !item.hidden)
        .map((item) => ({ item, key: getContextItemKey(item) }))
        .filter(({ key }) => !excludedKeys.includes(key)),
    [items, excludedKeys],
  );

  const totalTokens = useMemo(
    () =>
      visibleItems.reduce(
        (sum, { item }) => sum + estimateTokenCount(item.content),
        0,
      ),
    [visibleItems],
  );

  const trimmedCount = useMemo(
    () =>
      trimContextItemsToTokenBudget(visibleItems.map(({ item }) => item))
        .trimmedCount,
    [visibleItems],
  );

  const isBuildingCodebaseIndex =
    hasCodebaseMention && indexingStatus === "indexing";

  if (visibleItems.length === 0 && !isLoading && !isBuildingCodebaseIndex) {
    return null;
  }

  return (
    <div className="mb-1 px-2" data-testid="context-inspector-panel">
      {isBuildingCodebaseIndex && (
        <div
          data-testid="context-inspector-codebase-indexing-notice"
          className="text-description-muted mb-1 px-2 text-xs"
        >
          Building the codebase index for the first time - this can take a while
          for large projects. Later @codebase uses will be fast.
        </div>
      )}
      {trimmedCount > 0 ? (
        <div
          data-testid="context-inspector-over-limit-warning"
          className="text-error mb-1 px-2 text-xs"
        >
          Context is over the {DEFAULT_MAX_CONTEXT_TOKENS.toLocaleString()}{" "}
          token limit - {trimmedCount} item
          {trimmedCount === 1 ? "" : "s"} will be excluded automatically before
          sending. Remove some context to control what's kept.
        </div>
      ) : (
        totalTokens > CONTEXT_TOKEN_WARNING_THRESHOLD && (
          <div
            data-testid="context-inspector-token-warning"
            className="text-warning mb-1 px-2 text-xs"
          >
            Context is using ~{totalTokens.toLocaleString()} tokens - consider
            removing some items to keep responses fast and affordable.
          </div>
        )
      )}
      <ToggleDiv
        testId="context-inspector-toggle"
        title={
          isLoading && visibleItems.length === 0
            ? "Gathering context…"
            : `Context: ~${totalTokens.toLocaleString()} tokens (${visibleItems.length} item${
                visibleItems.length === 1 ? "" : "s"
              })`
        }
      >
        {visibleItems.map(({ item, key }) => {
          const { fileName, lines } = getContextItemDisplayInfo(item);
          return (
            <div
              key={key}
              data-testid="context-inspector-item"
              className="text-description flex items-center justify-between gap-2 py-0.5 pr-1 text-xs"
            >
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="truncate">{fileName}</span>
                {lines && (
                  <span className="text-description-muted flex-shrink-0">
                    {lines}
                  </span>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <span className="text-description-muted">
                  ~{estimateTokenCount(item.content)} tok
                </span>
                <button
                  type="button"
                  data-testid="context-inspector-item-remove"
                  aria-label={`Remove ${fileName} from context`}
                  onClick={() => dispatch(excludeContextItemKey(key))}
                  className="text-description-muted hover:text-foreground"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </ToggleDiv>
    </div>
  );
}
