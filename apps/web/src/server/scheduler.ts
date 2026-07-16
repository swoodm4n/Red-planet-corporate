/**
 * Turn scheduler. A game carries a configurable `turnLengthHours` (default 96) and
 * a `turnDeadline`. When the deadline passes, the turn auto-resolves. Two drivers:
 *   1. POST /api/cron/tick (CRON_SECRET) — call from any external cron/uptime pinger.
 *   2. src/server/schedulerDaemon.ts — a standalone in-process poller (docker svc).
 * Admin can also force a turn immediately via POST /api/admin/games/:id/process-turn.
 */

import { prisma } from "@/lib/prisma";
import { resolveGameTurn } from "@/server/turn";

export interface TickResult {
  checked: number;
  resolved: { gameId: number; resolvedTurn: number }[];
  errors: { gameId: number; message: string }[];
}

export async function runDueTurns(now: Date = new Date()): Promise<TickResult> {
  const due = await prisma.game.findMany({
    where: { status: "ACTIVE", turnDeadline: { lte: now } },
    select: { id: true },
  });

  const result: TickResult = { checked: due.length, resolved: [], errors: [] };
  for (const g of due) {
    try {
      const r = await resolveGameTurn(g.id);
      result.resolved.push({ gameId: g.id, resolvedTurn: r.resolvedTurn });
    } catch (e) {
      result.errors.push({ gameId: g.id, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}
