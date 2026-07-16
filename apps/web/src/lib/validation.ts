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

export const proposalSchema = z.object({
  subdivisionId: z.number().int().optional(),
  proposalText: z.string().min(3).max(4000),
});

export const announcementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
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
