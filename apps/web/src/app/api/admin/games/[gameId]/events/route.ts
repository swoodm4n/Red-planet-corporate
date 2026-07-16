import { handle, json, readJson, errors } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";
import { applyAdminEdits } from "@/server/adminEdit";
import type { StateEdit } from "@/server/stateEdit";

export const runtime = "nodejs";

// POST /api/admin/games/:gameId/events — manually trigger any event's mechanical
// effect. An event is expressed as one or more STRUCTURED edits (REGISTER_EFFECT,
// DISABLE_BUILDING, ADD_RESOURCE, ADJUST_EARTH_RELATIONS, ...) that the engine then
// interprets on the next resolution — never free-text-executed effects. [D-046]
// Body: { name: string, edits: StateEdit[], note?: string }
export const POST = handle(async (req, ctx) => {
  const admin = await requireAdmin(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const body = (await readJson<{ name?: string; edits?: StateEdit[]; note?: string }>(req)) ?? {};
  if (!body.name) throw errors.badRequest("event name required");
  if (!Array.isArray(body.edits) || body.edits.length === 0) throw errors.badRequest("edits[] required");

  const result = await applyAdminEdits({
    gameId: id,
    adminUserId: admin.id,
    action: `MANUAL_EVENT:${body.name}`,
    edits: body.edits,
    note: body.note,
  });
  return json({ ok: true, event: body.name, ...result });
});
