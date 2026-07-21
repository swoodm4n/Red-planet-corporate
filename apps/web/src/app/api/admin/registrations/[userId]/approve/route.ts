import { prisma } from "@/lib/prisma";
import { handle, json, readJson, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";
import { approveSchema, parseOr400 } from "@/lib/validation";
import { writeAudit } from "@/server/audit";

export const runtime = "nodejs";

// POST /api/admin/registrations/:userId/approve — approve a pending player and
// assign them a subdivision slot in a game. [D-014]
export const POST = handle(async (req, ctx) => {
  const admin = await requireAdmin(req);
  const { userId } = await ctx.params;
  const body = parseOr400(approveSchema, await readJson(req));

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw errors.notFound("User not found");
  if (user.role !== "PLAYER") throw errors.badRequest("Only player accounts can be assigned");

  const game = await prisma.game.findUnique({ where: { id: body.gameId } });
  if (!game) throw errors.notFound("Game not found");

  const sub = await prisma.subdivisionState.findUnique({
    where: { gameId_subdivisionId: { gameId: body.gameId, subdivisionId: body.subdivisionId } },
  });
  if (!sub) throw errors.notFound("Subdivision not found in this game");

  const slotTaken = await prisma.subdivisionAssignment.findUnique({
    where: { gameId_subdivisionId: { gameId: body.gameId, subdivisionId: body.subdivisionId } },
  });
  if (slotTaken && slotTaken.userId !== userId) {
    throw errors.conflict("That subdivision is already assigned to another player");
  }

  await prisma.$transaction(async (tx) => {
    // A user holds at most one assignment; clear any prior one.
    await tx.subdivisionAssignment.deleteMany({ where: { userId } });
    await tx.subdivisionAssignment.create({
      data: { gameId: body.gameId, subdivisionId: body.subdivisionId, userId },
    });
    await tx.user.update({ where: { id: userId }, data: { status: "APPROVED" } });
    await writeAudit(
      {
        gameId: body.gameId,
        adminUserId: admin.id,
        action: "APPROVE_REGISTRATION",
        targetType: "USER",
        targetId: userId,
        after: { subdivisionId: body.subdivisionId },
      },
      tx,
    );
  });

  return json({ ok: true, userId, gameId: body.gameId, subdivisionId: body.subdivisionId });
});
