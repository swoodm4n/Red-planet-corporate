import { handle, json, errors } from "@/lib/http";
import { env } from "@/lib/env";
import { runDueTurns } from "@/server/scheduler";

export const runtime = "nodejs";

// POST /api/cron/tick — resolve all games whose turn deadline has passed.
// Protected by the CRON_SECRET (header `x-cron-secret` or `?secret=`). Point any
// external scheduler/uptime pinger at this endpoint, or run the scheduler daemon.
async function tick(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const provided = req.headers.get("x-cron-secret") ?? url.searchParams.get("secret");
  if (!provided || provided !== env.cronSecret) throw errors.unauthorized("Invalid cron secret");
  const result = await runDueTurns();
  return json({ ok: true, ...result });
}

export const POST = handle(tick);
export const GET = handle(tick);
