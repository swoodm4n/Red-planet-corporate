import { describe, it, expect } from "vitest";
import {
  computeCategoryScores,
  composite,
  rankByComposite,
  categoryLeaders,
  CATEGORY_WEIGHTS,
} from "../src/scoring.js";
import { makeTestGame } from "./fixtures.js";
import { cr } from "../src/money.js";

describe("scoring (§12 / [D-035])", () => {
  it("composite applies category weights", () => {
    const c = {
      economic: 10, industrial: 10, research: 10, territorial: 10,
      security: 8, intelligence: 8,
    };
    // 10+10+10+10 + 0.75*8 + 0.75*8 = 40 + 6 + 6 = 52
    expect(composite(c)).toBe(52);
    expect(CATEGORY_WEIGHTS.security).toBe(0.75);
  });

  it("economic score counts credits + cumulative sales/10", () => {
    const game = makeTestGame();
    const sub = game.subdivisions[0]!;
    sub.resources.CREDITS = cr(40);
    sub.cum.creditsEarnedFromSales = cr(100);
    const scores = computeCategoryScores(game, sub);
    // 40 + 100/10 = 50
    expect(scores.economic).toBe(50);
  });

  it("territorial counts claimed hexes, HQ, outposts", () => {
    const game = makeTestGame();
    const sub = game.subdivisions[0]!;
    // Starts with HQ + claimed HQ hex.
    const scores = computeCategoryScores(game, sub);
    // 2*claimed(1) + 3*HQ(1) + 0 outposts = 5
    expect(scores.territorial).toBe(5);
  });

  it("ranking breaks ties by ascending subdivision id", () => {
    const boards = [
      { subdivisionId: 3, categories: {} as any, composite: 10 },
      { subdivisionId: 1, categories: {} as any, composite: 10 },
      { subdivisionId: 2, categories: {} as any, composite: 20 },
    ];
    const ranked = rankByComposite(boards);
    expect(ranked.map((b) => b.subdivisionId)).toEqual([2, 1, 3]);
  });

  it("category leader is max raw, ties -> ascending id", () => {
    const boards = [
      { subdivisionId: 2, categories: { economic: 5, industrial: 0, research: 0, territorial: 0, security: 0, intelligence: 0 }, composite: 5 },
      { subdivisionId: 1, categories: { economic: 5, industrial: 9, research: 0, territorial: 0, security: 0, intelligence: 0 }, composite: 14 },
    ];
    const leaders = categoryLeaders(boards);
    expect(leaders.economic).toBe(1); // tie -> lower id
    expect(leaders.industrial).toBe(1);
  });
});
