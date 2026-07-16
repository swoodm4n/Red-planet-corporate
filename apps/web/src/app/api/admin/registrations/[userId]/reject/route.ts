import { prisma } from "@/lib/prisma";
import { handle, json, readJson, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";
import { writeAudit } from "@/server/audit";

export const runtime = "nodejs";

// POST /api/admin/registrations/:userId/reject — reject a pending registration.
export const POST = handle(async (req, ctx) => {
  const admin = await requireAdmin(req);
  const { userId } = await ctx.params;
  const body = (await readJson<{ reason?: string }>(req)) ?? {};

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw errors.notFound("User not found");
  if (user.role !== "PLAYER") throw errors.badRequest("Cannot reject an admin account");

  await prisma.$transaction(async (tx) => {
    await tx.subdivisionAssignment.deleteMany({ where: { userId } });
    await tx.user.update({ where: { id: userId }, data: { status: "REJECTED" } });
    await writeAudit(
      { adminUserId: admin.id, action: "REJECT_REGISTRATION", targetType: "USER", targetId: userId, note: body.reason },
      tx,
    );
  });

  return json({ ok: true, userId, status: "REJECTED" });
});
