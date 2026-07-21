/**
 * Six-category scoring & composite. GAME_SPEC §12 / [D-035].
 * Category leader = max raw score per category. Ranking ties -> ascending id.
 */

import { RESOURCE_GENERATORS } from "./constants.js";
import { countActiveModule, isOperational } from "./helpers.js";
import { toCr } from "./money.js";
import type { Game, Subdivision } from "./types.js";

export interface CategoryScores {
  economic: number;
  industrial: number;
  research: number;
  territorial: number;
  security: number;
  intelligence: number;
}

export interface Scoreboard {
  subdivisionId: number;
  categories: CategoryScores;
  composite: number;
}

export const CATEGORY_WEIGHTS = {
  economic: 1.0,
  industrial: 1.0,
  research: 1.0,
  territorial: 1.0,
  security: 0.75,
  intelligence: 0.75,
} as const;

function claimedHexCount(game: Game, sub: Subdivision): number {
  return game.map.filter((h) => h.ownerSubdivisionId === sub.id).length;
}

export function computeCategoryScores(game: Game, sub: Subdivision): CategoryScores {
  const turn = game.turnNumber;

  // Economic: Credits + (cumulative sales+amplify credits / 10). Credits in Cr.
  const economic =
    toCr(sub.resources.CREDITS) + toCr(sub.cum.creditsEarnedFromSales) / 10;

  // Industrial: (E+Min+W+F)/4 + 1*(active Resource Generators).
  const activeGenerators = sub.buildings.filter(
    (b) => RESOURCE_GENERATORS.includes(b.type) && isOperational(b, turn),
  ).length;
  const industrial =
    (sub.resources.ENERGY + sub.resources.MINERALS + sub.resources.WATER + sub.resources.FOOD) /
      4 +
    activeGenerators;

  // Research: cum.researchGenerated + 2*cum.researchSubmissions.
  const research = sub.cum.researchGenerated + 2 * sub.cum.researchSubmissions;

  // Territorial: 2*claimed hexes + 3*(HQ held) + 1*(Outposts held).
  const hqHeld = sub.buildings.filter(
    (b) => b.type === "HEADQUARTERS" && b.status === "ACTIVE",
  ).length;
  const outpostsHeld = sub.buildings.filter(
    (b) => b.type === "OUTPOST" && b.status === "ACTIVE",
  ).length;
  const territorial = 2 * claimedHexCount(game, sub) + 3 * hqHeld + outpostsHeld;

  // Security: 2*defenses + 2*intercepts + (Fortification + Security Detail modules).
  const fortAndSecurity = sub.buildings.reduce(
    (n, b) => n + countActiveModule(b, "FORTIFICATION") + countActiveModule(b, "SECURITY_DETAIL"),
    0,
  );
  const security =
    2 * sub.cum.successfulSabotageDefenses +
    2 * sub.cum.successfulIntercepts +
    fortAndSecurity;

  // Intelligence: 2*(sabotage+surveillance) + 3*undetectedPlantIntel.
  const intelligence =
    2 * (sub.cum.successfulSabotageActions + sub.cum.successfulSurveillance) +
    3 * sub.cum.undetectedPlantIntel;

  return { economic, industrial, research, territorial, security, intelligence };
}

export function composite(categories: CategoryScores): number {
  return (
    categories.economic * CATEGORY_WEIGHTS.economic +
    categories.industrial * CATEGORY_WEIGHTS.industrial +
    categories.research * CATEGORY_WEIGHTS.research +
    categories.territorial * CATEGORY_WEIGHTS.territorial +
    categories.security * CATEGORY_WEIGHTS.security +
    categories.intelligence * CATEGORY_WEIGHTS.intelligence
  );
}

export function computeScoreboard(game: Game): Scoreboard[] {
  return game.subdivisions
    .filter((s) => s.status === "ACTIVE")
    .map((s) => {
      const categories = computeCategoryScores(game, s);
      return { subdivisionId: s.id, categories, composite: composite(categories) };
    });
}

export type CategoryKey = keyof CategoryScores;
export const CATEGORY_KEYS: CategoryKey[] = [
  "economic",
  "industrial",
  "research",
  "territorial",
  "security",
  "intelligence",
];

/** Rank by composite desc, ties -> ascending subdivisionId. */
export function rankByComposite(boards: Scoreboard[]): Scoreboard[] {
  return [...boards].sort((a, b) => {
    if (b.composite !== a.composite) return b.composite - a.composite;
    return a.subdivisionId - b.subdivisionId;
  });
}

/** Category leader per category (max raw; ties -> ascending id). */
export function categoryLeaders(boards: Scoreboard[]): Record<CategoryKey, number | null> {
  const leaders = {} as Record<CategoryKey, number | null>;
  for (const key of CATEGORY_KEYS) {
    let best: Scoreboard | null = null;
    for (const b of boards) {
      if (
        best === null ||
        b.categories[key] > best.categories[key] ||
        (b.categories[key] === best.categories[key] && b.subdivisionId < best.subdivisionId)
      ) {
        best = b;
      }
    }
    leaders[key] = best ? best.subdivisionId : null;
  }
  return leaders;
}
