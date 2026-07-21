import { prisma } from "@/lib/prisma";
import { handle, json, readJson, errors, serializeCookie } from "@/lib/http";
import { verifyPassword } from "@/lib/auth/password";
import { issueSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { sessionCookieOptions } from "@/lib/auth/session";
import { loginSchema, parseOr400 } from "@/lib/validation";

export const runtime = "nodejs";

// POST /api/auth/login — sets an httpOnly session cookie on success.
export const POST = handle(async (req) => {
  const body = parseOr400(loginSchema, await readJson(req));
  const email = body.email.toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  // Constant-ish behavior: always run a compare to avoid user enumeration timing.
  const ok = user ? await verifyPassword(body.password, user.passwordHash) : false;
  if (!user || !ok) throw errors.unauthorized("Invalid email or password");

  if (user.status === "REJECTED") throw errors.forbidden("This account has been rejected");

  const token = await issueSessionToken(user.id);
  const cookie = serializeCookie(SESSION_COOKIE, token, sessionCookieOptions());

  return json(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      displayName: user.displayName,
    },
    { headers: { "set-cookie": cookie } },
  );
});
