import type { Prisma } from "@prisma/client";
import { type Submission as EngineSubmission, validateSubmission } from "@rpc/engine";
import { prisma } from "@/lib/prisma";
import { handle, json, readJson, errors } from "@/lib/http";
import { requireOwnedSubdivision } from "@/lib/authz";
import { loadGame } from "@/server/gameStore";
import { ordersSchema, parseOr400 } from "@/lib/validation";

export const runtime = "nodejs";

// GET /api/games/:gameId/orders — the caller's stored submission for the current turn.
export const GET = handle(async (req, ctx) => {
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const { subdivisionId } = await requireOwnedSubdivision(req, id);
  const { game } = await loadGame(id);

  const row = await prisma.submission.findUnique({
    where: {
      gameId_turnNumber_subdivisionId: { gameId: id, turnNumber: game.turnNumber, subdivisionId },
    },
  });

  return json({
    gameId: id,
    turnNumber: game.turnNumber,
    subdivisionId,
    submission: row?.submissionJson ?? null,
    status: row?.status ?? null,
    updatedAt: row?.updatedAt ?? null,
  });
});

// PUT /api/games/:gameId/orders — submit or revise this turn's orders.
// subdivisionId + turnNumber are set server-side (never trusted from the client).
// Orders are validated by the engine at submission; any invalid orders are returned
// so the player can revise. They are re-validated by the engine at resolution.
export const PUT = handle(async (req, ctx) => {
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (!Number.isInteger(id)) throw errors.badRequest("Invalid game id");

  const { user, subdivisionId } = await requireOwnedSubdivision(req, id);
  const { row, game } = await loadGame(id);
  if (row.status !== "ACTIVE") throw errors.conflict(`Cannot submit orders: game is ${row.status}`);

  const body = parseOr400(ordersSchema, await readJson(req));
  const submission: EngineSubmission = {
    subdivisionId,
    turnNumber: game.turnNumber,
    garrison: body.garrison as EngineSubmission["garrison"],
    buildingActions: body.buildingActions as EngineSubmission["buildingActions"],
    unitActions: body.unitActions as EngineSubmission["unitActions"],
    politicalAction: (body.politicalAction ?? undefined) as EngineSubmission["politicalAction"],
    corporateActions: body.corporateActions as EngineSubmission["corporateActions"],
    notes: body.notes,
  };

  const invalidOrders = validateSubmission(game, submission);

  await prisma.submission.upsert({
    where: {
      gameId_turnNumber_subdivisionId: { gameId: id, turnNumber: game.turnNumber, subdivisionId },
    },
    create: {
      gameId: id,
      turnNumber: game.turnNumber,
      subdivisionId,
      userId: user.id,
      submissionJson: submission as unknown as Prisma.InputJsonValue,
      status: "SUBMITTED",
    },
    update: {
      submissionJson: submission as unknown as Prisma.InputJsonValue,
      status: "SUBMITTED",
      userId: user.id,
    },
  });

  return json({
    saved: true,
    gameId: id,
    turnNumber: game.turnNumber,
    subdivisionId,
    invalidOrders,
    accepted: invalidOrders.length === 0,
  });
});
