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
| GET | `/api/games/:gameId/dashboard` | approved | public standings/market/equity/map + announcements + colony events. NOTE: `dashboard.map` is a legacy public projection (terrain + `ownerSubdivisionId` only, no icons/tier). For the map screen use the intel-gated `/map` endpoint below instead. |
| GET | `/api/games/:gameId/map` | **owner** (admin: view-as) | intel-gated map-level markers, viewer = caller's own subdivision (server-derived) — see §21 map contract below |
| GET | `/api/games/:gameId/map/tiles/:col/:row` | **owner** (admin: full) | tier-gated single-tile inspection — see §21 map contract below |
| GET | `/api/games/:gameId/market` | approved | live dynamic-market prices + standings |
| GET | `/api/games/:gameId/equity` | approved | share prices + ownership ledger |
| GET | `/api/games/:gameId/report` | **owner** | full PRIVATE report for the caller's own subdivision + public view of others (§18/§20) |
| GET | `/api/games/:gameId/orders` | **owner** | current turn's stored submission |
| PUT | `/api/games/:gameId/orders` | **owner** | submit/revise; body = `{garrison[],buildingActions[],unitActions[],politicalAction?,corporateActions[],notes[]}`; returns `{saved,accepted,invalidOrders[]}` (subdivisionId/turn set server-side) |
| POST | `/api/games/:gameId/orders/validate` | **owner** | dry-run engine validation, no save → `{valid,invalidOrders[]}` |
| POST | `/api/games/:gameId/orders/available-actions` | **owner** | per-building currently-valid action list + per-unit attention state, reflecting the caller's draft orders — see §22 contract below |
| GET | `/api/games/:gameId/turns` | approved | index of resolved turns (+event) |
| GET | `/api/games/:gameId/turns/:turnNumber` | approved | player: event+scoreboard; admin: full log |
| GET | `/api/games/:gameId/announcements` | approved | colony announcements |
| GET | `/api/games/:gameId/messages` | approved | comms feed the caller is entitled to see (player: public + own DMs; admin: all) — see comms contract below |
| POST | `/api/games/:gameId/messages` | **owner** | send as own subdivision; body `{recipient,body}` — see comms contract below |
| GET | `/api/games/:gameId/research-proposals` | **owner** | own proposals + admin rulings |
| POST | `/api/games/:gameId/research-proposals` | **owner** | `{proposalText}` → PENDING proposal |

Order object shapes (garrison/building/unit/political/corporate) are exactly the
engine `Submission` sub-types (`@rpc/engine`): `BuildingActionOrder`,
`UnitActionOrder`, `PoliticalActionOrder`, `CorporateActionOrder`,
`GarrisonAssignment`. Invalid orders come back as engine `InvalidOrder`s
(`{kind,reason,order}`).

#### Intel-gated map contract (§21 / [D-050]–[D-055])

The map screen renders in two layers. The **map layer** (`GET …/map`) draws icons +
a tier badge per tile; the **tile-inspection layer** (`GET …/map/tiles/:col/:row`)
is fetched on click and returns tier-appropriate detail. The grid is a **12×8
square grid** (`col` 1..12, `row` 1..8), **8-directional / Chebyshev** distance
(no odd-q parity, no 6-neighbour hex geometry — those assumptions are stale).

**Who the viewer is:** always resolved server-side from the session. A player is
always their own assigned subdivision; the client cannot pass a viewer id or a
"desired tier". Any such query params are ignored. Admins may pass
`?viewerSubdivisionId=N` to view-as-N; omitting it gives the full admin view.

`GET /api/games/:gameId/map` → `200`:
```jsonc
{
  "gameId": 1,
  "turnNumber": 3,
  "cols": 12,
  "rows": 8,
  "viewerSubdivisionId": 1,   // the caller's subdivision; null for the full admin map
  "tiles": [ /* 96 MapTileMarker, row-major */ ]
}
```
Each `MapTileMarker` carries ONLY public map data + the server-computed tier — never
building lists, counts, or outputs (those live on tile inspection):
```jsonc
{
  "coord": { "col": 6, "row": 2 },
  "terrain": "PLAINS",          // PLAINS | MOUNTAINS | RARE_MINERALS | IMPASSABLE | LANDING_ZONE
  "owner": 3,                    // owning subdivision id, or null (unclaimed / retired owner)
  "isLandingZone": false,
  "hasHQ": true,                 // HQ icon (public)
  "hasOutpost": false,           // Outpost icon (public)
  "intelTier": "MEDIUM"          // "OWN" (self) | "LOW" | "MEDIUM" | "HIGH" | "FULL" (vs owner)
}
```

`GET /api/games/:gameId/map/tiles/:col/:row` → `200`:
```jsonc
{ "gameId": 1, "turnNumber": 3, "viewerSubdivisionId": 1, "tile": { /* TileView */ } }
```
`viewerSubdivisionId` is `null` for admin (admin gets full detail, not a per-viewer
tier). Off-map coords → `404`. `col`/`row` non-integers → `400`.

The `tile` (`TileView`) shape is **additive by tier** — the frontend must render
conditionally on `intelTier` and on field presence. Public fields are always present:
`coord`, `terrain`, `owner`, `isLandingZone`, `hasHQ`, `hasOutpost`, `intelTier`.
Gated fields are added as the tier rises:

| `intelTier` | Added fields (on top of public) |
|---|---|
| `LOW` | *(none — public fields only)* |
| `MEDIUM` | `buildingCount:number` |
| `HIGH` | `+ buildings: BuildingType[]` (id-ordered, duplicates listed) `+ unitCount:number` |
| `FULL` | `+ resourceOutput: Partial<Record<ResourceType,number>>` (per-turn capacity, NOT stockpiles) `+ units: { personnel: Partial<Record<PersonnelType,number>>, vehicles: Partial<Record<HullClass,number>> }` |
| `OWN` | full detail: `buildingCount`, `buildings`, `unitCount`, `resourceOutput`, `units`, **plus** `ownBuildings: { id, type, tier, status, modules: {id,type,status}[], garrison: Partial<Record<PersonnelType,number>> }[]` |

Notes for the frontend:
- `OWN` is returned for the caller's own tiles **and** for admin on any owned tile.
  It is the only tier that includes `ownBuildings` (per-building modules/garrison).
- No tier ever exposes personnel identity or vehicle loadouts — `units`/`unitCount`
  are aggregate counts only.
- Unclaimed or retired-owner tiles report `owner: null`, `intelTier: "LOW"`, and no
  gated fields (there is no private content to reveal).
- Tier is recomputed live every request from current espionage/opsec; a tile's shape
  can therefore change turn-to-turn. Never cache a shape across turns.

#### Building available-actions contract (§22 / [D-056]–[D-064])

The orders composer must never guess whether an action is valid client-side — the
engine's `availableActions(building, sub, game)` ([D-061]) is the single source of
truth. This endpoint runs it per building **and** (a) applies the draft's garrison exactly
as Phase 1 would — reset-then-assign, before per-building actions are evaluated
([D-065]) — then (b) applies the tentative attention spend of the orders the player
has queued but not yet submitted, so the offered set and the ASSIGNED/AVAILABLE unit
badges update live as they compose.

**Who the viewer is:** always the caller's own assigned subdivision, resolved
server-side from the session (`requireOwnedSubdivision`). There is no way to pass a
target subdivision; a player can only ever query their own buildings. (Admins have
no assigned slot, so this player-composer endpoint is not for them — they use the
admin report/state routes.)

`POST /api/games/:gameId/orders/available-actions`

Request body (all fields optional; omit `draftOrders` for the fresh, nothing-queued
state):
```jsonc
{
  "draftOrders": {
    "garrison":        [ /* GarrisonAssignment[] — engine shape */ ],
    "buildingActions": [ /* BuildingActionOrder[] — engine shape */ ],
    "unitActions":     [ /* UnitActionOrder[] — engine shape */ ]
    // politicalAction / corporateActions are accepted but ignored here: they spend no
    // unit attention and change nothing this endpoint reports ([D-058]/[D-059]).
    // garrison spends no attention either, but IS applied (Phase 1, reset-then-assign)
    // before the per-building action lists are derived, so a building the player
    // re-garrisons in the draft shows its NEW garrison's actions live, not last
    // turn's ([D-065]). Omit `garrison` to keep the turn-start garrison unchanged.
  }
}
```

Response `200`:
```jsonc
{
  "gameId": 1,
  "turnNumber": 3,
  "subdivisionId": 2,               // server-derived; the caller's own subdivision
  "buildings": {                    // buildingId -> currently-valid BuildingActionType[]
    "950101": ["AMPLIFY_CREDIT_YIELD"],
    "950102": ["COLONIST_REQUISITION", "TERRITORIAL_CLAIM", "LOCKDOWN"],
    "950103": []                    // e.g. not operational (garrison below labor min)
  },
  "unitAttention": {                // personnelId -> attention spent by the draft so far
    "950201": true,                 // true  => attention spent (badge: ASSIGNED)
    "950203": false                 // false => attention unspent (badge: AVAILABLE)
  }
}
```

Semantics the frontend can rely on:
- `buildings[id]` is the engine's live offered set: base actions ∪ garrison-unlocked
  ∪ module-unlocked, filtered by operational status, built-this-turn gating ([D-022]),
  surplus/module set requirements, and **attention availability**. It intentionally
  does **not** validate per-order params (quantities, targets, hulls) or variable
  costs (Market Sale / Colonist Requisition / Produce Vehicle / Lockdown) — those
  remain the job of `POST …/orders/validate` and turn resolution ([D-063]).
- The set is **live under the draft's garrison**: if the draft carries a `garrison`
  list it is applied first (Phase 1, reset-then-assign via the engine's own
  `applyGarrisonForSubdivision`, §10.1) so each building's `garrisonUnlocked` actions,
  operational status, and set-count gating reflect the NEW garrison the player is
  composing — matching resolution, where garrison (Phase 1) precedes building actions
  (Phase 4). Invalid garrison entries (missing/ineligible unit, missing/DERELICT
  target, duplicate unit) are skipped best-effort (that unit stays AVAILABLE); one bad
  entry never fails the request. Omit `garrison` to keep the turn-start garrison.
- The set is also **live under the draft's attention**: draft
  `buildingActions`/`unitActions` are walked in declaration order (building actions
  before unit actions, matching Phase 2's `claimed` reservation, §22.4) and tentatively
  mark the units they'd commit as attention-spent via the engine's canonical lowest-id
  selection ([D-057]). So once a draft order commits a required unit, any action needing
  that same unit **drops off** the building's list — exactly what will happen at
  resolution. A queued action that is not actually offered (non-operational building,
  etc.) spends nothing.
- `unitAttention[personnelId]` is the authoritative value for the ASSIGNED/AVAILABLE
  badge (`true` = spent = ASSIGNED, `false`/absent = unspent = AVAILABLE). Every unit
  in the caller's subdivision is keyed. This is the server value the badge should read
  instead of any client-side derivation.
- Attention state is turn-scoped and derived from turn-start snapshot + draft only;
  the request never mutates persisted state (the game is cloned per call).

#### Subdivision comms contract (tactical-HUD feed / [D-066]–[D-068])

Player-authored subdivision-to-subdivision messaging. This is the **messaging piece
only** — the frontend blends it with the already-existing turn logs (`…/turns`) and
announcements (`…/announcements`) into its unified feed client-side; there is
deliberately no combined-feed endpoint (see the report note at the bottom). All
player messages are tagged `channel: "COMMS"` (the frontend's violet diplomacy/comms
lane); public vs private is carried by the derived `scope` field, not the channel.

Three kinds, discriminated by the recipient:
- **PUBLIC** — a colony-wide post (player-authored analogue of an announcement),
  visible to every subdivision.
- **SUBDIVISION** — a private DM to one rival subdivision.
- **ADMIN** — a private DM to "high command" (the admin).

`POST /api/games/:gameId/messages` (auth: **owner**; sender is the caller's own
subdivision, server-derived — never trusted from the client):
```jsonc
{
  "recipient": { "type": "PUBLIC" },
  // or { "type": "SUBDIVISION", "subdivisionId": 3 }   // must exist, must not be self
  // or { "type": "ADMIN" },                             // DM to high command
  "body": "Proposing a water-for-minerals swap next turn."
}
```
→ `201 { "ok": true, "message": Message }`. Errors: `400` self-DM / empty or >4000-char
body, `404` unknown recipient subdivision or game, `403` caller has no subdivision in
this game (admins have none — they use the announcement system to broadcast, [D-068]).

`GET /api/games/:gameId/messages` (auth: approved) → `200`:
```jsonc
{
  "gameId": 1,
  "viewerSubdivisionId": 2,   // caller's subdivision; null for admin (whole-feed view)
  "isAdmin": false,
  "messages": [ /* newest-first, max 200 */ ]
}
```
Each `Message`:
```jsonc
{
  "id": "clx…",
  "gameId": 1,
  "scope": "SUBDIVISION",          // "PUBLIC" | "SUBDIVISION" | "ADMIN" (derived)
  "channel": "COMMS",
  "senderSubdivisionId": 2,        // author's subdivision (null only for future system rows)
  "recipientSubdivisionId": 3,     // null for PUBLIC and ADMIN
  "recipientIsAdmin": false,       // true for ADMIN (high-command) DMs
  "body": "…",
  "createdAt": "2026-07-21T…Z"
}
```

**Visibility (enforced server-side in SQL, never in UI):**
- **PLAYER** sees: all PUBLIC posts in the game + every DM their OWN subdivision is a
  party to (sender OR recipient), including their own DMs to high command. A player
  NEVER sees a DM strictly between two other subdivisions, nor another subdivision's DM
  to high command.
- **ADMIN** sees: the entire feed (all public + all DMs), matching the existing
  "admin views any subdivision's private data" precedent ([D-067]).
- Messages are delivered **immediately** — NOT turn-gated or intel-gated ([D-066]);
  they are out-of-band chatter, not observable game state. Visibility is keyed on
  **subdivision id**, so a re-assigned player inherits that subdivision's comms history.

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
