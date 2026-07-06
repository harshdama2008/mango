import { OnboardingModes } from "core/protocol/core";
import { useContext, useEffect, useState } from "react";
import { useStore } from "react-redux";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useOnboardingCard } from "../OnboardingCard";
import { FULL_MODEL_ROLES } from "../../pages/config/components/ModelTierRow";
import { useAppDispatch } from "../../redux/hooks";
import { RootState } from "../../redux/store";
import {
  setEverydayModelKey,
  setPowerfulModelKey,
} from "../../redux/slices/uiSlice";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import {
  findRecommendedModel,
  getModelOptionsForProvider,
} from "../../util/recommendedModels";
import { ReusableCard } from "../ReusableCard";
import { ChooseProviderStep } from "./ChooseProviderStep";
import { ConnectStep } from "./ConnectStep";
import { getOnboardingProvider } from "./onboardingProviders";
import { PickModelsStep } from "./PickModelsStep";

// Config additions land in redux asynchronously (core reloads config and
// pushes a separate "configUpdate" message once it's done) - closing the
// wizard as soon as the addModel/updateSelectedModel requests are merely
// *accepted* can beat that push. If the user sends a message in that gap,
// Chat.tsx's sendInput finds no chat model selected yet and silently drops
// it. Wait for the real thing (with a generous timeout as a safety net) so
// the wizard never closes into a config-not-ready state.
const CONFIG_READY_TIMEOUT_MS = 8_000;
function waitForChatModelConfigured(
  store: ReturnType<typeof useStore<RootState>>,
): Promise<void> {
  if (store.getState().config.config?.selectedModelByRole?.chat) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve();
    }, CONFIG_READY_TIMEOUT_MS);
    const unsubscribe = store.subscribe(() => {
      if (store.getState().config.config?.selectedModelByRole?.chat) {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
  });
}

type WizardStep = 1 | 2 | 3;

export function OnboardingWizard() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const { selectedProfile } = useAuth();
  const { activeTab, close } = useOnboardingCard();

  const store = useStore<RootState>();

  const [step, setStep] = useState<WizardStep>(1);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [everydayKey, setEverydayKeyState] = useState<string | null>(null);
  const [powerfulKey, setPowerfulKeyState] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    if (getLocalStorage("onboardingStatus") === undefined) {
      setLocalStorage("onboardingStatus", "Started");
    }
  }, []);

  // "Set up Ollama" (from the command palette / Help menu) jumps straight to
  // the connect step with Ollama preselected, skipping provider choice.
  useEffect(() => {
    if (activeTab === OnboardingModes.LOCAL && !providerId) {
      setProviderId("ollama");
      preselectSoleModelOptions("ollama");
      setStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const provider = getOnboardingProvider(providerId ?? undefined);

  // Every onboarding provider currently offers exactly one everyday and one
  // powerful model - preselect the sole option instead of forcing a pointless
  // manual pick from a single-item dropdown. If a provider ever gains more
  // than one option, this just leaves it unselected as before.
  function preselectSoleModelOptions(id: string) {
    const { everyday, powerful } = getModelOptionsForProvider(id);
    setEverydayKeyState(everyday.length === 1 ? everyday[0].key : null);
    setPowerfulKeyState(powerful.length === 1 ? powerful[0].key : null);
  }

  function handleSelectProvider(id: string) {
    setProviderId(id);
    // Each provider has its own API key and its own everyday/powerful model
    // options - clear the previous provider's selections so going back and
    // picking a different provider can't submit a stale, mismatched
    // combination (e.g. an old provider's API key attached to a new
    // provider's model, or vice versa).
    setApiKey("");
    preselectSoleModelOptions(id);
    setStep(2);
  }

  async function completeOnboarding() {
    if (!provider || isCompleting) {
      return;
    }
    setIsCompleting(true);

    // Defense in depth: only accept selections that actually belong to the
    // currently chosen provider, in case anything leaves stale state (e.g.
    // going back and picking a different provider).
    const belongsToProvider = (m: ReturnType<typeof findRecommendedModel>) =>
      !!m && m.provider === provider.id;
    const everyday = findRecommendedModel(everydayKey);
    const powerful = findRecommendedModel(powerfulKey);
    const validEveryday = belongsToProvider(everyday) ? everyday : undefined;
    const validPowerful = belongsToProvider(powerful) ? powerful : undefined;
    const chosen = [validEveryday, validPowerful].filter(
      (m): m is NonNullable<typeof m> => !!m,
    );

    try {
      const added = new Set<string>();
      for (const rec of chosen) {
        const dedupeKey = `${rec.provider}:${rec.model}`;
        if (added.has(dedupeKey)) {
          continue;
        }
        added.add(dedupeKey);

        const model = {
          provider: rec.provider,
          model: rec.model,
          title: rec.displayName,
          underlyingProviderName: rec.provider,
          ...(provider.isLocal ? {} : { apiKey }),
          roles: FULL_MODEL_ROLES,
        };
        await ideMessenger.request("config/addModel", { model });
      }

      ideMessenger.post("config/openProfile", { profileId: "local" });

      if (selectedProfile && validEveryday) {
        await ideMessenger.request("config/updateSelectedModel", {
          profileId: selectedProfile.id,
          role: "chat",
          title: validEveryday.displayName,
        });
      }

      dispatch(setEverydayModelKey(everydayKey));
      dispatch(setPowerfulModelKey(powerfulKey));

      // Don't close until the chat model this wizard just configured has
      // actually landed in redux - otherwise the user can send a message
      // into the gap where selectedModelByRole.chat is still unset.
      if (chosen.length > 0) {
        await waitForChatModelConfigured(store);
      }

      setLocalStorage("onboardingStatus", "Completed");
      close();
    } finally {
      setIsCompleting(false);
    }
  }

  function handleSkip() {
    close();
  }

  return (
    // The close-X and "Skip for now" used to be two controls doing the exact
    // same thing - keep only the labeled link, which is more discoverable
    // for a first-time user than an icon-only X.
    <ReusableCard testId="onboarding-wizard">
      <div className="mx-auto max-w-md py-4">
        <div className="mb-4 flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 w-8 rounded-full ${
                s <= step ? "bg-foreground" : "bg-vsc-input-background"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <ChooseProviderStep
            selectedProviderId={providerId}
            onSelect={handleSelectProvider}
          />
        )}

        {step === 2 && provider && (
          <ConnectStep
            provider={provider}
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && provider && (
          <PickModelsStep
            provider={provider}
            everydayKey={everydayKey}
            powerfulKey={powerfulKey}
            onEverydayChange={setEverydayKeyState}
            onPowerfulChange={setPowerfulKeyState}
            onBack={() => setStep(2)}
            onComplete={completeOnboarding}
            isCompleting={isCompleting}
          />
        )}

        <div className="mt-4 text-center">
          <span
            className="text-description-muted cursor-pointer text-xs underline hover:brightness-125"
            onClick={handleSkip}
            data-testid="onboarding-skip"
          >
            Skip for now
          </span>
        </div>
      </div>
    </ReusableCard>
  );
}
