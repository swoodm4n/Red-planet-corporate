import { describe, it, expect } from "vitest";
import {
  adjustEr,
  colonistEta,
  emergencyResupplyAvailable,
  appealAvailable,
  requisitionCostMultiplier,
  expeditedDeliveryFree,
  parentBonusActionUnlocked,
  universalBonusActive,
  accrueResourceExport,
} from "../src/earthRelations.js";
import type { Subdivision } from "../src/types.js";

function sub(er: number, sold = 0, credited = 0): Subdivision {
  return {
    id: 1, name: "s", parentCompany: "UNIFIED_MINING", parentPerk: "A", status: "ACTIVE",
    resources: { CREDITS: 0, ENERGY: 0, MINERALS: 0, WATER: 0, FOOD: 0, RESEARCH: 0 },
    earthRelations: er, buildings: [], personnel: [], vehicles: [], capturedUnits: [],
    closedBordersAgainst: new Set(),
    cum: {
      resourcesSoldUnits: sold, creditsEarnedFromSales: 0, researchGenerated: 0,
      researchSubmissions: 0, successfulSabotageDefenses: 0, successfulIntercepts: 0,
      successfulSabotageActions: 0, successfulSurveillance: 0, undetectedPlantIntel: 0,
      consistentOutputStreak: 0, resourceExportCredited: credited,
    },
    earthRelationsBonusActive: false, consistentOutputStreak: 0, insolventStreak: 0,
  };
}

describe("Earth Relations (§13 / [D-024])", () => {
  it("clamps to [0,30]", () => {
    const s = sub(28);
    adjustEr(s, +10);
    expect(s.earthRelations).toBe(30);
    adjustEr(s, -50);
    expect(s.earthRelations).toBe(0);
  });

  it("adjustEr returns the actual applied delta", () => {
    const s = sub(29);
    expect(adjustEr(s, +5)).toBe(1); // only +1 possible up to 30
  });

  it("threshold predicates", () => {
    expect(colonistEta(sub(4))).toBe(4);
    expect(colonistEta(sub(5))).toBe(3);
    expect(emergencyResupplyAvailable(sub(4))).toBe(false);
    expect(emergencyResupplyAvailable(sub(5))).toBe(true);
    expect(appealAvailable(sub(0))).toBe(false);
    expect(appealAvailable(sub(1))).toBe(true);
    expect(requisitionCostMultiplier(sub(0))).toBe(1.5);
    expect(requisitionCostMultiplier(sub(21))).toBe(0.75);
    expect(requisitionCostMultiplier(sub(10))).toBe(1.0);
    expect(expeditedDeliveryFree(sub(21))).toBe(true);
    expect(expeditedDeliveryFree(sub(20))).toBe(false);
    expect(parentBonusActionUnlocked(sub(26))).toBe(true);
    expect(parentBonusActionUnlocked(sub(25))).toBe(false);
    expect(universalBonusActive(sub(30))).toBe(true);
    expect(universalBonusActive(sub(29))).toBe(false);
  });

  it("resource export accrues +1 ER per 20 units sold", () => {
    const s = sub(10, 45, 0); // 45 units -> 2 milestones
    const delta = accrueResourceExport(s);
    expect(delta).toBe(2);
    expect(s.earthRelations).toBe(12);
    expect(s.cum.resourceExportCredited).toBe(2);
    // No further accrual until crossing next 20.
    expect(accrueResourceExport(s)).toBe(0);
  });
});
