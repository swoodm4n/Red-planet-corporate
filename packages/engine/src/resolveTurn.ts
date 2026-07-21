/**
 * Public entry point: resolveTurn(state, submissions) -> { newState, turnLog }.
 * GAME_SPEC §16. Deterministic: identical inputs + seed reproduce byte-identical
 * output. The input `state` is never mutated (deep-cloned first).
 */

import { cloneGame } from "./clone.js";
import type { TurnContext } from "./context.js";
import { adjustEr } from "./earthRelations.js";
import { addResourceCapped, housingCapacity } from "./helpers.js";
import { makeTurnRng } from "./rng.js";
import { applyGarrison } from "./phases/garrison.js";
import { runPhase3 } from "./phases/phase3.js";
import { runPhase4 } from "./phases/phase4.js";
import { runPhase5 } from "./phases/phase5.js";
import { runPhase6 } from "./phases/phase6.js";
import { runPhase7 } from "./phases/phase7.js";
import { runPhase8 } from "./phases/phase8.js";
import { validateGarrisonPhase, validateActionsPhase } from "./validation.js";
import type { Submission, TurnLog } from "./orders.js";
import type { Game, ResourceBundle } from "./types.js";

export interface ResolveResult {
  newState: Game;
  turnLog: TurnLog;
}

/** Admin actions queued for the start of a turn (retirement). §16 P1 / [D-032]. */
export interface AdminActions {
  retireSubdivisionIds?: number[];
}

export function resolveTurn(
  state: Game,
  submissions: Submission[],
  admin?: AdminActions,
): ResolveResult {
  const game = cloneGame(state);
  const turnNumber = game.turnNumber;
  const rng = makeTurnRng(game.gameSeed, turnNumber);

  const ctx: TurnContext = {
    game,
    rng,
    turnNumber,
    log: [],
    invalidOrders: [],
    turnStartResources: new Map(),
    plan: [],
    attentionPicks: new Map(),
    scratch: {
      hubSalesThisTurn: new Map(),
      amplifyActive: new Set(),
      autoDefendBuildings: new Set(),
    },
  };

  // ---- Start-of-turn (before Phase 2). [D-038] ----
  prepareTurnStart(ctx, admin);

  // Snapshot turn-start resources for validation (§2 affordability). [D-021]
  for (const sub of game.subdivisions) {
    if (sub.status !== "ACTIVE") continue;
    ctx.turnStartResources.set(sub.id, { ...sub.resources } as ResourceBundle);
  }

  // ---- Phase 2 (garrison) + garrison application + Phase 2 (actions) ----
  // Garrison is validated and applied first so action validation's operational
  // checks reflect this turn's declared garrison. [D-012]
  validateGarrisonPhase(ctx, submissions);
  applyGarrison(ctx);
  validateActionsPhase(ctx, submissions);

  // ---- Phases 3..8 ----
  runPhase3(ctx);
  runPhase4(ctx);
  runPhase5(ctx);
  runPhase6(ctx);
  const event = runPhase7(ctx);
  const report = runPhase8(ctx);

  const turnLog: TurnLog = {
    turnNumber,
    entries: ctx.log,
    invalidOrders: ctx.invalidOrders,
    event,
    scoreboard: report.scoreboard,
    categoryLeaders: report.categoryLeaders,
  };

  return { newState: game, turnLog };
}

// ---- Start-of-turn helpers -------------------------------------------------

/**
 * Runs the deterministic start-of-turn mutations (retirements, PENDING→ACTIVE
 * activation, resupply/colonist arrivals, housing overflow) that precede Phase 2
 * validation [D-038]. Exported so the backend's submission-time validator can
 * mirror the exact pre-validation state the engine will see at resolution. [D-043]
 */
export function prepareTurnStart(ctx: TurnContext, admin?: AdminActions): void {
  processRetirements(ctx, admin?.retireSubdivisionIds ?? []);
  activatePending(ctx);
  processResupplyArrivals(ctx);
  processColonistArrivals(ctx);
  applyHousingOverflow(ctx);
}

function processRetirements(ctx: TurnContext, ids: number[]): void {
  for (const id of ids) {
    const sub = ctx.game.subdivisions.find((s) => s.id === id);
    if (!sub || sub.status === "RETIRED") continue;
    sub.status = "RETIRED";
    // Buildings derelict, hexes unclaimed. [D-032]
    for (const b of sub.buildings) b.status = "DERELICT";
    for (const h of ctx.game.map) if (h.ownerSubdivisionId === id) h.ownerSubdivisionId = undefined;
    sub.personnel = [];
    sub.vehicles = [];
    // Captives held by this subdivision are released back to their owners. [D-032]
    for (const captive of sub.capturedUnits) {
      const owner = ctx.game.subdivisions.find((s) => s.id === captive.assignedBuildingId);
      void owner; // ownership of captives is admin-tracked; simply free them.
      captive.status = "AVAILABLE";
    }
    sub.capturedUnits = [];
    ctx.log.push({ phase: 1, subdivisionId: id, code: "RETIRED", message: `Subdivision ${id} retired` });
  }
}

function activatePending(ctx: TurnContext): void {
  for (const sub of ctx.game.subdivisions) {
    if (sub.status !== "ACTIVE") continue;
    for (const b of sub.buildings) {
      // Reset the per-turn non-operational flag from last turn's upkeep shortfall.
      b.nonOperationalNextTurn = false;
      if (b.status === "PENDING") b.status = "ACTIVE";
      for (const m of b.modules) if (m.status === "PENDING") m.status = "ACTIVE";
    }
    for (const v of sub.vehicles) {
      if (v.status === "PENDING") v.status = "ACTIVE";
      for (const m of v.modules) if (m.status === "PENDING") m.status = "ACTIVE";
    }
  }
}

function processResupplyArrivals(ctx: TurnContext): void {
  const remaining = [];
  for (const mission of ctx.game.resupplyMissions) {
    if (mission.arriveOnTurn === ctx.turnNumber) {
      const sub = ctx.game.subdivisions.find((s) => s.id === mission.subdivisionId);
      if (sub && sub.status === "ACTIVE") {
        addResourceCapped(sub, mission.resource, mission.quantity);
        ctx.log.push({ phase: 1, subdivisionId: sub.id, code: "RESUPPLY_ARRIVED", message: `Resupply +${mission.quantity} ${mission.resource}`, data: { kind: mission.kind } });
      }
    } else if (mission.arriveOnTurn > ctx.turnNumber) {
      remaining.push(mission);
    }
  }
  ctx.game.resupplyMissions = remaining;
}

function processColonistArrivals(ctx: TurnContext): void {
  for (const sub of ctx.game.subdivisions) {
    if (sub.status !== "ACTIVE") continue;
    for (const p of sub.personnel) {
      if (p.arrivalTurn != null && p.arrivalTurn <= ctx.turnNumber) {
        p.arrivalTurn = undefined;
        p.requisitionType = undefined;
        p.unavailableUntilTurn = 0;
        p.status = "AVAILABLE";
        ctx.log.push({ phase: 1, subdivisionId: sub.id, code: "COLONIST_ARRIVED", message: `Colonist ${p.id} (${p.type}) arrived` });
      }
    }
  }
}

/** Housing overflow: excess (highest ids) flagged UNHOUSED, -2 ER/turn. [D-023] */
function applyHousingOverflow(ctx: TurnContext): void {
  for (const sub of ctx.game.subdivisions) {
    if (sub.status !== "ACTIVE") continue;
    const cap = housingCapacity(sub);
    const present = sub.personnel
      .filter((p) => p.status !== "LOST" && p.status !== "CAPTURED" && !(p.arrivalTurn != null && p.arrivalTurn > ctx.turnNumber))
      .sort((a, b) => a.id - b.id);
    // Re-house everyone first.
    for (const p of present) if (p.status === "UNHOUSED") p.status = "AVAILABLE";
    if (present.length > cap) {
      const excess = present.slice(cap);
      for (const p of excess) p.status = "UNHOUSED";
      adjustEr(sub, -2);
      ctx.log.push({ phase: 1, subdivisionId: sub.id, code: "OVER_HOUSED", message: `${excess.length} unit(s) unhoused (-2 ER)`, data: { count: excess.length } });
    }
  }
}
