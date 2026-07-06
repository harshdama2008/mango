import { Button } from "..";
import { useOnboardingCard } from "../OnboardingCard";
import { getLocalStorage } from "../../util/localStorage";

/**
 * Shown when the user dismissed first-run onboarding ("Skip for now")
 * without ever completing it. Hidden once onboarding is completed, and
 * hidden while the wizard itself is showing (avoid double-prompting).
 */
export function CompleteSetupBanner() {
  const { show: wizardShowing, open } = useOnboardingCard();

  const onboardingStatus = getLocalStorage("onboardingStatus");
  const hasDismissed = getLocalStorage("hasDismissedOnboardingCard");

  const shouldShow =
    !wizardShowing && onboardingStatus !== "Completed" && !!hasDismissed;

  if (!shouldShow) {
    return null;
  }

  return (
    <div
      data-testid="complete-setup-banner"
      className="border-vsc-input-border bg-vsc-input-background mb-2 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
    >
      <span>Finish setting up Mango to start coding.</span>
      <Button
        type="button"
        data-testid="complete-setup-banner-button"
        onClick={() => open()}
        className="flex-shrink-0"
      >
        Complete setup
      </Button>
    </div>
  );
}
