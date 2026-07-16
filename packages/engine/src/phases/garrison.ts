/**
 * Garrison Phase application. §10.1. Declared first; applied before Phase 3 so
 * production uses this turn's garrison. Garrisoning is free.
 */

import type { TurnContext } from "../context.js";
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
    resetGarrison(sub);

    for (const g of validated.garrison) {
      const unit = sub.personnel.find((p) => p.id === g.unitId);
      if (!unit) continue;
      if (unit.status === "CAPTURED" || unit.status === "LOST" || unit.status === "UNHOUSED") continue;
      if (unit.unavailableUntilTurn >= ctx.turnNumber) continue;

      const target = g.target;
      if (target.kind === "BUILDING") {
        const bid = target.buildingId;
        const b = sub.buildings.find((x) => x.id === bid);
        if (!b) continue;
        assignToBuilding(unit, b);
      } else if (target.kind === "VEHICLE") {
        const vid = target.vehicleId;
        const v = sub.vehicles.find((x) => x.id === vid);
        if (!v || v.status === "DESTROYED") continue;
        unit.status = "CREWING";
        unit.assignedVehicleId = v.id;
        v.crew.push(unit.id);
      }
      // AVAILABLE: leave as-is.
    }
  }
}

function assignToBuilding(unit: Personnel, b: Building): void {
  unit.status = "GARRISONED";
  unit.assignedBuildingId = b.id;
  const t = unit.type as PersonnelType;
  b.garrison[t] = (b.garrison[t] ?? 0) + 1;
}
