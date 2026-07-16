import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/http";

export const runtime = "nodejs";

// GET /api/health — liveness + DB connectivity.
export const GET = handle(async () => {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  return json({ ok: true, db, time: new Date().toISOString() });
});
