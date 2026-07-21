/**
 * End-to-end tests for the subdivision comms endpoints ([D-066]–[D-068]) against
 * the real seeded Postgres DB (game id 1). Verifies the send/read authorization
 * boundaries that are the whole point of the feature:
 *
 *   POST /api/games/:gameId/messages   body: { recipient, body }
 *   GET  /api/games/:gameId/messages   -> { viewerSubdivisionId, isAdmin, messages }
 *
 * Three real players (SUB / OTHER / THIRD) + admin. We assert:
 *  - a player can post publicly, DM a specific rival, and DM high command,
 *  - the DM recipient sees it but an uninvolved third subdivision does NOT,
 *  - public posts are visible to everyone,
 *  - a player can never see two other subdivisions' private DM,
 *  - admin sees everything,
 *  - send auth: no self-DM, unknown recipient 404, unauthenticated 401,
 *    admin cannot send (no assigned subdivision).
 *
 * Created rows are cleaned up in afterAll so other test files are undisturbed.
 */

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as approve } from "@/app/api/admin/registrations/[userId]/approve/route";
import { GET as listMessages, POST as sendMessage } from "@/app/api/games/[gameId]/messages/route";

const GAME_ID = 1;
const SUB = 2; // primary test player
const OTHER = 4; // the DM recipient / second party
const THIRD = 5; // an uninvolved third subdivision
const EMAIL = "itest-msg@example.com";
const OTHER_EMAIL = "itest-msg-other@example.com";
const THIRD_EMAIL = "itest-msg-third@example.com";

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

type Msg = {
  id: string;
  scope: "PUBLIC" | "SUBDIVISION" | "ADMIN";
  senderSubdivisionId: number | null;
  recipientSubdivisionId: number | null;
  recipientIsAdmin: boolean;
  body: string;
};

async function send(cookie: string, recipient: unknown, body: string): Promise<Response> {
  return sendMessage(
    req(`/api/games/${GAME_ID}/messages`, { method: "POST", cookie, body: { recipient, body } }),
    ctx({ gameId: String(GAME_ID) }),
  );
}

async function list(cookie: string): Promise<{ status: number; body: { viewerSubdivisionId: number | null; isAdmin: boolean; messages: Msg[] } }> {
  const res = await listMessages(
    req(`/api/games/${GAME_ID}/messages`, { cookie }),
    ctx({ gameId: String(GAME_ID) }),
  );
  return { status: res.status, body: await res.json() };
}

let adminCookie = "";
let subCookie = "";
let otherCookie = "";
let thirdCookie = "";

// Unique bodies so we can find exactly our rows regardless of other feed traffic.
const tag = `msgtest-${Date.now()}`;
const PUBLIC_BODY = `${tag}-public-hello-colony`;
const DM_BODY = `${tag}-dm-sub-to-other`;
const ADMIN_BODY = `${tag}-dm-to-high-command`;

beforeAll(async () => {
  adminCookie = await loginAs(env.adminEmail.toLowerCase(), env.adminPassword);
  subCookie = await ensurePlayer(EMAIL, SUB);
  otherCookie = await ensurePlayer(OTHER_EMAIL, OTHER);
  thirdCookie = await ensurePlayer(THIRD_EMAIL, THIRD);
});

afterAll(async () => {
  await prisma.message.deleteMany({ where: { gameId: GAME_ID, body: { contains: tag } } });
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL, OTHER_EMAIL, THIRD_EMAIL] } } });
  await prisma.$disconnect();
});

function bodies(msgs: Msg[]): string[] {
  return msgs.map((m) => m.body);
}

describe("send authorization", () => {
  it("401 without a session", async () => {
    const res = await send("", { type: "PUBLIC" }, `${tag}-noauth`);
    expect(res.status).toBe(401);
  });

  it("a player can post publicly", async () => {
    const res = await send(subCookie, { type: "PUBLIC" }, PUBLIC_BODY);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message.scope).toBe("PUBLIC");
    expect(body.message.senderSubdivisionId).toBe(SUB);
    expect(body.message.channel).toBe("COMMS");
  });

  it("a player can DM a specific rival subdivision", async () => {
    const res = await send(subCookie, { type: "SUBDIVISION", subdivisionId: OTHER }, DM_BODY);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message.scope).toBe("SUBDIVISION");
    expect(body.message.recipientSubdivisionId).toBe(OTHER);
  });

  it("a player can DM high command (admin)", async () => {
    const res = await send(subCookie, { type: "ADMIN" }, ADMIN_BODY);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message.scope).toBe("ADMIN");
    expect(body.message.recipientIsAdmin).toBe(true);
    expect(body.message.recipientSubdivisionId).toBeNull();
  });

  it("rejects a self-DM (400)", async () => {
    const res = await send(subCookie, { type: "SUBDIVISION", subdivisionId: SUB }, `${tag}-self`);
    expect(res.status).toBe(400);
  });

  it("rejects an unknown recipient subdivision (404)", async () => {
    const res = await send(subCookie, { type: "SUBDIVISION", subdivisionId: 99999 }, `${tag}-nobody`);
    expect(res.status).toBe(404);
  });

  it("admin cannot send (no assigned subdivision) — announcements stay separate [D-068]", async () => {
    const res = await send(adminCookie, { type: "PUBLIC" }, `${tag}-admin-send`);
    expect(res.status).toBe(403);
  });
});

describe("read visibility boundaries", () => {
  it("public posts are visible to everyone (sender, other, third, admin)", async () => {
    for (const [who, cookie] of [
      ["sub", subCookie],
      ["other", otherCookie],
      ["third", thirdCookie],
      ["admin", adminCookie],
    ] as const) {
      const { status, body } = await list(cookie);
      expect(status, who).toBe(200);
      expect(bodies(body.messages), `${who} sees public`).toContain(PUBLIC_BODY);
    }
  });

  it("the DM recipient sees the DM; sender sees their own DM", async () => {
    const recip = await list(otherCookie);
    expect(bodies(recip.body.messages)).toContain(DM_BODY);
    const sender = await list(subCookie);
    expect(bodies(sender.body.messages)).toContain(DM_BODY);
  });

  it("an uninvolved third subdivision CANNOT see the SUB->OTHER DM", async () => {
    const { body } = await list(thirdCookie);
    expect(body.viewerSubdivisionId).toBe(THIRD);
    expect(bodies(body.messages)).not.toContain(DM_BODY);
  });

  it("a player's DM to high command is invisible to other players", async () => {
    for (const cookie of [otherCookie, thirdCookie]) {
      const { body } = await list(cookie);
      expect(bodies(body.messages)).not.toContain(ADMIN_BODY);
    }
    // ...but visible to the sender.
    const sender = await list(subCookie);
    expect(bodies(sender.body.messages)).toContain(ADMIN_BODY);
  });

  it("admin sees everything: public, the rival DM, and the high-command DM", async () => {
    const { body } = await list(adminCookie);
    expect(body.isAdmin).toBe(true);
    expect(body.viewerSubdivisionId).toBeNull();
    const b = bodies(body.messages);
    expect(b).toContain(PUBLIC_BODY);
    expect(b).toContain(DM_BODY);
    expect(b).toContain(ADMIN_BODY);
  });

  it("a DM strictly between two OTHER subdivisions is invisible to a third", async () => {
    // OTHER -> THIRD; SUB (uninvolved) must not see it.
    const priv = `${tag}-other-to-third`;
    const res = await send(otherCookie, { type: "SUBDIVISION", subdivisionId: THIRD }, priv);
    expect(res.status).toBe(201);

    const subView = await list(subCookie);
    expect(bodies(subView.body.messages)).not.toContain(priv);
    // Both parties DO see it.
    expect(bodies((await list(otherCookie)).body.messages)).toContain(priv);
    expect(bodies((await list(thirdCookie)).body.messages)).toContain(priv);
  });
});
