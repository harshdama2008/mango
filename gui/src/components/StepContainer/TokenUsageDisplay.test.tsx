import { render, screen } from "@testing-library/react";
import { PromptLog } from "core";
import TokenUsageDisplay from "./TokenUsageDisplay";

function log(overrides: Partial<PromptLog> = {}): PromptLog {
  return {
    modelTitle: "claude-sonnet-4-6",
    modelProvider: "anthropic",
    prompt: "",
    completion: "",
    ...overrides,
  };
}

describe("TokenUsageDisplay", () => {
  it("renders nothing when there are no promptLogs", () => {
    const { container } = render(<TokenUsageDisplay promptLogs={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when no entries have usage", () => {
    const { container } = render(<TokenUsageDisplay promptLogs={[log()]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows model, token counts, and cost when usage is present", () => {
    render(
      <TokenUsageDisplay
        promptLogs={[
          log({
            usage: {
              promptTokens: 1000,
              completionTokens: 500,
            },
          }),
        ]}
      />,
    );

    const el = screen.getByTestId("token-usage-display");
    expect(el.textContent).toContain("claude-sonnet-4-6");
    expect(el.textContent).toContain("1,000 in");
    expect(el.textContent).toContain("500 out");
    expect(el.textContent).toContain("$0.01"); // 1000/1M*3 + 500/1M*15 = 0.0105, rounded to 2dp
  });

  it("sums usage across multiple entries and lists distinct models", () => {
    render(
      <TokenUsageDisplay
        promptLogs={[
          log({
            modelTitle: "claude-sonnet-4-6",
            usage: { promptTokens: 100, completionTokens: 50 },
          }),
          log({
            modelTitle: "claude-opus-4-6",
            usage: { promptTokens: 200, completionTokens: 100 },
          }),
        ]}
      />,
    );

    const el = screen.getByTestId("token-usage-display");
    expect(el.textContent).toContain("claude-sonnet-4-6, claude-opus-4-6");
    expect(el.textContent).toContain("300 in");
    expect(el.textContent).toContain("150 out");
  });

  it("still shows token counts when cost is unavailable for the model", () => {
    render(
      <TokenUsageDisplay
        promptLogs={[
          log({
            modelProvider: "ollama",
            modelTitle: "llama3.1:8b",
            usage: { promptTokens: 42, completionTokens: 8 },
          }),
        ]}
      />,
    );

    const el = screen.getByTestId("token-usage-display");
    expect(el.textContent).toContain("42 in");
    expect(el.textContent).toContain("8 out");
    expect(el.textContent).not.toContain("$");
  });
});
