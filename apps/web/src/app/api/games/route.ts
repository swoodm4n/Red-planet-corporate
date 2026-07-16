import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/http";
import { getCurrentUser, getAssignment } from "@/lib/authz";

export const runtime = "nodejs";

// GET /api/games — list games. Public metadata for everyone; assignment info for
// the logged-in player; admins see all games.
export const GET = handle(async (req) => {
  const user = await getCurrentUser(req);
  const assignment = user ? await getAssignment(user.id) : null;

  const games = await prisma.game.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      turnNumber: true,
      status: true,
      turnDeadline: true,
      turnLengthHours: true,
    },
  });

  return json({
    games: games.map((g) => ({
      ...g,
      yourSubdivisionId: assignment && assignment.gameId === g.id ? assignment.subdivisionId : null,
    })),
  });
});
