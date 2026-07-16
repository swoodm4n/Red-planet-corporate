/**
 * API-level authorization & result-visibility tests. Extends integration.test.ts
 * (registration→approval→orders→resolution→basic boundaries) with the boundaries it
 * does not cover:
 *   - order writes never trust client subdivisionId/turnNumber;
 *   - an unapproved (PENDING) player is blocked from all player data;
 *   - a player cannot reach admin-only routes (registrations list, state-edit, events);
 *   - a player cannot request a game they are not assigned to;
 *   - resolved-turn visibility: players get event+scoreboard only, admins get the full log.
 * Runs against the same real seeded Postgres as integration.test.ts.
 */

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as approve } from "@/app/api/admin/registrations/[userId]/approve/route";
import { GET as getReport } from "@/app/api/games/[gameId]/report/route";
import { GET as getDashboard } from "@/app/api/games/[gameId]/dashboard/route";
import { PUT as putOrders, GET as getOrders } from "@/app/api/games/[gameId]/orders/route";
import { GET as adminRegistrations } from "@/app/api/admin/registrations/route";
import { POST as stateEdit } from "@/app/api/admin/games/[gameId]/state-edit/route";
import { POST as adminEvent } from "@/app/api/admin/games/[gameId]/events/route";
import { POST as processTurn } from "@/app/api/admin/games/[gameId]/process-turn/route";
import { GET as getTurn } from "@/app/api/games/[gameId]/turns/[turnNumber]/route";

const GAME_ID = 1;
const A_EMAIL = "authv-a@example.com";
const B_EMAIL = "authv-b@example.com";
const C_EMAIL = "authv-c@example.com"; // stays PENDING (never approved)
const PASS = "authvPass123";

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
async function registerUser(email: string): Promise<string> {
  const r = await register(req("/api/auth/register", { method: "POST", body: { email, password: PASS } }), ctx({}));
  expect([201, 409]).toContain(r.status);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return user.id;
}
async function approveTo(userId: string, subdivisionId: number, adminCookie: string): Promise<void> {
  const a = await approve(
    req(`/api/admin/registrations/${userId}/approve`, { method: "POST", cookie: adminCookie, body: { gameId: GAME_ID, subdivisionId } }),
    ctx({ userId }),
  );
  expect(a.status, `approve ${userId}`).toBe(200);
}

let adminCookie = "";
let aCookie = "";
let bCookie = "";
let cCookie = "";

beforeAll(async () => {
  await prisma.subdivisionAssignment.deleteMany({ where: { gameId: GAME_ID, subdivisionId: { in: [1, 2] } } });
  await prisma.user.deleteMany({ where: { email: { in: [A_EMAIL, B_EMAIL, C_EMAIL] } } });

  adminCookie = await loginAs(env.adminEmail.toLowerCase(), env.adminPassword);
  const aId = await registerUser(A_EMAIL);
  const bId = await registerUser(B_EMAIL);
  await registerUser(C_EMAIL); // deliberately left PENDING
  await approveTo(aId, 1, adminCookie);
  await approveTo(bId, 2, adminCookie);
  aCookie = await loginAs(A_EMAIL, PASS);
  bCookie = await loginAs(B_EMAIL, PASS);
  cCookie = await loginAs(C_EMAIL, PASS);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [A_EMAIL, B_EMAIL, C_EMAIL] } } });
  await prisma.$disconnect();
});

describe("order write-side authorization", () => {
  it("ignores a spoofed subdivisionId/turnNumber in the request body", async () => {
    const spoofed = {
      subdivisionId: 2, // player A trying to write as subdivision 2
      turnNumber: 99999,
      garrison: [], buildingActions: [], unitActions: [], corporateActions: [], notes: [],
    };
    const put = await putOrders(
      req(`/api/games/${GAME_ID}/orders`, { method: "PUT", cookie: aCookie, body: spoofed }),
      ctx({ gameId: String(GAME_ID) }),
    );
    expect(put.status).toBe(200);
    const putBody = await put.json();
    expect(putBody.subdivisionId).toBe(1); // server-assigned, not the spoofed 2
    expect(putBody.turnNumber).not.toBe(99999);

    // Persisted under subdivision 1, and the stored submission carries the real id.
    const get = await getOrders(req(`/api/games/${GAME_ID}/orders`, { cookie: aCookie }), ctx({ gameId: String(GAME_ID) }));
    const getBody = await get.json();
    expect(getBody.subdivisionId).toBe(1);
    expect(getBody.submission.subdivisionId).toBe(1);

    // Player B's stored orders are untouched by A's write.
    const row = await prisma.submission.findFirst({ where: { gameId: GAME_ID, subdivisionId: 2 }, orderBy: { turnNumber: "desc" } });
    if (row) expect((row.submissionJson as { subdivisionId: number }).subdivisionId).toBe(2);
  });
});

describe("unapproved (PENDING) player is blocked from player data", () => {
  it("can log in but cannot read dashboard / report / orders (403)", async () => {
    const d = await getDashboard(req(`/api/games/${GAME_ID}/dashboard`, { cookie: cCookie }), ctx({ gameId: String(GAME_ID) }));
    expect(d.status).toBe(403);
    const rep = await getReport(req(`/api/games/${GAME_ID}/report`, { cookie: cCookie }), ctx({ gameId: String(GAME_ID) }));
    expect(rep.status).toBe(403);
    const ord = await getOrders(req(`/api/games/${GAME_ID}/orders`, { cookie: cCookie }), ctx({ gameId: String(GAME_ID) }));
    expect(ord.status).toBe(403);
  });
});

describe("player cannot reach admin-only routes", () => {
  it("admin registrations list is 403 for a player", async () => {
    const res = await adminRegistrations(req(`/api/admin/registrations?status=ALL`, { cookie: bCookie }), ctx({}));
    expect(res.status).toBe(403);
  });
  it("admin state-edit is 403 for a player", async () => {
    const res = await stateEdit(
      req(`/api/admin/games/${GAME_ID}/state-edit`, { method: "POST", cookie: bCookie, body: { edits: [{ op: "ADD_RESOURCE", subdivisionId: 1, resource: "CREDITS", amount: 1000, asCredits: true }] } }),
      ctx({ gameId: String(GAME_ID) }),
    );
    expect(res.status).toBe(403);
  });
  it("admin manual-event is 403 for a player", async () => {
    const res = await adminEvent(
      req(`/api/admin/games/${GAME_ID}/events`, { method: "POST", cookie: bCookie, body: { name: "Dust Storm", edits: [] } }),
      ctx({ gameId: String(GAME_ID) }),
    );
    expect(res.status).toBe(403);
  });
});

describe("player cannot request a game they are not assigned to", () => {
  it("report for an unrelated game id is 403", async () => {
    const res = await getReport(req(`/api/games/424242/report`, { cookie: aCookie }), ctx({ gameId: "424242" }));
    expect(res.status).toBe(403);
  });
});

describe("resolved-turn result visibility (public vs private)", () => {
  it("a player sees only event+scoreboard; the admin sees the full per-order log", async () => {
    // Ensure at least one resolved turn log exists.
    let log = await prisma.turnLog.findFirst({ where: { gameId: GAME_ID }, orderBy: { turnNumber: "desc" } });
    if (!log) {
      const p = await processTurn(req(`/api/admin/games/${GAME_ID}/process-turn`, { method: "POST", cookie: adminCookie }), ctx({ gameId: String(GAME_ID) }));
      expect(p.status).toBe(200);
      log = await prisma.turnLog.findFirst({ where: { gameId: GAME_ID }, orderBy: { turnNumber: "desc" } });
    }
    const turn = log!.turnNumber;

    const playerRes = await getTurn(req(`/api/games/${GAME_ID}/turns/${turn}`, { cookie: aCookie }), ctx({ gameId: String(GAME_ID), turnNumber: String(turn) }));
    expect(playerRes.status).toBe(200);
    const playerBody = await playerRes.json();
    expect(playerBody.event).toBeDefined();
    expect(playerBody.scoreboard).toBeDefined();
    expect(playerBody.log).toBeUndefined(); // full per-order log is NOT exposed to players

    const adminRes = await getTurn(req(`/api/games/${GAME_ID}/turns/${turn}`, { cookie: adminCookie }), ctx({ gameId: String(GAME_ID), turnNumber: String(turn) }));
    expect(adminRes.status).toBe(200);
    const adminBody = await adminRes.json();
    expect(adminBody.log).toBeDefined(); // admin gets the full log
  });
});
