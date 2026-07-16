/**
 * Phase 5 — Unit Actions. §16, §10.3, §14 / [D-017], [D-018], [D-022], [D-028].
 * Non-conflict actions resolve simultaneously (greedy, ascending id). Conflicts
 * (Sabotage, Intercept) and spotting consume the seeded stream in the §15 step-2
 * canonical order: (targetSubdivisionId, targetHex, attackerSubdivisionId, decl).
 */

import { BUILDINGS, MODULES, TIER_UPGRADE_COST } from "../constants.js";
import type { TurnContext } from "../context.js";
import { resolveConflict } from "../conflict.js";
import { countActiveModule, addResourceCapped } from "../helpers.js";
import { getHex, hexDistance, rowMajorIndex, sameCoord } from "../map.js";
import { terrainBuildMineralSurcharge } from "../map.js";
import type { UnitActionOrder } from "../orders.js";
import type { Building, Personnel, ResourceBundle, Subdivision } from "../types.js";

export function runPhase5(ctx: TurnContext): void {
  const sorted = [...ctx.plan].sort((a, b) => a.subdivisionId - b.subdivisionId);

  // --- Sub-step 1: non-conflict actions (simultaneous, greedy) ---
  const outpostPlacements: { sub: Subdivision; order: UnitActionOrder }[] = [];
  for (const vs of sorted) {
    const sub = getSub(ctx, vs.subdivisionId);
    if (!sub) continue;
    for (const order of vs.unitActions) {
      switch (order.action) {
        case "PLACE_OUTPOST":
          outpostPlacements.push({ sub, order });
          break;
        case "CONSTRUCT_BUILDING":
          constructBuilding(ctx, sub, order);
          break;
        case "INSTALL_MODULE":
          installModule(ctx, sub, order);
          break;
        case "TIER_UPGRADE":
          tierUpgrade(ctx, sub, order);
          break;
        case "SURVEY_HEX":
          surveyHex(ctx, sub, order);
          break;
        case "DEMOLISH":
          demolish(ctx, sub, order);
          break;
        case "REPAIR_BUILDING":
          repairBuilding(ctx, sub, order);
          break;
        case "FIELD_RESEARCH":
          fieldResearch(ctx, sub, order);
          break;
        default:
          break; // conflict actions handled below
      }
    }
  }
  resolveOutpostPlacements(ctx, outpostPlacements);

  // --- Sub-step 2: conflict actions + spotting (seeded, canonical order) ---
  interface Conflict {
    sub: Subdivision;
    order: UnitActionOrder;
    unit: Personnel;
    targetSubId: number;
    targetHexIdx: number;
    declIndex: number;
  }
  const conflicts: Conflict[] = [];
  for (const vs of sorted) {
    const sub = getSub(ctx, vs.subdivisionId);
    if (!sub) continue;
    vs.unitActions.forEach((order, i) => {
      if (order.action !== "SABOTAGE" && order.action !== "INTERCEPT") return;
      const unit = sub.personnel.find((p) => p.id === order.unitId);
      if (!unit || unit.status !== "AVAILABLE") return;
      const targetSubId = order.targetSubdivisionId ?? -1;
      const targetSub = ctx.game.subdivisions.find((s) => s.id === targetSubId);
      let targetHexIdx = 0;
      if (order.targetBuildingId != null && targetSub) {
        const tb = targetSub.buildings.find((b) => b.id === order.targetBuildingId);
        if (tb) targetHexIdx = rowMajorIndex(tb.hex);
      }
      conflicts.push({ sub, order, unit, targetSubId, targetHexIdx, declIndex: i });
    });
  }
  conflicts.sort(
    (a, b) =>
      a.targetSubId - b.targetSubId ||
      a.targetHexIdx - b.targetHexIdx ||
      a.sub.id - b.sub.id ||
      a.declIndex - b.declIndex,
  );
  for (const c of conflicts) {
    // Spotting gate first (§14.4 / [D-028]) if crossing a closed rival hex.
    if (spotAndMaybeCapture(ctx, c.sub, c.unit, c.order)) continue;
    if (c.order.action === "SABOTAGE") resolveSabotage(ctx, c.sub, c.unit, c.order);
    else resolveIntercept(ctx, c.sub, c.unit, c.order);
  }
}

function getSub(ctx: TurnContext, id: number): Subdivision | undefined {
  const s = ctx.game.subdivisions.find((x) => x.id === id);
  return s && s.status === "ACTIVE" ? s : undefined;
}

function affordAndPay(sub: Subdivision, cost: Partial<ResourceBundle>): boolean {
  for (const key of Object.keys(cost) as (keyof ResourceBundle)[]) {
    if (sub.resources[key] < (cost[key] ?? 0)) return false;
  }
  for (const key of Object.keys(cost) as (keyof ResourceBundle)[]) {
    sub.resources[key] -= cost[key] ?? 0;
  }
  return true;
}

// ---- Non-conflict actions --------------------------------------------------

function constructBuilding(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const bt = order.params?.buildingType;
  const target = order.targetHex;
  if (!bt || !target) return;
  const hex = getHex(ctx.game.map, target);
  if (!hex) return;
  const cost = { ...BUILDINGS[bt].buildCost };
  const surcharge = terrainBuildMineralSurcharge(hex.terrain);
  if (surcharge > 0 && cost.MINERALS) {
    cost.MINERALS = Math.ceil(cost.MINERALS * (1 + surcharge));
  }
  if (!affordAndPay(sub, cost)) {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "CONSTRUCT_UNAFFORDABLE", message: `Construct ${bt} unaffordable` });
    return;
  }
  const b: Building = {
    id: ctx.game.nextIds.building++,
    type: bt,
    tier: BUILDINGS[bt].tier,
    hex: target,
    status: "PENDING",
    builtOnTurn: ctx.turnNumber,
    modules: [],
    garrison: {},
    disabledUntilTurn: 0,
    dormantTurns: 0,
  };
  sub.buildings.push(b);
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "CONSTRUCT_BUILDING", message: `Constructed ${bt} (pending) id ${b.id}`, data: { buildingId: b.id } });
}

function installModule(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const mt = order.params?.moduleType;
  const b = order.targetBuildingId != null ? sub.buildings.find((x) => x.id === order.targetBuildingId) : undefined;
  if (!mt || !b) return;
  if (b.modules.length >= BUILDINGS[b.type].slots) return;
  if (!affordAndPay(sub, MODULES[mt].buildCost)) {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "MODULE_UNAFFORDABLE", message: `Install ${mt} unaffordable` });
    return;
  }
  b.modules.push({
    id: ctx.game.nextIds.module++,
    type: mt,
    status: "PENDING",
    ...(mt === "OPERATIONS_DIRECTOR" ? { operationsDirectorMode: order.params?.namedUnits ? "OUTPUT" : "OUTPUT" } : {}),
    ...(order.params?.namedUnits ? { namedUnits: order.params.namedUnits } : {}),
  });
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "INSTALL_MODULE", message: `Installed ${mt} (pending) on building ${b.id}`, data: { buildingId: b.id, moduleType: mt } });
}

function tierUpgrade(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const b = order.targetBuildingId != null ? sub.buildings.find((x) => x.id === order.targetBuildingId) : undefined;
  if (!b || b.type !== "OUTPOST") return;
  if (!affordAndPay(sub, TIER_UPGRADE_COST)) {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "TIER_UPGRADE_UNAFFORDABLE", message: `Tier Upgrade unaffordable` });
    return;
  }
  b.type = "HEADQUARTERS";
  b.tier = "T1";
  b.status = "PENDING";
  b.builtOnTurn = ctx.turnNumber;
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "TIER_UPGRADE", message: `Outpost ${b.id} upgrading to HQ (pending)`, data: { buildingId: b.id } });
}

function surveyHex(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const target = order.targetHex;
  if (!target) return;
  const hex = getHex(ctx.game.map, target);
  if (!hex) return;
  hex.surveyed = true;
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "SURVEY", message: `Surveyed hex ${target.col},${target.row}`, data: { deposits: hex.deposits ?? {} } });
}

function demolish(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const b = order.targetBuildingId != null ? sub.buildings.find((x) => x.id === order.targetBuildingId) : undefined;
  if (!b) return;
  const minCost = BUILDINGS[b.type].buildCost.MINERALS ?? 0;
  addResourceCapped(sub, "MINERALS", Math.floor(minCost / 2));
  // Free its garrison.
  for (const p of sub.personnel) {
    if (p.assignedBuildingId === b.id) {
      p.status = "AVAILABLE";
      p.assignedBuildingId = undefined;
    }
  }
  sub.buildings = sub.buildings.filter((x) => x.id !== b.id);
  // Unclaim any hex owned solely via this building? Keep claim (Outpost/HQ tracked separately).
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "DEMOLISH", message: `Demolished building ${b.id}, recovered ${Math.floor(minCost / 2)} Min` });
}

function repairBuilding(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const b = order.targetBuildingId != null ? sub.buildings.find((x) => x.id === order.targetBuildingId) : undefined;
  if (!b) return;
  if (!affordAndPay(sub, { CREDITS: 20000, MINERALS: 2 })) return;
  b.disabledUntilTurn = 0;
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "REPAIR", message: `Repaired building ${b.id}` });
}

function fieldResearch(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const unit = sub.personnel.find((p) => p.id === order.unitId);
  if (!unit || unit.type !== "INNOVATOR") return;
  const { stored } = addResourceCapped(sub, "RESEARCH", 1);
  sub.cum.researchGenerated += stored;
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "FIELD_RESEARCH", message: `Field Research +1 R` });
}

function resolveOutpostPlacements(
  ctx: TurnContext,
  placements: { sub: Subdivision; order: UnitActionOrder }[],
): void {
  // Group by target hex; simultaneous new claims on same unclaimed hex mutually cancel. [D-018]
  const byHex = new Map<string, { sub: Subdivision; order: UnitActionOrder }[]>();
  for (const p of placements) {
    const t = p.order.targetHex;
    if (!t) continue;
    const key = `${t.col},${t.row}`;
    const arr = byHex.get(key) ?? [];
    arr.push(p);
    byHex.set(key, arr);
  }
  for (const [key, group] of byHex) {
    const hex = ctx.game.map.find((h) => `${h.coord.col},${h.coord.row}` === key);
    if (!hex) continue;
    if (group.length > 1) {
      ctx.log.push({ phase: 5, code: "OUTPOST_COLLISION", message: `Simultaneous outpost claims on ${key} cancelled (refunded)` });
      continue; // mutual cancel, no cost charged (we never charged yet)
    }
    const p = group[0]!;
    if (hex.ownerSubdivisionId != null && hex.ownerSubdivisionId !== p.sub.id) {
      ctx.log.push({ phase: 5, subdivisionId: p.sub.id, code: "OUTPOST_CONTESTED", message: `Hex ${key} already claimed` });
      continue;
    }
    if (!affordAndPay(p.sub, BUILDINGS.OUTPOST.buildCost)) {
      ctx.log.push({ phase: 5, subdivisionId: p.sub.id, code: "OUTPOST_UNAFFORDABLE", message: `Place Outpost unaffordable` });
      continue;
    }
    const b: Building = {
      id: ctx.game.nextIds.building++,
      type: "OUTPOST",
      tier: "T0",
      hex: hex.coord,
      status: "PENDING",
      builtOnTurn: ctx.turnNumber,
      modules: [],
      garrison: {},
      disabledUntilTurn: 0,
      dormantTurns: 0,
    };
    p.sub.buildings.push(b);
    hex.ownerSubdivisionId = p.sub.id;
    ctx.log.push({ phase: 5, subdivisionId: p.sub.id, code: "PLACE_OUTPOST", message: `Placed Outpost (pending) on ${key}`, data: { buildingId: b.id } });
  }
}

// ---- Conflicts (§14) -------------------------------------------------------

function defenseInvestment(ctx: TurnContext, targetSub: Subdivision, b: Building): { investment: number; autoDefend: boolean } {
  const contractors = b.garrison.CONTRACTOR ?? 0;
  const security = countActiveModule(b, "SECURITY_DETAIL");
  const fort = countActiveModule(b, "FORTIFICATION");
  const autoDefend = ctx.scratch.autoDefendBuildings.has(b.id);
  return { investment: contractors + security + fort, autoDefend };
}

function resolveSabotage(ctx: TurnContext, sub: Subdivision, unit: Personnel, order: UnitActionOrder): void {
  const targetSub = ctx.game.subdivisions.find((s) => s.id === order.targetSubdivisionId);
  const targetB = targetSub?.buildings.find((b) => b.id === order.targetBuildingId);
  if (!targetSub || !targetB) return;

  // Attacker: +1 per Analyst (this unit) + 1 if own operational Comms Array aiding.
  const commsAid = sub.buildings.some((b) => b.type === "COMMUNICATIONS_ARRAY" && b.status === "ACTIVE") ? 1 : 0;
  const attacker = 1 + commsAid;
  const def = defenseInvestment(ctx, targetSub, targetB);

  const result = resolveConflict(ctx.rng, {
    attackerInvestment: attacker,
    defenderInvestment: def.investment,
    defenderAutoDefend: def.autoDefend,
  });

  if (result.success) {
    // Redundant Systems -> 50% output instead of disable is applied at output time;
    // here we still flag the disable, output.ts / phase3 could honor RS (future).
    targetB.disabledUntilTurn = ctx.turnNumber + 1;
    sub.cum.successfulSabotageActions += 1;
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "SABOTAGE_SUCCESS", message: `Sabotaged building ${targetB.id} of subdivision ${targetSub.id}`, data: { target: targetSub.id, buildingId: targetB.id } });
  } else {
    targetSub.cum.successfulSabotageDefenses += 1;
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "SABOTAGE_FAILED", message: `Sabotage on building ${targetB.id} failed (attacker exposed)`, data: { target: targetSub.id, buildingId: targetB.id } });
  }
}

function resolveIntercept(ctx: TurnContext, sub: Subdivision, unit: Personnel, order: UnitActionOrder): void {
  // Contractor (1) vs target-unit weight 1. §14.2.
  const result = resolveConflict(ctx.rng, { attackerInvestment: 1, defenderInvestment: 1 });
  if (result.success) {
    sub.cum.successfulIntercepts += 1;
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "INTERCEPT_SUCCESS", message: `Intercept succeeded` });
  } else {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "INTERCEPT_FAILED", message: `Intercept failed` });
  }
}

// ---- Spotting (§14.4 / [D-028]) --------------------------------------------

function spotAndMaybeCapture(ctx: TurnContext, sub: Subdivision, unit: Personnel, order: UnitActionOrder): boolean {
  const targetSub = ctx.game.subdivisions.find((s) => s.id === order.targetSubdivisionId);
  if (!targetSub || targetSub.id === sub.id) return false;
  // Only if the target hex is closed to this subdivision.
  const targetB = targetSub.buildings.find((b) => b.id === order.targetBuildingId);
  if (!targetB) return false;
  const closed =
    targetSub.closedBordersAgainst.has("ALL") || targetSub.closedBordersAgainst.has(sub.id);
  if (!closed) return false;

  // Must be crossing via adjacency (hub jumps exempt). Assume adjacency here.
  let chance = 20;
  // +10% per Fortification on target hex or adjacent-to-fortified building.
  const fortOnHex = targetSub.buildings
    .filter((b) => sameCoord(b.hex, targetB.hex))
    .reduce((n, b) => n + countActiveModule(b, "FORTIFICATION"), 0);
  chance += 10 * fortOnHex;
  if (unit.type === "ANALYST") chance -= 10;
  chance = Math.max(0, Math.min(100, chance));

  const spotted = ctx.rng.percentSuccess(chance);
  if (spotted) {
    unit.status = "CAPTURED";
    unit.assignedBuildingId = undefined;
    unit.assignedVehicleId = undefined;
    sub.personnel = sub.personnel.filter((p) => p.id !== unit.id);
    targetSub.capturedUnits.push(unit);
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "SPOTTED_CAPTURED", message: `Unit ${unit.id} captured crossing closed border of subdivision ${targetSub.id}`, data: { unitId: unit.id, captor: targetSub.id } });
    return true;
  }
  return false;
}

export { hexDistance };
