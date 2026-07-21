/**
 * Standalone scheduler daemon (docker `scheduler` service). Polls the DB on an
 * interval and auto-resolves any ACTIVE game whose turn deadline has passed.
 * Runs independently of the Next.js web process.
 */

import { env } from "@/lib/env";
import { runDueTurns } from "@/server/scheduler";

const intervalMs = Math.max(5, env.schedulerPollSeconds) * 1000;

async function loop(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[scheduler] polling every ${intervalMs / 1000}s`);
  for (;;) {
    try {
      const r = await runDueTurns();
      if (r.resolved.length || r.errors.length) {
        // eslint-disable-next-line no-console
        console.log(`[scheduler] resolved=${JSON.stringify(r.resolved)} errors=${JSON.stringify(r.errors)}`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[scheduler] tick failed:", e);
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
}

void loop();
