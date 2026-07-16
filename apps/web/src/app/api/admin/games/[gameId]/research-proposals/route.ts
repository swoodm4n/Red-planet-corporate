import { prisma } from "@/lib/prisma";
import { handle, json, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";

export const runtime = "nodejs";

// GET /api/admin/games/:gameId/research-proposals?status=PENDING — review queue.
export const GET = handle(async (req, ctx) => {
  await requireAdmin(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");
  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const proposals = await prisma.researchProposal.findMany({
    where: { gameId: id, ...(status ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : {}) },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, email: true } } },
  });
  return json({ gameId: id, proposals });
});
