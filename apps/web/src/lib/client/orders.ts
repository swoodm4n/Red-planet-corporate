"use client";

import { api } from "@/lib/client/api";
import type {
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
