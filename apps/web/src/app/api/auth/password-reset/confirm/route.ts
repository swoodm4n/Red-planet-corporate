import { prisma } from "@/lib/prisma";
import { handle, json, readJson, errors } from "@/lib/http";
import { hashPassword, hashResetToken } from "@/lib/auth/password";
import { parseOr400, resetConfirmSchema } from "@/lib/validation";

export const runtime = "nodejs";

// POST /api/auth/password-reset/confirm — consume a token and set a new password.
export const POST = handle(async (req) => {
  const body = parseOr400(resetConfirmSchema, await readJson(req));
  const tokenHash = hashResetToken(body.token);

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw errors.badRequest("Invalid or expired reset token");
  }

  const passwordHash = await hashPassword(body.newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Invalidate any other outstanding tokens for this user.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  return json({ ok: true, message: "Password updated. You may now log in." });
});
