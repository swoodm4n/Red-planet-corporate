import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handle, json, readJson, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";
import { writeAudit } from "@/server/audit";

export const runtime = "nodejs";

// POST /api/admin/games/:gameId/subdivisions/:sid/retire — queue a retirement.
// Applied at the start of the NEXT turn resolution via the engine's AdminActions
// hook (buildings derelict, hexes unclaimed, shares frozen). [D-032]
export const POST = handle(async (req, ctx) => {
  const admin = await requireAdmin(req);
  const { gameId, sid } = await ctx.params;
  const id = Number(gameId);
  const subdivisionId = Number(sid);
  if (!Number.isInteger(id) || !Number.isInteger(subdivisionId)) throw errors.badRequest("Invalid params");
  const body = (await readJson<{ note?: string }>(req)) ?? {};

  const sub = await prisma.subdivisionState.findUnique({
    where: { gameId_subdivisionId: { gameId: id, subdivisionId } },
  });
  if (!sub) throw errors.notFound("Subdivision not found");

  const existing = await prisma.adminQueuedAction.findFirst({
    where: { gameId: id, type: "RETIRE_SUBDIVISION", appliedTurn: null, payloadJson: { equals: { subdivisionId } } },
  });
  if (existing) return json({ ok: true, alreadyQueued: true });

  await prisma.$transaction(async (tx) => {
    await tx.adminQueuedAction.create({
      data: {
        gameId: id,
        type: "RETIRE_SUBDIVISION",
        payloadJson: { subdivisionId } as unknown as Prisma.InputJsonValue,
      },
    });
    // Free the player slot immediately so the account can be reassigned.
    await tx.subdivisionAssignment.deleteMany({ where: { gameId: id, subdivisionId } });
    await writeAudit(
      {
        gameId: id,
        adminUserId: admin.id,
        action: "QUEUE_RETIREMENT",
        targetType: "SUBDIVISION",
        targetId: String(subdivisionId),
        note: body.note,
      },
      tx,
    );
  });

  return json({ ok: true, queued: true, appliesOnNextResolution: true });
});
