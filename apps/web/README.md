# Red Planet Corporate — Web/API service (`@rpc/web`)

Next.js (App Router) + TypeScript backend for Red Planet Corporate. All game math
comes from `@rpc/engine`; this service only persists, authorizes, and serves engine
output. No player UI lives here — this is the API the frontend subagent consumes.

## Stack & architecture
- **Next.js App Router** route handlers under `src/app/api/**` (all `runtime = "nodejs"`).
- **Prisma + PostgreSQL** (`prisma/schema.prisma`). Dev + prod both use Postgres.
- **Auth:** custom bcrypt + signed-JWT session cookie (`rpc_session`) — see [D-044].
- **State model:** the authoritative game state is the serialized engine `Game`
  on `Game.stateJson`; per-entity tables are read-only projections rebuilt each
  turn — see [D-045]. Round-trip: `deserializeGame → resolveTurn → serializeGame`.
- **Engine calls:** submission validation → `validateSubmission` ([D-043]); turn
  resolution → `resolveTurn`. The server never reimplements rules.

Key modules: `src/lib/authz.ts` (guards), `src/server/gameStore.ts` (load/save/
project), `src/server/turn.ts` (resolution), `src/server/scheduler.ts` (timer),
`src/server/stateEdit.ts` (structured admin ops), `src/server/reports.ts` (§18
visibility split).

## Local dev
```bash
# 1. Postgres (docker) — or use any local Postgres and set DATABASE_URL.
docker compose up -d db
# 2. Env
cp apps/web/.env.example apps/web/.env   # then edit secrets
# 3. From repo root:
npm install
npm run build -w @rpc/engine
cd apps/web
npx prisma migrate deploy      # or: npx prisma migrate dev
npx tsx prisma/seed.ts         # admin (from env) + fresh 6-subdivision game
npm run dev                    # http://localhost:3000
npx vitest run                 # end-to-end integration test
```

## One-command run
```bash
docker compose up            # db + web (migrate+seed+start) + scheduler daemon
```

## Auth model (enforced server-side, never in UI) — [D-044]
- Session = httpOnly `rpc_session` JWT. Role/status/ownership re-read from DB per request.
- Roles: `PLAYER`, `ADMIN`. Registration status: `PENDING` → `APPROVED`/`REJECTED`.
- A player may only ever read/write **their own assigned subdivision**
  (`assertSubdivisionAccess` / `requireOwnedSubdivision`). Admin routes require
  `role === ADMIN`. There is no UI-only gating.

## Turn scheduling
Each `Game` has `turnLengthHours` (default 96) and `turnDeadline`. Resolution is
triggered by: (a) the scheduler daemon (`src/server/schedulerDaemon.ts`, docker
`scheduler` service) polling for due deadlines, (b) `POST /api/cron/tick` (guard:
`CRON_SECRET`) for external cron, or (c) admin `POST …/process-turn`. Every
resolution persists an immutable `TurnLog` and advances `turnNumber`.

## Money & values
Credits/prices are fixed-point integers in units of 0.0001 Cr ([D-002]); fields
suffixed `Fp` are raw fixed-point, and display strings (e.g. `livePrice`,
`creditsDisplay`) are 2-dp. Physical resources are plain integers.

---

## API surface

All responses are JSON. Errors: `{ "error": { "code", "message" } }` with HTTP
status (400/401/403/404/409/500). Auth via the `rpc_session` cookie (set by login).

### Auth
| Method | Path | Auth | Body → Result |
|---|---|---|---|
| POST | `/api/auth/register` | public | `{email,password,displayName?,desiredName?,parentCompany?,parentPerk?,choicePersonnel?}` → creates PENDING user |
| POST | `/api/auth/login` | public | `{email,password}` → sets cookie, returns `{id,email,role,status,displayName}` |
| POST | `/api/auth/logout` | public | clears cookie |
| GET | `/api/auth/me` | optional | `{user|null, assignment|null}` |
| POST | `/api/auth/password-reset/request` | public | `{email}` → `{ok, devToken?}` (token returned only in non-prod) |
| POST | `/api/auth/password-reset/confirm` | public | `{token,newPassword}` → `{ok}` |

### Player (approved)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/games` | any | list games + `yourSubdivisionId` |
| GET | `/api/games/:gameId/dashboard` | approved | public standings/market/equity/map + announcements + colony events |
| GET | `/api/games/:gameId/market` | approved | live dynamic-market prices + standings |
| GET | `/api/games/:gameId/equity` | approved | share prices + ownership ledger |
| GET | `/api/games/:gameId/report` | **owner** | full PRIVATE report for the caller's own subdivision + public view of others (§18/§20) |
| GET | `/api/games/:gameId/orders` | **owner** | current turn's stored submission |
| PUT | `/api/games/:gameId/orders` | **owner** | submit/revise; body = `{garrison[],buildingActions[],unitActions[],politicalAction?,corporateActions[],notes[]}`; returns `{saved,accepted,invalidOrders[]}` (subdivisionId/turn set server-side) |
| POST | `/api/games/:gameId/orders/validate` | **owner** | dry-run engine validation, no save → `{valid,invalidOrders[]}` |
| GET | `/api/games/:gameId/turns` | approved | index of resolved turns (+event) |
| GET | `/api/games/:gameId/turns/:turnNumber` | approved | player: event+scoreboard; admin: full log |
| GET | `/api/games/:gameId/announcements` | approved | colony announcements |
| GET | `/api/games/:gameId/research-proposals` | **owner** | own proposals + admin rulings |
| POST | `/api/games/:gameId/research-proposals` | **owner** | `{proposalText}` → PENDING proposal |

Order object shapes (garrison/building/unit/political/corporate) are exactly the
engine `Submission` sub-types (`@rpc/engine`): `BuildingActionOrder`,
`UnitActionOrder`, `PoliticalActionOrder`, `CorporateActionOrder`,
`GarrisonAssignment`. Invalid orders come back as engine `InvalidOrder`s
(`{kind,reason,order}`).

### Admin (`role === ADMIN`)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/registrations?status=PENDING\|APPROVED\|REJECTED\|ALL` | review queue |
| POST | `/api/admin/registrations/:userId/approve` | `{gameId,subdivisionId}` → approve + assign slot |
| POST | `/api/admin/registrations/:userId/reject` | `{reason?}` |
| GET | `/api/admin/games/:gameId/subdivisions` | slots + assignments + scores |
| POST | `/api/admin/games/:gameId/subdivisions/:sid/assign` | `{userId}` → (re)assign slot |
| POST | `/api/admin/games/:gameId/subdivisions/:sid/retire` | queue retirement (applied next resolution) [D-032] |
| GET | `/api/admin/games/:gameId/subdivisions/:sid/report` | view ANY subdivision's private report |
| POST | `/api/admin/games/:gameId/pause` | pause auto-resolution |
| POST | `/api/admin/games/:gameId/resume` | `{resetDeadline?}` |
| PATCH | `/api/admin/games/:gameId/config` | `{turnLengthHours?,turnDeadline?,resetDeadline?}` |
| POST | `/api/admin/games/:gameId/process-turn` | force-resolve current turn now |
| POST | `/api/admin/games/:gameId/events` | `{name,edits:StateEdit[],note?}` — manual event as structured effects [D-046] |
| POST | `/api/admin/games/:gameId/state-edit` | `{edits:StateEdit[],note?}` — direct structured edit (audited) [D-046] |
| POST | `/api/admin/games/:gameId/announcements` | `{title,body}` |
| GET | `/api/admin/games/:gameId/audit` | audit trail |
| GET | `/api/admin/games/:gameId/research-proposals?status=` | review queue |
| POST | `/api/admin/research-proposals/:id/resolve` | `{status,adminResponse?,grantedEffects:StateEdit[]}` — structured grants only [D-047] |

### Ops
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/cron/tick` | header `x-cron-secret` (or `?secret=`) = `CRON_SECRET`; resolves all due games |
| GET | `/api/health` | liveness + DB check |

### `StateEdit` ops (admin structured editor) — `src/server/stateEdit.ts`
`SET_RESOURCE` · `ADD_RESOURCE` · `SET_EARTH_RELATIONS` · `ADJUST_EARTH_RELATIONS`
· `DISABLE_BUILDING` · `SET_HEX_OWNER` · `SET_OXYGEN` · `ADD_MILESTONE` ·
`REGISTER_EFFECT` (`effectType`/`scope`/`turnsRemaining`/`magnitude`/targets) ·
`RELEASE_CAPTIVE`. Credits ops accept `asCredits:true` to pass whole Cr instead of
fixed-point. Every edit is audited (before/after).

## Notes for frontend/QA
- Money display: prefer `*Display` strings or divide `*Fp` by 10000.
- `report.own` = private; `report.others` = public-only (guaranteed server-side).
- Submitting orders never trusts client `subdivisionId`/`turnNumber`.
- Turn logs are immutable; re-resolution is prevented by a unique constraint.
