/**
 * Dynamic resource market. GAME_SPEC §11.2 / [D-001], [D-005], [D-006].
 * Prices are frozen intra-turn; recomputed once in Phase 8 in order [E,Min,W,F,R].
 */

import { BASELINE_PRICE, EARTH_SELL_MULT } from "./constants.js";
import { clampFp, fpMul, type Fp } from "./money.js";
import type { MarketState, PhysicalResource } from "./types.js";
import { MARKET_RESOURCE_ORDER } from "./types.js";

export function makeInitialMarket(): MarketState {
  const zero = (): Record<PhysicalResource, number> => ({
    ENERGY: 0,
    MINERALS: 0,
    WATER: 0,
    FOOD: 0,
    RESEARCH: 0,
  });
  return {
    livePrice: { ...BASELINE_PRICE },
    cumulativeBought: zero(),
    cumulativeSold: zero(),
    boughtThisTurn: zero(),
    soldThisTurn: zero(),
    lzColonyUsedThisTurn: 0,
  };
}

/**
 * Recompute one resource's live price from this-turn flow. §11.2:
 *   netFlow  = bought - sold
 *   shift    = livePrice * (1 + clamp((netFlow/100)*0.03, -0.15, +0.15))
 *   reverted = shift + 0.25*(baseline - shift)
 *   price    = clamp(reverted, 0.40*baseline, 2.50*baseline)
 */
export function recomputePrice(
  livePrice: Fp,
  baseline: Fp,
  boughtThisTurn: number,
  soldThisTurn: number,
): Fp {
  const netFlow = boughtThisTurn - soldThisTurn;
  const rawShiftPct = (netFlow / 100) * 0.03;
  const shiftPct = Math.max(-0.15, Math.min(0.15, rawShiftPct));
  const shift = livePrice * (1 + shiftPct);
  const reverted = shift + 0.25 * (baseline - shift);
  const floor = fpMul(baseline, 0.4);
  const ceil = fpMul(baseline, 2.5);
  return clampFp(Math.round(reverted), floor, ceil);
}

/** Phase 8 step: recompute all prices, roll this-turn flow into cumulative. */
export function updateMarketPrices(market: MarketState): void {
  for (const res of MARKET_RESOURCE_ORDER) {
    const next = recomputePrice(
      market.livePrice[res],
      BASELINE_PRICE[res],
      market.boughtThisTurn[res],
      market.soldThisTurn[res],
    );
    market.livePrice[res] = next;
    market.cumulativeBought[res] += market.boughtThisTurn[res];
    market.cumulativeSold[res] += market.soldThisTurn[res];
    market.boughtThisTurn[res] = 0;
    market.soldThisTurn[res] = 0;
  }
  market.lzColonyUsedThisTurn = 0;
}

/** Proceeds for selling `qty` to Earth at the frozen live price × 0.80. [D-005] */
export function earthSaleProceeds(market: MarketState, resource: PhysicalResource, qty: number): Fp {
  return fpMul(market.livePrice[resource] * qty, EARTH_SELL_MULT);
}

/** Proceeds for a matched peer sale at full live price. */
export function peerSaleProceeds(market: MarketState, resource: PhysicalResource, qty: number): Fp {
  return market.livePrice[resource] * qty;
}
