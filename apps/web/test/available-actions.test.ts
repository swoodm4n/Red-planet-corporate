/**
 * End-to-end tests for the building available-actions endpoint (§22.9 / [D-056]–
 * [D-064]) against the real seeded Postgres DB (game id 1). Verifies the server
 * derives per-building action availability + per-unit attention state from the
 * engine, reflecting the tentative attention spend of the caller's draft orders,
 * and that it is strictly viewer-scoped.
 *
 *   POST /api/games/:gameId/orders/available-actions
 *     body: { draftOrders?: { buildingActions?, unitActions?, ... } }
 *     -> { gameId, turnNumber, subdivisionId, buildings, unitAttention }
 *
 * The test mutates a dedicated subdivision's buildings/personnel into a known
 * scenario, then restores the pristine snapshot in afterAll (mirroring
 * map-intel.test.ts) so other test files are undisturbed.
 */

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { deserializeGame, serializeGame } from "@/lib/serialize";

import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as approve } from "@/app/api/admin/registrations/[userId]/approve/route";
import { POST as availableActions } from "@/app/api/games/[gameId]/orders/available-actions/route";

const GAME_ID = 1;
const SUB = 2; // the test player's subdivision (crafted scenario below)
const OTHER_SUB = 4; // a second player, for the viewer-isolation check
const EMAIL = "itest-avail@example.com";
const OTHER_EMAIL = "itest-avail-other@example.com";

// Crafted building ids (well out of the seed's range so they never collide).
const B_COMMERCIAL = 950101; // COMMERCIAL_HUB, 2 Admins -> AMPLIFY_CREDIT_YIELD
const B_HQ_SECURED = 950102; // HQ + active SECURITY_DETAIL -> +LOCKDOWN
const B_UNDERSTAFFED = 950103; // COMMERCIAL_HUB, 1 Admin (below min 2) -> not operational
const B_HQ_PLAIN = 950104; // HQ, no module -> no LOCKDOWN

// Crafted personnel ids.
const P = {
  hubAdminA: 950201,
  hubAdminB: 950202,
  hqAdminA: 950203,
  hqAdminB: 950204,
  hqContractor: 950205,
  underAdmin: 950206,
  plainAdminA: 950207,
  plainAdminB: 950208,
  plainContractor: 950209,
};

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

async function ensurePlayer(email: string, subId: number): Promise<string> {
  await prisma.subdivisionAssignment.deleteMany({ where: { gameId: GAME_ID, subdivisionId: subId } });
  await prisma.user.deleteMany({ where: { email } });
  const r = await register(
    req("/api/auth/register", { method: "POST", body: { email, password: "playerPass123" } }),
    ctx({}),
  );
  expect([201, 409]).toContain(r.status);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const a = await approve(
    req(`/api/admin/registrations/${user.id}/approve`, {
      method: "POST",
      cookie: adminCookie,
      body: { gameId: GAME_ID, subdivisionId: subId },
    }),
    ctx({ userId: user.id }),
  );
  expect(a.status, `approve ${email}`).toBe(200);
  return loginAs(email, "playerPass123");
}

type J = Record<string, unknown>;

function building(
  id: number,
  type: string,
  garrison: Record<string, number>,
  modules: J[],
  col: number,
): J {
  return {
    id,
    type,
    tier: "T1",
    hex: { col, row: 7 },
    status: "ACTIVE",
    builtOnTurn: 0,
    modules,
    garrison,
    disabledUntilTurn: 0,
    dormantTurns: 0,
  };
}

function person(id: number, type: string, buildingId: number): J {
  return {
    id,
    type,
    status: "GARRISONED",
    assignedBuildingId: buildingId,
    unavailableUntilTurn: 0,
    attentionSpentThisTurn: false,
  };
}

/** Overwrite SUB's buildings + personnel with the fixed availability scenario. */
async function installScenario(): Promise<void> {
  const row = await prisma.game.findUniqueOrThrow({ where: { id: GAME_ID } });
  const game = deserializeGame(row.stateJson as Record<string, unknown>);
  const sub = game.subdivisions.find((s) => s.id === SUB);
  if (!sub) throw new Error(`subdivision ${SUB} not found`);
  sub.status = "ACTIVE";
  sub.buildings = [
    building(B_COMMERCIAL, "COMMERCIAL_HUB", { ADMINISTRATOR: 2 }, [], 1) as never,
    building(
      B_HQ_SECURED,
      "HEADQUARTERS",
      { ADMINISTRATOR: 2, CONTRACTOR: 1 },
      [{ id: 950301, type: "SECURITY_DETAIL", status: "ACTIVE" }],
      2,
    ) as never,
    building(B_UNDERSTAFFED, "COMMERCIAL_HUB", { ADMINISTRATOR: 1 }, [], 3) as never,
    building(B_HQ_PLAIN, "HEADQUARTERS", { ADMINISTRATOR: 2, CONTRACTOR: 1 }, [], 4) as never,
  ];
  sub.personnel = [
    person(P.hubAdminA, "ADMINISTRATOR", B_COMMERCIAL) as never,
    person(P.hubAdminB, "ADMINISTRATOR", B_COMMERCIAL) as never,
    person(P.hqAdminA, "ADMINISTRATOR", B_HQ_SECURED) as never,
    person(P.hqAdminB, "ADMINISTRATOR", B_HQ_SECURED) as never,
    person(P.hqContractor, "CONTRACTOR", B_HQ_SECURED) as never,
    person(P.underAdmin, "ADMINISTRATOR", B_UNDERSTAFFED) as never,
    person(P.plainAdminA, "ADMINISTRATOR", B_HQ_PLAIN) as never,
    person(P.plainAdminB, "ADMINISTRATOR", B_HQ_PLAIN) as never,
    person(P.plainContractor, "CONTRACTOR", B_HQ_PLAIN) as never,
  ];
  await prisma.game.update({
    where: { id: GAME_ID },
    data: { stateJson: serializeGame(game) as Prisma.InputJsonValue },
  });
}

async function fetchAvailable(cookie: string, draftOrders?: unknown) {
  const res = await availableActions(
    req(`/api/games/${GAME_ID}/orders/available-actions`, {
      method: "POST",
      cookie,
      body: draftOrders != null ? { draftOrders } : {},
    }),
    ctx({ gameId: String(GAME_ID) }),
  );
  return res;
}

let adminCookie = "";
let playerCookie = "";
let otherCookie = "";
let originalStateJson: Prisma.InputJsonValue;

beforeAll(async () => {
  const row = await prisma.game.findUniqueOrThrow({ where: { id: GAME_ID } });
  originalStateJson = row.stateJson as Prisma.InputJsonValue;

  adminCookie = await loginAs(env.adminEmail.toLowerCase(), env.adminPassword);
  playerCookie = await ensurePlayer(EMAIL, SUB);
  otherCookie = await ensurePlayer(OTHER_EMAIL, OTHER_SUB);

  await installScenario();
});

afterAll(async () => {
  await prisma.game.update({ where: { id: GAME_ID }, data: { stateJson: originalStateJson } });
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL, OTHER_EMAIL] } } });
  await prisma.$disconnect();
});

describe("auth + viewer scoping", () => {
  it("401 without a session", async () => {
    const res = await fetchAvailable("");
    expect(res.status).toBe(401);
  });

  it("response is scoped to the caller's own subdivision (server-derived)", async () => {
    const res = await fetchAvailable(playerCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subdivisionId).toBe(SUB);
    expect(body.gameId).toBe(GAME_ID);
    // Only this subdivision's crafted buildings are present.
    const ids = Object.keys(body.buildings).map(Number).sort((a, b) => a - b);
    expect(ids).toEqual([B_COMMERCIAL, B_HQ_SECURED, B_UNDERSTAFFED, B_HQ_PLAIN].sort((a, b) => a - b));
  });

  it("a different player can never see this subdivision's buildings", async () => {
    const res = await fetchAvailable(otherCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subdivisionId).toBe(OTHER_SUB);
    // The crafted building ids belong to SUB, not OTHER_SUB.
    for (const id of [B_COMMERCIAL, B_HQ_SECURED, B_UNDERSTAFFED, B_HQ_PLAIN]) {
      expect(body.buildings).not.toHaveProperty(String(id));
    }
  });
});

describe("(a) fresh buildings with no draft show their base + module actions", () => {
  it("derives the engine's real gating per building", async () => {
    const res = await fetchAvailable(playerCookie);
    const body = await res.json();
    // COMMERCIAL_HUB with 2 Admins -> AMPLIFY_CREDIT_YIELD offered.
    expect(body.buildings[B_COMMERCIAL]).toContain("AMPLIFY_CREDIT_YIELD");
    // HQ (operational) base actions.
    expect(body.buildings[B_HQ_SECURED]).toEqual(
      expect.arrayContaining(["COLONIST_REQUISITION", "TERRITORIAL_CLAIM"]),
    );
    // (d) module-unlocked LOCKDOWN appears ONLY with an active SECURITY_DETAIL.
    expect(body.buildings[B_HQ_SECURED]).toContain("LOCKDOWN");
    expect(body.buildings[B_HQ_PLAIN]).not.toContain("LOCKDOWN");
    expect(body.buildings[B_HQ_PLAIN]).toEqual(
      expect.arrayContaining(["COLONIST_REQUISITION", "TERRITORIAL_CLAIM"]),
    );
    // (d) operational gating: understaffed COMMERCIAL_HUB offers nothing.
    expect(body.buildings[B_UNDERSTAFFED]).toEqual([]);
    // No unit's attention is spent before any draft order.
    for (const id of Object.values(P)) {
      expect(body.unitAttention[id]).toBe(false);
    }
  });
});

describe("(b) draft orders tentatively spend attention -> actions drop off", () => {
  it("spending both Admins removes the Admin-gated action and marks them spent", async () => {
    const draft = {
      buildingActions: [{ buildingId: B_COMMERCIAL, action: "AMPLIFY_CREDIT_YIELD" }],
    };
    const res = await fetchAvailable(playerCookie, draft);
    const body = await res.json();
    // AMPLIFY_CREDIT_YIELD needs 2 Admins; both are now spent -> no longer offered.
    expect(body.buildings[B_COMMERCIAL]).not.toContain("AMPLIFY_CREDIT_YIELD");
    expect(body.buildings[B_COMMERCIAL]).toEqual([]);
    expect(body.unitAttention[P.hubAdminA]).toBe(true);
    expect(body.unitAttention[P.hubAdminB]).toBe(true);
    // Other buildings' units untouched.
    expect(body.unitAttention[P.hqAdminA]).toBe(false);
  });

  it("spending the Security Detail's Contractor removes only LOCKDOWN", async () => {
    const draft = {
      buildingActions: [{ buildingId: B_HQ_SECURED, action: "LOCKDOWN" }],
    };
    const res = await fetchAvailable(playerCookie, draft);
    const body = await res.json();
    // LOCKDOWN needs the 1 Contractor, now spent -> gone.
    expect(body.buildings[B_HQ_SECURED]).not.toContain("LOCKDOWN");
    // Admin-gated actions remain (their Admins are untouched).
    expect(body.buildings[B_HQ_SECURED]).toEqual(
      expect.arrayContaining(["COLONIST_REQUISITION", "TERRITORIAL_CLAIM"]),
    );
    expect(body.unitAttention[P.hqContractor]).toBe(true);
    expect(body.unitAttention[P.hqAdminA]).toBe(false);
    expect(body.unitAttention[P.hqAdminB]).toBe(false);
  });

  it("a draft on one building does not affect an unrelated building", async () => {
    const draft = {
      buildingActions: [{ buildingId: B_COMMERCIAL, action: "AMPLIFY_CREDIT_YIELD" }],
    };
    const res = await fetchAvailable(playerCookie, draft);
    const body = await res.json();
    // HQ still fully available; only the COMMERCIAL_HUB's Admins were spent.
    expect(body.buildings[B_HQ_SECURED]).toContain("LOCKDOWN");
    expect(body.buildings[B_HQ_SECURED]).toEqual(
      expect.arrayContaining(["COLONIST_REQUISITION", "TERRITORIAL_CLAIM"]),
    );
  });
});
