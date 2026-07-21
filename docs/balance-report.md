# Scripted Balance Simulation — Red Planet Corporate

Deterministic, zero-AI balance run: six hardcoded strategy scripts drive the real engine (`makeGame` + `resolveTurn`) for a fixed number of turns under one fixed RNG seed. Each strategy is a pure function that reads game state and emits valid `Submission` orders per fixed rules — no LLM/AI is involved anywhere. Re-runnable via `npm test -w @rpc/engine` (see `test/balance-sim.test.ts` / `test/balance/strategies.ts`).

- **Game seed:** `62763211192008417`
- **Turns simulated:** 24
- **Subdivisions (parent · archetype):**
  - #1 **EconRush** — STELLAR_DYNAMICS (perk A) · ECON
  - #2 **MilSec** — OMEGA_SECURITY (perk A) · MIL
  - #3 **ResLab** — HELIX_PHARMA (perk A) · RESEARCH
  - #4 **Logistics** — UNIFIED_MINING (perk A) · LOGI
  - #5 **Expansion** — TERRA_AGRICULTURAL (perk A) · EXPAND
  - #6 **IntelGen** — GENESIS_TECH (perk A) · INTEL

## Strategy scripts

| Archetype | Fixed rules (summarised) |
|---|---|
| ECON (EconRush) | Staff HQ + generators; build Commercial Hub then Transit Hub; `AMPLIFY_CREDIT_YIELD`; sell surplus Minerals on the Transit Hub; claim band hexes. |
| MIL (MilSec) | Staff HQ + generators; install Security Detail then Fortification on HQ; build Vehicle Workshop; idle Contractors patrol. |
| RESEARCH (ResLab) | Requisition Innovators early to reach the Research Complex min; build Research Complexes; idle Innovators run Field Research. |
| LOGI (Logistics) | Build Warehouses + Transit Hub; sell surplus Minerals; run Resource Transfers. |
| EXPAND (Expansion) | Claim a new band hex each turn; requisition Engineers; place Outposts + generators. |
| INTEL (IntelGen) | Man the free Comms Array with Analysts; run Passive Intel Scans; build power/extraction. |

## Turn-by-turn economy (colony totals)

| Turn | Event | Total Credits (Cr) | Credit Cap (Cr) | Leader (composite) |
|---|---|---|---|---|
| 1 | NONE:No Event | 197 | 600 | EconRush 63.25 |
| 2 | NONE:No Event | 161 | 600 | EconRush 61.25 |
| 3 | NONE:No Event | 174 | 620 | IntelGen 59.5 |
| 4 | NONE:No Event | 180 | 640 | IntelGen 66.75 |
| 5 | NONE:No Event | 209 | 640 | EconRush 76.5 |
| 6 | NONE:No Event | 250 | 660 | EconRush 92.75 |
| 7 | NONE:No Event | 287 | 660 | EconRush 109.25 |
| 8 | NONE:No Event | 306 | 660 | EconRush 114.75 |
| 9 | NONE:No Event | 323 | 660 | EconRush 105.25 |
| 10 | NONE:No Event | 347 | 660 | EconRush 113.75 |
| 11 | NONE:No Event | 371 | 660 | IntelGen 117.5 |
| 12 | NONE:No Event | 396 | 660 | IntelGen 124.75 |
| 13 | NONE:No Event | 419 | 660 | IntelGen 130 |
| 14 | NONE:No Event | 433 | 660 | IntelGen 132.25 |
| 15 | NONE:No Event | 444 | 660 | IntelGen 134.75 |
| 16 | NONE:No Event | 455 | 660 | IntelGen 137.25 |
| 17 | REGIONAL:Equipment Cache | 471 | 660 | IntelGen 138.75 |
| 18 | NONE:No Event | 477 | 660 | ResLab 141.25 |
| 19 | NONE:No Event | 488 | 660 | ResLab 147.5 |
| 20 | NONE:No Event | 495 | 660 | ResLab 149.75 |
| 21 | NONE:No Event | 501 | 660 | ResLab 151 |
| 22 | NONE:No Event | 507 | 660 | ResLab 152.25 |
| 23 | COLONY:Dust Storm Season | 513 | 660 | ResLab 153.5 |
| 24 | NONE:No Event | 519 | 660 | ResLab 154.75 |

## Composite scores by subdivision

| Turn | EconRush | MilSec | ResLab | Logistics | Expansion | IntelGen |
|---|---|---|---|---|---|---|
| 1 | 63.25 | 55 | 54 | 58.5 | 58.25 | 58.75 |
| 2 | 61.25 | 51 | 38.75 | 59.25 | 45.75 | 52.75 |
| 3 | 56.5 | 56 | 43.25 | 58.5 | 55 | 59.5 |
| 4 | 65 | 61 | 46.75 | 53.25 | 45.75 | 66.75 |
| 5 | 76.5 | 58 | 54.75 | 57.75 | 56.25 | 74 |
| 6 | 92.75 | 61.5 | 65.25 | 62.25 | 63.75 | 81.25 |
| 7 | 109.25 | 65 | 73.75 | 66.75 | 67.25 | 88.5 |
| 8 | 114.75 | 68.5 | 68.75 | 71.25 | 77 | 95.75 |
| 9 | 105.25 | 72.75 | 76.25 | 75.75 | 84.75 | 103 |
| 10 | 113.75 | 77 | 83.75 | 80.25 | 82 | 110.25 |
| 11 | 116.25 | 81.25 | 91.25 | 85.25 | 92.5 | 117.5 |
| 12 | 117.75 | 85.5 | 98.75 | 90.25 | 101.25 | 124.75 |
| 13 | 119.25 | 89.75 | 106.25 | 95.25 | 111 | 130 |
| 14 | 120.75 | 85.5 | 113.75 | 100.25 | 120.75 | 132.25 |
| 15 | 122.25 | 89.5 | 121.25 | 105.25 | 122.5 | 134.75 |
| 16 | 123.75 | 92.75 | 128.75 | 110.25 | 124.25 | 137.25 |
| 17 | 131.5 | 96 | 135 | 115.25 | 126 | 138.75 |
| 18 | 128 | 99.25 | 141.25 | 120.25 | 127.5 | 140 |
| 19 | 129.5 | 102.5 | 147.5 | 125.25 | 128 | 141.25 |
| 20 | 131 | 105.75 | 149.75 | 130.25 | 128.5 | 142.5 |
| 21 | 132.5 | 109 | 151 | 135.25 | 129 | 143.75 |
| 22 | 134 | 112.25 | 152.25 | 140.25 | 129.5 | 145 |
| 23 | 135.5 | 115.5 | 153.5 | 145.25 | 130 | 146.25 |
| 24 | 136.75 | 118.5 | 154.75 | 150 | 130.5 | 147.5 |

## Final standings (turn 24)

| Rank | Subdivision | Archetype | Composite | Credits (Cr) | Personnel | Claimed hexes | Consistent-output streak |
|---|---|---|---|---|---|---|---|
| 1 | ResLab | RESEARCH | 154.75 | 85 | 8 | 1 | 20 |
| 2 | Logistics | LOGI | 150 | 108 | 10 | 1 | 24 |
| 3 | IntelGen | INTEL | 147.5 | 85 | 8 | 1 | 24 |
| 4 | EconRush | ECON | 136.75 | 83 | 10 | 4 | 24 |
| 5 | Expansion | EXPAND | 130.5 | 81 | 10 | 6 | 15 |
| 6 | MilSec | MIL | 118.5 | 77 | 10 | 1 | 24 |

## Pass/fail assertions

### 1. No runaway credit inflation — **PASS**

The engine caps Credits at each subdivision's storage cap (100 base + 50 per Commercial-Hub Expansion), so the colony-wide credit supply is structurally bounded; upkeep continuously drains it. Observed:

- Colony credits never exceeded the summed storage cap on any turn (max 519 Cr vs cap 660 Cr).
- First-half credit gain (t1→t10): 150 Cr; second-half gain (t10→t24): 172 Cr (non-accelerating).
- Largest single-turn colony credit jump: 41 Cr (bound 400).

### 2. No dominant degenerate strategy — **PASS**

- Final leader/median composite ratio: 1.13 (bound 3.0).
- Final top/bottom composite spread: 1.31 (bound 5.0).
- Mid-game (t10) dominance ratio was 1.39 — the lead is not diverging over time.
- Every archetype stayed competitive (lowest composite 118.5 > 15% of the leader).

### 3. No negative-resource crash / permanent bankruptcy lock — **PASS**

- Negative-resource breaches across all 24 turns × 6 subs × 6 resources: 0.
- All six subdivisions survived to turn 24 with personnel intact and none auto-retired.
- No subdivision was locked at 0 Credits through the final third of the game.

---

*Generated by `packages/engine/test/balance-sim.test.ts`. Re-run with `npm test -w @rpc/engine` to regenerate this report from the deterministic engine.*