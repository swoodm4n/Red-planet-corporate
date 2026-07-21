/**
 * Turn resolution service. Gathers this turn's submissions + queued admin actions,
 * calls the engine's `resolveTurn`, and persists an IMMUTABLE turn log plus the new
 * authoritative snapshot and projections. Validation runs a second time here (via
 * the engine inside resolveTurn's Phase 2), independent of submission-time checks.
 */

import type { Prisma } from "@prisma/client";
import { type Submission as EngineSubmission, resolveTurn } from "@rpc/engine";
import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/http";
import { serializeGame } from "@/lib/serialize";
import { loadGame, projectGame } from "@/server/gameStore";

export interface ResolveOptions {
  /** Bypass the ACTIVE-status guard (used by admin "process now" on any non-paused game). */
  force?: boolean;
}

export async function resolveGameTurn(gameId: number, opts: ResolveOptions = {}) {
  const { row, game } = await loadGame(gameId);

  if (row.status === "PAUSED") throw errors.conflict("Game is paused");
  if (row.status === "COMPLETED") throw errors.conflict("Game is completed");
  if (row.status !== "ACTIVE" && !opts.force) {
    throw errors.conflict(`Game is not active (status ${row.status})`);
  }

  const resolvingTurn = game.turnNumber;

  // Gather submissions for this turn (missing subs default to repeat-garrison in engine).
  const subRows = await prisma.submission.findMany({
    where: { gameId, turnNumber: resolvingTurn, status: "SUBMITTED" },
  });
  const submissions: EngineSubmission[] = subRows.map(
    (r) => r.submissionJson as unknown as EngineSubmission,
  );

  // Gather queued admin actions (retirements) not yet applied. [D-032]
  const queued = await prisma.adminQueuedAction.findMany({
    where: { gameId, appliedTurn: null, type: "RETIRE_SUBDIVISION" },
  });
  const retireSubdivisionIds = queued.map((q) => (q.payloadJson as { subdivisionId: number }).subdivisionId);

  // --- Engine resolution (deterministic; validates in Phase 2 again). ---
  const { newState, turnLog } = resolveTurn(
    game,
    submissions,
    retireSubdivisionIds.length ? { retireSubdivisionIds } : undefined,
  );

  const nextDeadline = new Date(Date.now() + row.turnLengthHours * 3600 * 1000);

  await prisma.$transaction(async (tx) => {
    // Immutable turn log (unique per game+turn; a re-run would violate the constraint).
    await tx.turnLog.create({
      data: {
        gameId,
        turnNumber: turnLog.turnNumber,
        logJson: turnLog as unknown as Prisma.InputJsonValue,
        eventJson: (turnLog.event ?? null) as unknown as Prisma.InputJsonValue,
        scoreboardJson: {
          scoreboard: turnLog.scoreboard,
          categoryLeaders: turnLog.categoryLeaders,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.game.update({
      where: { id: gameId },
      data: {
        stateJson: serializeGame(newState) as Prisma.InputJsonValue,
        turnNumber: newState.turnNumber,
        turnDeadline: nextDeadline,
      },
    });

    await projectGame(tx, gameId, newState);

    if (queued.length) {
      await tx.adminQueuedAction.updateMany({
        where: { id: { in: queued.map((q) => q.id) } },
        data: { appliedTurn: resolvingTurn },
      });
    }
  });

  return { resolvedTurn: turnLog.turnNumber, nextTurn: newState.turnNumber, turnLog };
}
