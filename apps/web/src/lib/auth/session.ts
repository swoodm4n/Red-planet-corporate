/**
 * Session handling. [D-044] We use a stateless signed JWT (jose) in an httpOnly,
 * SameSite=Lax cookie rather than NextAuth — the app needs custom pending-approval
 * and admin-assignment flows that are simpler to own directly. The token carries
 * only { sub: userId }; role/status/authorization are always re-read from the DB on
 * each request, so a revoked/downgraded user cannot act on a stale token's claims.
 */

import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "rpc_session";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.authSecret);
}

export async function issueSessionToken(userId: string): Promise<string> {
  const ttlSeconds = env.sessionTtlHours * 3600;
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: env.sessionTtlHours * 3600,
  };
}
