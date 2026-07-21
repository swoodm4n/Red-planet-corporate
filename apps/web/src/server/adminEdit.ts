/**
 * Admin state-edit pipeline: load snapshot -> apply structured edits -> persist +
 * re-project -> write audit log. Every manual change is recorded. [D-046]
 */

import { loadGame, saveGameState } from "@/server/gameStore";
import { applyStateEdits, type StateEdit } from "@/server/stateEdit";
import { writeAudit } from "@/server/audit";

export async function applyAdminEdits(params: {
  gameId: number;
  adminUserId: string;
  action: string;
  edits: StateEdit[];
  note?: string;
}) {
  const { gameId, adminUserId, action, edits, note } = params;
  const { game } = await loadGame(gameId);

  const result = applyStateEdits(game, edits);
  await saveGameState(gameId, game);

  await writeAudit({
    gameId,
    adminUserId,
    action,
    targetType: "GAME_STATE",
    targetId: String(gameId),
    before: { edits },
    after: { applied: result.applied, warnings: result.warnings },
    note,
  });

  return result;
}
