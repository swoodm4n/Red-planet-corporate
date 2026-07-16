import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handle, json, readJson, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";
import { applyAdminEdits } from "@/server/adminEdit";
import type { StateEdit } from "@/server/stateEdit";

export const runtime = "nodejs";

// POST /api/admin/research-proposals/:id/resolve — adjudicate a freeform research
// proposal. The admin approves/rejects and, on approval, grants effects through
// STRUCTURED edits (stat modifiers / unlocks) — never free-text effects. [D-047]
// Body: { status: "APPROVED"|"REJECTED", adminResponse?, grantedEffects?: StateEdit[] }
export const POST = handle(async (req, ctx) => {
  const admin = await requireAdmin(req);
  const { id } = await ctx.params;

  const body = (await readJson<{
    status?: "APPROVED" | "REJECTED";
    adminResponse?: string;
    grantedEffects?: StateEdit[];
  }>(req)) ?? {};
  if (body.status !== "APPROVED" && body.status !== "REJECTED") {
    throw errors.badRequest("status must be APPROVED or REJECTED");
  }

  const proposal = await prisma.researchProposal.findUnique({ where: { id } });
  if (!proposal) throw errors.notFound("Proposal not found");
  if (proposal.status !== "PENDING") throw errors.conflict("Proposal already resolved");

  let grantResult: { applied: string[]; warnings: string[] } | undefined;
  if (body.status === "APPROVED" && Array.isArray(body.grantedEffects) && body.grantedEffects.length) {
    grantResult = await applyAdminEdits({
      gameId: proposal.gameId,
      adminUserId: admin.id,
      action: `RESEARCH_GRANT:${proposal.id}`,
      edits: body.grantedEffects,
      note: body.adminResponse,
    });
  }

  const updated = await prisma.researchProposal.update({
    where: { id },
    data: {
      status: body.status,
      adminResponse: body.adminResponse ?? null,
      grantedEffectsJson: (body.grantedEffects ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      resolvedByUserId: admin.id,
      resolvedAt: new Date(),
    },
  });

  return json({ ok: true, proposal: updated, grant: grantResult ?? null });
});
