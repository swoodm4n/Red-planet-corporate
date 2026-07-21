import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handle, json, readJson, errors } from "@/lib/http";
import { requireApproved, requireOwnedSubdivision, getAssignment } from "@/lib/authz";
import { loadGame } from "@/server/gameStore";
import { messageSchema, parseOr400 } from "@/lib/validation";

export const runtime = "nodejs";

// Message-visibility scope, derived from the stored recipient columns. [D-066]
//   PUBLIC      -> recipientSubdivisionId = null, recipientIsAdmin = false
//   SUBDIVISION -> recipientSubdivisionId set,     recipientIsAdmin = false
//   ADMIN       -> recipientSubdivisionId = null,  recipientIsAdmin = true
type MessageRow = {
  id: string;
  gameId: number;
  senderSubdivisionId: number | null;
  recipientSubdivisionId: number | null;
  recipientIsAdmin: boolean;
  channel: string;
  body: string;
  createdAt: Date;
};

function scopeOf(m: MessageRow): "PUBLIC" | "SUBDIVISION" | "ADMIN" {
  if (m.recipientIsAdmin) return "ADMIN";
  if (m.recipientSubdivisionId == null) return "PUBLIC";
  return "SUBDIVISION";
}

function shape(m: MessageRow) {
  return {
    id: m.id,
    gameId: m.gameId,
    scope: scopeOf(m),
    channel: m.channel,
    senderSubdivisionId: m.senderSubdivisionId,
    recipientSubdivisionId: m.recipientSubdivisionId,
    recipientIsAdmin: m.recipientIsAdmin,
    body: m.body,
    createdAt: m.createdAt,
  };
}

// GET /api/games/:gameId/messages — the comms feed the caller is entitled to see.
//
// Visibility (enforced server-side; the UI is never trusted): [D-066]
//   PLAYER: all PUBLIC posts in the game + every DM the player's OWN subdivision is a
//           party to (sender OR recipient), including their own DMs to high command.
//           A player NEVER sees DMs strictly between two other subdivisions, nor
//           other subdivisions' DMs to high command.
//   ADMIN:  everything (all public posts + all DMs), consistent with the admin's
//           existing "view any subdivision's private data" precedent (report route,
//           assertSubdivisionAccess admin bypass).
export const GET = handle(async (req, ctx) => {
  const user = await requireApproved(req);
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const game = await prisma.game.findUnique({ where: { id }, select: { id: true } });
  if (!game) throw errors.notFound("Game not found");

  let where: Prisma.MessageWhereInput;
  let viewerSubdivisionId: number | null = null;

  if (user.role === "ADMIN") {
    // Admin sees the whole feed.
    where = { gameId: id };
  } else {
    const assignment = await getAssignment(user.id);
    if (!assignment || assignment.gameId !== id) {
      throw errors.forbidden("You are not assigned to a subdivision in this game");
    }
    viewerSubdivisionId = assignment.subdivisionId;
    where = {
      gameId: id,
      OR: [
        // Public posts (not admin-directed).
        { recipientSubdivisionId: null, recipientIsAdmin: false },
        // DMs I sent (to a rival subdivision OR to high command).
        { senderSubdivisionId: viewerSubdivisionId },
        // DMs sent TO my subdivision.
        { recipientSubdivisionId: viewerSubdivisionId },
      ],
    };
  }

  const rows = (await prisma.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      gameId: true,
      senderSubdivisionId: true,
      recipientSubdivisionId: true,
      recipientIsAdmin: true,
      channel: true,
      body: true,
      createdAt: true,
    },
  })) as MessageRow[];

  return json({
    gameId: id,
    viewerSubdivisionId, // null for admin (whole-feed view)
    isAdmin: user.role === "ADMIN",
    messages: rows.map(shape),
  });
});

// POST /api/games/:gameId/messages — send a comms message AS the caller's own
// subdivision. Only assigned players may send (admins have no slot and keep the
// separate announcement system — [D-068]). sender/turn are server-derived; the
// client only supplies the recipient + body.
export const POST = handle(async (req, ctx) => {
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const { user, subdivisionId } = await requireOwnedSubdivision(req, id);
  const body = parseOr400(messageSchema, await readJson(req));

  // Load the authoritative snapshot to validate the recipient exists in this game.
  const { game } = await loadGame(id);

  let recipientSubdivisionId: number | null = null;
  let recipientIsAdmin = false;

  if (body.recipient.type === "SUBDIVISION") {
    const target = body.recipient.subdivisionId;
    if (target === subdivisionId) {
      throw errors.badRequest("Cannot DM your own subdivision");
    }
    const exists = game.subdivisions.some((s) => s.id === target);
    if (!exists) throw errors.notFound("Recipient subdivision not found in this game");
    recipientSubdivisionId = target;
  } else if (body.recipient.type === "ADMIN") {
    recipientIsAdmin = true;
  }
  // PUBLIC: both stay null/false.

  const created = (await prisma.message.create({
    data: {
      gameId: id,
      senderSubdivisionId: subdivisionId,
      senderUserId: user.id,
      recipientSubdivisionId,
      recipientIsAdmin,
      channel: "COMMS",
      body: body.body,
    },
    select: {
      id: true,
      gameId: true,
      senderSubdivisionId: true,
      recipientSubdivisionId: true,
      recipientIsAdmin: true,
      channel: true,
      body: true,
      createdAt: true,
    },
  })) as MessageRow;

  return json({ ok: true, message: shape(created) }, { status: 201 });
});
