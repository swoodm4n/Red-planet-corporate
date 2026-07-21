import { handle, json, readJson, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";
import { applyAdminEdits } from "@/server/adminEdit";
import type { StateEdit } from "@/server/stateEdit";

export const runtime = "nodejs";

// POST /api/admin/games/:gameId/state-edit — apply STRUCTURED state edits (audited).
// Body: { edits: StateEdit[], note?: string }. See src/server/stateEdit.ts for ops.
export const POST = handle(async (req, ctx) => {
  const admin = await requireAdmin(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const body = (await readJson<{ edits?: StateEdit[]; note?: string }>(req)) ?? {};
  if (!Array.isArray(body.edits) || body.edits.length === 0) throw errors.badRequest("edits[] required");

  const result = await applyAdminEdits({
    gameId: id,
    adminUserId: admin.id,
    action: "STATE_EDIT",
    edits: body.edits,
    note: body.note,
  });
  return json({ ok: true, ...result });
});
