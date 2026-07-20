"use client";

import { api } from "@/lib/client/api";
import type {
  AvailableActionsResponse,
  BuildingActionOrder,
  CorporateActionOrder,
  EngineSubmission,
  GarrisonAssignment,
  OrdersPutResult,
  OrdersResponse,
  PoliticalActionOrder,
  UnitActionOrder,
} from "@/lib/client/types";

export interface DraftSubmission {
  garrison: GarrisonAssignment[];
  buildingActions: BuildingActionOrder[];
  unitActions: UnitActionOrder[];
  politicalAction: PoliticalActionOrder | null;
  corporateActions: CorporateActionOrder[];
  notes: string[];
}

export function emptyDraft(): DraftSubmission {
  return { garrison: [], buildingActions: [], unitActions: [], politicalAction: null, corporateActions: [], notes: [] };
}

export function fromSubmission(s: EngineSubmission | null): DraftSubmission {
  if (!s) return emptyDraft();
  return {
    garrison: s.garrison ?? [],
    buildingActions: s.buildingActions ?? [],
    unitActions: s.unitActions ?? [],
    politicalAction: s.politicalAction ?? null,
    corporateActions: s.corporateActions ?? [],
    notes: s.notes ?? [],
  };
}

export async function loadDraft(gameId: number): Promise<{ draft: DraftSubmission; turnNumber: number; status: string | null }> {
  const r = await api.get<OrdersResponse>(`/api/games/${gameId}/orders`);
  return { draft: fromSubmission(r.submission), turnNumber: r.turnNumber, status: r.status };
}

/** PUT the full draft. subdivisionId/turnNumber are set server-side. */
export async function saveDraft(gameId: number, draft: DraftSubmission): Promise<OrdersPutResult> {
  return api.put<OrdersPutResult>(`/api/games/${gameId}/orders`, {
    garrison: draft.garrison,
    buildingActions: draft.buildingActions,
    unitActions: draft.unitActions,
    politicalAction: draft.politicalAction ?? null,
    corporateActions: draft.corporateActions,
    notes: draft.notes,
  });
}

/**
 * Ask the server which building actions are currently valid for each of the
 * caller's buildings, and which units' attention the draft has already spent
 * (§22.9 / [D-064]). Only building + unit actions affect the result — garrison,
 * political and corporate draft entries are attention-neutral and ignored server
 * side, so we only send the two relevant arrays. Safe to call on every draft edit
 * (nothing is persisted; the server computes on a clone).
 */
export async function fetchAvailableActions(
  gameId: number,
  draft: DraftSubmission,
): Promise<AvailableActionsResponse> {
  return api.post<AvailableActionsResponse>(`/api/games/${gameId}/orders/available-actions`, {
    draftOrders: {
      buildingActions: draft.buildingActions,
      unitActions: draft.unitActions,
    },
  });
}

export async function validateDraft(gameId: number, draft: DraftSubmission) {
  return api.post<{ valid: boolean; invalidOrders: unknown[] }>(`/api/games/${gameId}/orders/validate`, {
    garrison: draft.garrison,
    buildingActions: draft.buildingActions,
    unitActions: draft.unitActions,
    politicalAction: draft.politicalAction ?? null,
    corporateActions: draft.corporateActions,
    notes: draft.notes,
  });
}
