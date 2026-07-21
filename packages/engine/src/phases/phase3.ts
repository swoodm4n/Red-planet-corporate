/**
 * Phase 3 — Passive Systems. §16 / [D-004], [D-008], [D-009], [D-013], [D-019],
 * [D-020], [D-039], [D-040]. Pure arithmetic, no RNG.
 *
 * Order: (a) production, (b) research-link/accumulation, (c) income,
 * (d) dividends, (e) upkeep (building→module→personnel), (f) attrition,
 * (g) streak/dormant bookkeeping.
 */

import {
  ADMIN_PASSIVE_CR,
  BUILDINGS,
  HQ_SUBSIDY,
  MODULES,
  PERSONNEL_UPKEEP,
} from "../constants.js";
import type { TurnContext } from "../context.js";
import { computeDividends, setShares, sharesHeld } from "../equity.js";
import { computeCategoryScores } from "../scoring.js";
import { toCr } from "../money.js";
import {
  addResourceCapped,
  countActiveModule,
  hasOperational,
  isOperational,
  laborGarrisonMin,
  garrisonMeetsMin,
} from "../helpers.js";
import { computePassiveOutput } from "../output.js";
import type {
  Building,
  PhysicalResource,
  ResourceBundle,
  Subdivision,
} from "../types.js";

const PHYSICAL: PhysicalResource[] = ["ENERGY", "MINERALS", "WATER", "FOOD", "RESEARCH"];

export function runPhase3(ctx: TurnContext): void {
  for (const sub of ctx.game.subdivisions) {
    if (sub.status !== "ACTIVE") continue;
    // Track physical net for Consistent Output streak. [D-025]
    const producedPhysical: Record<PhysicalResource, number> = {
      ENERGY: 0, MINERALS: 0, WATER: 0, FOOD: 0, RESEARCH: 0,
    };
    const consumedPhysical: Record<PhysicalResource, number> = {
      ENERGY: 0, MINERALS: 0, WATER: 0, FOOD: 0, RESEARCH: 0,
    };

    // ---- (a) production + HQ subsidy -----------------------------------
    const hqOperational = hasOperational(sub, "HEADQUARTERS", ctx.turnNumber);
    if (hqOperational) {
      // §4 flat subsidy [D-004].
      for (const res of PHYSICAL) {
        const amt = HQ_SUBSIDY[res];
        if (amt > 0) {
          const { stored, discarded } = addResourceCapped(sub, res, amt);
          producedPhysical[res] += stored;
          if (discarded > 0) logDiscard(ctx, sub, res, discarded);
        }
      }
      addResourceCapped(sub, "CREDITS", HQ_SUBSIDY.CREDITS);
    }

    for (const b of sub.buildings) {
      const out = computePassiveOutput(b, ctx.game, sub.id);
      if (out.resource && out.amount > 0) {
        const { stored, discarded } = addResourceCapped(sub, out.resource, out.amount);
        producedPhysical[out.resource] += stored;
        if (out.resource === "RESEARCH") sub.cum.researchGenerated += stored;
        if (discarded > 0) logDiscard(ctx, sub, out.resource, discarded);
      }
      // ---- (b) research link ----
      if (out.researchLinkBonus > 0) {
        const { stored, discarded } = addResourceCapped(sub, "RESEARCH", out.researchLinkBonus);
        producedPhysical.RESEARCH += stored;
        sub.cum.researchGenerated += stored;
        if (discarded > 0) logDiscard(ctx, sub, "RESEARCH", discarded);
      }
    }

    // ---- (c) income: admin passive + commercial hub + territory ----------
    const admins = sub.personnel.filter(
      (p) => p.type === "ADMINISTRATOR" && p.status !== "CAPTURED" && p.status !== "LOST" && p.status !== "UNHOUSED",
    ).length;
    let perAdmin = ADMIN_PASSIVE_CR;
    if (hasOperational(sub, "COMMERCIAL_HUB", ctx.turnNumber)) {
      // +1 base, +1 per Hub Efficiency module. [D-008]
      const hubEfficiency = sub.buildings
        .filter((b) => b.type === "COMMERCIAL_HUB" && isOperational(b, ctx.turnNumber))
        .reduce((n, b) => n + countActiveModule(b, "EFFICIENCY"), 0);
      perAdmin += 10000 * (1 + hubEfficiency); // +1 Cr (+1 per efficiency) in fp
    }
    if (admins > 0) addResourceCapped(sub, "CREDITS", perAdmin * admins);

    // Territory income: +1 Cr per claimed hex if operational HQ. [D-009]
    if (hqOperational) {
      const claimed = ctx.game.map.filter((h) => h.ownerSubdivisionId === sub.id).length;
      if (claimed > 0) addResourceCapped(sub, "CREDITS", 10000 * claimed);
    }

    // ---- (e) upkeep: building -> module -> personnel ---------------------
    // (dividends step (d) handled after all subs produce income; see below)
    // Buildings & modules first.
    for (const b of sub.buildings) {
      if (b.status !== "ACTIVE") continue;
      payUpkeep(ctx, sub, BUILDINGS[b.type].upkeep, consumedPhysical, b);
      for (const m of b.modules) {
        if (m.status !== "ACTIVE") continue;
        payUpkeep(ctx, sub, MODULES[m.type].upkeep, consumedPhysical, b);
      }
    }

    // ---- (f) personnel upkeep + attrition (ascending id) ----------------
    const units = [...sub.personnel]
      .filter((p) => p.status !== "CAPTURED" && p.status !== "LOST")
      .sort((a, b) => a.id - b.id);
    for (const unit of units) {
      const up = PERSONNEL_UPKEEP[unit.type];
      // Physical shortfall => unit lost. [D-019]
      const shortF = sub.resources.FOOD < up.FOOD;
      const shortW = sub.resources.WATER < up.WATER;
      const shortE = up.ENERGY > 0 && sub.resources.ENERGY < up.ENERGY;
      const shortR = up.RESEARCH > 0 && sub.resources.RESEARCH < up.RESEARCH;
      if (shortF || shortW || shortE || shortR) {
        cullUnit(ctx, sub, unit);
        continue;
      }
      sub.resources.FOOD -= up.FOOD; consumedPhysical.FOOD += up.FOOD;
      sub.resources.WATER -= up.WATER; consumedPhysical.WATER += up.WATER;
      if (up.ENERGY > 0) { sub.resources.ENERGY -= up.ENERGY; consumedPhysical.ENERGY += up.ENERGY; }
      if (up.RESEARCH > 0) { sub.resources.RESEARCH -= up.RESEARCH; consumedPhysical.RESEARCH += up.RESEARCH; }
      // Credits: clamp at 0, forgive shortfall. [D-020]
      if (up.CREDITS > 0) {
        sub.resources.CREDITS = Math.max(0, sub.resources.CREDITS - up.CREDITS);
      }
    }

    // ---- (g) streak / dormant bookkeeping -------------------------------
    let netPhysical = 0;
    for (const res of PHYSICAL) netPhysical += producedPhysical[res] - consumedPhysical[res];
    if (netPhysical >= 0) sub.consistentOutputStreak += 1;
    else sub.consistentOutputStreak = 0;

    for (const b of sub.buildings) {
      if (b.status !== "ACTIVE") continue;
      const meetsMin = garrisonMeetsMin(b, laborGarrisonMin(b));
      if (!meetsMin && Object.keys(laborGarrisonMin(b)).length > 0) {
        b.dormantTurns += 1;
      } else {
        b.dormantTurns = 0;
      }
    }
  }

  // ---- (d) dividends: paid after all subs computed income --------------
  payAllDividends(ctx);
}

function logDiscard(ctx: TurnContext, sub: Subdivision, res: PhysicalResource, amount: number): void {
  ctx.log.push({
    phase: 3,
    subdivisionId: sub.id,
    code: "STORAGE_OVERFLOW",
    message: `${amount} ${res} discarded (storage cap)`,
    data: { resource: res, amount },
  });
}

function payUpkeep(
  ctx: TurnContext,
  sub: Subdivision,
  cost: Partial<ResourceBundle>,
  consumed: Record<PhysicalResource, number>,
  building: Building,
): void {
  for (const key of Object.keys(cost) as (keyof ResourceBundle)[]) {
    const amt = cost[key] ?? 0;
    if (amt <= 0) continue;
    if (key === "CREDITS") {
      if (sub.resources.CREDITS < amt) {
        // Cr upkeep unpaid -> forgiven, building non-operational next turn. [D-020]
        sub.resources.CREDITS = 0;
        building.nonOperationalNextTurn = true;
      } else {
        sub.resources.CREDITS -= amt;
      }
    } else {
      const phys = key as PhysicalResource;
      const paid = Math.min(sub.resources[phys], amt);
      sub.resources[phys] -= paid;
      consumed[phys] += paid;
      if (paid < amt) building.nonOperationalNextTurn = true;
    }
  }
}

function cullUnit(ctx: TurnContext, sub: Subdivision, unit: Subdivision["personnel"][number]): void {
  unit.status = "LOST";
  // Vacate garrison.
  if (unit.assignedBuildingId != null) {
    const b = sub.buildings.find((x) => x.id === unit.assignedBuildingId);
    if (b) {
      const cur = b.garrison[unit.type] ?? 0;
      if (cur > 0) b.garrison[unit.type] = cur - 1;
    }
  }
  unit.assignedBuildingId = undefined;
  unit.assignedVehicleId = undefined;
  ctx.log.push({
    phase: 3,
    subdivisionId: sub.id,
    code: "STARVATION",
    message: `Unit ${unit.id} (${unit.type}) lost to starvation`,
    data: { unitId: unit.id, type: unit.type },
  });
}

function payAllDividends(ctx: TurnContext): void {
  const eq = ctx.game.equity;
  for (const issuer of ctx.game.subdivisions) {
    if (issuer.status !== "ACTIVE") continue;
    const econ = toCr(issuer.resources.CREDITS) + toCr(issuer.cum.creditsEarnedFromSales) / 10;
    const payouts = computeDividends(eq, issuer, econ);
    for (const p of payouts) {
      const holder = ctx.game.subdivisions.find((s) => s.id === p.holderId);
      if (!holder || holder.status !== "ACTIVE") continue;
      const pay = Math.min(p.amount, issuer.resources.CREDITS);
      if (pay <= 0) continue;
      issuer.resources.CREDITS -= pay;
      addResourceCapped(holder, "CREDITS", pay);
      ctx.log.push({
        phase: 3,
        subdivisionId: issuer.id,
        code: "DIVIDEND",
        message: `Paid dividend ${toCr(pay)} Cr to subdivision ${holder.id}`,
        data: { issuer: issuer.id, holder: holder.id, amount: pay },
      });
    }
  }
}

export { computeCategoryScores };
