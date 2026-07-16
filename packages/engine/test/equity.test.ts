import { describe, it, expect } from "vitest";
import {
  recomputeSharePrice,
  computeDividends,
  makeInitialEquity,
  setShares,
  sharesHeld,
  TOTAL_SHARES,
} from "../src/equity.js";
import { cr, displayCr } from "../src/money.js";
import type { Subdivision } from "../src/types.js";

function stubSub(id: number, credits: number): Subdivision {
  return {
    id,
    name: `S${id}`,
    parentCompany: "UNIFIED_MINING",
    parentPerk: "A",
    status: "ACTIVE",
    resources: { CREDITS: credits, ENERGY: 0, MINERALS: 0, WATER: 0, FOOD: 0, RESEARCH: 0 },
    earthRelations: 10,
    buildings: [],
    personnel: [],
    vehicles: [],
    capturedUnits: [],
    closedBordersAgainst: new Set(),
    cum: {
      resourcesSoldUnits: 0, creditsEarnedFromSales: 0, researchGenerated: 0,
      researchSubmissions: 0, successfulSabotageDefenses: 0, successfulIntercepts: 0,
      successfulSabotageActions: 0, successfulSurveillance: 0, undetectedPlantIntel: 0,
      consistentOutputStreak: 0, resourceExportCredited: 0,
    },
    earthRelationsBonusActive: false,
    consistentOutputStreak: 0,
    insolventStreak: 0,
  };
}

describe("equity market (§11.3 / [D-007])", () => {
  it("anchor worked example: composite 56.5 -> 10.65 Cr share price", () => {
    const price = recomputeSharePrice(56.5, 0);
    expect(price).toBe(cr(10.65)); // 106500
    expect(displayCr(price)).toBe(10.65);
  });

  it("share price floors at 1 Cr", () => {
    expect(recomputeSharePrice(-1000, -100)).toBe(cr(1));
  });

  it("trading pressure clamps at +-15%", () => {
    const base = recomputeSharePrice(50, 0); // anchor 10
    const up = recomputeSharePrice(50, 1000); // large positive net -> +15%
    expect(up).toBe(cr(10 * 1.15));
    const down = recomputeSharePrice(50, -1000);
    expect(down).toBe(cr(10 * 0.85));
    expect(base).toBe(cr(10));
  });

  it("dividend worked example: economic 22, 30/100 held -> 0.33 Cr", () => {
    const issuer = stubSub(1, cr(100));
    const equity = makeInitialEquity([issuer, stubSub(2, 0)]);
    // Holder 2 owns 30 of issuer 1's shares.
    setShares(equity, 1, 1, 70);
    setShares(equity, 1, 2, 30);
    const payouts = computeDividends(equity, issuer, 22);
    expect(payouts).toHaveLength(1);
    expect(payouts[0]!.holderId).toBe(2);
    expect(payouts[0]!.amount).toBe(cr(0.33)); // 3300
  });

  it("dividend is pro-rated down when issuer cannot afford it", () => {
    const issuer = stubSub(1, cr(0.1)); // only 0.10 Cr
    const equity = makeInitialEquity([issuer, stubSub(2, 0)]);
    setShares(equity, 1, 2, 100); // holder owns all -> wants full 1.1 Cr
    const payouts = computeDividends(equity, issuer, 22);
    const total = payouts.reduce((n, p) => n + p.amount, 0);
    expect(total).toBeLessThanOrEqual(issuer.resources.CREDITS);
  });

  it("issuer initially holds all 100 of its own shares", () => {
    const equity = makeInitialEquity([stubSub(1, 0)]);
    expect(sharesHeld(equity, 1, 1)).toBe(TOTAL_SHARES);
  });
});
