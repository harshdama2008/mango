import { OnboardingModes } from "core/protocol/core";
import { useContext, useEffect, useState } from "react";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useOnboardingCard } from "../OnboardingCard";
import { FULL_MODEL_ROLES } from "../../pages/config/components/ModelTierRow";
import { useAppDispatch } from "../../redux/hooks";
import {
  setEverydayModelKey,
  setPowerfulModelKey,
} from "../../redux/slices/uiSlice";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { findRecommendedModel } from "../../util/recommendedModels";
import { ReusableCard } from "../ReusableCard";
import { ChooseProviderStep } from "./ChooseProviderStep";
import { ConnectStep } from "./ConnectStep";
import { getOnboardingProvider } from "./onboardingProviders";
import { PickModelsStep } from "./PickModelsStep";

type WizardStep = 1 | 2 | 3;

export function OnboardingWizard() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const { selectedProfile } = useAuth();
  const { activeTab, close } = useOnboardingCard();

  const [step, setStep] = useState<WizardStep>(1);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [everydayKey, setEverydayKeyState] = useState<string | null>(null);
  const [powerfulKey, setPowerfulKeyState] = useState<string | null>(null);

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
      setStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const provider = getOnboardingProvider(providerId ?? undefined);

  function handleSelectProvider(id: string) {
    setProviderId(id);
    setStep(2);
  }

  function completeOnboarding() {
    if (!provider) {
      return;
    }

    const everyday = findRecommendedModel(everydayKey);
    const powerful = findRecommendedModel(powerfulKey);
    const chosen = [everyday, powerful].filter(
      (m): m is NonNullable<typeof m> => !!m,
    );

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
      ideMessenger.post("config/addModel", { model });
    }

    ideMessenger.post("config/openProfile", { profileId: "local" });

    if (selectedProfile && everyday) {
      ideMessenger.post("config/updateSelectedModel", {
        profileId: selectedProfile.id,
        role: "chat",
        title: everyday.displayName,
      });
    }

    dispatch(setEverydayModelKey(everydayKey));
    dispatch(setPowerfulModelKey(powerfulKey));

    setLocalStorage("onboardingStatus", "Completed");
    close();
  }

  function handleSkip() {
    close();
  }

  return (
    <ReusableCard
      showCloseButton
      onClose={handleSkip}
      testId="onboarding-wizard"
    >
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
