import { ONBOARDING_PROVIDERS } from "./onboardingProviders";

interface ChooseProviderStepProps {
  selectedProviderId: string | null;
  onSelect: (providerId: string) => void;
}

export function ChooseProviderStep({
  selectedProviderId,
  onSelect,
}: ChooseProviderStepProps) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Choose your AI provider</h2>
      <p className="text-description mb-4 text-sm">
        Pick where Mango should send your chat and autocomplete requests. You
        can always add more providers later.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ONBOARDING_PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            data-testid={`onboarding-provider-${provider.id}`}
            onClick={() => onSelect(provider.id)}
            className={`border-vsc-input-border bg-vsc-input-background hover:border-foreground flex items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
              selectedProviderId === provider.id
                ? "border-foreground"
                : "border-opacity-50"
            }`}
          >
            {window.vscMediaUrl && (
              <img
                src={`${window.vscMediaUrl}/logos/${provider.icon}`}
                alt=""
                className="h-5 w-5 flex-shrink-0 object-contain"
              />
            )}
            <span className="font-medium">{provider.displayName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
