import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface AuditInput {
  gameId?: number | null;
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  note?: string;
}

/** Record an admin action to the immutable audit log. */
export async function writeAudit(input: AuditInput, tx?: Prisma.TransactionClient): Promise<void> {
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      gameId: input.gameId ?? null,
      adminUserId: input.adminUserId,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      beforeJson: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
      afterJson: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
      note: input.note ?? null,
    },
  });
}
