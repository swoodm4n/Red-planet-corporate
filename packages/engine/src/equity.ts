/**
 * Subdivision equity market & dividends. GAME_SPEC §11.3 / [D-007].
 * 100 fixed shares/subdivision, start 10 Cr. Trades execute Phase 5 at pre-turn
 * price; price recomputed Phase 8. Dividends paid Phase 3 from issuer Credits.
 */

import { clampFp, cr, fpMul, roundHalfUp, type Fp } from "./money.js";
import type { EquityState, Game, Subdivision } from "./types.js";

export const TOTAL_SHARES = 100;
export const INITIAL_SHARE_PRICE: Fp = cr(10);

export function makeInitialEquity(subdivisions: Subdivision[]): EquityState {
  const sharePrice: Record<number, Fp> = {};
  const holdings = [];
  const netSharesTradedThisTurn: Record<number, number> = {};
  for (const s of subdivisions) {
    sharePrice[s.id] = INITIAL_SHARE_PRICE;
    netSharesTradedThisTurn[s.id] = 0;
    // Issuer initially holds all 100 of its own shares.
    holdings.push({ issuerSubdivisionId: s.id, holderSubdivisionId: s.id, shares: TOTAL_SHARES });
  }
  return { sharePrice, holdings, netSharesTradedThisTurn };
}

export function sharesHeld(equity: EquityState, issuerId: number, holderId: number): number {
  const h = equity.holdings.find(
    (x) => x.issuerSubdivisionId === issuerId && x.holderSubdivisionId === holderId,
  );
  return h ? h.shares : 0;
}

export function setShares(
  equity: EquityState,
  issuerId: number,
  holderId: number,
  shares: number,
): void {
  const h = equity.holdings.find(
    (x) => x.issuerSubdivisionId === issuerId && x.holderSubdivisionId === holderId,
  );
  if (h) {
    h.shares = shares;
  } else {
    equity.holdings.push({ issuerSubdivisionId: issuerId, holderSubdivisionId: holderId, shares });
  }
}

/**
 * Phase 8 price recompute. §11.3:
 *   anchor     = CompositeScore/10 + 5
 *   pressure   = clamp((netSharesTraded/10)*0.05, -0.15, +0.15)
 *   sharePrice = max(1.0, anchor * (1 + pressure))
 */
export function recomputeSharePrice(compositeScore: number, netSharesTraded: number): Fp {
  const anchor = compositeScore / 10 + 5; // in Cr
  const rawPressure = (netSharesTraded / 10) * 0.05;
  const pressure = Math.max(-0.15, Math.min(0.15, rawPressure));
  const price = anchor * (1 + pressure); // Cr
  const floor = cr(1.0);
  return clampFp(roundHalfUp(price * 10000), floor, Number.MAX_SAFE_INTEGER);
}

/**
 * Dividend per issuer, paid Phase 3 from the issuer's Credits. §11.3 / [D-007].
 * Total = EconomicScore/20 (Cr). Split by shareholding among *other* holders and
 * the issuer itself. If issuer cannot pay in full, pay pro-rata down to 0.
 * Returns per-holder payouts (fp) actually paid.
 */
export function computeDividends(
  equity: EquityState,
  issuer: Subdivision,
  economicScore: number,
): { holderId: number; amount: Fp }[] {
  const totalCr = economicScore / 20;
  if (totalCr <= 0) return [];
  const totalFp = roundHalfUp(totalCr * 10000);

  // Determine each holder's share of the pool (excluding the issuer's own retained
  // shares — issuer paying itself a dividend is a no-op, so we distribute only to
  // external holders proportionally to their holdings out of TOTAL_SHARES). [D-007]
  const externalHoldings = equity.holdings.filter(
    (h) => h.issuerSubdivisionId === issuer.id && h.holderSubdivisionId !== issuer.id && h.shares > 0,
  );
  if (externalHoldings.length === 0) return [];

  const payouts: { holderId: number; amount: Fp }[] = [];
  let want = 0;
  for (const h of externalHoldings) {
    const amount = roundHalfUp((totalFp * h.shares) / TOTAL_SHARES);
    payouts.push({ holderId: h.holderSubdivisionId, amount });
    want += amount;
  }

  // Affordability: pay pro-rata down to what the issuer holds. [D-007]/[D-020]
  const available = issuer.resources.CREDITS;
  if (want > available && want > 0) {
    const scale = available / want;
    for (const p of payouts) {
      p.amount = Math.floor(p.amount * scale);
    }
  }
  return payouts.filter((p) => p.amount > 0);
}

export function resetEquityTurnFlow(game: Game): void {
  for (const key of Object.keys(game.equity.netSharesTradedThisTurn)) {
    game.equity.netSharesTradedThisTurn[Number(key)] = 0;
  }
}

export { fpMul };
