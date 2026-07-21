# BUILD_SUMMARY.md — Red Planet Corporate

Final build summary for the from-scratch, deterministic Mars-colony strategy
game. This is the honest ledger of **what was built** and, importantly, **what
was simplified or intentionally left inert** relative to the source rulebook.
For the "why" behind every ambiguity resolution, see
[`DECISIONS.md`](DECISIONS.md) (D-001 … D-049). For the API contract see
[`apps/web/README.md`](apps/web/README.md); for setup and the GM handbook see
[`README.md`](README.md).

---

## What was built

**Spec (`GAME_SPEC.md`, `DECISIONS.md`).** The 25-sheet
`docs/master-rulebook.xlsx` — written for a human host who exercises
discretion — was translated into a single, unambiguous, implementable spec:
concrete data models, exact formulas, an eight-phase turn-resolution algorithm,
and enumerated edge cases. Every point where the rulebook was silent,
contradictory, or said "host discretion" is resolved by a numbered decision in
`DECISIONS.md` (49 decisions across economy/market, buildings/personnel, turn
processing/RNG/conflict, map/movement, vehicles/combat/retirement, scoring,
engine implementation, and backend). These documents are the binding contract
for all downstream code.

**Engine (`packages/engine`, `@rpc/engine`).** A pure, framework-agnostic,
zero-runtime-dependency TypeScript package implementing the deterministic rules:
order validation, the eight-phase resolution, the dynamic resource market,
subdivision equity market with dividends, Earth Relations, the event system,
conflict resolution and spotting, durational status effects, and scoring/
standings. Determinism is guaranteed by an in-house seeded RNG (SplitMix64 +
xoshiro256\*\*) with a fully specified consumption order ([D-016]) and
fixed-point money ([D-002]) — no floats, no wall-clock, no network. **105 vitest
tests pass** (unit per subsystem + integration + the balance simulation).

**Backend (`apps/web`, Next.js App Router + Prisma + PostgreSQL).** The server
persists, authorizes, and serves engine output and **never reimplements rules**.
State is **snapshot-authoritative**: the serialized engine `Game` on
`Game.stateJson` is the single source of truth, round-tripped
`deserialize → resolveTurn → serialize`, with per-entity tables as read-only
projections rebuilt each turn ([D-045]). Auth is a custom bcrypt + signed-JWT
session with authz re-read from the DB every request ([D-044]). Turn resolution
is driven by a scheduler daemon, a cron endpoint, or a forced admin action, each
writing an immutable `TurnLog`. Admin manual events, direct state edits, and
research grants are all expressed as a **closed set of structured `StateEdit`
ops** applied as data to the snapshot ([D-046]/[D-047]) — free-text effects are
impossible. **17 vitest tests pass** (auth/result-visibility boundaries +
end-to-end integration).

**Frontend (`apps/web/src/app`).** A CRT-terminal-styled (green-on-black
phosphor, IBM Plex Mono, scanline overlay) player and admin UI on the same
Next.js app: auth flows, player views (dashboard, standings, market/equity, map,
private report, orders, research, turn history), and the full GM console
(registrations, subdivisions, turn control, event triggers, announcements,
structured state editor, audit log, research adjudication). Server-side authz
means the UI is never the security boundary.

**QA (`packages/engine/test`, `apps/web/test`, `docs/balance-report.md`).** The
engine suite covers each subsystem plus a deterministic **24-turn scripted
balance simulation** — six hardcoded strategy scripts (no AI/LLM) driving the
real engine under one seed, asserting no runaway credit inflation, no dominant
degenerate strategy, and no negative-resource/bankruptcy crash (all pass). The
web suite verifies the auth model and the private/public report visibility
split. `docs/balance-report.md` is regenerated from the test on every run.

---

## Judgment calls

Every discretionary ruling is recorded in **[`DECISIONS.md`](DECISIONS.md)**
(D-001 … D-049), each with source citation, ruling, and reasoning, grouped into
categories A–H (see the summary at the end of that file). They are not repeated
here. The gap list below cross-references the relevant decisions.

---

## Honest gap list — simplified or intentionally-inert rulebook items

Each item below was **verified against the current code** during this
documentation pass, not copied from an earlier draft.

1. **Durational effects cover named events only; no generic "any future event
   modifier" beyond the four coded types.** `game.activeEffects` is a single
   generic list ticked in Phase 8, but `EffectType`
   (`packages/engine/src/types.ts`) is a **closed enum of four**: `OUTPUT_DELTA`,
   `MODULE_HALF_EFFECT`, `NO_INTELLIGENCE`, `TERRAIN_EXPLOIT_SUSPEND`. Every named
   durational event (Dust Storm, Solar Flare, Seismic, Equipment Recall, Ice
   Deposit Shift) maps onto these. A genuinely novel modifier that doesn't fit one
   of the four read-points would need new engine code — it can't be expressed
   purely as data. ([D-042]) *Design boundary, not a defect.*

2. **Equity BUY sources shares from the issuer's own treasury — a ruling, not
   spec-pinned.** `phase5.ts` buys shares from the issuer's retained holdings and
   pays proceeds into the issuer treasury; SELL returns them and the issuer buys
   back within what it can afford. The rulebook did not pin the counterparty for
   an open-market equity buy; this is the [D-042](c) ruling. *Confirmed in code.*

3. **Negotiate and Patrol are informational-only, not mechanical.** In
   `phase5.ts`, `NEGOTIATE` (Administrator) writes a "social" log line and
   `PATROL` (Contractor) writes a sighting report of rival buildings within
   range — neither changes game state. ([D-042]e) *Confirmed.*

4. **Peer-to-peer market matching is simplified vs. a full order book.** A `SELL`
   naming a peer buyer matches at full live price with **proportional allocation
   by ascending subdivision ID** if oversubscribed; otherwise it routes to Earth
   at live × 0.80. There is no bid/ask book, price-time priority, or partial
   resting orders. ([D-005]/[D-001]) *Intentional simplification.*

5. **`insolventStreak` is a dead field — tracked in the schema and surfaced in the
   report/UI, but never incremented or acted on.** It is declared and initialized
   to 0 in the engine (`state.ts`, `types.ts`) and displayed in the private report
   (`server/reports.ts`, `play/report/page.tsx`), but **no engine phase ever
   increments it** — it stays 0. The bankruptcy rule ([D-020]) clamps credits at 0
   and describes an "insolvent" flag for admin attention, but that flag was never
   wired to auto-flag or auto-act. (By contrast `consistentOutputStreak` **is**
   maintained and drives Earth Relations in Phase 8.) *Confirmed gap — stronger
   than "tracked but not acted on": it is never even computed.*

6. **Freeform research adjudication is fully wired; the engine tech tree itself is
   intentionally inert.** This item from earlier drafts is **resolved**, with one
   clarification. The end-to-end freeform research flow **exists and works**:
   players POST a text `ResearchProposal` (`/play/research`), and the admin
   resolves it APPROVED/REJECTED with structured `grantedEffects` applied through
   the audited edit pipeline (`/admin/research`,
   `api/admin/research-proposals/:id/resolve`, [D-047]) — this is not a stub. What
   **remains inert by design** is the engine-level tech tree / "Apply Research"
   tech-unlock: the engine never invents research effects; every research outcome
   is an admin-stamped structured edit ([D-034]). So: adjudication pipeline =
   done; automated tech tree = intentionally not built.

7. **Oxygen / habitability is tracked but mechanically inert.** `SET_OXYGEN` /
   Global Contribution increment an Oxygen counter with **no threshold effect**;
   the only concrete Oxygen hook is the "Atmospheric Processing Breakthrough"
   event's +1 Bio output, which fires normally. ([D-034]) *Intentional.*

8. **Registration parent/perk/personnel choices are advisory; the admin does the
   real assignment.** `makeGame` fixes parent/perk at creation, so the six seeded
   slots are parent-distinct and registration merely captures a player's
   *preferences*; approval seats the player in a slot and the admin may match or
   reconfigure via structured edits. ([D-014]/[D-048]) *Intentional.*

9. **IBM Plex Mono falls back to system monospace when the Google Fonts CDN is
   unreachable.** `layout.tsx` loads the font from
   `fonts.googleapis.com`; `globals.css` sets
   `--font: 'IBM Plex Mono', 'Courier New', monospace`. With no CDN access (as in
   the dev sandbox) the UI renders in `Courier New`/system mono — cosmetic only,
   not a real deployment issue (a deployment with outbound HTTPS gets Plex Mono;
   self-hosting the font would remove even the cosmetic dependency).

### Other deliberately-bounded items (from DECISIONS, for completeness)

- **Custom/freeform vehicle modules are admin-only** — the engine only resolves
  the predefined modules with fixed stats; freeform modules require an admin
  override that stamps a concrete stat block ([D-029]).
- **Captured-unit release is an admin/social action** — captured units are inert
  data toggled free only via `RELEASE_CAPTIVE` on admin instruction ([D-031]).
- **Score normalization is disabled by default** — composite scores are raw and
  reproducible; normalization is an optional admin action, never automatic
  ([D-035]).
- **Password-reset email delivery is out of scope** — the request endpoint returns
  the token directly in non-production; no mailer is wired ([D-044]).
- **Docker path is unverified** — `docker-compose.yml` exists and is reviewed but
  was never run in Docker (unavailable in the dev sandbox); all verification used
  a local PostgreSQL 16. See README.

---

## Verification performed for this pass

- `npm run build -w @rpc/engine` — clean. `npm test -w @rpc/engine` — **105/105
  pass** (incl. the balance simulation).
- `cd apps/web && npx vitest run` — **17/17 pass** against local PostgreSQL 16.
- **Seed verified on a clean scratch database** (`prisma migrate deploy` +
  `tsx prisma/seed.ts`): produced a fresh game at **turn 1**, **six
  parent-distinct subdivisions** (Terra Agricultural, Unified Mining, Stellar
  Dynamics, Helix Pharma, Omega Security, Genesis Tech), 23 buildings, 60
  personnel (10 each), 96 hexes, 5 market prices, and the admin account — a usable
  fresh 6-player game. Idempotent re-run skips existing rows.
