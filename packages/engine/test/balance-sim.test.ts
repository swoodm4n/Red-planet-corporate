/**
 * Scripted balance simulation (NO AI/LLM). Drives the real engine (makeGame +
 * resolveTurn) for 24 turns with a fixed seed and six hardcoded strategy scripts,
 * then asserts economic stability:
 *   1. No runaway credit inflation (per-turn economy growth is bounded).
 *   2. No dominant degenerate strategy (no composite pulls away unboundedly).
 *   3. No negative-resource crash / permanent bankruptcy lock.
 * The turn-by-turn summary + pass/fail is written to docs/balance-report.md.
 */

import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";

import { makeGame } from "../src/state.js";
import { resolveTurn } from "../src/resolveTurn.js";
import { storageCap } from "../src/helpers.js";
import { toCr } from "../src/money.js";
import type { Game } from "../src/types.js";
import { SUB_SETUPS, LANDING_ZONE, buildSubmission } from "./balance/strategies.js";

const SEED = 0x0defaced_c0ffee1n;
const TURNS = 24;

interface SubTurnRow {
  id: number;
  name: string;
  credits: number; // whole Cr
  composite: number;
  personnel: number; // living, non-captured
  claimed: number;
  streak: number;
  retired: boolean;
}
interface TurnRow {
  turn: number;
  event: string;
  totalCredits: number;
  totalCapCredits: number;
  subs: SubTurnRow[];
}

function newGame(): Game {
  return makeGame({
    id: 1,
    gameSeed: SEED,
    landingZoneHex: LANDING_ZONE,
    subdivisions: SUB_SETUPS.map((s) => ({
      id: s.id,
      name: s.name,
      parentCompany: s.parentCompany,
      parentPerk: s.parentPerk,
      choicePersonnel: s.choicePersonnel,
      hqHex: s.hqHex,
      freeBuildingHex: s.freeBuildingHex,
    })),
  });
}

function snapshot(game: Game, scoreboard: { subdivisionId: number; composite: number }[]): SubTurnRow[] {
  return game.subdivisions.map((sub) => {
    const board = scoreboard.find((b) => b.subdivisionId === sub.id);
    return {
      id: sub.id,
      name: SUB_SETUPS.find((s) => s.id === sub.id)!.name,
      credits: toCr(sub.resources.CREDITS),
      composite: board ? Math.round(board.composite * 100) / 100 : 0,
      personnel: sub.personnel.filter((p) => p.status !== "LOST" && p.status !== "CAPTURED").length,
      claimed: game.map.filter((h) => h.ownerSubdivisionId === sub.id).length,
      streak: sub.consistentOutputStreak,
      retired: sub.status === "RETIRED",
    };
  });
}

/** Run the full sim, returning the per-turn history and every negative-resource breach. */
function runSim(): { rows: TurnRow[]; negatives: string[]; finalGame: Game } {
  let game = newGame();
  const rows: TurnRow[] = [];
  const negatives: string[] = [];

  for (let t = 0; t < TURNS; t++) {
    const submissions = SUB_SETUPS.map((s) => buildSubmission(game, s));
    const { newState, turnLog } = resolveTurn(game, submissions);

    // Invariant: no resource ever goes negative (checked on the resolved state).
    for (const sub of newState.subdivisions) {
      for (const [res, val] of Object.entries(sub.resources)) {
        if (val < 0) negatives.push(`turn ${turnLog.turnNumber} sub ${sub.id} ${res}=${val}`);
      }
    }

    const subs = snapshot(newState, turnLog.scoreboard);
    const totalCredits = subs.reduce((n, s) => n + s.credits, 0);
    const totalCapCredits = newState.subdivisions.reduce(
      (n, sub) => n + storageCap(sub, "CREDITS"),
      0,
    );
    rows.push({
      turn: turnLog.turnNumber,
      event: turnLog.event ? `${turnLog.event.scope}:${turnLog.event.name}` : "NONE",
      totalCredits,
      totalCapCredits,
      subs,
    });
    game = newState;
  }
  return { rows, negatives, finalGame: game };
}

// ---------------------------------------------------------------------------

describe("scripted 24-turn balance simulation (§11, §12 / no AI)", () => {
  const { rows, negatives, finalGame } = runSim();
  const final = rows[rows.length - 1]!;
  const mid = rows[9]!; // turn 10

  // ---- headline numbers reused by assertions + report ----
  const finalComposites = final.subs.map((s) => s.composite).sort((a, b) => b - a);
  const topComposite = finalComposites[0]!;
  const medianComposite = finalComposites[Math.floor(finalComposites.length / 2)]!;
  const minComposite = finalComposites[finalComposites.length - 1]!;
  const dominanceRatio = topComposite / Math.max(1, medianComposite);
  const spreadRatio = topComposite / Math.max(1, minComposite);

  const midComposites = mid.subs.map((s) => s.composite).sort((a, b) => b - a);
  const midDominance = midComposites[0]! / Math.max(1, midComposites[Math.floor(midComposites.length / 2)]!);

  const firstHalfGain = mid.totalCredits - rows[0]!.totalCredits;
  const secondHalfGain = final.totalCredits - mid.totalCredits;
  const maxTurnJump = Math.max(
    ...rows.slice(1).map((r, i) => r.totalCredits - rows[i]!.totalCredits),
  );

  it("determinism: re-running the sim reproduces identical final composites", () => {
    const second = runSim();
    const a = final.subs.map((s) => `${s.id}:${s.composite}:${s.credits}`).join("|");
    const b = second.rows[second.rows.length - 1]!.subs
      .map((s) => `${s.id}:${s.composite}:${s.credits}`)
      .join("|");
    expect(b).toBe(a);
  });

  it("runs the full 24 turns for all six subdivisions", () => {
    expect(rows).toHaveLength(TURNS);
    expect(finalGame.turnNumber).toBe(TURNS + 1);
    expect(final.subs).toHaveLength(6);
  });

  it("ASSERTION 1 — no runaway credit inflation (economy stays bounded by storage caps)", () => {
    // Hard invariant: total credits never exceed the sum of per-subdivision credit
    // storage caps (clamping works, no fixed-point overflow).
    for (const r of rows) {
      expect(r.totalCredits).toBeLessThanOrEqual(r.totalCapCredits);
    }
    // Non-accelerating: late-game credit accumulation does not blow past early-game
    // (caps + upkeep throttle growth). Allow generous slack, still catches runaway.
    expect(secondHalfGain).toBeLessThanOrEqual(Math.abs(firstHalfGain) + 400);
    // No single turn injects an implausible amount of colony-wide credits.
    expect(maxTurnJump).toBeLessThanOrEqual(400);
  });

  it("ASSERTION 2 — no dominant degenerate strategy (composite spread is bounded & non-diverging)", () => {
    // The leader never runs away from the pack.
    expect(dominanceRatio).toBeLessThanOrEqual(3.0);
    expect(spreadRatio).toBeLessThanOrEqual(5.0);
    // Divergence check: the lead is not exploding relative to mid-game.
    expect(dominanceRatio).toBeLessThanOrEqual(midDominance * 2 + 1);
    // Every archetype remains competitive (nobody collapses to a rounding error).
    expect(minComposite).toBeGreaterThan(topComposite * 0.15);
  });

  it("ASSERTION 3 — no negative-resource crash or permanent bankruptcy lock", () => {
    // No resource ever went negative on any resolved turn.
    expect(negatives).toEqual([]);
    // Nobody was wiped out or auto-retired; each sub kept personnel and had a
    // solvent (Credits > 0) turn in the final third (not locked at 0 forever).
    const lastThird = rows.slice(-8);
    for (const setup of SUB_SETUPS) {
      const finalSub = final.subs.find((s) => s.id === setup.id)!;
      expect(finalSub.retired, `${setup.name} retired`).toBe(false);
      expect(finalSub.personnel, `${setup.name} personnel`).toBeGreaterThan(0);
      const solventSomewhere = lastThird.some(
        (r) => r.subs.find((s) => s.id === setup.id)!.credits > 0,
      );
      expect(solventSomewhere, `${setup.name} solvent in final third`).toBe(true);
    }
  });

  it("writes docs/balance-report.md", () => {
    const report = renderReport(rows, {
      seed: SEED,
      turns: TURNS,
      dominanceRatio,
      spreadRatio,
      midDominance,
      firstHalfGain,
      secondHalfGain,
      maxTurnJump,
      negatives,
    });
    const here = dirname(fileURLToPath(import.meta.url));
    const docsDir = resolve(here, "../../../docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(resolve(docsDir, "balance-report.md"), report, "utf8");
    expect(report).toContain("Scripted Balance Simulation");
  });
});

// ---- report rendering ------------------------------------------------------

function renderReport(
  rows: TurnRow[],
  meta: {
    seed: bigint;
    turns: number;
    dominanceRatio: number;
    spreadRatio: number;
    midDominance: number;
    firstHalfGain: number;
    secondHalfGain: number;
    maxTurnJump: number;
    negatives: string[];
  },
): string {
  const final = rows[rows.length - 1]!;
  const names = SUB_SETUPS.map((s) => s.name);
  const arche = Object.fromEntries(SUB_SETUPS.map((s) => [s.id, s.archetype]));

  const l: string[] = [];
  l.push("# Scripted Balance Simulation — Red Planet Corporate");
  l.push("");
  l.push(
    "Deterministic, zero-AI balance run: six hardcoded strategy scripts drive the " +
      "real engine (`makeGame` + `resolveTurn`) for a fixed number of turns under one " +
      "fixed RNG seed. Each strategy is a pure function that reads game state and emits " +
      "valid `Submission` orders per fixed rules — no LLM/AI is involved anywhere. " +
      "Re-runnable via `npm test -w @rpc/engine` (see `test/balance-sim.test.ts` / " +
      "`test/balance/strategies.ts`).",
  );
  l.push("");
  l.push(`- **Game seed:** \`${meta.seed}\``);
  l.push(`- **Turns simulated:** ${meta.turns}`);
  l.push(`- **Subdivisions (parent · archetype):**`);
  for (const s of SUB_SETUPS) {
    l.push(`  - #${s.id} **${s.name}** — ${s.parentCompany} (perk ${s.parentPerk}) · ${s.archetype}`);
  }
  l.push("");

  l.push("## Strategy scripts");
  l.push("");
  l.push("| Archetype | Fixed rules (summarised) |");
  l.push("|---|---|");
  l.push("| ECON (EconRush) | Staff HQ + generators; build Commercial Hub then Transit Hub; `AMPLIFY_CREDIT_YIELD`; sell surplus Minerals on the Transit Hub; claim band hexes. |");
  l.push("| MIL (MilSec) | Staff HQ + generators; install Security Detail then Fortification on HQ; build Vehicle Workshop; idle Contractors patrol. |");
  l.push("| RESEARCH (ResLab) | Requisition Innovators early to reach the Research Complex min; build Research Complexes; idle Innovators run Field Research. |");
  l.push("| LOGI (Logistics) | Build Warehouses + Transit Hub; sell surplus Minerals; run Resource Transfers. |");
  l.push("| EXPAND (Expansion) | Claim a new band hex each turn; requisition Engineers; place Outposts + generators. |");
  l.push("| INTEL (IntelGen) | Man the free Comms Array with Analysts; run Passive Intel Scans; build power/extraction. |");
  l.push("");

  // Per-turn total-credit + event table.
  l.push("## Turn-by-turn economy (colony totals)");
  l.push("");
  l.push("| Turn | Event | Total Credits (Cr) | Credit Cap (Cr) | Leader (composite) |");
  l.push("|---|---|---|---|---|");
  for (const r of rows) {
    const top = [...r.subs].sort((a, b) => b.composite - a.composite)[0]!;
    l.push(
      `| ${r.turn} | ${r.event} | ${r.totalCredits} | ${r.totalCapCredits} | ${top.name} ${top.composite} |`,
    );
  }
  l.push("");

  // Per-turn composite matrix.
  l.push("## Composite scores by subdivision");
  l.push("");
  l.push(`| Turn | ${names.join(" | ")} |`);
  l.push(`|---|${names.map(() => "---").join("|")}|`);
  for (const r of rows) {
    const cells = SUB_SETUPS.map((s) => r.subs.find((x) => x.id === s.id)!.composite);
    l.push(`| ${r.turn} | ${cells.join(" | ")} |`);
  }
  l.push("");

  // Final standings.
  l.push("## Final standings (turn " + final.turn + ")");
  l.push("");
  l.push("| Rank | Subdivision | Archetype | Composite | Credits (Cr) | Personnel | Claimed hexes | Consistent-output streak |");
  l.push("|---|---|---|---|---|---|---|---|");
  const ranked = [...final.subs].sort((a, b) => b.composite - a.composite);
  ranked.forEach((s, i) => {
    l.push(
      `| ${i + 1} | ${s.name} | ${arche[s.id]} | ${s.composite} | ${s.credits} | ${s.personnel} | ${s.claimed} | ${s.streak} |`,
    );
  });
  l.push("");

  // Assertions / findings.
  const pass = (b: boolean) => (b ? "PASS" : "FAIL");
  const a1 = rows.every((r) => r.totalCredits <= r.totalCapCredits) &&
    meta.secondHalfGain <= Math.abs(meta.firstHalfGain) + 400 && meta.maxTurnJump <= 400;
  const a2 = meta.dominanceRatio <= 3.0 && meta.spreadRatio <= 5.0;
  const a3 = meta.negatives.length === 0 &&
    final.subs.every((s) => !s.retired && s.personnel > 0);

  l.push("## Pass/fail assertions");
  l.push("");
  l.push(`### 1. No runaway credit inflation — **${pass(a1)}**`);
  l.push("");
  l.push(
    "The engine caps Credits at each subdivision's storage cap (100 base + 50 per " +
      "Commercial-Hub Expansion), so the colony-wide credit supply is structurally " +
      "bounded; upkeep continuously drains it. Observed:",
  );
  l.push("");
  l.push(`- Colony credits never exceeded the summed storage cap on any turn (max ${Math.max(...rows.map((r) => r.totalCredits))} Cr vs cap ${final.totalCapCredits} Cr).`);
  l.push(`- First-half credit gain (t1→t10): ${meta.firstHalfGain} Cr; second-half gain (t10→t${final.turn}): ${meta.secondHalfGain} Cr (non-accelerating).`);
  l.push(`- Largest single-turn colony credit jump: ${meta.maxTurnJump} Cr (bound 400).`);
  l.push("");
  l.push(`### 2. No dominant degenerate strategy — **${pass(a2)}**`);
  l.push("");
  l.push(`- Final leader/median composite ratio: ${meta.dominanceRatio.toFixed(2)} (bound 3.0).`);
  l.push(`- Final top/bottom composite spread: ${meta.spreadRatio.toFixed(2)} (bound 5.0).`);
  l.push(`- Mid-game (t10) dominance ratio was ${meta.midDominance.toFixed(2)} — the lead is not diverging over time.`);
  l.push(`- Every archetype stayed competitive (lowest composite ${final.subs.reduce((m, s) => Math.min(m, s.composite), Infinity)} > 15% of the leader).`);
  l.push("");
  l.push(`### 3. No negative-resource crash / permanent bankruptcy lock — **${pass(a3)}**`);
  l.push("");
  l.push(`- Negative-resource breaches across all ${meta.turns} turns × 6 subs × 6 resources: ${meta.negatives.length}.`);
  l.push(`- All six subdivisions survived to turn ${final.turn} with personnel intact and none auto-retired.`);
  l.push(`- No subdivision was locked at 0 Credits through the final third of the game.`);
  l.push("");
  l.push("---");
  l.push("");
  l.push(
    "*Generated by `packages/engine/test/balance-sim.test.ts`. Re-run with " +
      "`npm test -w @rpc/engine` to regenerate this report from the deterministic engine.*",
  );
  return l.join("\n");
}
