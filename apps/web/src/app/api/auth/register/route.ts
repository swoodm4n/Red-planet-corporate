import { prisma } from "@/lib/prisma";
import { handle, json, readJson, errors } from "@/lib/http";
import { hashPassword } from "@/lib/auth/password";
import { parseOr400, registerSchema } from "@/lib/validation";

export const runtime = "nodejs";

// POST /api/auth/register — new account lands PENDING until an admin approves it.
export const POST = handle(async (req) => {
  const body = parseOr400(registerSchema, await readJson(req));
  const email = body.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw errors.conflict("An account with this email already exists");

  const passwordHash = await hashPassword(body.password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "PLAYER",
      status: "PENDING",
      displayName: body.displayName ?? null,
      prefParentCompany: body.parentCompany ?? null,
      prefParentPerk: body.parentPerk ?? null,
      prefChoicePersonnel: body.choicePersonnel ?? undefined,
      prefDesiredName: body.desiredName ?? null,
    },
  });

  return json(
    {
      id: user.id,
      email: user.email,
      status: user.status,
      message: "Registration received. An admin must approve your account before you can play.",
    },
    { status: 201 },
  );
});
