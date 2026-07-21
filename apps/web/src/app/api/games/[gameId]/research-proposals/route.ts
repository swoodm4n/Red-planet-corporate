import { prisma } from "@/lib/prisma";
import { handle, json, readJson, errors } from "@/lib/http";
import { requireOwnedSubdivision } from "@/lib/authz";
import { parseOr400, proposalSchema } from "@/lib/validation";

export const runtime = "nodejs";

// GET /api/games/:gameId/research-proposals — the caller's OWN proposals + admin rulings.
export const GET = handle(async (req, ctx) => {
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");
  const { subdivisionId } = await requireOwnedSubdivision(req, id);

  const proposals = await prisma.researchProposal.findMany({
    where: { gameId: id, subdivisionId },
    orderBy: { createdAt: "desc" },
  });
  return json({ gameId: id, subdivisionId, proposals });
});

// POST /api/games/:gameId/research-proposals — submit a freeform research proposal
// as text. The admin later grants STRUCTURED effects (never free-text). [D-047]
export const POST = handle(async (req, ctx) => {
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");
  const { user, subdivisionId } = await requireOwnedSubdivision(req, id);

  const body = parseOr400(proposalSchema, await readJson(req));
  const proposal = await prisma.researchProposal.create({
    data: {
      gameId: id,
      subdivisionId,
      userId: user.id,
      proposalText: body.proposalText,
      status: "PENDING",
    },
  });
  return json({ proposal }, { status: 201 });
});
