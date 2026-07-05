import { CostDashboardEvent } from "core";

export interface SessionCostSummary {
  sessionId: string;
  sessionTitle: string;
  /** Timestamp of the most recent event recorded for this session */
  lastActivity: number;
  messageCount: number;
  totalCost: number;
}

export interface ModelCostSummary {
  modelProvider: string;
  modelTitle: string;
  totalCost: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  responseCount: number;
}

export interface CostDashboardSummary {
  totalToday: number;
  totalThisWeek: number;
  totalThisMonth: number;
  sessions: SessionCostSummary[];
  models: ModelCostSummary[];
  mostExpensiveSession: SessionCostSummary | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;

export function summarizeCostEvents(
  events: CostDashboardEvent[],
  now: number = Date.now(),
): CostDashboardSummary {
  let totalToday = 0;
  let totalThisWeek = 0;
  let totalThisMonth = 0;

  const sessionsById = new Map<string, SessionCostSummary>();
  const modelsByKey = new Map<string, ModelCostSummary>();

  for (const event of events) {
    const age = now - event.timestamp;
    if (age <= DAY_MS) {
      totalToday += event.cost;
    }
    if (age <= WEEK_MS) {
      totalThisWeek += event.cost;
    }
    if (age <= MONTH_MS) {
      totalThisMonth += event.cost;
    }

    const session = sessionsById.get(event.sessionId);
    if (session) {
      session.totalCost += event.cost;
      session.messageCount += 1;
      // Session titles can change after events are recorded (renames); keep
      // whichever title came from the most recent event.
      if (event.timestamp >= session.lastActivity) {
        session.sessionTitle = event.sessionTitle;
        session.lastActivity = event.timestamp;
      }
    } else {
      sessionsById.set(event.sessionId, {
        sessionId: event.sessionId,
        sessionTitle: event.sessionTitle,
        lastActivity: event.timestamp,
        messageCount: 1,
        totalCost: event.cost,
      });
    }

    const modelKey = `${event.modelProvider}::${event.modelTitle}`;
    const model = modelsByKey.get(modelKey);
    if (model) {
      model.totalCost += event.cost;
      model.totalPromptTokens += event.promptTokens;
      model.totalCompletionTokens += event.completionTokens;
      model.responseCount += 1;
    } else {
      modelsByKey.set(modelKey, {
        modelProvider: event.modelProvider,
        modelTitle: event.modelTitle,
        totalCost: event.cost,
        totalPromptTokens: event.promptTokens,
        totalCompletionTokens: event.completionTokens,
        responseCount: 1,
      });
    }
  }

  const sessions = Array.from(sessionsById.values()).sort(
    (a, b) => b.lastActivity - a.lastActivity,
  );

  const models = Array.from(modelsByKey.values()).sort(
    (a, b) => b.totalCost - a.totalCost,
  );

  const mostExpensiveSession = sessions.reduce<SessionCostSummary | null>(
    (max, session) =>
      !max || session.totalCost > max.totalCost ? session : max,
    null,
  );

  return {
    totalToday,
    totalThisWeek,
    totalThisMonth,
    sessions,
    models,
    mostExpensiveSession,
  };
}
