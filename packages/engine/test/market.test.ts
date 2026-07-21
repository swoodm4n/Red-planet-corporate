import { describe, it, expect } from "vitest";
import { recomputePrice, makeInitialMarket, updateMarketPrices } from "../src/market.js";
import { cr } from "../src/money.js";

describe("dynamic market (§11.2 / [D-006])", () => {
  it("reproduces the Minerals worked example (bought 20, sold 60 -> 0.4955)", () => {
    const baseline = cr(0.5); // 5000
    const next = recomputePrice(baseline, baseline, 20, 60);
    // netFlow -40 -> shift 4940 -> reverted 4955
    expect(next).toBe(4955);
  });

  it("clamps price shift to +-15%", () => {
    const baseline = cr(0.5);
    // Huge positive net flow -> shift capped at +15% then reverted toward baseline.
    const high = recomputePrice(baseline, baseline, 100000, 0);
    // shift = 5000 * 1.15 = 5750; reverted = 5750 + 0.25*(5000-5750) = 5562.5 -> 5563 (round)
    expect(high).toBe(5563);
  });

  it("respects the 40%-250% floor/ceiling", () => {
    const baseline = cr(0.5); // 5000, floor 2000, ceil 12500
    // Start already very high, keep buying.
    let price = 12500;
    for (let i = 0; i < 50; i++) price = recomputePrice(price, baseline, 100000, 0);
    expect(price).toBeLessThanOrEqual(12500);
    expect(price).toBeGreaterThanOrEqual(2000);
  });

  it("updateMarketPrices rolls flow into cumulative and resets", () => {
    const m = makeInitialMarket();
    m.soldThisTurn.MINERALS = 60;
    m.boughtThisTurn.MINERALS = 20;
    updateMarketPrices(m);
    expect(m.livePrice.MINERALS).toBe(4955);
    expect(m.cumulativeSold.MINERALS).toBe(60);
    expect(m.cumulativeBought.MINERALS).toBe(20);
    expect(m.soldThisTurn.MINERALS).toBe(0);
    expect(m.boughtThisTurn.MINERALS).toBe(0);
  });

  it("no flow reverts price 25% toward baseline", () => {
    const baseline = cr(0.5);
    // price 6000, no flow: reverted = 6000 + 0.25*(5000-6000) = 5750
    expect(recomputePrice(6000, baseline, 0, 0)).toBe(5750);
  });
});
