export interface OnboardingProvider {
  id: string;
  displayName: string;
  icon: string;
  isLocal: boolean;
  apiKeyUrl?: string;
  downloadUrl?: string;
}

/** The 5 providers offered in the first-run onboarding wizard - a small,
 * curated subset of the full provider catalog in
 * gui/src/pages/AddNewModel/configs/providers.ts, since onboarding is meant
 * to get someone coding quickly, not replace the full "Add Model" flow. */
export const ONBOARDING_PROVIDERS: OnboardingProvider[] = [
  {
    id: "anthropic",
    displayName: "Anthropic",
    icon: "anthropic.png",
    isLocal: false,
    apiKeyUrl: "https://console.anthropic.com/account/keys",
  },
  {
    id: "openai",
    displayName: "OpenAI",
    icon: "openai.png",
    isLocal: false,
    apiKeyUrl: "https://platform.openai.com/account/api-keys",
  },
  {
    id: "gemini",
    displayName: "Google",
    icon: "gemini.png",
    isLocal: false,
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "openrouter",
    displayName: "OpenRouter",
    icon: "openrouter.png",
    isLocal: false,
    apiKeyUrl: "https://openrouter.ai/settings/keys",
  },
  {
    id: "ollama",
    displayName: "Ollama (local)",
    icon: "ollama.png",
    isLocal: true,
    downloadUrl: "https://ollama.ai/download",
  },
];

export function getOnboardingProvider(
  id: string | undefined,
): OnboardingProvider | undefined {
  return ONBOARDING_PROVIDERS.find((p) => p.id === id);
}
