/**
 * Garrison Phase application. §10.1. Declared first; applied before Phase 3 so
 * production uses this turn's garrison. Garrisoning is free.
 */

import type { TurnContext } from "../context.js";
import type { GarrisonAssignment } from "../orders.js";
import type { Building, Personnel, PersonnelType, Subdivision } from "../types.js";

function resetGarrison(sub: Subdivision): void {
  for (const b of sub.buildings) b.garrison = {};
  for (const v of sub.vehicles) v.crew = [];
  for (const p of sub.personnel) {
    if (p.status === "CAPTURED" || p.status === "LOST" || p.status === "UNHOUSED") continue;
    if (p.unavailableUntilTurn >= 0 && p.status === "GARRISONED") {
      // will be re-set below if reassigned
    }
    p.status = "AVAILABLE";
    p.assignedBuildingId = undefined;
    p.assignedVehicleId = undefined;
  }
}

export function applyGarrison(ctx: TurnContext): void {
  for (const validated of ctx.plan) {
    const sub = ctx.game.subdivisions.find((s) => s.id === validated.subdivisionId);
    if (!sub || sub.status !== "ACTIVE") continue;
    applyGarrisonForSubdivision(sub, validated.garrison, ctx.turnNumber);
  }
}

/**
 * Apply one subdivision's garrison assignments to `sub` in place, exactly as Phase 1
 * does at resolution: clear all current garrison/crew, then assign each valid entry.
 * This is the single application implementation `applyGarrison` (the full Phase-1
 * pipeline) delegates to; it is exported so callers that need Phase-1 garrison
 * semantics *outside* the pipeline — notably the orders composer's available-actions
 * preview (§22.9), which must reflect the draft's re-garrisoning before it evaluates
 * per-building actions (which run in Phase 4, after garrison) — get identical results
 * without reimplementing the rule.
 *
 * Best-effort / atomic-drop, mirroring how Phase 2 drops an INVALID garrison order
 * ([D-021]): an entry referencing a missing/CAPTURED/LOST/UNHOUSED/unavailable unit,
 * a missing/DERELICT building, a missing/DESTROYED vehicle, or a unit already placed
 * by an earlier entry, is **skipped**; the affected unit simply stays AVAILABLE (from
 * the initial reset). One bad entry never aborts the rest. When callers pass a
 * *validated* garrison list (as `applyGarrison` does) every entry passes and the
 * skips are inert.
 */
export function applyGarrisonForSubdivision(
  sub: Subdivision,
  assignments: readonly GarrisonAssignment[],
  turnNumber: number,
): void {
  resetGarrison(sub);
  const placed = new Set<number>();

  for (const g of assignments) {
    if (placed.has(g.unitId)) continue; // a unit already assigned by an earlier entry
    const unit = sub.personnel.find((p) => p.id === g.unitId);
    if (!unit) continue;
    if (unit.status === "CAPTURED" || unit.status === "LOST" || unit.status === "UNHOUSED") continue;
    if (unit.unavailableUntilTurn >= turnNumber) continue;

    const target = g.target;
    if (target.kind === "BUILDING") {
      const b = sub.buildings.find((x) => x.id === target.buildingId);
      if (!b || b.status === "DERELICT") continue;
      assignToBuilding(unit, b);
      placed.add(g.unitId);
    } else if (target.kind === "VEHICLE") {
      const v = sub.vehicles.find((x) => x.id === target.vehicleId);
      if (!v || v.status === "DESTROYED") continue;
      unit.status = "CREWING";
      unit.assignedVehicleId = v.id;
      v.crew.push(unit.id);
      placed.add(g.unitId);
    } else {
      // AVAILABLE: leave as reset.
      placed.add(g.unitId);
    }
  }
}

function assignToBuilding(unit: Personnel, b: Building): void {
  unit.status = "GARRISONED";
  unit.assignedBuildingId = b.id;
  const t = unit.type as PersonnelType;
  b.garrison[t] = (b.garrison[t] ?? 0) + 1;
}
