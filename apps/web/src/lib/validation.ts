import { z } from "zod";
import { errors } from "@/lib/http";

const PARENTS = [
  "TERRA_AGRICULTURAL",
  "UNIFIED_MINING",
  "STELLAR_DYNAMICS",
  "HELIX_PHARMA",
  "OMEGA_SECURITY",
  "GENESIS_TECH",
] as const;

const PERSONNEL = ["ENGINEER", "CONTRACTOR", "ADMINISTRATOR", "INNOVATOR", "ANALYST"] as const;

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
  displayName: z.string().max(100).optional(),
  desiredName: z.string().max(100).optional(),
  parentCompany: z.enum(PARENTS).optional(),
  parentPerk: z.enum(["A", "B"]).optional(),
  choicePersonnel: z.array(z.enum(PERSONNEL)).length(2).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const resetRequestSchema = z.object({ email: z.string().email() });
export const resetConfirmSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8).max(200),
});

// Orders: structural only; the engine performs deep semantic validation. The
// subdivisionId and turnNumber are always set server-side, never trusted from the
// client, so they are omitted from the accepted body.
export const ordersSchema = z.object({
  garrison: z.array(z.record(z.string(), z.any())).default([]),
  buildingActions: z.array(z.record(z.string(), z.any())).default([]),
  unitActions: z.array(z.record(z.string(), z.any())).default([]),
  politicalAction: z.record(z.string(), z.any()).nullish(),
  corporateActions: z.array(z.record(z.string(), z.any())).default([]),
  notes: z.array(z.string()).default([]),
});

// Available-actions query: the player's in-progress draft orders. Structural only
// (the engine derives validity); subdivisionId/turnNumber are server-side. Only
// buildingActions + unitActions affect attention ([D-058]/[D-059]); the rest of a
// draft submission is accepted-but-ignored so the client can pass a full draft.
export const availableActionsSchema = z.object({
  draftOrders: ordersSchema.partial().optional(),
});

export const proposalSchema = z.object({
  subdivisionId: z.number().int().optional(),
  proposalText: z.string().min(3).max(4000),
});

export const announcementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
});

// Subdivision comms message (tactical HUD composer). [D-066] The recipient is a
// discriminated union; subdivisionId/turn/sender are always server-derived and are
// never accepted from the client. `body` is capped but NOT filtered/rate-limited
// (game feature, not a public chat product — per brief).
export const messageSchema = z.object({
  recipient: z.discriminatedUnion("type", [
    z.object({ type: z.literal("PUBLIC") }),
    z.object({ type: z.literal("SUBDIVISION"), subdivisionId: z.number().int().positive() }),
    z.object({ type: z.literal("ADMIN") }),
  ]),
  body: z.string().min(1).max(4000),
});

export const configSchema = z.object({
  turnLengthHours: z.number().int().min(1).max(24 * 30).optional(),
});

export const approveSchema = z.object({
  gameId: z.number().int(),
  subdivisionId: z.number().int(),
});

export const assignSchema = z.object({ userId: z.string().min(1) });

export function parseOr400<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw errors.badRequest(msg);
  }
  return r.data;
}
