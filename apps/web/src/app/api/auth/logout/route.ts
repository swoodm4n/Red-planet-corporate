import { handle, json, serializeCookie } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";

// POST /api/auth/logout — clears the session cookie.
export const POST = handle(async () => {
  const cookie = serializeCookie(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return json({ ok: true }, { headers: { "set-cookie": cookie } });
});
