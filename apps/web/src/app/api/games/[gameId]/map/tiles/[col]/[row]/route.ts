import { handle, json, errors } from "@/lib/http";
import { requireApproved, getAssignment } from "@/lib/authz";
import { loadGame } from "@/server/gameStore";
import { getGatedTileView, getHex, type TileView } from "@rpc/engine";

export const runtime = "nodejs";

// GET /api/games/:gameId/map/tiles/:col/:row — tier-gated single-tile inspection
// (§21.6 / [D-053], [D-055]).
//
// SECURITY: the intel tier is computed by the engine from the CURRENT game state
// using the viewer subdivision resolved server-side from the session. The client
// cannot request a tier, nor claim to view as another subdivision — any such query
// params are ignored. A player can never learn more about an opponent's tile than
// their live-computed espionage-vs-opsec tier permits.
//
// - Player: views as their own assigned subdivision. Own tiles → full detail
//   (`intelTier: "OWN"`); opponent tiles → additive reveal per computed tier
//   (LOW/MEDIUM/HIGH/FULL). Unclaimed / retired-owner tiles → public fields only.
// - Admin: full detail on ANY tile (inspects the tile "as its owner", so the engine
//   yields the OWN-level view). Consistent with admin "view any subdivision's
//   private data". Unclaimed tiles have no private content to reveal.
//
// Off-map coordinates → 404 (same for players and admin).
export const GET = handle(async (req, ctx) => {
  const { gameId, col, row } = await ctx.params;
  const id = Number(gameId);
  const c = Number(col);
  const r = Number(row);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");
  if (!Number.isInteger(c) || !Number.isInteger(r)) {
    throw errors.badRequest("Invalid tile coordinate");
  }

  const user = await requireApproved(req);
  const { game } = await loadGame(id);
  const coord = { col: c, row: r };

  let viewerSubdivisionId: number | null = null;
  let tile: TileView | null;

  if (user.role === "ADMIN") {
    const hex = getHex(game.map, coord);
    if (!hex) throw errors.notFound("Tile not found");
    const ownerId = hex.ownerSubdivisionId ?? null;
    // Admin full detail: inspect as the tile's owner so the engine returns the
    // OWN-level view. `-1` for unclaimed tiles never matches an owner → public base.
    tile = getGatedTileView(ownerId ?? -1, coord, game);
  } else {
    const assignment = await getAssignment(user.id);
    if (!assignment || assignment.gameId !== id) {
      throw errors.forbidden("You are not assigned to a subdivision in this game");
    }
    viewerSubdivisionId = assignment.subdivisionId;
    tile = getGatedTileView(viewerSubdivisionId, coord, game);
  }

  if (!tile) throw errors.notFound("Tile not found");

  return json({
    gameId: game.id,
    turnNumber: game.turnNumber,
    viewerSubdivisionId,
    tile,
  });
});
