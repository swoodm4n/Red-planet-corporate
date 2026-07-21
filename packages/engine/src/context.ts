/**
 * Per-turn processing context shared across phases.
 */

import type { Rng } from "./rng.js";
import type { Game, ResourceBundle } from "./types.js";
import type {
  BuildingActionOrder,
  CorporateActionOrder,
  GarrisonAssignment,
  InvalidOrder,
  LogEntry,
  PoliticalActionOrder,
  Submission,
  UnitActionOrder,
} from "./orders.js";

export interface ValidatedSubmission {
  subdivisionId: number;
  garrison: GarrisonAssignment[];
  buildingActions: BuildingActionOrder[];
  unitActions: UnitActionOrder[];
  politicalAction?: PoliticalActionOrder;
  corporateActions: CorporateActionOrder[];
  raw: Submission;
}

export interface TurnContext {
  game: Game;
  rng: Rng;
  turnNumber: number;
  log: LogEntry[];
  invalidOrders: InvalidOrder[];
  /** Turn-start resource snapshot per subdivision id (for validation vs. §2). */
  turnStartResources: Map<number, ResourceBundle>;
  plan: ValidatedSubmission[];
  /**
   * §22 attention reservations: accepted building/unit action order -> the exact
   * personnel ids whose attention it will spend. Keyed by the order object
   * reference (stable from submission through validated plan into Phase 4/5).
   * Phase 4/5 read this to set `attentionSpentThisTurn` on execution. [D-057]
   */
  attentionPicks: Map<BuildingActionOrder | UnitActionOrder, number[]>;
  /** Per-turn transient counters that don't belong in persistent state. */
  scratch: {
    /** units sold per Transit Hub this turn (cap tracking). */
    hubSalesThisTurn: Map<number, number>;
    /** subdivisions that took Amplify Credit Yield this turn. */
    amplifyActive: Set<number>;
    /** subdivisions with an active Lockdown/auto-defend this turn (building id set). */
    autoDefendBuildings: Set<number>;
  };
}

export function logEntry(ctx: TurnContext, entry: LogEntry): void {
  ctx.log.push(entry);
}
