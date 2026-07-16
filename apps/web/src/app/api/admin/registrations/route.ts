import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/http";
import { requireAdmin } from "@/lib/authz";

export const runtime = "nodejs";

// GET /api/admin/registrations?status=PENDING — list registrations for review.
export const GET = handle(async (req) => {
  await requireAdmin(req);
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "PENDING";

  const users = await prisma.user.findMany({
    where: { role: "PLAYER", ...(status === "ALL" ? {} : { status: status as "PENDING" | "APPROVED" | "REJECTED" }) },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      status: true,
      displayName: true,
      prefParentCompany: true,
      prefParentPerk: true,
      prefChoicePersonnel: true,
      prefDesiredName: true,
      createdAt: true,
      assignment: { select: { gameId: true, subdivisionId: true } },
    },
  });
  return json({ registrations: users });
});
