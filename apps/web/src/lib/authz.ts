/**
 * Server-side authorization guards. THIS is the enforcement layer — every route
 * calls these; the UI is never trusted. [D-045 / brief]
 *
 * Invariants:
 *  - Identity comes only from a verified session cookie; role/status are re-read
 *    from the DB on every request (never trusted from the token).
 *  - A PLAYER can only ever touch their own assigned subdivision's private data.
 *  - Admin-only routes require role === ADMIN; there is no player bypass.
 */

import type { Role, User, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { errors, parseCookies } from "@/lib/http";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function getCurrentUser(req: Request): Promise<User | null> {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const userId = await verifySessionToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ?? null;
}

export async function requireUser(req: Request): Promise<User> {
  const user = await getCurrentUser(req);
  if (!user) throw errors.unauthorized();
  return user;
}

export async function requireAdmin(req: Request): Promise<User> {
  const user = await requireUser(req);
  if (user.role !== ("ADMIN" satisfies Role)) throw errors.forbidden("Admin only");
  return user;
}

/** Approved player (or admin, who is implicitly approved). */
export async function requireApproved(req: Request): Promise<User> {
  const user = await requireUser(req);
  if (user.role === "ADMIN") return user;
  if (user.status !== ("APPROVED" satisfies UserStatus)) {
    throw errors.forbidden("Account is not approved yet");
  }
  return user;
}

export interface Assignment {
  gameId: number;
  subdivisionId: number;
}

export async function getAssignment(userId: string): Promise<Assignment | null> {
  const a = await prisma.subdivisionAssignment.findUnique({ where: { userId } });
  return a ? { gameId: a.gameId, subdivisionId: a.subdivisionId } : null;
}

/**
 * Resolve the subdivision the current player is allowed to act on for a game, or
 * throw. Admins are NOT auto-granted a subdivision here (admin uses admin routes
 * to view any subdivision); this is strictly the player-ownership check.
 */
export async function requireOwnedSubdivision(
  req: Request,
  gameId: number,
): Promise<{ user: User; subdivisionId: number }> {
  const user = await requireApproved(req);
  const assignment = await getAssignment(user.id);
  if (!assignment || assignment.gameId !== gameId) {
    throw errors.forbidden("You are not assigned to a subdivision in this game");
  }
  return { user, subdivisionId: assignment.subdivisionId };
}

/**
 * Authorize access to a SPECIFIC subdivision's private data. A player passes only
 * for their own assigned subdivision. Admins pass for any (used by admin routes).
 */
export async function assertSubdivisionAccess(
  req: Request,
  gameId: number,
  subdivisionId: number,
): Promise<User> {
  const user = await requireApproved(req);
  if (user.role === "ADMIN") return user;
  const assignment = await getAssignment(user.id);
  if (!assignment || assignment.gameId !== gameId || assignment.subdivisionId !== subdivisionId) {
    throw errors.forbidden("You may not access another subdivision's private data");
  }
  return user;
}
