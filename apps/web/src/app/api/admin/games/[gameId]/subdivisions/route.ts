import { prisma } from "@/lib/prisma";
import { handle, json, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";

export const runtime = "nodejs";

// GET /api/admin/games/:gameId/subdivisions — all subdivision slots + assignments.
export const GET = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const [subs, assignments] = await Promise.all([
    prisma.subdivisionState.findMany({ where: { gameId: id }, orderBy: { subdivisionId: "asc" } }),
    prisma.subdivisionAssignment.findMany({
      where: { gameId: id },
      include: { user: { select: { id: true, email: true, displayName: true } } },
    }),
  ]);
  const byId = new Map(assignments.map((a) => [a.subdivisionId, a.user]));

  return json({
    gameId: id,
    subdivisions: subs.map((s) => ({
      subdivisionId: s.subdivisionId,
      name: s.name,
      parentCompany: s.parentCompany,
      parentPerk: s.parentPerk,
      status: s.status,
      earthRelations: s.earthRelations,
      composite: s.composite,
      rank: s.rank,
      assignedTo: byId.get(s.subdivisionId) ?? null,
    })),
  });
});
