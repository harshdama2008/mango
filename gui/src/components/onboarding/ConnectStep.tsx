import { useContext, useState } from "react";
import { Button, Input } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { OnboardingProvider } from "./onboardingProviders";

interface ConnectStepProps {
  provider: OnboardingProvider;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}

type TestState = "idle" | "testing" | "success" | "error";

export function ConnectStep({
  provider,
  apiKey,
  onApiKeyChange,
  onBack,
  onNext,
}: ConnectStepProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMessage, setTestMessage] = useState("");

  async function handleTestOllama() {
    setTestState("testing");
    try {
      const result = await ideMessenger.request("llm/listModels", {
        title: "Ollama",
      });
      if (result.status === "success" && result.content) {
        setTestState("success");
        setTestMessage("Ollama is running at http://localhost:11434.");
      } else {
        setTestState("error");
        setTestMessage(
          "Couldn't reach Ollama at http://localhost:11434 - make sure it's running.",
        );
      }
    } catch {
      setTestState("error");
      setTestMessage(
        "Couldn't reach Ollama at http://localhost:11434 - make sure it's running.",
      );
    }
  }

  async function handleTestCloudProvider() {
    setTestState("testing");
    const result = await ideMessenger.request("llm/testConnection", {
      provider: provider.id,
      apiKey,
    });
    if (result.status === "success" && result.content.success) {
      setTestState("success");
      setTestMessage(result.content.message);
    } else {
      setTestState("error");
      setTestMessage(
        result.status === "success"
          ? result.content.message
          : "Connection test failed.",
      );
    }
  }

  const canContinue = provider.isLocal || apiKey.trim().length > 0;

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">
        Connect to {provider.displayName}
      </h2>

      {provider.isLocal ? (
        <p className="text-description mb-4 text-sm">
          Make sure{" "}
          <a
            href={provider.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-inherit underline hover:brightness-125"
          >
            Ollama
          </a>{" "}
          is installed and running locally, then test the connection.
        </p>
      ) : (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium">API key</label>
          <Input
            type="password"
            data-testid="onboarding-api-key-input"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={`Enter your ${provider.displayName} API key`}
            className="w-full"
          />
          {provider.apiKeyUrl && (
            <span className="text-description-muted mt-1 block text-xs">
              <a
                href={provider.apiKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer text-inherit underline hover:brightness-125"
              >
                Click here
              </a>{" "}
              to create a {provider.displayName} API key
            </span>
          )}
        </div>
      )}

      <Button
        type="button"
        data-testid="onboarding-test-connection"
        onClick={provider.isLocal ? handleTestOllama : handleTestCloudProvider}
        disabled={testState === "testing" || !canContinue}
        className="w-full"
      >
        {testState === "testing"
          ? "Testing…"
          : provider.isLocal
            ? "Test local connection"
            : "Test connection"}
      </Button>

      {testState === "success" && (
        <p
          className="text-success mt-2 text-xs"
          data-testid="onboarding-test-success"
        >
          ✓ {testMessage}
        </p>
      )}
      {testState === "error" && (
        <p
          className="text-error mt-2 text-xs"
          data-testid="onboarding-test-error"
        >
          ✗ {testMessage}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button type="button" onClick={onBack} className="bg-transparent">
          Back
        </Button>
        <Button
          type="button"
          data-testid="onboarding-connect-continue"
          onClick={onNext}
          disabled={!canContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
