# Red Planet Corporate

A from-scratch, **deterministic** browser-based Mars-colony strategy game (a
play-by-email / asynchronous multiplayer "season"). Players run competing
corporate **subdivisions** on a shared 12×8 hex map of Mars, submitting orders
each turn; a seeded rules engine resolves every turn identically for the same
inputs — **no AI or host dice at runtime**. A human admin ("Game Master") runs
the season through an admin console.

- **`packages/engine`** (`@rpc/engine`) — the pure, framework-agnostic rules
  engine: order validation, the eight-phase turn resolution, dynamic resource
  market, subdivision equity market, Earth Relations, events, conflict/spotting,
  and scoring. Zero network/DB dependencies. **105 vitest tests passing.**
- **`apps/web`** (`@rpc/web`) — a Next.js (App Router) + Prisma + PostgreSQL
  backend **and** player/admin frontend. It only persists, authorizes, and
  serves engine output; it never reimplements game rules. **17 vitest tests
  passing** (auth/visibility boundaries + end-to-end integration).
- **`docs/`** — the authoritative source rulebook (`master-rulebook.xlsx`), the
  CRT-terminal UI reference (`index.html`/`app.js`/`pages.js`), and the generated
  `balance-report.md`.

Authoritative design documents live at the repo root:

- **[`GAME_SPEC.md`](GAME_SPEC.md)** — the complete, unambiguous implementation
  spec derived from the rulebook (data models, formulas, the eight-phase
  algorithm, edge cases).
- **[`DECISIONS.md`](DECISIONS.md)** — every judgment call (D-001 … D-049) made
  where the human-host rulebook left something to "host discretion", with the
  ruling and reasoning. Binding on all downstream code.
- **[`BUILD_SUMMARY.md`](BUILD_SUMMARY.md)** — what was built, and an **honest
  list of rulebook items that were simplified or intentionally left inert**.
- **[`apps/web/README.md`](apps/web/README.md)** — the full HTTP **API contract**
  (every route, auth model, `StateEdit` op set). Not duplicated here.
- **[`docs/balance-report.md`](docs/balance-report.md)** — the deterministic
  24-turn scripted balance simulation and its pass/fail assertions.

---

## Repository layout

```
Red-planet-corporate/
├── GAME_SPEC.md              # implementation spec
├── DECISIONS.md              # D-001..D-049 judgment calls
├── BUILD_SUMMARY.md          # build overview + honest gap list
├── docker-compose.yml        # Postgres + web + scheduler (see note below)
├── package.json              # npm workspace root (packages/* + apps/*)
├── packages/engine/          # @rpc/engine — deterministic rules engine
└── apps/web/                 # @rpc/web — Next.js backend + frontend
    ├── prisma/schema.prisma  # snapshot-authoritative schema (D-045)
    ├── prisma/seed.ts        # admin + fresh 6-subdivision game (D-048)
    └── src/…                 # API routes, server logic, player/admin UI
```

---

## Local setup

Prerequisites: **Node 22+**, **npm 10+**, and a **PostgreSQL** database (dev + prod
both use Postgres). The engine has zero runtime dependencies; only the web app
needs a database.

### 1. Install (npm workspaces, one lockfile)

```bash
# from repo root
npm install
```

### 2. Build & test the engine

```bash
npm run build -w @rpc/engine          # tsc -> packages/engine/dist
npm test  -w @rpc/engine              # 105 vitest tests
```

### 3. Provision PostgreSQL

**Option A — Docker (`docker-compose.yml` provided):**

```bash
docker compose up -d db               # postgres:16-alpine on localhost:5432
```

> **Honesty note:** Docker was **not available** in the development sandbox, so
> the `docker-compose.yml` (and the one-command `docker compose up` flow below)
> is written and reviewed but **has not been exercised end-to-end in Docker**.
> All actual verification (migrations, seed, both test suites) was done against a
> **locally-installed PostgreSQL 16** on `localhost:5432`, which is fully
> supported and is what the instructions below use.

**Option B — local PostgreSQL install (what was actually used to verify):**

```bash
# create a database + role matching the default DATABASE_URL, e.g.:
#   user rpc / password rpc / database rpc on localhost:5432
sudo -u postgres psql -c "CREATE ROLE rpc LOGIN PASSWORD 'rpc';"
sudo -u postgres psql -c "CREATE DATABASE rpc OWNER rpc;"
```

### 4. Configure env & migrate/seed the web app

```bash
cp apps/web/.env.example apps/web/.env      # then edit secrets (AUTH_SECRET etc.)
cd apps/web
npx prisma migrate deploy                   # apply migrations (or: migrate dev)
npx tsx prisma/seed.ts                       # admin account + fresh 6-slot game
npm run dev                                  # http://localhost:3000
```

`apps/web/.env` keys (see `.env.example` for the annotated list): `DATABASE_URL`,
`AUTH_SECRET` (≥32 bytes), `SESSION_TTL_HOURS`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
(the seed reads these — the admin is **never** hardcoded), `CRON_SECRET`,
`DEFAULT_TURN_LENGTH_HOURS`, `SCHEDULER_POLL_SECONDS`, `APP_BASE_URL`.

### One-command run (Docker; see honesty note above)

```bash
docker compose up      # db + web (migrate+seed+start) + scheduler daemon
```

---

## Running the tests

| What | Command | Count | Needs DB? |
|---|---|---|---|
| Engine unit + integration + balance | `npm test -w @rpc/engine` | 105 | no |
| Web auth/visibility + integration | `cd apps/web && npx vitest run` | 17 | **yes** |
| Everything (workspace) | `npm test` (from root) | 122 | web needs DB |

The web tests use `apps/web/.env` for `DATABASE_URL` (via `dotenv`), so a reachable
Postgres must exist first (steps 3–4 above).

## Running the balance simulation

The balance report is generated **by a test** — it is deterministic and
re-runnable:

```bash
npm test -w @rpc/engine       # runs test/balance-sim.test.ts among the 105
```

Six hardcoded strategy scripts (one per archetype, in
`packages/engine/test/balance/strategies.ts`) drive the real engine for 24 turns
under one fixed seed and assert three balance properties (no runaway credit
inflation, no dominant degenerate strategy, no negative-resource/bankruptcy
crash). The rendered results live in **[`docs/balance-report.md`](docs/balance-report.md)**.
No AI/LLM is involved anywhere in the simulation.

---

## GM Handbook — running a season in practice

The admin ("Game Master") drives the whole season from the **GM console** at
**`/admin`** (redirects to `/admin/registrations`). The admin account is created
by the seed from `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Everything the GM does is either
a slot assignment, a turn-control action, or a **structured** edit — the GM never
types free-text game effects and never edits rules; the engine computes every
consequence deterministically. Every state-changing admin action is written to an
immutable **audit log**.

### 0. The world the seed hands you

`prisma/seed.ts` creates one game — **"Red Planet — Season 1"** — via the engine's
`makeGame`, with **six subdivision slots**, one per parent corporation
(Terra Agricultural, Unified Mining, Stellar Dynamics, Helix Pharma, Omega
Security, Genesis Tech), each with perk A, an HQ hex, its free perk building,
and 10 starting personnel. It also creates the admin user. It is **idempotent** —
re-running skips an existing game/admin. Players are variable in number (up to 6);
**unassigned slots simply repeat "hold garrison, no actions"** each turn until a
player is assigned or the slot is retired ([D-048]).

### 1. Approving registrations

Players self-register at `/register`, choosing a **desired name, parent company,
perk, and two choice personnel**. These are **advisory preferences only**
([D-014]/[D-048]) — they do **not** auto-configure anything. New accounts land in
`PENDING`.

- **`/admin/registrations`** — the review queue (`GET /api/admin/registrations`).
- **Approve** a user → you pick the `gameId` **and the subdivision slot** to bind
  them to (`POST …/registrations/:userId/approve`). This is where the player is
  actually seated. If you want to honour their requested parent, assign the
  matching slot; if you want to reconfigure a slot, use the structured **state
  editor** afterwards.
- **Reject** with an optional reason.

A player may only ever read/write **their own assigned subdivision** — enforced
server-side on every request, never in the UI ([D-044]).

### 2. Assigning / reassigning subdivisions & parents

- **`/admin/subdivisions`** — every slot, its assignment, and live scores
  (`GET …/subdivisions`). Reassign a slot to a different user
  (`POST …/subdivisions/:sid/assign`), or **retire** a slot
  (`POST …/subdivisions/:sid/retire`). Retirement is **queued** and applied at the
  start of the next resolution: buildings become derelict, hexes return to
  unclaimed, personnel/vehicles are removed, and its shares freeze at last price
  ([D-032]).
- **Parent/perk changes** after seating are done via the structured **state
  editor** (add/set resources, register effects, etc.) — the parent selection
  itself is fixed at `makeGame`, so "matching a player's requested parent" means
  seating them in that parent's slot.

### 3. The turn cycle (submit → deadline → resolution)

Each game has `turnLengthHours` (default 96) and a `turnDeadline`. Within a turn:

1. **Submit** — assigned players `PUT /api/games/:id/orders` (via `/play/orders`)
   as many times as they like before the deadline; the last saved submission
   wins. Orders are validated **at submission time** by the real engine
   (`validateSubmission`, [D-043]) so players see invalid orders immediately, and
   again at resolution.
2. **Deadline reached → resolution.** Resolution can be triggered three ways:
   - **Automatically** by the scheduler daemon (`src/server/schedulerDaemon.ts`,
     the docker `scheduler` service) polling for due deadlines, **or** by an
     external cron hitting `POST /api/cron/tick` (guard: `x-cron-secret` =
     `CRON_SECRET`).
   - **Forced** by the GM: `/admin/turns` → **process turn now**
     (`POST …/process-turn`) resolves the current turn immediately regardless of
     deadline.
3. **Resolution** runs the engine's deterministic eight phases, writes an
   **immutable `TurnLog`**, advances `turnNumber`, and rebuilds the read-only
   projections. Re-resolution is blocked by a unique `gameId+turnNumber`
   constraint.

**Pause / resume / retime:** `/admin/turns` also exposes pause
(`POST …/pause`), resume (`POST …/resume`, optional `resetDeadline`), and config
(`PATCH …/config` — change `turnLengthHours` or set an explicit `turnDeadline`).
Unassigned/idle slots resolve on the default "hold" behaviour.

### 4. Using the GM console

- **Events (`/admin/events`)** — trigger any event **as structured effects**
  ([D-046]). You give the event a display **name** and author its mechanical
  result with the **StateEdit builder** (e.g. a Dust Storm = `REGISTER_EFFECT
  OUTPUT_DELTA / COLONY / −1 / requiresUnshielded / 2 turns`). There is no
  free-text effect — a manual event is exactly the structured edit(s) that event
  would produce, applied to the engine snapshot and resolved by the engine next
  turn.
- **State editor (`/admin/state`)** — direct structured edits to the live
  snapshot (`POST …/state-edit`). The full op set (see
  [`apps/web/README.md`](apps/web/README.md#stateedit-ops-admin-structured-editor)):
  `SET_RESOURCE`, `ADD_RESOURCE`, `SET/ADJUST_EARTH_RELATIONS`, `DISABLE_BUILDING`,
  `SET_HEX_OWNER`, `SET_OXYGEN`, `ADD_MILESTONE`, `REGISTER_EFFECT`,
  `RELEASE_CAPTIVE`. Credit ops accept `asCredits:true` to pass whole credits.
- **Announcements (`/admin/announcements`)** — post colony-wide bulletins players
  see on their dashboard (`POST …/announcements`).
- **Research adjudication (`/admin/research`)** — the queue of freeform research
  **proposals** players submit as text. You resolve each **APPROVED/REJECTED**;
  on approval you attach **`grantedEffects`** — the same structured op set — which
  are applied through the audited edit pipeline ([D-047]). The proposal text is
  **never executed**; only your structured grant takes effect. (The engine's tech
  tree itself is intentionally inert — all research outcomes are admin-stamped;
  see BUILD_SUMMARY.)
- **Audit log (`/admin/audit`)** — the immutable before/after trail of every
  manual event, state edit, and research grant (`GET …/audit`).

### 5. Reading a turn log / report / balance report

- **Turn log** (`/admin/turns/:n`, or `GET …/turns/:turnNumber` as admin) — the
  full per-phase resolution record for a turn: the event that fired, per-phase log
  lines (production, trades, conflicts, attrition, ER changes), and the end-of-turn
  scoreboard. Players see only the event + scoreboard for turns they can view; the
  GM sees everything ([D-035]/§18 visibility split in `src/server/reports.ts`).
- **Private report** (`/play/report`, `GET …/report`) — a subdivision's own
  **private** view (full resources, personnel, cumulative counters, insolvent
  streak) plus a **public-only** view of rivals. The GM can view **any**
  subdivision's private report (`GET …/subdivisions/:sid/report`).
- **Balance report** ([`docs/balance-report.md`](docs/balance-report.md)) — read
  it as: colony-wide credit totals vs the structural credit cap (inflation
  bound), the composite-score table per subdivision per turn (dominance /
  divergence), and the three pass/fail assertions at the bottom. Regenerate it any
  time with `npm test -w @rpc/engine`.

---

## Money & values (quick reference)

Credits and prices are **fixed-point integers** in units of 0.0001 Cr ([D-002]);
fields suffixed `Fp` are raw fixed-point, `*Display` strings are 2-dp. The five
physical resources (Energy/Minerals/Water/Food/Rare) are non-negative integers.
Prefer `*Display` strings, or divide `*Fp` by 10000, for presentation.

## License / status

Internal project build. Functionally complete: engine (105 tests), web
backend+frontend (17 tests, manually verified end-to-end in a browser), and a
passing 24-turn balance simulation. See `BUILD_SUMMARY.md` for the honest gap
list.
