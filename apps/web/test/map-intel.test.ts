/**
 * End-to-end tests for the intel-gated map + tile-inspection endpoints (§21 /
 * [D-050]–[D-055]) against the real seeded Postgres DB (game id 1, 6 subdivisions).
 *
 * Verifies server-side enforcement of the per-tile intel gating:
 *  - own tile -> full detail regardless of tier
 *  - opponent tile -> exactly the fields the viewer's COMPUTED tier allows
 *  - tampering with query params cannot raise the tier
 *  - admin gets full detail on any tile
 *
 * Tiers are constructed by mutating the VIEWER subdivision's espionage (adding
 * ANALYST personnel) vs a fixed target's opsec, then restoring original state.
 */

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { deserializeGame, serializeGame } from "@/lib/serialize";

import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as approve } from "@/app/api/admin/registrations/[userId]/approve/route";
import { GET as getMap } from "@/app/api/games/[gameId]/map/route";
import { GET as getTile } from "@/app/api/games/[gameId]/map/tiles/[col]/[row]/route";

const GAME_ID = 1;
const M_EMAIL = "itest-map@example.com";

// Seed placement (prisma/seed.ts): subdivision 1 (Terra) HQ {2,2}; subdivision 3
// (Stellar) HQ {6,2}. Every subdivision starts with 1 Contractor, so a bare target's
// opsec = INTEL_OPSEC_BASE(1) + 1 Contractor = 2 (GAME_SPEC §21.3-4). Viewer = sub 1
// (Terra: no starting Analysts/Sensor/Comms), so espionage(viewer) = 1 + analysts.
const OWN_HQ = { col: 2, row: 2 };
const TARGET_HQ = { col: 6, row: 2 }; // subdivision 3's HQ; opsec 2
const VIEWER_SUB = 1;

// Tier boundaries against a fresh target opsec = 2, evaluated by the integer-exact
// cross-multiplication of §21.4 with e = espionage(viewer) = 1 + analysts, o = 2:
//   LOW    2e <  3o (=6)  -> e <= 2  -> analysts <= 1
//   MEDIUM  e <  3o (=6)  -> e in {3,4,5} -> analysts in {2,3,4}   (min 2)
//   HIGH    e <  9o (=18) -> e in {6..17}  -> analysts in {5..16}  (min 5)
//   FULL    e >= 9o (=18) -> e >= 18       -> analysts >= 17       (min 17)

function ctx(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}

function req(url: string, opts: { method?: string; body?: unknown; cookie?: string } = {}): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.cookie) headers["cookie"] = opts.cookie;
  return new Request(`http://test${url}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
}

function cookieFrom(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = setCookie.match(/rpc_session=([^;]+)/);
  if (!m) throw new Error("no session cookie in response");
  return `rpc_session=${m[1]}`;
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await login(req("/api/auth/login", { method: "POST", body: { email, password } }), ctx({}));
  expect(res.status, `login ${email}`).toBe(200);
  return cookieFrom(res);
}

/**
 * Set the viewer's espionage to exactly `1 + n` by making ANALYST personnel the sole
 * espionage source. Strips every other espionage contributor (existing Analysts, and
 * the COMMUNICATIONS_ARRAY / SENSOR_ARRAY / COMMAND_SUITE modules & buildings that
 * §21.3 counts) so the tier is a deterministic function of `n` alone — independent of
 * any incidental prior game state (e.g. a turn already resolved by another test file).
 * Test-owned analysts use ids 900000+. Espionage(viewer) = INTEL_ESPIONAGE_BASE(1) + n.
 */
async function setViewerAnalysts(subId: number, n: number): Promise<void> {
  const row = await prisma.game.findUniqueOrThrow({ where: { id: GAME_ID } });
  const game = deserializeGame(row.stateJson as Record<string, unknown>);
  const sub = game.subdivisions.find((s) => s.id === subId);
  if (!sub) throw new Error("subdivision not found");
  // Remove all pre-existing Analyst personnel (any id) so only our n test analysts count.
  sub.personnel = sub.personnel.filter((p) => p.type !== "ANALYST");
  // Neutralise the other §21.3 espionage sources on the viewer.
  sub.buildings = sub.buildings.filter((b) => b.type !== "COMMUNICATIONS_ARRAY");
  for (const b of sub.buildings) {
    b.modules = b.modules.filter((m) => m.type !== "SENSOR_ARRAY" && m.type !== "COMMAND_SUITE");
  }
  for (let i = 0; i < n; i++) {
    sub.personnel.push({ id: 900000 + i, type: "ANALYST", status: "AVAILABLE", unavailableUntilTurn: 0 });
  }
  await prisma.game.update({
    where: { id: GAME_ID },
    data: { stateJson: serializeGame(game) as Prisma.InputJsonValue },
  });
}

let adminCookie = "";
let mCookie = "";
let originalStateJson: Prisma.InputJsonValue;

beforeAll(async () => {
  const row = await prisma.game.findUniqueOrThrow({ where: { id: GAME_ID } });
  originalStateJson = row.stateJson as Prisma.InputJsonValue;

  await prisma.subdivisionAssignment.deleteMany({ where: { gameId: GAME_ID, subdivisionId: VIEWER_SUB } });
  await prisma.user.deleteMany({ where: { email: M_EMAIL } });

  adminCookie = await loginAs(env.adminEmail.toLowerCase(), env.adminPassword);

  const r = await register(
    req("/api/auth/register", { method: "POST", body: { email: M_EMAIL, password: "playerPass123" } }),
    ctx({}),
  );
  expect([201, 409]).toContain(r.status);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: M_EMAIL } });
  const a = await approve(
    req(`/api/admin/registrations/${user.id}/approve`, {
      method: "POST",
      cookie: adminCookie,
      body: { gameId: GAME_ID, subdivisionId: VIEWER_SUB },
    }),
    ctx({ userId: user.id }),
  );
  expect(a.status, "approve map player").toBe(200);
  mCookie = await loginAs(M_EMAIL, "playerPass123");
});

afterAll(async () => {
  // Restore the pristine game snapshot so we do not disturb other test files.
  await prisma.game.update({ where: { id: GAME_ID }, data: { stateJson: originalStateJson } });
  await prisma.user.deleteMany({ where: { email: M_EMAIL } });
  await prisma.$disconnect();
});

async function tile(col: number, row: number, cookie: string) {
  const res = await getTile(
    req(`/api/games/${GAME_ID}/map/tiles/${col}/${row}`, { cookie }),
    ctx({ gameId: String(GAME_ID), col: String(col), row: String(row) }),
  );
  return res;
}

describe("map-level endpoint", () => {
  it("requires auth (401 without a session)", async () => {
    const res = await getMap(req(`/api/games/${GAME_ID}/map`), ctx({ gameId: String(GAME_ID) }));
    expect(res.status).toBe(401);
  });

  it("returns 96 markers scoped to the caller's own subdivision, icons + tier only", async () => {
    const res = await getMap(req(`/api/games/${GAME_ID}/map`, { cookie: mCookie }), ctx({ gameId: String(GAME_ID) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.viewerSubdivisionId).toBe(VIEWER_SUB);
    expect(body.cols).toBe(12);
    expect(body.rows).toBe(8);
    expect(body.tiles.length).toBe(96);
    const own = body.tiles.find((t: { coord: { col: number; row: number } }) => t.coord.col === OWN_HQ.col && t.coord.row === OWN_HQ.row);
    expect(own.intelTier).toBe("OWN");
    expect(own.hasHQ).toBe(true);
    // No gated content leaks at the map level, for any tile.
    for (const t of body.tiles) {
      expect(t).not.toHaveProperty("buildingCount");
      expect(t).not.toHaveProperty("buildings");
      expect(t).not.toHaveProperty("units");
    }
  });
});

describe("own tile is always full detail", () => {
  it("player sees OWN tier + ownBuildings for their own HQ", async () => {
    const res = await tile(OWN_HQ.col, OWN_HQ.row, mCookie);
    expect(res.status).toBe(200);
    const { tile: t } = await res.json();
    expect(t.intelTier).toBe("OWN");
    expect(Array.isArray(t.ownBuildings)).toBe(true);
    expect(t.ownBuildings.length).toBeGreaterThan(0);
    expect(t.ownBuildings.some((b: { type: string }) => b.type === "HEADQUARTERS")).toBe(true);
    expect(t).toHaveProperty("resourceOutput");
    expect(t).toHaveProperty("units");
  });
});

describe("opponent tile is gated by the server-computed intel tier", () => {
  it("LOW (default): public fields only, no building count", async () => {
    await setViewerAnalysts(VIEWER_SUB, 0); // espionage 1 vs opsec 2 -> LOW
    const res = await tile(TARGET_HQ.col, TARGET_HQ.row, mCookie);
    expect(res.status).toBe(200);
    const { tile: t } = await res.json();
    expect(t.intelTier).toBe("LOW");
    expect(t.hasHQ).toBe(true); // icon is public
    expect(t).not.toHaveProperty("buildingCount");
    expect(t).not.toHaveProperty("buildings");
    expect(t).not.toHaveProperty("unitCount");
    expect(t).not.toHaveProperty("units");
    expect(t).not.toHaveProperty("ownBuildings");
  });

  it("MEDIUM: building count only, no types/units", async () => {
    await setViewerAnalysts(VIEWER_SUB, 2); // espionage 3 vs opsec 2 -> MEDIUM
    const res = await tile(TARGET_HQ.col, TARGET_HQ.row, mCookie);
    const { tile: t } = await res.json();
    expect(t.intelTier).toBe("MEDIUM");
    expect(typeof t.buildingCount).toBe("number");
    expect(t.buildingCount).toBeGreaterThan(0);
    expect(t).not.toHaveProperty("buildings");
    expect(t).not.toHaveProperty("unitCount");
    expect(t).not.toHaveProperty("resourceOutput");
    expect(t).not.toHaveProperty("units");
    expect(t).not.toHaveProperty("ownBuildings");
  });

  it("HIGH: building types + unit count, but no outputs/unit breakdown", async () => {
    await setViewerAnalysts(VIEWER_SUB, 5); // espionage 6 vs opsec 2 -> HIGH
    const res = await tile(TARGET_HQ.col, TARGET_HQ.row, mCookie);
    const { tile: t } = await res.json();
    expect(t.intelTier).toBe("HIGH");
    expect(Array.isArray(t.buildings)).toBe(true);
    expect(t.buildings).toContain("HEADQUARTERS");
    expect(typeof t.unitCount).toBe("number");
    expect(t).not.toHaveProperty("resourceOutput");
    expect(t).not.toHaveProperty("units");
    expect(t).not.toHaveProperty("ownBuildings");
  });

  it("FULL: resource output + unit type/hull breakdown, still no ownBuildings", async () => {
    await setViewerAnalysts(VIEWER_SUB, 17); // espionage 18 vs opsec 2 -> FULL
    const res = await tile(TARGET_HQ.col, TARGET_HQ.row, mCookie);
    const { tile: t } = await res.json();
    expect(t.intelTier).toBe("FULL");
    expect(t).toHaveProperty("resourceOutput");
    expect(t).toHaveProperty("units");
    expect(t.units).toHaveProperty("personnel");
    expect(t.units).toHaveProperty("vehicles");
    // FULL is still NOT the owner's private view.
    expect(t).not.toHaveProperty("ownBuildings");
  });
});

describe("tampering cannot raise the tier", () => {
  it("query params claiming another viewer / a desired tier are ignored", async () => {
    await setViewerAnalysts(VIEWER_SUB, 0); // back to LOW
    const url = `/api/games/${GAME_ID}/map/tiles/${TARGET_HQ.col}/${TARGET_HQ.row}?viewerSubdivisionId=3&tier=FULL&intelTier=FULL`;
    const res = await getTile(
      req(url, { cookie: mCookie }),
      ctx({ gameId: String(GAME_ID), col: String(TARGET_HQ.col), row: String(TARGET_HQ.row) }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.viewerSubdivisionId).toBe(VIEWER_SUB); // server-derived, not 3
    expect(body.tile.intelTier).toBe("LOW");
    expect(body.tile).not.toHaveProperty("buildingCount");
    expect(body.tile).not.toHaveProperty("resourceOutput");
  });

  it("map-level: player cannot view-as another subdivision", async () => {
    const res = await getMap(
      req(`/api/games/${GAME_ID}/map?viewerSubdivisionId=3`, { cookie: mCookie }),
      ctx({ gameId: String(GAME_ID) }),
    );
    const body = await res.json();
    expect(body.viewerSubdivisionId).toBe(VIEWER_SUB); // ignored for players
  });
});

describe("admin bypass", () => {
  it("admin gets full OWN-level detail on any opponent tile regardless of tier", async () => {
    await setViewerAnalysts(VIEWER_SUB, 0);
    const res = await tile(TARGET_HQ.col, TARGET_HQ.row, adminCookie);
    expect(res.status).toBe(200);
    const { tile: t, viewerSubdivisionId } = await res.json();
    expect(viewerSubdivisionId).toBeNull();
    expect(t.intelTier).toBe("OWN");
    expect(Array.isArray(t.ownBuildings)).toBe(true);
    expect(t.ownBuildings.some((b: { type: string }) => b.type === "HEADQUARTERS")).toBe(true);
  });

  it("admin map (no viewer param) shows every owned tile as OWN", async () => {
    const res = await getMap(req(`/api/games/${GAME_ID}/map`, { cookie: adminCookie }), ctx({ gameId: String(GAME_ID) }));
    const body = await res.json();
    expect(body.viewerSubdivisionId).toBeNull();
    const target = body.tiles.find((t: { coord: { col: number; row: number } }) => t.coord.col === TARGET_HQ.col && t.coord.row === TARGET_HQ.row);
    expect(target.intelTier).toBe("OWN");
  });
});

describe("unclaimed / off-map tiles", () => {
  it("an unclaimed in-bounds tile returns public terrain only (tier LOW, no private data) [D-055]", async () => {
    // {4,5} is in-bounds but owned by nobody at seed (only HQ hexes are claimed).
    const res = await tile(4, 5, mCookie);
    expect(res.status).toBe(200);
    const { tile: t } = await res.json();
    expect(t.owner).toBeNull();
    expect(t.intelTier).toBe("LOW");
    expect(t.hasHQ).toBe(false);
    expect(t.hasOutpost).toBe(false);
    expect(t).not.toHaveProperty("buildingCount");
    expect(t).not.toHaveProperty("buildings");
    expect(t).not.toHaveProperty("resourceOutput");
    expect(t).not.toHaveProperty("units");
    expect(t).not.toHaveProperty("ownBuildings");
  });

  it("returns 404 for a tile outside the 12x8 grid", async () => {
    const res = await tile(99, 99, mCookie);
    expect(res.status).toBe(404);
  });
});
