import { Button } from "..";
import { getModelOptionsForProvider } from "../../util/recommendedModels";
import { OnboardingProvider } from "./onboardingProviders";

interface PickModelsStepProps {
  provider: OnboardingProvider;
  everydayKey: string | null;
  powerfulKey: string | null;
  onEverydayChange: (key: string) => void;
  onPowerfulChange: (key: string) => void;
  onBack: () => void;
  onComplete: () => void;
}

export function PickModelsStep({
  provider,
  everydayKey,
  powerfulKey,
  onEverydayChange,
  onPowerfulChange,
  onBack,
  onComplete,
}: PickModelsStepProps) {
  const { everyday, powerful } = getModelOptionsForProvider(provider.id);
  const canComplete = !!everydayKey && !!powerfulKey;

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Pick your models</h2>
      <p className="text-description mb-4 text-sm">
        Everyday handles autocomplete and simple questions cheaply and quickly.
        Powerful is used for complex tasks and agent mode.
      </p>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium">Everyday Model</label>
        <select
          data-testid="onboarding-everyday-select"
          className="bg-vsc-input-background text-vsc-foreground w-full rounded-md border border-none px-2 py-1.5 text-sm outline-none focus:outline-none"
          value={everydayKey ?? ""}
          onChange={(e) => onEverydayChange(e.target.value)}
        >
          <option value="" disabled>
            Select a model...
          </option>
          {everyday.map((option) => (
            <option key={option.key} value={option.key}>
              {option.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium">Powerful Model</label>
        <select
          data-testid="onboarding-powerful-select"
          className="bg-vsc-input-background text-vsc-foreground w-full rounded-md border border-none px-2 py-1.5 text-sm outline-none focus:outline-none"
          value={powerfulKey ?? ""}
          onChange={(e) => onPowerfulChange(e.target.value)}
        >
          <option value="" disabled>
            Select a model...
          </option>
          {powerful.map((option) => (
            <option key={option.key} value={option.key}>
              {option.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button type="button" onClick={onBack} className="bg-transparent">
          Back
        </Button>
        <Button
          type="button"
          data-testid="onboarding-start-coding"
          onClick={onComplete}
          disabled={!canComplete}
        >
          Start coding
        </Button>
      </div>
    </div>
  );
}
