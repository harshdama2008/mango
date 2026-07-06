import { render, screen } from "@testing-library/react";
import { SessionCostSummary } from "../../util/costDashboard";
import { SessionRow } from "./SessionRow";

function session(overrides: Partial<SessionCostSummary>): SessionCostSummary {
  return {
    sessionId: "session-1",
    sessionTitle: "My Session",
    lastActivity: Date.now(),
    messageCount: 3,
    pricedMessageCount: 3,
    totalCost: 0.05,
    ...overrides,
  };
}

describe("SessionRow", () => {
  it("says 'N priced responses' when every response has pricing data", () => {
    render(
      <SessionRow
        session={session({ messageCount: 3, pricedMessageCount: 3 })}
      />,
    );
    expect(screen.getByText(/3 priced responses/)).toBeInTheDocument();
  });

  it("does not claim 'priced' when no response has pricing data (e.g. an Ollama-only session)", () => {
    render(
      <SessionRow
        session={session({ messageCount: 3, pricedMessageCount: 0 })}
      />,
    );
    expect(screen.queryByText(/priced/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/3 responses \(no pricing data\)/),
    ).toBeInTheDocument();
  });

  it("shows a mixed count when only some responses have pricing data", () => {
    render(
      <SessionRow
        session={session({ messageCount: 3, pricedMessageCount: 1 })}
      />,
    );
    expect(screen.getByText(/3 responses \(1 priced\)/)).toBeInTheDocument();
  });

  it("uses singular 'response' for a single message", () => {
    render(
      <SessionRow
        session={session({ messageCount: 1, pricedMessageCount: 1 })}
      />,
    );
    expect(screen.getByText(/1 priced response\b/)).toBeInTheDocument();
  });
});
