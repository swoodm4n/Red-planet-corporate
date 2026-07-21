import { handle, json, errors } from "@/lib/http";
import { requireApproved, getAssignment } from "@/lib/authz";
import { loadGame } from "@/server/gameStore";
import {
  getMapView,
  getGatedTileView,
  MAP_COLS,
  MAP_ROWS,
  type Game,
  type MapTileMarker,
} from "@rpc/engine";

export const runtime = "nodejs";

/**
 * Admin map projection: every tile rendered at full detail by inspecting each hex
 * "as its owner" (the engine yields the OWN-level marker, tier "OWN"). Reuses the
 * engine's gating — no visibility logic is reimplemented here. Unclaimed tiles have
 * no owner, so they fall through to the public base marker (tier "LOW"). §21.5.
 */
function adminMapView(game: Game): MapTileMarker[] {
  return game.map.map((hex) => {
    const ownerId = hex.ownerSubdivisionId ?? -1;
    // getGatedTileView never returns null for an in-map tile.
    const v = getGatedTileView(ownerId, hex.coord, game)!;
    return {
      coord: v.coord,
      terrain: v.terrain,
      owner: v.owner,
      isLandingZone: v.isLandingZone,
      hasHQ: v.hasHQ,
      hasOutpost: v.hasOutpost,
      intelTier: v.intelTier,
    };
  });
}

// GET /api/games/:gameId/map — intel-gated, map-level markers (§21.5 / [D-053]).
//
// The viewer subdivision is resolved SERVER-SIDE from the session, never from the
// client. A player always views as their own assigned subdivision; the client
// cannot ask to view as anyone else. Admins may pass `?viewerSubdivisionId=N` to
// view-as-N (mirrors the admin "view any subdivision" pattern), or omit it to get
// the full admin map (every owned tile shown as "OWN").
//
// Markers carry ONLY the public icons + the server-computed intel tier — never
// building lists, counts, or outputs. Those come from the per-tile inspection
// endpoint (`/map/tiles/:col/:row`).
export const GET = handle(async (req, ctx) => {
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const user = await requireApproved(req);
  const { game } = await loadGame(id);

  let viewerSubdivisionId: number | null = null;
  let tiles: MapTileMarker[];

  if (user.role === "ADMIN") {
    const param = new URL(req.url).searchParams.get("viewerSubdivisionId");
    if (param != null && param !== "") {
      const v = Number(param);
      if (!Number.isInteger(v)) throw errors.badRequest("Invalid viewerSubdivisionId");
      viewerSubdivisionId = v;
      tiles = getMapView(v, game);
    } else {
      tiles = adminMapView(game);
    }
  } else {
    const assignment = await getAssignment(user.id);
    if (!assignment || assignment.gameId !== id) {
      throw errors.forbidden("You are not assigned to a subdivision in this game");
    }
    viewerSubdivisionId = assignment.subdivisionId;
    tiles = getMapView(viewerSubdivisionId, game);
  }

  return json({
    gameId: game.id,
    turnNumber: game.turnNumber,
    cols: MAP_COLS,
    rows: MAP_ROWS,
    viewerSubdivisionId,
    tiles,
  });
});
