/**
 * Report builders enforcing the GAME_SPEC §18 information-visibility split.
 * These are the ONLY shapes returned to players. `buildPrivateReport` includes
 * one subdivision's private data; every other subdivision is reduced to its
 * public projection. Authorization (who may call these) is enforced upstream in
 * the route via `assertSubdivisionAccess`; these functions additionally guarantee
 * no private field of a non-owned subdivision ever leaks into the payload.
 */

import {
  type Game,
  type Subdivision,
  MARKET_RESOURCE_ORDER,
  categoryLeaders,
  computeCategoryScores,
  composite,
  computeScoreboard,
  displayCr,
  rankByComposite,
  toCr,
} from "@rpc/engine";

function leadingCategory(cats: Record<string, number>): string {
  let best = "";
  let bestVal = -Infinity;
  for (const [k, v] of Object.entries(cats)) {
    if (v > bestVal) {
      bestVal = v;
      best = k;
    }
  }
  return best;
}

/** Public per-subdivision facts (§18 Public). No stockpiles, ER, garrison, cum. */
function publicSubdivision(game: Game, sub: Subdivision) {
  const cats = computeCategoryScores(game, sub);
  return {
    subdivisionId: sub.id,
    name: sub.name,
    parentCompany: sub.parentCompany,
    status: sub.status,
    composite: composite(cats),
    leadingCategory: leadingCategory(cats as unknown as Record<string, number>),
    // Building existence & type + claimed hex ownership are public.
    buildings: sub.buildings
      .filter((b) => b.status !== "DERELICT")
      .map((b) => ({ id: b.id, type: b.type, tier: b.tier, hex: b.hex, status: b.status })),
    closedBordersAgainst: Array.from(sub.closedBordersAgainst),
  };
}

export function marketView(game: Game) {
  return MARKET_RESOURCE_ORDER.map((res) => ({
    resource: res,
    livePriceFp: game.market.livePrice[res],
    livePrice: displayCr(game.market.livePrice[res]),
    cumulativeBought: game.market.cumulativeBought[res],
    cumulativeSold: game.market.cumulativeSold[res],
  }));
}

export function equityView(game: Game) {
  return {
    sharePrices: Object.entries(game.equity.sharePrice).map(([issuer, price]) => ({
      issuerSubdivisionId: Number(issuer),
      sharePriceFp: price,
      sharePrice: displayCr(price),
    })),
    holdings: game.equity.holdings.map((h) => ({
      issuerSubdivisionId: h.issuerSubdivisionId,
      holderSubdivisionId: h.holderSubdivisionId,
      shares: h.shares,
    })),
  };
}

export function standingsView(game: Game) {
  const boards = computeScoreboard(game);
  const ranked = rankByComposite(boards);
  const leaders = categoryLeaders(boards);
  return {
    leaders,
    standings: ranked.map((b, i) => {
      const sub = game.subdivisions.find((s) => s.id === b.subdivisionId)!;
      return {
        rank: i + 1,
        subdivisionId: b.subdivisionId,
        name: sub.name,
        parentCompany: sub.parentCompany,
        composite: b.composite,
        leadingCategory: leadingCategory(b.categories as unknown as Record<string, number>),
      };
    }),
  };
}

/** Public map: terrain + owner + hub/landing-zone location; no deposits/intel. */
export function publicMapView(game: Game) {
  return game.map.map((h) => ({
    col: h.coord.col,
    row: h.coord.row,
    terrain: h.terrain,
    ownerSubdivisionId: h.ownerSubdivisionId ?? null,
  }));
}

export function buildPublicDashboard(game: Game) {
  return {
    gameId: game.id,
    turnNumber: game.turnNumber,
    standings: standingsView(game),
    market: marketView(game),
    equity: equityView(game),
    map: publicMapView(game),
    subdivisions: game.subdivisions
      .filter((s) => s.status === "ACTIVE")
      .map((s) => publicSubdivision(game, s)),
  };
}

/** Full private data for one subdivision + public view of the rest. §20 report. */
export function buildPrivateReport(game: Game, subdivisionId: number) {
  const sub = game.subdivisions.find((s) => s.id === subdivisionId);
  if (!sub) return null;

  const cats = computeCategoryScores(game, sub);
  const boards = computeScoreboard(game);
  const ranked = rankByComposite(boards);
  const rank = ranked.findIndex((b) => b.subdivisionId === subdivisionId) + 1;

  const own = {
    subdivisionId: sub.id,
    name: sub.name,
    parentCompany: sub.parentCompany,
    parentPerk: sub.parentPerk,
    status: sub.status,
    earthRelations: sub.earthRelations,
    earthRelationsBonusActive: sub.earthRelationsBonusActive,
    // Exact stockpiles (private). Money in fixed-point + display.
    resources: {
      CREDITS: sub.resources.CREDITS,
      creditsDisplay: displayCr(sub.resources.CREDITS),
      ENERGY: sub.resources.ENERGY,
      MINERALS: sub.resources.MINERALS,
      WATER: sub.resources.WATER,
      FOOD: sub.resources.FOOD,
      RESEARCH: sub.resources.RESEARCH,
    },
    buildings: sub.buildings.map((b) => ({
      id: b.id,
      type: b.type,
      tier: b.tier,
      hex: b.hex,
      status: b.status,
      builtOnTurn: b.builtOnTurn,
      garrison: b.garrison,
      modules: b.modules,
      disabledUntilTurn: b.disabledUntilTurn,
      dormantTurns: b.dormantTurns,
    })),
    personnel: sub.personnel.map((p) => ({
      id: p.id,
      type: p.type,
      status: p.status,
      assignedBuildingId: p.assignedBuildingId ?? null,
      assignedVehicleId: p.assignedVehicleId ?? null,
      unavailableUntilTurn: p.unavailableUntilTurn,
      arrivalTurn: p.arrivalTurn ?? null,
      requisitionType: p.requisitionType ?? null,
    })),
    vehicles: sub.vehicles,
    capturedUnits: sub.capturedUnits,
    closedBordersAgainst: Array.from(sub.closedBordersAgainst),
    cumulativeCounters: sub.cum,
    consistentOutputStreak: sub.consistentOutputStreak,
    insolventStreak: sub.insolventStreak,
    scoring: { categories: cats, composite: composite(cats), rank },
    equityHoldings: game.equity.holdings.filter((h) => h.holderSubdivisionId === subdivisionId),
    creditsEarnedFromSalesDisplay: toCr(sub.cum.creditsEarnedFromSales),
  };

  return {
    gameId: game.id,
    turnNumber: game.turnNumber,
    own,
    // Everyone else: public only.
    others: game.subdivisions
      .filter((s) => s.id !== subdivisionId && s.status === "ACTIVE")
      .map((s) => publicSubdivision(game, s)),
    market: marketView(game),
    standings: standingsView(game),
  };
}
