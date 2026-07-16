/**
 * End-to-end integration test against the real (seeded) Postgres DB. Drives the
 * actual route handlers to verify: registration -> approval/assignment -> login ->
 * order submission -> turn resolution, plus the server-side authorization
 * boundaries (a player cannot read another subdivision's private data or hit an
 * admin route). Requires the seed to have run (game id 1 with 6 subdivisions).
 */

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as approve } from "@/app/api/admin/registrations/[userId]/approve/route";
import { GET as getReport } from "@/app/api/games/[gameId]/report/route";
import { GET as adminReport } from "@/app/api/admin/games/[gameId]/subdivisions/[sid]/report/route";
import { PUT as putOrders, GET as getOrders } from "@/app/api/games/[gameId]/orders/route";
import { GET as dashboard } from "@/app/api/games/[gameId]/dashboard/route";
import { POST as processTurn } from "@/app/api/admin/games/[gameId]/process-turn/route";

const GAME_ID = 1;
const A_EMAIL = "itest-a@example.com";
const B_EMAIL = "itest-b@example.com";

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

async function registerAndAssign(email: string, subdivisionId: number, adminCookie: string): Promise<string> {
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
      body: { gameId: GAME_ID, subdivisionId },
    }),
    ctx({ userId: user.id }),
  );
  expect(a.status, `approve ${email}`).toBe(200);
  return user.id;
}

let adminCookie = "";
let aCookie = "";
let bCookie = "";

beforeAll(async () => {
  // Clean prior test artifacts so approvals to slots 1 & 2 are free.
  await prisma.subdivisionAssignment.deleteMany({
    where: { gameId: GAME_ID, subdivisionId: { in: [1, 2] } },
  });
  await prisma.user.deleteMany({ where: { email: { in: [A_EMAIL, B_EMAIL] } } });

  adminCookie = await loginAs(env.adminEmail.toLowerCase(), env.adminPassword);
  await registerAndAssign(A_EMAIL, 1, adminCookie);
  await registerAndAssign(B_EMAIL, 2, adminCookie);
  aCookie = await loginAs(A_EMAIL, "playerPass123");
  bCookie = await loginAs(B_EMAIL, "playerPass123");
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [A_EMAIL, B_EMAIL] } } });
  await prisma.$disconnect();
});

describe("auth + identity", () => {
  it("returns identity + assignment via /me", async () => {
    const res = await me(req("/api/auth/me", { cookie: aCookie }), ctx({}));
    const body = await res.json();
    expect(body.user.email).toBe(A_EMAIL);
    expect(body.assignment).toEqual({ gameId: GAME_ID, subdivisionId: 1 });
  });

  it("rejects unauthenticated private report with 401", async () => {
    const res = await getReport(req(`/api/games/${GAME_ID}/report`), ctx({ gameId: String(GAME_ID) }));
    expect(res.status).toBe(401);
  });
});

describe("private report authorization boundary", () => {
  it("player A sees only their own subdivision (id 1) in `own`", async () => {
    const res = await getReport(req(`/api/games/${GAME_ID}/report`, { cookie: aCookie }), ctx({ gameId: String(GAME_ID) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.own.subdivisionId).toBe(1);
    // Others are public-only: no resource stockpiles / cumulative counters leak.
    for (const other of body.others) {
      expect(other).not.toHaveProperty("resources");
      expect(other).not.toHaveProperty("cumulativeCounters");
      expect(other).not.toHaveProperty("earthRelations");
    }
  });

  it("player B's own report is subdivision 2, never 1", async () => {
    const res = await getReport(req(`/api/games/${GAME_ID}/report`, { cookie: bCookie }), ctx({ gameId: String(GAME_ID) }));
    const body = await res.json();
    expect(body.own.subdivisionId).toBe(2);
  });

  it("player B cannot hit the admin per-subdivision report route (403)", async () => {
    const res = await adminReport(
      req(`/api/admin/games/${GAME_ID}/subdivisions/1/report`, { cookie: bCookie }),
      ctx({ gameId: String(GAME_ID), sid: "1" }),
    );
    expect(res.status).toBe(403);
  });

  it("player B cannot force a turn via the admin route (403)", async () => {
    const res = await processTurn(
      req(`/api/admin/games/${GAME_ID}/process-turn`, { method: "POST", cookie: bCookie }),
      ctx({ gameId: String(GAME_ID) }),
    );
    expect(res.status).toBe(403);
  });

  it("admin CAN read any subdivision's private report", async () => {
    const res = await adminReport(
      req(`/api/admin/games/${GAME_ID}/subdivisions/1/report`, { cookie: adminCookie }),
      ctx({ gameId: String(GAME_ID), sid: "1" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.own.subdivisionId).toBe(1);
    expect(body.own).toHaveProperty("resources");
  });
});

describe("orders + turn resolution", () => {
  it("player A can submit and read back orders, validated by the engine", async () => {
    const orders = { garrison: [], buildingActions: [], unitActions: [], corporateActions: [], notes: [] };
    const put = await putOrders(
      req(`/api/games/${GAME_ID}/orders`, { method: "PUT", cookie: aCookie, body: orders }),
      ctx({ gameId: String(GAME_ID) }),
    );
    expect(put.status).toBe(200);
    const putBody = await put.json();
    expect(putBody.saved).toBe(true);
    expect(putBody.accepted).toBe(true);

    const get = await getOrders(req(`/api/games/${GAME_ID}/orders`, { cookie: aCookie }), ctx({ gameId: String(GAME_ID) }));
    const getBody = await get.json();
    expect(getBody.submission.subdivisionId).toBe(1);
  });

  it("admin process-turn resolves the current turn and persists an immutable log", async () => {
    const before = await prisma.game.findUniqueOrThrow({ where: { id: GAME_ID } });
    const turnBeing = before.turnNumber;

    const res = await processTurn(
      req(`/api/admin/games/${GAME_ID}/process-turn`, { method: "POST", cookie: adminCookie }),
      ctx({ gameId: String(GAME_ID) }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resolvedTurn).toBe(turnBeing);
    expect(body.nextTurn).toBe(turnBeing + 1);

    const log = await prisma.turnLog.findUnique({
      where: { gameId_turnNumber: { gameId: GAME_ID, turnNumber: turnBeing } },
    });
    expect(log).not.toBeNull();

    const after = await prisma.game.findUniqueOrThrow({ where: { id: GAME_ID } });
    expect(after.turnNumber).toBe(turnBeing + 1);

    // Projection reflects the new turn; round-trip succeeded (report renders).
    const rep = await getReport(req(`/api/games/${GAME_ID}/report`, { cookie: aCookie }), ctx({ gameId: String(GAME_ID) }));
    const repBody = await rep.json();
    expect(repBody.turnNumber).toBe(turnBeing + 1);
  });

  it("public dashboard renders standings + market", async () => {
    const res = await dashboard(req(`/api/games/${GAME_ID}/dashboard`, { cookie: aCookie }), ctx({ gameId: String(GAME_ID) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.standings.standings.length).toBeGreaterThan(0);
    expect(body.market.length).toBe(5);
  });
});
