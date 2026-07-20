/**
 * Phase 4 — Building Actions. §16, §10.2 / [D-005], [D-016], [D-021], [D-022].
 * Reads post-Phase-3 state. Emergency Extraction consumes the seeded stream in
 * canonical order (§15 step 1). Intra-subdivision spending is greedy.
 */

import {
  ADMIN_PASSIVE_CR,
  BLACK_MARKET_CAP,
  HULLS,
  TRANSIT_HUB_BASE_SELL_CAP,
  TRANSIT_HUB_EXPANSION_SELL_BONUS,
  VEHICLE_MODULES,
} from "../constants.js";
import { spendAttention } from "../attention.js";
import type { TurnContext } from "../context.js";
import { colonistEta, requisitionCostMultiplier } from "../earthRelations.js";
import {
  addResourceCapped,
  countActiveModule,
  isOperational,
} from "../helpers.js";
import { earthSaleProceeds, peerSaleProceeds } from "../market.js";
import { computePassiveOutput } from "../output.js";
import { cr, fpMul } from "../money.js";
import { rowMajorIndex } from "../map.js";
import type { Building, PhysicalResource, Subdivision, Vehicle } from "../types.js";
import type { BuildingActionOrder } from "../orders.js";

export function runPhase4(ctx: TurnContext): void {
  // Non-RNG building actions, iterated by ascending subdivision id then declaration.
  const sorted = [...ctx.plan].sort((a, b) => a.subdivisionId - b.subdivisionId);

  // §22.4: spend the attention reserved in Phase 2 for every accepted building
  // action (Phase 2's `claimed` set already prevented double-reservation). [D-056]
  for (const vs of sorted) {
    const sub = getSub(ctx, vs.subdivisionId);
    if (!sub) continue;
    for (const order of vs.buildingActions) {
      spendAttention(sub, ctx.attentionPicks.get(order) ?? []);
    }
  }

  // First: all Emergency Extraction damage rolls in canonical order (§15 step 1).
  runEmergencyExtractions(ctx, sorted);

  for (const vs of sorted) {
    const sub = getSub(ctx, vs.subdivisionId);
    if (!sub) continue;
    for (const order of vs.buildingActions) {
      if (order.action === "EMERGENCY_EXTRACTION") continue; // already handled
      resolveBuildingAction(ctx, sub, order);
    }
  }
}

function getSub(ctx: TurnContext, id: number): Subdivision | undefined {
  const s = ctx.game.subdivisions.find((x) => x.id === id);
  return s && s.status === "ACTIVE" ? s : undefined;
}

function building(sub: Subdivision, id: number): Building | undefined {
  return sub.buildings.find((b) => b.id === id);
}

// ---- Emergency Extraction (RNG) -------------------------------------------

function runEmergencyExtractions(ctx: TurnContext, sorted: TurnContext["plan"]): void {
  interface EE { sub: Subdivision; b: Building; declIndex: number }
  const items: EE[] = [];
  for (const vs of sorted) {
    const sub = getSub(ctx, vs.subdivisionId);
    if (!sub) continue;
    vs.buildingActions.forEach((order, i) => {
      if (order.action !== "EMERGENCY_EXTRACTION") return;
      const b = building(sub, order.buildingId);
      if (b) items.push({ sub, b, declIndex: i });
    });
  }
  // Canonical order: (subdivisionId, hex row-major index, declaration index).
  items.sort(
    (a, b) =>
      a.sub.id - b.sub.id ||
      rowMajorIndex(a.b.hex) - rowMajorIndex(b.b.hex) ||
      a.declIndex - b.declIndex,
  );
  for (const it of items) {
    // ×2 total output this turn: pay the passive amount again.
    const out = computePassiveOutput(it.b, ctx.game, it.sub.id);
    if (out.resource && out.amount > 0) {
      addResourceCapped(it.sub, out.resource, out.amount);
    }
    // 25% damage roll: disable building next turn. [D-016]
    const damaged = ctx.rng.percentSuccess(25);
    if (damaged) {
      it.b.disabledUntilTurn = ctx.turnNumber + 1;
      ctx.log.push({
        phase: 4, subdivisionId: it.sub.id, code: "EMERGENCY_EXTRACTION_DAMAGE",
        message: `Emergency Extraction damaged building ${it.b.id}`,
        data: { buildingId: it.b.id },
      });
    } else {
      ctx.log.push({
        phase: 4, subdivisionId: it.sub.id, code: "EMERGENCY_EXTRACTION",
        message: `Emergency Extraction on building ${it.b.id} (no damage)`,
        data: { buildingId: it.b.id },
      });
    }
  }
}

// ---- Non-RNG actions -------------------------------------------------------

function resolveBuildingAction(ctx: TurnContext, sub: Subdivision, order: BuildingActionOrder): void {
  const b = building(sub, order.buildingId);
  if (!b) return;
  switch (order.action) {
    case "MARKET_SALE":
      return marketSale(ctx, sub, b, order);
    case "BOOST_OUTPUT":
      return boostOutput(ctx, sub, b);
    case "COLONIST_REQUISITION":
      return colonistRequisition(ctx, sub, b, order);
    case "TERRITORIAL_CLAIM":
      return territorialClaim(ctx, sub, b, order);
    case "PRODUCE_VEHICLE":
      return produceVehicle(ctx, sub, b, order);
    case "AMPLIFY_CREDIT_YIELD":
      return amplifyCreditYield(ctx, sub, b);
    case "RESEARCH_SPRINT":
      return researchSprint(ctx, sub, b);
    case "RESOURCE_TRANSFER":
      return resourceTransfer(ctx, sub, order);
    case "PASSIVE_INTEL_SCAN":
      ctx.log.push({ phase: 4, subdivisionId: sub.id, code: "INTEL_SCAN", message: `Passive Intel Scan from building ${b.id}` });
      return;
    case "LOCKDOWN":
      return lockdown(ctx, sub, b);
  }
}

/** Lockdown: total sabotage/intercept immunity this turn (3 Cr). §7.2 / [D-011]. */
function lockdown(ctx: TurnContext, sub: Subdivision, b: Building): void {
  if (!affordAndPay(sub, cr(3))) {
    ctx.log.push({ phase: 4, subdivisionId: sub.id, code: "LOCKDOWN_UNAFFORDABLE", message: `Lockdown unaffordable` });
    return;
  }
  ctx.scratch.autoDefendBuildings.add(b.id);
  ctx.log.push({ phase: 4, subdivisionId: sub.id, code: "LOCKDOWN", message: `Lockdown active on building ${b.id} (auto-defend)`, data: { buildingId: b.id } });
}

function affordAndPay(sub: Subdivision, fp: number): boolean {
  if (sub.resources.CREDITS < fp) return false;
  sub.resources.CREDITS -= fp;
  return true;
}

function transitHubCap(b: Building): number {
  return TRANSIT_HUB_BASE_SELL_CAP + TRANSIT_HUB_EXPANSION_SELL_BONUS * countActiveModule(b, "EXPANSION");
}

function marketSale(ctx: TurnContext, sub: Subdivision, b: Building, order: BuildingActionOrder): void {
  const res = order.params?.resource as PhysicalResource | undefined;
  let qty = order.params?.quantity ?? 0;
  if (!res || qty <= 0) return;

  // Transit Hub throughput cap (per hub, this turn). [D-001]
  const used = ctx.scratch.hubSalesThisTurn.get(b.id) ?? 0;
  const remaining = transitHubCap(b) - used;
  qty = Math.min(qty, remaining, sub.resources[res]);
  if (qty <= 0) {
    ctx.log.push({ phase: 4, subdivisionId: sub.id, code: "MARKET_SALE_CAPPED", message: `Market Sale hit Transit Hub cap`, data: { buildingId: b.id } });
    return;
  }

  sub.resources[res] -= qty;
  ctx.scratch.hubSalesThisTurn.set(b.id, used + qty);
  ctx.game.market.soldThisTurn[res] += qty;

  // Peer routing [D-005].
  const peerId = order.params?.peerBuyerSubdivisionId;
  let proceeds: number;
  if (peerId != null) {
    const peer = getSub(ctx, peerId);
    if (peer) {
      proceeds = peerSaleProceeds(ctx.game.market, res, qty);
      // Peer pays and receives goods (capped at peer storage).
      const pay = Math.min(proceeds, peer.resources.CREDITS);
      peer.resources.CREDITS -= pay;
      addResourceCapped(peer, res, qty);
      ctx.game.market.boughtThisTurn[res] += qty;
      proceeds = pay;
    } else {
      proceeds = earthSaleProceeds(ctx.game.market, res, qty);
    }
  } else {
    proceeds = earthSaleProceeds(ctx.game.market, res, qty);
  }

  addResourceCapped(sub, "CREDITS", proceeds);
  sub.cum.creditsEarnedFromSales += proceeds;
  sub.cum.resourcesSoldUnits += qty;
  ctx.log.push({
    phase: 4, subdivisionId: sub.id, code: "MARKET_SALE",
    message: `Sold ${qty} ${res} for ${proceeds / 10000} Cr`,
    data: { resource: res, qty, proceeds },
  });
}

function boostOutput(ctx: TurnContext, sub: Subdivision, b: Building): void {
  const out = computePassiveOutput(b, ctx.game, sub.id);
  if (!out.resource) return;
  const { stored } = addResourceCapped(sub, out.resource, 2);
  if (out.resource === "RESEARCH") sub.cum.researchGenerated += stored;
  ctx.log.push({ phase: 4, subdivisionId: sub.id, code: "BOOST_OUTPUT", message: `Boost Output +2 ${out.resource} on building ${b.id}` });
}

function researchSprint(ctx: TurnContext, sub: Subdivision, b: Building): void {
  const { stored } = addResourceCapped(sub, "RESEARCH", 2);
  sub.cum.researchGenerated += stored;
  ctx.log.push({ phase: 4, subdivisionId: sub.id, code: "RESEARCH_SPRINT", message: `Research Sprint +2 R on building ${b.id}` });
}

function colonistRequisition(ctx: TurnContext, sub: Subdivision, b: Building, order: BuildingActionOrder): void {
  const count = order.params?.colonistCount ?? 0;
  const type = order.params?.colonistType ?? "ENGINEER";
  const mult = requisitionCostMultiplier(sub);
  const costFp = fpMul(cr(5) * count + cr(2), mult);
  if (sub.resources.CREDITS < costFp) {
    ctx.log.push({ phase: 4, subdivisionId: sub.id, code: "REQUISITION_FAILED", message: `Colonist Requisition unaffordable` });
    return;
  }
  sub.resources.CREDITS -= costFp;
  const eta = colonistEta(sub);
  const arriveTurn = ctx.turnNumber + eta;
  for (let i = 0; i < count; i++) {
    const id = ctx.game.nextIds.personnel++;
    sub.personnel.push({
      id, type, status: "AVAILABLE", unavailableUntilTurn: 0,
      arrivalTurn: arriveTurn, requisitionType: type, attentionSpentThisTurn: false,
    });
    // Not yet available: mark unavailable until arrival by using arrivalTurn.
    const p = sub.personnel[sub.personnel.length - 1]!;
    p.status = "AVAILABLE";
    p.unavailableUntilTurn = arriveTurn - 1; // becomes usable on arriveTurn
  }
  // Large Requisition ER penalty: -1 per 3 colonists above 3. [D-024]
  if (count > 3) {
    const steps = -Math.ceil((count - 3) / 3);
    sub.earthRelations = Math.max(0, sub.earthRelations + steps);
    ctx.log.push({ phase: 4, subdivisionId: sub.id, code: "LARGE_REQUISITION", message: `Large Requisition ER ${steps}` });
  }
  ctx.log.push({
    phase: 4, subdivisionId: sub.id, code: "COLONIST_REQUISITION",
    message: `Requisitioned ${count} ${type}, arriving turn ${arriveTurn}`,
    data: { count, type, arriveTurn },
  });
}

function territorialClaim(ctx: TurnContext, sub: Subdivision, b: Building, order: BuildingActionOrder): void {
  const target = order.params?.targetHex;
  if (!target) return;
  const hex = ctx.game.map.find((h) => h.coord.col === target.col && h.coord.row === target.row);
  if (!hex || hex.terrain === "LANDING_ZONE" || hex.terrain === "IMPASSABLE") return;
  if (hex.ownerSubdivisionId != null && hex.ownerSubdivisionId !== sub.id) {
    ctx.log.push({ phase: 4, subdivisionId: sub.id, code: "CLAIM_CONTESTED", message: `Hex already claimed` });
    return;
  }
  hex.ownerSubdivisionId = sub.id;
  ctx.log.push({ phase: 4, subdivisionId: sub.id, code: "TERRITORIAL_CLAIM", message: `Claimed hex ${target.col},${target.row}` });
}

function produceVehicle(ctx: TurnContext, sub: Subdivision, b: Building, order: BuildingActionOrder): void {
  const hull = order.params?.hull;
  if (!hull) return;
  const hullSpec = HULLS[hull];
  const modules = order.params?.vehicleModules ?? [];
  // Total cost = hull + modules.
  const cost = { ...hullSpec.buildCost } as Record<string, number>;
  for (const m of modules) {
    const spec = VEHICLE_MODULES[m];
    if (!spec) continue;
    for (const [k, v] of Object.entries(spec.buildCost)) cost[k] = (cost[k] ?? 0) + (v ?? 0);
  }
  // Affordability check.
  const res = sub.resources as unknown as Record<string, number>;
  for (const [k, v] of Object.entries(cost)) {
    if ((res[k] ?? 0) < v) {
      ctx.log.push({ phase: 4, subdivisionId: sub.id, code: "VEHICLE_UNAFFORDABLE", message: `Produce Vehicle unaffordable` });
      return;
    }
  }
  for (const [k, v] of Object.entries(cost)) {
    res[k] = (res[k] ?? 0) - v;
  }
  const vehicle: Vehicle = {
    id: ctx.game.nextIds.vehicle++,
    hull,
    modules: modules.map((m) => {
      const spec = VEHICLE_MODULES[m]!;
      return { id: ctx.game.nextIds.vehicleModule++, category: spec.category, name: m, status: "PENDING" };
    }),
    crew: [],
    hex: b.hex,
    status: "PENDING",
    cargo: {},
  };
  sub.vehicles.push(vehicle);
  ctx.log.push({ phase: 4, subdivisionId: sub.id, code: "PRODUCE_VEHICLE", message: `Produced ${hull} vehicle ${vehicle.id} (pending)`, data: { vehicleId: vehicle.id } });
}

function amplifyCreditYield(ctx: TurnContext, sub: Subdivision, b: Building): void {
  if (ctx.scratch.amplifyActive.has(sub.id)) return;
  ctx.scratch.amplifyActive.add(sub.id);
  // +1 Cr per Administrator this turn (applied now).
  const admins = sub.personnel.filter(
    (p) => p.type === "ADMINISTRATOR" && p.status !== "CAPTURED" && p.status !== "LOST" && p.status !== "UNHOUSED",
  ).length;
  addResourceCapped(sub, "CREDITS", cr(1) * admins);
  ctx.log.push({ phase: 4, subdivisionId: sub.id, code: "AMPLIFY_CREDIT_YIELD", message: `Amplify Credit Yield: +1 Cr/Admin (${admins})`, data: { buildingId: b.id } });
}

function resourceTransfer(ctx: TurnContext, sub: Subdivision, order: BuildingActionOrder): void {
  // Simplified: intra-subdivision transfers are logical no-ops on stockpiles
  // (resources are pooled per subdivision in this model). Log for the report.
  ctx.log.push({ phase: 4, subdivisionId: sub.id, code: "RESOURCE_TRANSFER", message: `Resource Transfer executed` });
}

export const BLACK_MARKET_SELL_CAP = BLACK_MARKET_CAP;
