import { prisma } from "@/lib/prisma";
import { handle, json, readJson } from "@/lib/http";
import { makeResetToken } from "@/lib/auth/password";
import { parseOr400, resetRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

// POST /api/auth/password-reset/request — issue a reset token.
// Always returns 200 (no user enumeration). Email delivery is out of scope; in
// non-production the token is returned directly so it can be used/tested.
export const POST = handle(async (req) => {
  const body = parseOr400(resetRequestSchema, await readJson(req));
  const email = body.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  let devToken: string | undefined;
  if (user) {
    const { token, tokenHash } = makeResetToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 3600 * 1000) },
    });
    if (process.env.NODE_ENV !== "production") devToken = token;
  }

  return json({
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
    ...(devToken ? { devToken } : {}),
  });
});
