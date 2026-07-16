import { handle, json } from "@/lib/http";
import { getCurrentUser, getAssignment } from "@/lib/authz";

export const runtime = "nodejs";

// GET /api/auth/me — current session identity + subdivision assignment (if any).
export const GET = handle(async (req) => {
  const user = await getCurrentUser(req);
  if (!user) return json({ user: null });
  const assignment = await getAssignment(user.id);
  return json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      displayName: user.displayName,
      preferences: {
        parentCompany: user.prefParentCompany,
        parentPerk: user.prefParentPerk,
        choicePersonnel: user.prefChoicePersonnel,
        desiredName: user.prefDesiredName,
      },
    },
    assignment,
  });
});
