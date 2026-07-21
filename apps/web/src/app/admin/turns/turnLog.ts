// Display-only helpers for rendering an admin turn-resolution log. No game logic:
// the engine (@rpc/engine) produces the TurnLog; this file only labels/groups it
// for the GM console. Types mirror the engine `TurnLog` shape returned by
// GET /api/games/:id/turns/:turnNumber for an admin.

import { titleCase } from "@/lib/client/labels";

export interface LogEntry {
  phase: number;
  subdivisionId?: number;
  code: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface InvalidOrder {
  subdivisionId: number;
  kind: "GARRISON" | "BUILDING" | "UNIT" | "POLITICAL" | "CORPORATE";
  reason: string;
  order: unknown;
}

export interface TurnEvent {
  scope: "COLONY" | "REGIONAL" | "SUBDIVISION" | "NONE";
  name: string;
  message: string;
  affectedSubdivisionIds: number[];
}

export interface ScoreboardRow {
  subdivisionId: number;
  categories: Record<string, number>;
  composite: number;
  rank: number;
}

/** Full engine TurnLog (admin `log` field). */
export interface TurnLogFull {
  turnNumber: number;
  entries: LogEntry[];
  invalidOrders: InvalidOrder[];
  event?: TurnEvent | null;
  scoreboard: ScoreboardRow[];
  categoryLeaders: Record<string, number | null>;
}

/** Admin detail response from GET /api/games/:id/turns/:turnNumber. */
export interface TurnDetailResponse {
  gameId: number;
  turnNumber: number;
  log: TurnLogFull;
  scoreboard: { scoreboard: ScoreboardRow[]; categoryLeaders: Record<string, number | null> };
  event: TurnEvent | null;
}

/** One row in GET /api/games/:id/turns index. */
export interface TurnIndexRow {
  turnNumber: number;
  eventJson: TurnEvent | null;
  scoreboardJson: { scoreboard: ScoreboardRow[]; categoryLeaders: Record<string, number | null> } | null;
  createdAt: string;
}

export interface TurnIndexResponse {
  gameId: number;
  turns: TurnIndexRow[];
}

/** Human titles for each resolution phase, in canonical order. §16. */
export const PHASE_META: Record<number, { title: string; blurb: string }> = {
  1: { title: "Start of Turn", blurb: "Retirements, activations, resupply & colonist arrivals, housing." },
  2: { title: "Garrison & Validation", blurb: "Declared garrison applied; order validation." },
  3: { title: "Passive Systems", blurb: "Production, research, income, dividends, upkeep, attrition." },
  4: { title: "Building Actions", blurb: "Boost, sales, requisition, claims, transfers, vehicles." },
  5: { title: "Unit Actions", blurb: "Construction, survey, sabotage, intercept, trades, movement, combat." },
  6: { title: "Political & Corporate Actions", blurb: "Motions, votes, agreements, acquisitions, resupply." },
  7: { title: "Event Roll", blurb: "Colony/regional/subdivision event resolution." },
  8: { title: "Reporting & Scoring", blurb: "Market & equity re-pricing, ER accrual, scoreboard." },
};

export const CATEGORY_ORDER = [
  "economic",
  "industrial",
  "research",
  "territorial",
  "security",
  "intelligence",
] as const;

/** Group log entries by phase, preserving order and skipping empty phases. */
export function groupByPhase(entries: LogEntry[]): { phase: number; entries: LogEntry[] }[] {
  const byPhase = new Map<number, LogEntry[]>();
  for (const e of entries) {
    const list = byPhase.get(e.phase) ?? [];
    list.push(e);
    byPhase.set(e.phase, list);
  }
  return [...byPhase.keys()]
    .sort((a, b) => a - b)
    .map((phase) => ({ phase, entries: byPhase.get(phase)! }));
}

/** Colour class for a log-entry code — red for failures, amber for warnings/costs. */
export function codeTone(code: string): string {
  const c = code.toUpperCase();
  if (/(FAILED|INVALID|UNAFFORDABLE|BLOCKED|STARVATION|OUT_OF_RANGE|NO_TARGET|DAMAGE|CONTESTED|COLLISION|OVERFLOW)/.test(c)) {
    return "badge-red";
  }
  if (/(SUCCESS|ARRIVED|UPGRADE|MILESTONE|CONSTRUCT_BUILDING|PLACE_OUTPOST)/.test(c)) {
    return "badge-green";
  }
  if (/(EVENT|MICROMETEORITE|CAPTURED|SPOTTED|RETIRED|UNHOUSED|OVER_HOUSED)/.test(c)) {
    return "badge-amber";
  }
  return "badge-cyan";
}

export function eventScopeTone(scope: string): string {
  switch (scope) {
    case "COLONY": return "badge-red";
    case "REGIONAL": return "badge-amber";
    case "SUBDIVISION": return "badge-violet";
    default: return "badge-dim";
  }
}

export function codeLabel(code: string): string {
  return titleCase(code);
}
