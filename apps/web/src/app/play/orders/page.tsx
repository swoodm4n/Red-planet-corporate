"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePlayer } from "@/lib/client/gameContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { ConfirmButton } from "@/lib/client/Confirm";
import { api } from "@/lib/client/api";
import { fromSubmission, emptyDraft, saveDraft, validateDraft, fetchAvailableActions, type DraftSubmission } from "@/lib/client/orders";
import type {
  AvailableActionsResponse,
  InvalidOrder,
  OrdersResponse,
  OwnBuilding,
  OwnPersonnel,
  PublicSubdivision,
  ReportResponse,
} from "@/lib/client/types";
import {
  BUILDING_TYPES,
  CORPORATE_ACTIONS,
  GARRISON_MIN,
  MODULE_TYPES,
  PERSONNEL_LABELS,
  PHYSICAL_RESOURCES,
  POLITICAL_ACTIONS,
  RESOURCE_LABELS,
  UNIT_ACTIONS,
  actionInfo,
  actionLabel,
  buildingLabel,
  hexLabel,
  paramLabel,
  titleCase,
} from "@/lib/client/labels";
import { BuildingIcon, PersonnelIcon } from "@/lib/client/Icon";

// Which optional param fields each action commonly needs (advisory — engine validates).
const FIELD_HINTS: Record<string, string[]> = {
  MARKET_SALE: ["resource", "quantity"],
  BLACK_MARKET_SALE: ["resource", "quantity"],
  EMERGENCY_RESUPPLY: ["resource"],
  EXPEDITED_DELIVERY: ["resource", "quantity"],
  COLONIST_REQUISITION: ["colonistCount", "colonistType"],
  TERRITORIAL_CLAIM: ["targetHexCol", "targetHexRow"],
  RESOURCE_TRANSFER: ["resource", "quantity", "toBuildingId"],
  PRODUCE_VEHICLE: ["hull"],
  CONSTRUCT_BUILDING: ["buildingType", "targetHexCol", "targetHexRow"],
  PLACE_OUTPOST: ["targetHexCol", "targetHexRow"],
  INSTALL_MODULE: ["moduleType", "targetBuildingId"],
  TIER_UPGRADE: ["targetBuildingId"],
  SURVEY_HEX: ["targetHexCol", "targetHexRow"],
  SABOTAGE: ["targetSubdivisionId", "targetBuildingId"],
  INTERCEPT: ["targetSubdivisionId"],
  ENFORCE_TERRITORY: ["targetHexCol", "targetHexRow"],
  HOSTILE_ACQUISITION: ["targetSubdivisionId", "targetUnitId"],
  APPEAL_TO_EARTH: ["resource"],
  EMERGENCY_RESUPPLY_C: ["resource"],
  PUBLIC_STATEMENT: ["text"],
  DENOUNCE: ["targetSubdivisionId"],
};

const HULLS = ["LIGHT", "MEDIUM", "HEAVY"];

interface ParamCtx {
  buildings: OwnBuilding[];
  rivals: PublicSubdivision[];
}

function ParamInputs({
  fields,
  values,
  onChange,
  ctx,
}: {
  fields: string[];
  values: Record<string, string>;
  onChange: (k: string, v: string) => void;
  ctx: ParamCtx;
}) {
  if (fields.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {fields.map((f) => {
        let control: React.ReactNode;
        if (f === "resource") {
          control = (
            <select className="console-input inline-input" value={values[f] ?? ""} onChange={(e) => onChange(f, e.target.value)}>
              <option value="">select…</option>
              {PHYSICAL_RESOURCES.map((r) => <option key={r} value={r}>{RESOURCE_LABELS[r]}</option>)}
            </select>
          );
        } else if (f === "colonistType") {
          control = (
            <select className="console-input inline-input" value={values[f] ?? ""} onChange={(e) => onChange(f, e.target.value)}>
              <option value="">select…</option>
              {Object.keys(PERSONNEL_LABELS).map((r) => <option key={r} value={r}>{PERSONNEL_LABELS[r]}</option>)}
            </select>
          );
        } else if (f === "hull") {
          control = (
            <select className="console-input inline-input" value={values[f] ?? ""} onChange={(e) => onChange(f, e.target.value)}>
              <option value="">select…</option>
              {HULLS.map((h) => <option key={h} value={h}>{titleCase(h)}</option>)}
            </select>
          );
        } else if (f === "buildingType") {
          control = (
            <select className="console-input inline-input" value={values[f] ?? ""} onChange={(e) => onChange(f, e.target.value)}>
              <option value="">select…</option>
              {BUILDING_TYPES.map((b) => <option key={b} value={b}>{buildingLabel(b)}</option>)}
            </select>
          );
        } else if (f === "moduleType") {
          control = (
            <select className="console-input inline-input" value={values[f] ?? ""} onChange={(e) => onChange(f, e.target.value)}>
              <option value="">select…</option>
              {MODULE_TYPES.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
            </select>
          );
        } else if (f === "targetBuildingId" || f === "toBuildingId") {
          control = (
            <select className="console-input inline-input" value={values[f] ?? ""} onChange={(e) => onChange(f, e.target.value)}>
              <option value="">select…</option>
              {ctx.buildings.map((b) => <option key={b.id} value={b.id}>{buildingLabel(b.type)} {hexLabel(b.hex.col, b.hex.row)}</option>)}
            </select>
          );
        } else if (f === "targetSubdivisionId") {
          control = (
            <select className="console-input inline-input" value={values[f] ?? ""} onChange={(e) => onChange(f, e.target.value)}>
              <option value="">select…</option>
              {ctx.rivals.map((r) => <option key={r.subdivisionId} value={r.subdivisionId}>{r.name}</option>)}
            </select>
          );
        } else {
          const numeric = /count|quantity|Id|Col|Row/.test(f);
          control = (
            <input
              className="console-input inline-input"
              style={{ width: 130 }}
              type={numeric ? "number" : "text"}
              min={numeric ? 0 : undefined}
              placeholder={paramLabel(f)}
              value={values[f] ?? ""}
              onChange={(e) => onChange(f, e.target.value)}
            />
          );
        }
        return (
          <label key={f} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span className="field-label" style={{ marginBottom: 0 }}>{paramLabel(f)}</span>
            {control}
          </label>
        );
      })}
    </div>
  );
}

function buildParams(action: string, values: Record<string, string>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  const hint = FIELD_HINTS[action] ?? [];
  for (const f of hint) {
    const v = values[f];
    if (v == null || v === "") continue;
    if (f === "targetHexCol" || f === "targetHexRow") continue; // handled below
    if (/count|quantity|Id/.test(f)) p[f] = Number(v);
    else p[f] = v;
  }
  if (values.targetHexCol && values.targetHexRow) {
    p.targetHex = { col: Number(values.targetHexCol), row: Number(values.targetHexRow) };
  }
  return p;
}

// --- readable rendering of stored params -----------------------------------

function paramValueLabel(key: string, value: unknown, buildings: OwnBuilding[], rivals: PublicSubdivision[]): string {
  if (key === "resource") return RESOURCE_LABELS[String(value)] ?? String(value);
  if (key === "colonistType") return PERSONNEL_LABELS[String(value)] ?? String(value);
  if (key === "buildingType") return buildingLabel(String(value));
  if (key === "moduleType") return titleCase(String(value));
  if (key === "hull") return titleCase(String(value));
  if (key === "targetBuildingId" || key === "toBuildingId") {
    const b = buildings.find((x) => x.id === Number(value));
    return b ? `${buildingLabel(b.type)} ${hexLabel(b.hex.col, b.hex.row)}` : `building #${value}`;
  }
  if (key === "targetSubdivisionId") {
    const r = rivals.find((x) => x.subdivisionId === Number(value));
    return r ? r.name : `subdivision #${value}`;
  }
  return String(value);
}

function describeParams(params: Record<string, unknown> | undefined, buildings: OwnBuilding[], rivals: PublicSubdivision[]): string {
  if (!params) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (k === "targetHex" && v && typeof v === "object") {
      const h = v as { col: number; row: number };
      parts.push(`hex ${hexLabel(h.col, h.row)}`);
    } else {
      parts.push(`${paramLabel(k)}: ${paramValueLabel(k, v, buildings, rivals)}`);
    }
  }
  return parts.join(", ");
}

function withArticle(word: string): string {
  return `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
}

// Required-garrison summary string for a building type, e.g. "2 Admin + 1 Contractor".
function reqString(type: string): string {
  const req = GARRISON_MIN[type] ?? {};
  const parts = Object.entries(req).map(([t, n]) => `${n} ${PERSONNEL_LABELS[t] ?? titleCase(t)}`);
  return parts.length ? parts.join(" + ") : "No garrison required";
}

// Per-unit marker showing whether the current draft has already committed this
// unit to a task this turn (garrisoned or actor of a queued unit action).
function AssignBadge({ committed, reason }: { committed: boolean; reason?: string }) {
  return (
    <span
      className={`badge ${committed ? "badge-cyan" : "badge-dim"}`}
      title={committed ? reason ?? "Attention spent this turn" : "Attention unspent — this unit can still back an action this turn"}
    >
      {committed ? "ASSIGNED" : "AVAILABLE"}
    </span>
  );
}

export default function OrdersPage() {
  const { gameId, subdivisionId, game } = usePlayer();
  const [draft, setDraft] = useState<DraftSubmission | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [turnNumber, setTurnNumber] = useState<number>(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invalids, setInvalids] = useState<InvalidOrder[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(false);
  const [busy, setBusy] = useState(false);

  // Live per-building available-actions + per-unit attention from the server
  // (§22.9 / [D-064]). Recomputed from the draft on every edit; the single source
  // of truth for which building actions are offered and the ASSIGNED/AVAILABLE badge.
  const [avail, setAvail] = useState<AvailableActionsResponse | null>(null);
  const [availErr, setAvailErr] = useState<string | null>(null);
  // Which building's action panel is expanded (null = none).
  const [openBuilding, setOpenBuilding] = useState<number | null>(null);
  // Per-(building,action) param entry for building actions that need parameters,
  // keyed "<buildingId>:<action>".
  const [actionParams, setActionParams] = useState<Record<string, Record<string, string>>>({});

  // add-form state
  const [uaUnit, setUaUnit] = useState<number | "">("");
  const [uaAction, setUaAction] = useState(UNIT_ACTIONS[0]);
  const [uaParams, setUaParams] = useState<Record<string, string>>({});
  const [polAction, setPolAction] = useState("");
  const [polParams, setPolParams] = useState<Record<string, string>>({});
  const [coAction, setCoAction] = useState(CORPORATE_ACTIONS[0]);
  const [coParams, setCoParams] = useState<Record<string, string>>({});

  useEffect(() => {
    if (subdivisionId == null) return;
    let cancelled = false;
    Promise.all([
      api.get<OrdersResponse>(`/api/games/${gameId}/orders`),
      api.get<ReportResponse>(`/api/games/${gameId}/report`),
    ])
      .then(([o, rep]) => {
        if (cancelled) return;
        setReport(rep);
        setTurnNumber(o.turnNumber);
        setStatus(o.status);
        if (o.submission) {
          setDraft(fromSubmission(o.submission));
        } else {
          // No orders saved yet this turn: pre-seed the garrison from the units'
          // CURRENT assignments so the screen reflects reality (and submitting
          // won't silently unstaff everyone — the engine rebuilds garrison from
          // this array each turn). Purely a convenience; the engine still validates.
          setDraft(seedFromReport(rep));
        }
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [gameId, subdivisionId]);

  // Live available-actions: re-query the server whenever the draft's building or
  // unit actions change (garrison/political/corporate are attention-neutral, so
  // they don't affect the result). Debounced so rapid edits collapse into one call.
  // The returned `buildings`/`unitAttention` maps are the sole source of truth for
  // the per-building action lists and the ASSIGNED/AVAILABLE badges (§22.9).
  const baKey = draft ? JSON.stringify(draft.buildingActions) : "";
  const uaKey = draft ? JSON.stringify(draft.unitActions) : "";
  useEffect(() => {
    if (subdivisionId == null || !draft) return;
    let cancelled = false;
    const t = setTimeout(() => {
      fetchAvailableActions(gameId, draft)
        .then((r) => {
          if (cancelled) return;
          setAvail(r);
          setAvailErr(null);
        })
        .catch((e) => !cancelled && setAvailErr((e as Error).message));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, subdivisionId, baKey, uaKey]);

  if (subdivisionId == null) {
    return (
      <div className="page">
        <div className="page-header"><div><div className="page-title">ORDERS</div></div></div>
        <div className="muted-note amber">No assigned subdivision — you cannot submit orders until a game master assigns you a slot.</div>
      </div>
    );
  }

  if (error) return <ErrorMsg error={error} />;
  if (!draft || !report) return <Loading label="LOADING TURN SUBMISSION" />;

  const own = report.own;
  const rivals = report.others ?? [];
  const maxCorporate = own.earthRelations >= 30 ? 2 : 1;
  const unitById = new Map(own.personnel.map((p) => [p.id, p]));

  // Personnel that can be assigned/act this turn (not lost/captured/unhoused).
  const assignable = own.personnel.filter((p) => !["LOST", "CAPTURED", "UNHOUSED"].includes(p.status));

  // Live view of where each unit currently sits in the DRAFT.
  function draftAssignmentOf(unitId: number): string {
    const g = draft!.garrison.find((x) => x.unitId === unitId);
    if (!g || g.target.kind === "AVAILABLE") return "UNASSIGNED";
    if (g.target.kind === "BUILDING") return `B${g.target.buildingId}`;
    return `V${g.target.vehicleId}`;
  }

  // Units left AVAILABLE in the draft can take unit actions this turn.
  const availableUnits = assignable.filter((p) => draftAssignmentOf(p.id) === "UNASSIGNED");
  const availableIds = new Set(availableUnits.map((u) => u.id));

  // ATTENTION (§22): a unit's attention is spent — badge ASSIGNED — once the draft
  // commits it to a building or unit action this turn. The authoritative flag is the
  // server's `unitAttention` map (which walks the draft with the engine's own
  // lowest-id selection); we never derive it client-side. `attentionSpent` reads it
  // directly; `attentionReason` is only a best-effort tooltip for what spent it.
  function attentionSpent(unitId: number): boolean {
    return avail?.unitAttention?.[String(unitId)] === true;
  }
  function attentionReason(unitId: number): string {
    const ua = draft!.unitActions.find((a) => a.unitId === unitId);
    if (ua) return `Attention spent: ${actionLabel(ua.action)}`;
    const p = unitById.get(unitId);
    if (p?.assignedBuildingId != null) {
      const b = own.buildings.find((x) => x.id === p.assignedBuildingId);
      const ba = draft!.buildingActions.find((a) => a.buildingId === p.assignedBuildingId);
      if (ba) return `Backing ${actionLabel(ba.action)}${b ? ` at ${buildingLabel(b.type)} ${hexLabel(b.hex.col, b.hex.row)}` : ""}`;
    }
    return "Attention spent this turn";
  }

  // Building actions the server currently offers for a building (string key over the
  // JSON map). Empty until the first available-actions response lands.
  function actionsForBuilding(buildingId: number): string[] {
    return avail?.buildings?.[String(buildingId)] ?? [];
  }

  // Turn-START garrison shortfall (from the report projection) — what the server's
  // availableActions predicate actually sees. Used only to explain an empty list.
  function turnStartOperational(b: OwnBuilding): boolean {
    const req = GARRISON_MIN[b.type] ?? {};
    for (const [t, n] of Object.entries(req)) {
      if ((b.garrison[t] ?? 0) < (n ?? 0)) return false;
    }
    return true;
  }

  // Live garrison tally per building from the current draft.
  const garrisonByBuilding = new Map<number, Record<string, number>>();
  for (const g of draft.garrison) {
    if (g.target.kind !== "BUILDING") continue;
    const u = unitById.get(g.unitId);
    if (!u) continue;
    const rec = garrisonByBuilding.get(g.target.buildingId) ?? {};
    rec[u.type] = (rec[u.type] ?? 0) + 1;
    garrisonByBuilding.set(g.target.buildingId, rec);
  }

  function buildingShortfall(b: OwnBuilding): { met: boolean; missing: string[] } {
    const req = GARRISON_MIN[b.type] ?? {};
    const have = garrisonByBuilding.get(b.id) ?? {};
    const missing: string[] = [];
    for (const [t, n] of Object.entries(req)) {
      const short = (n ?? 0) - (have[t] ?? 0);
      if (short > 0) missing.push(`${short} more ${PERSONNEL_LABELS[t] ?? titleCase(t)}`);
    }
    return { met: missing.length === 0, missing };
  }

  const understaffed = own.buildings.filter((b) => !buildingShortfall(b).met);

  function setGarrison(unitId: number, value: string) {
    setDraft((d) => {
      if (!d) return d;
      const garrison = d.garrison.filter((x) => x.unitId !== unitId);
      if (value === "UNASSIGNED") return { ...d, garrison };
      if (value.startsWith("B")) garrison.push({ unitId, target: { kind: "BUILDING", buildingId: Number(value.slice(1)) } });
      else if (value.startsWith("V")) garrison.push({ unitId, target: { kind: "VEHICLE", vehicleId: Number(value.slice(1)) } });
      return { ...d, garrison };
    });
  }

  // Building actions are now added only from the building's own action panel. Params
  // (targets/quantities) are still gathered here because available-actions does NOT
  // validate them ([D-063]) — orders/validate + resolution do.
  const paramKey = (buildingId: number, action: string) => `${buildingId}:${action}`;
  const getActionParams = (buildingId: number, action: string) => actionParams[paramKey(buildingId, action)] ?? {};
  function setActionParam(buildingId: number, action: string, k: string, v: string) {
    setActionParams((s) => ({ ...s, [paramKey(buildingId, action)]: { ...(s[paramKey(buildingId, action)] ?? {}), [k]: v } }));
  }
  function addBuildingActionFor(buildingId: number, action: string) {
    const params = buildParams(action, getActionParams(buildingId, action));
    setDraft((d) => d && { ...d, buildingActions: [...d.buildingActions, { buildingId, action, params }] });
    setActionParams((s) => {
      const next = { ...s };
      delete next[paramKey(buildingId, action)];
      return next;
    });
  }
  function addUnitAction() {
    if (uaUnit === "") return;
    const params = buildParams(uaAction, uaParams);
    const order: Record<string, unknown> = { unitId: Number(uaUnit), action: uaAction };
    if (params.targetHex) order.targetHex = params.targetHex;
    if (params.targetBuildingId) order.targetBuildingId = params.targetBuildingId;
    if (params.targetSubdivisionId) order.targetSubdivisionId = params.targetSubdivisionId;
    if (params.targetUnitId) order.targetUnitId = params.targetUnitId;
    const rest = { ...params };
    delete rest.targetHex; delete rest.targetBuildingId; delete rest.targetSubdivisionId; delete rest.targetUnitId;
    if (Object.keys(rest).length) order.params = rest;
    setDraft((d) => d && { ...d, unitActions: [...d.unitActions, order as never] });
    setUaParams({});
    setUaUnit("");
  }
  function setPolitical() {
    if (!polAction) { setDraft((d) => d && { ...d, politicalAction: null }); return; }
    setDraft((d) => d && { ...d, politicalAction: { action: polAction, params: buildParams(polAction, polParams) } });
  }
  function addCorporate() {
    if ((draft?.corporateActions.length ?? 0) >= maxCorporate) return;
    setDraft((d) => d && { ...d, corporateActions: [...d.corporateActions, { action: coAction, params: buildParams(coAction, coParams) }] });
    setCoParams({});
  }

  async function onValidate() {
    setBusy(true); setMsg(null);
    try {
      const r = await validateDraft(gameId, draft!);
      setInvalids((r.invalidOrders as InvalidOrder[]) ?? []);
      setMsgOk(r.valid);
      setMsg(r.valid ? "Dry run passed — every order is currently valid. Nothing has been submitted yet." : `Dry run found ${r.invalidOrders.length} problem(s) below. Fix them, then submit.`);
    } catch (e) { setMsgOk(false); setMsg((e as Error).message); } finally { setBusy(false); }
  }
  async function onSave() {
    setBusy(true); setMsg(null);
    try {
      const r = await saveDraft(gameId, draft!);
      setInvalids(r.invalidOrders);
      setStatus("SUBMITTED");
      setMsgOk(r.accepted);
      setMsg(r.accepted
        ? "Orders submitted and accepted. You can keep revising and re-submit any time before the deadline."
        : `Orders saved, but the engine flagged ${r.invalidOrders.length} order(s) (listed below). Those will be skipped at resolution unless you fix and re-submit.`);
    } catch (e) { setMsgOk(false); setMsg((e as Error).message); } finally { setBusy(false); }
  }

  const totalActions =
    draft.buildingActions.length +
    draft.unitActions.length +
    (draft.politicalAction ? 1 : 0) +
    draft.corporateActions.length;
  const staffedUnits = draft.garrison.filter((g) => g.target.kind !== "AVAILABLE").length;

  const submitDisabled = game?.status !== "ACTIVE";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">ORDERS <span className="dim">// TURN {turnNumber}</span></div>
          <div className="page-subtitle">
            {status === "SUBMITTED"
              ? "Orders submitted for this turn — revise and re-submit any time before the deadline."
              : "Not submitted yet. Build your orders below, then press Submit Turn."}{" "}
            {game?.status === "ACTIVE" ? "" : `Game is ${game?.status}.`}
          </div>
        </div>
        <div className="page-meta" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`badge ${status === "SUBMITTED" ? "badge-green" : "badge-amber"}`}>
            {status === "SUBMITTED" ? "SUBMITTED" : "NOT SUBMITTED"}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onValidate} disabled={busy}>CHECK ORDERS</button>
          <ConfirmButton
            className="btn btn-primary"
            title="SUBMIT TURN"
            confirmLabel="CONFIRM SUBMIT"
            confirmClass="btn-primary"
            danger={false}
            disabled={busy || submitDisabled}
            onConfirm={onSave}
            message={<ReviewSummary draft={draft} understaffed={understaffed} buildings={own.buildings} rivals={rivals} unitById={unitById} staffedUnits={staffedUnits} totalActions={totalActions} />}
          >
            SUBMIT TURN
          </ConfirmButton>
        </div>
      </div>

      <div className="help-box">
        <span className="help-title">HOW ORDERS WORK</span>
        Each turn you (1) <strong>garrison</strong> your personnel into buildings so they run, then queue{" "}
        <strong>building</strong>, <strong>unit</strong>, <strong>political</strong> and <strong>corporate</strong> actions.
        <strong> Click a building in Step 1</strong> to open its own list of actions — you only ever see the actions it can
        actually perform right now (the server checks garrison, modules and per-unit attention). Once a unit backs an
        action its attention is spent for the turn, so any action needing it drops off every list until next turn. Nothing
        is locked in until you press <strong>Submit Turn</strong>; revise and re-submit as often as you like before the
        deadline, and use <strong>Check Orders</strong> for a full engine dry run at any time.
      </div>

      {understaffed.length > 0 && (
        <div className="muted-note amber">
          {understaffed.length} of your {own.buildings.length} building(s) are understaffed and will not produce this turn:{" "}
          {understaffed.map((b) => `${buildingLabel(b.type)} ${hexLabel(b.hex.col, b.hex.row)}`).join(", ")}.
        </div>
      )}

      {msg && <div className={msgOk ? "ok-box" : "error-box"}>{msg}</div>}
      {invalids.length > 0 && (
        <div className="panel">
          <div className="panel-head"><span>&#9635; ORDERS THE ENGINE REJECTED ({invalids.length})</span></div>
          <div className="panel-body tight">
            <div className="table-scroll">
              <table>
                <thead><tr><th>ORDER TYPE</th><th>WHY IT WAS REJECTED</th></tr></thead>
                <tbody>
                  {invalids.map((io, i) => (
                    <tr key={i}><td><span className="badge badge-red">{titleCase(io.kind)}</span></td><td className="td-dim">{io.reason}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="orders-layout">
        <div>
          {/* ---- GARRISON ---- */}
          <div className="panel">
            <div className="panel-head"><span>&#9635; STEP 1 · GARRISON YOUR BUILDINGS</span></div>
            <div className="panel-body">
              <div className="field-hint" style={{ marginTop: 0, marginBottom: 12 }}>
                Assign personnel to each building until its requirement is met. Extra full sets let buildings take
                boost/repeat actions. Unassigned personnel stay free to perform Unit Actions.
              </div>

              {own.buildings.length === 0 && <div className="order-slot"><span className="order-slot-empty-text">You have no buildings yet.</span></div>}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {own.buildings.map((b) => {
                  const { met, missing } = buildingShortfall(b);
                  const have = garrisonByBuilding.get(b.id) ?? {};
                  const haveStr = Object.entries(have).map(([t, n]) => `${n} ${PERSONNEL_LABELS[t] ?? titleCase(t)}`).join(" + ") || "empty";
                  const open = openBuilding === b.id;
                  const acts = actionsForBuilding(b.id);
                  const queuedHere = draft!.buildingActions.filter((a) => a.buildingId === b.id).length;
                  return (
                    <div key={b.id} className={`bldg-card${open ? " selected" : ""}`}>
                      <button
                        type="button"
                        className="bldg-card-toggle"
                        onClick={() => setOpenBuilding(open ? null : b.id)}
                        aria-expanded={open}
                      >
                        <div className="bldg-card-top">
                          <span className="icon-label">
                            <BuildingIcon type={b.type} size={22} />
                            <span className="bldg-name">{buildingLabel(b.type)}</span>
                            <span className="bldg-hex">{hexLabel(b.hex.col, b.hex.row)}</span>
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {queuedHere > 0 && <span className="badge badge-cyan">{queuedHere} QUEUED</span>}
                            <span className={`badge ${met ? "badge-green" : "badge-amber"}`}>{met ? "STAFFED" : "UNDERSTAFFED"}</span>
                            <span className="dim" style={{ fontSize: 11 }}>{open ? "▾" : "▸"}</span>
                          </span>
                        </div>
                        <div className="bldg-card-meta">
                          <span>Requires: {reqString(b.type)}</span>
                          <span>Assigned: {haveStr}</span>
                          {!met && <span style={{ color: "var(--amber)" }}>Needs {missing.join(", ")}</span>}
                        </div>
                      </button>

                      {open && (
                        <div className="bldg-actions">
                          <div className="section-label" style={{ marginTop: 0 }}>AVAILABLE ACTIONS</div>
                          {avail == null ? (
                            <div className="order-slot"><span className="order-slot-empty-text">Loading available actions…</span></div>
                          ) : acts.length === 0 ? (
                            <div className="order-slot">
                              <span className="order-slot-empty-text">
                                {!turnStartOperational(b)
                                  ? "Not operational at the start of this turn — its garrison is below the minimum, so it offers no actions. (New garrison assignments take effect next turn.)"
                                  : "No actions available for this building right now — every action's required units have already had their attention spent this turn, or none apply."}
                              </span>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {acts.map((a) => {
                                const hints = FIELD_HINTS[a] ?? [];
                                return (
                                  <div key={a} className="order-slot filled" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                                      <span className="icon-label">
                                        <BuildingIcon type={b.type} size={16} />
                                        <span><strong>{actionLabel(a)}</strong></span>
                                      </span>
                                      <button className="btn btn-sm" onClick={() => addBuildingActionFor(b.id, a)}>+ QUEUE</button>
                                    </div>
                                    <div className="op-desc" style={{ marginTop: 0 }}>{actionInfo(a).desc}</div>
                                    {hints.length > 0 && (
                                      <ParamInputs
                                        fields={hints}
                                        values={getActionParams(b.id, a)}
                                        onChange={(k, v) => setActionParam(b.id, a, k, v)}
                                        ctx={{ buildings: own.buildings, rivals }}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {availErr && <div className="field-hint" style={{ color: "var(--amber)" }}>Could not refresh actions: {availErr}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="section-label" style={{ marginTop: 16 }}>PERSONNEL ROSTER · {availableUnits.length} unassigned of {assignable.length}</div>
              <div className="field-hint" style={{ marginTop: 0, marginBottom: 8 }}>
                <span className="badge badge-cyan">ASSIGNED</span> means this unit&apos;s attention is already spent by a queued action
                this turn (server-confirmed); <span className="badge badge-dim">AVAILABLE</span> means it can still back one.
              </div>
              {assignable.length === 0 && <div className="order-slot"><span className="order-slot-empty-text">You have no available personnel.</span></div>}
              {assignable.length > 0 && (
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>PERSONNEL</th><th>ATTENTION</th><th>ASSIGN TO</th></tr></thead>
                    <tbody>
                      {assignable.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <span className="icon-label">
                              <PersonnelIcon type={p.type} size={18} />
                              <span>{PERSONNEL_LABELS[p.type] ?? titleCase(p.type)} <span className="td-dim">#{p.id}</span></span>
                            </span>
                          </td>
                          <td>
                            <AssignBadge committed={attentionSpent(p.id)} reason={attentionSpent(p.id) ? attentionReason(p.id) : undefined} />
                          </td>
                          <td>
                            <select className="console-input inline-input" style={{ width: "100%" }} value={draftAssignmentOf(p.id)} onChange={(e) => setGarrison(p.id, e.target.value)}>
                              <option value="UNASSIGNED">Unassigned (free for unit actions)</option>
                              {own.buildings.map((b) => <option key={b.id} value={`B${b.id}`}>{buildingLabel(b.type)} {hexLabel(b.hex.col, b.hex.row)}</option>)}
                              {own.vehicles.map((v) => <option key={v.id} value={`V${v.id}`}>Crew Vehicle #{v.id}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ---- POLITICAL ---- */}
          <div className="panel">
            <div className="panel-head"><span>&#9635; POLITICAL ACTION</span><span className="td-dim" style={{ fontSize: 10 }}>1 per turn</span></div>
            <div className="panel-body">
              <span className="field-label">Action</span>
              <select className="console-input" value={polAction} onChange={(e) => { setPolAction(e.target.value); setPolParams({}); }}>
                <option value="">— none —</option>
                {POLITICAL_ACTIONS.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
              </select>
              {polAction && (
                <>
                  <div className="op-desc">{actionInfo(polAction).desc}</div>
                  <div style={{ marginTop: 8 }}>
                    <ParamInputs fields={FIELD_HINTS[polAction] ?? []} values={polParams} onChange={(k, v) => setPolParams((s) => ({ ...s, [k]: v }))} ctx={{ buildings: own.buildings, rivals }} />
                  </div>
                </>
              )}
              <button className="btn btn-sm btn-block" style={{ marginTop: 10 }} onClick={setPolitical}>
                {polAction ? "SET POLITICAL ACTION" : "CLEAR POLITICAL ACTION"}
              </button>
              {draft.politicalAction && (
                <div className="order-slot filled" style={{ marginTop: 10 }}>
                  <span><strong>{actionLabel(draft.politicalAction.action)}</strong>{describeParams(draft.politicalAction.params, own.buildings, rivals) ? ` — ${describeParams(draft.politicalAction.params, own.buildings, rivals)}` : ""}</span>
                  <button className="btn btn-sm btn-ghost" onClick={() => { setDraft((d) => d && { ...d, politicalAction: null }); setPolAction(""); }}>REMOVE</button>
                </div>
              )}
            </div>
          </div>

          {/* ---- CORPORATE ---- */}
          <div className="panel">
            <div className="panel-head"><span>&#9635; CORPORATE ACTIONS</span><span className="td-dim" style={{ fontSize: 10 }}>{draft.corporateActions.length}/{maxCorporate} used</span></div>
            <div className="panel-body">
              <div className="field-hint" style={{ marginTop: 0, marginBottom: 8 }}>
                {maxCorporate} corporate action{maxCorporate > 1 ? "s" : ""} allowed this turn{own.earthRelations >= 30 ? " (2 unlocked by Earth Relations ≥ 30)" : " (reach Earth Relations 30 to unlock a 2nd)"}.
              </div>
              <span className="field-label">Action</span>
              <select className="console-input" value={coAction} onChange={(e) => { setCoAction(e.target.value); setCoParams({}); }}>
                {CORPORATE_ACTIONS.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
              </select>
              <div className="op-desc">{actionInfo(coAction).desc}</div>
              <div style={{ marginTop: 8 }}>
                <ParamInputs fields={FIELD_HINTS[coAction] ?? []} values={coParams} onChange={(k, v) => setCoParams((s) => ({ ...s, [k]: v }))} ctx={{ buildings: own.buildings, rivals }} />
              </div>
              <button className="btn btn-sm btn-block" style={{ marginTop: 10 }} disabled={draft.corporateActions.length >= maxCorporate} onClick={addCorporate}>+ ADD CORPORATE ACTION</button>
              {draft.corporateActions.length === 0 && <div className="order-slot" style={{ marginTop: 10 }}><span className="order-slot-empty-text">No corporate action queued.</span></div>}
              {draft.corporateActions.map((c, i) => (
                <div className="order-slot filled" key={i} style={{ marginTop: 10 }}>
                  <span><strong>{actionLabel(c.action)}</strong>{describeParams(c.params, own.buildings, rivals) ? ` — ${describeParams(c.params, own.buildings, rivals)}` : ""}</span>
                  <button className="btn btn-sm btn-ghost" onClick={() => setDraft((d) => d && { ...d, corporateActions: d.corporateActions.filter((_, j) => j !== i) })}>REMOVE</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          {/* ---- QUEUED BUILDING ACTIONS ---- */}
          <div className="panel">
            <div className="panel-head"><span>&#9635; STEP 2 · BUILDING ACTIONS</span><span className="td-dim" style={{ fontSize: 10 }}>{draft.buildingActions.length} queued</span></div>
            <div className="panel-body">
              <div className="field-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                Add building actions by opening a building in <strong>Step 1</strong> — each building offers only the actions
                it can currently perform (server-checked, live against attention). Queued actions appear here.
              </div>
              <div style={{ marginTop: 0 }}>
                {draft.buildingActions.length === 0 && <div className="order-slot"><span className="order-slot-empty-text">No building actions queued. Open a building in Step 1 to add one.</span></div>}
                {draft.buildingActions.map((a, i) => {
                  const b = own.buildings.find((x) => x.id === a.buildingId);
                  const where = b ? `${buildingLabel(b.type)} ${hexLabel(b.hex.col, b.hex.row)}` : `building #${a.buildingId}`;
                  const p = describeParams(a.params, own.buildings, rivals);
                  return (
                    <div className="order-slot filled" key={i}>
                      <span className="icon-label">
                        {b ? <BuildingIcon type={b.type} size={18} /> : null}
                        <span><strong>{actionLabel(a.action)}</strong> — {where}{p ? ` · ${p}` : ""}</span>
                      </span>
                      <button className="btn btn-sm btn-ghost" onClick={() => setDraft((d) => d && { ...d, buildingActions: d.buildingActions.filter((_, j) => j !== i) })}>REMOVE</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ---- UNIT ACTIONS ---- */}
          <div className="panel">
            <div className="panel-head"><span>&#9635; STEP 3 · UNIT ACTIONS</span><span className="td-dim" style={{ fontSize: 10 }}>{availableUnits.length} unassigned units available</span></div>
            <div className="panel-body">
              <div className="field-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                Only <strong>unassigned</strong> personnel can take unit actions — units garrisoned in Step 1 are busy.
                Each action suits a particular personnel type (shown below the selector).
              </div>
              {availableUnits.length === 0 ? (
                <div className="order-slot"><span className="order-slot-empty-text">Every unit is currently garrisoned. Unassign a unit in Step 1 to free it for a unit action.</span></div>
              ) : (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span className="field-label" style={{ marginBottom: 0 }}>Unit</span>
                      <select className="console-input inline-input" value={uaUnit} onChange={(e) => setUaUnit(e.target.value === "" ? "" : Number(e.target.value))}>
                        <option value="">select…</option>
                        {availableUnits.map((u) => <option key={u.id} value={u.id}>{PERSONNEL_LABELS[u.type] ?? titleCase(u.type)} #{u.id}{attentionSpent(u.id) ? " · ASSIGNED" : ""}</option>)}
                      </select>
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span className="field-label" style={{ marginBottom: 0 }}>Action</span>
                      <select className="console-input inline-input" value={uaAction} onChange={(e) => { setUaAction(e.target.value); setUaParams({}); }}>
                        {UNIT_ACTIONS.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
                      </select>
                    </label>
                    <ParamInputs fields={FIELD_HINTS[uaAction] ?? []} values={uaParams} onChange={(k, v) => setUaParams((s) => ({ ...s, [k]: v }))} ctx={{ buildings: own.buildings, rivals }} />
                    <button className="btn btn-sm" onClick={addUnitAction} disabled={uaUnit === ""}>+ ADD</button>
                  </div>
                  <div className="op-desc">
                    {actionInfo(uaAction).desc}
                    {actionInfo(uaAction).personnel ? ` · Best performed by: ${PERSONNEL_LABELS[actionInfo(uaAction).personnel!] ?? ""}` : ""}
                  </div>
                  {uaUnit !== "" && actionInfo(uaAction).personnel && unitById.get(Number(uaUnit))?.type !== actionInfo(uaAction).personnel && (
                    <div className="field-hint" style={{ color: "var(--amber)" }}>
                      Heads up: {actionLabel(uaAction)} is usually {withArticle(PERSONNEL_LABELS[actionInfo(uaAction).personnel!])} action — the engine may reject it for {withArticle(PERSONNEL_LABELS[unitById.get(Number(uaUnit))!.type])}.
                    </div>
                  )}
                </>
              )}

              <div style={{ marginTop: 12 }}>
                {draft.unitActions.length === 0 && <div className="order-slot"><span className="order-slot-empty-text">No unit actions queued.</span></div>}
                {draft.unitActions.map((a, i) => {
                  const u = unitById.get(a.unitId);
                  const who = u ? `${PERSONNEL_LABELS[u.type] ?? titleCase(u.type)} #${a.unitId}` : `unit #${a.unitId}`;
                  const parts: string[] = [];
                  if (a.targetHex) parts.push(`hex ${hexLabel(a.targetHex.col, a.targetHex.row)}`);
                  if (a.targetBuildingId) parts.push(paramValueLabel("targetBuildingId", a.targetBuildingId, own.buildings, rivals));
                  if (a.targetSubdivisionId) parts.push(paramValueLabel("targetSubdivisionId", a.targetSubdivisionId, own.buildings, rivals));
                  const rest = describeParams(a.params, own.buildings, rivals);
                  if (rest) parts.push(rest);
                  const warn = !availableIds.has(a.unitId);
                  return (
                    <div className="order-slot filled" key={i}>
                      <span className="icon-label">
                        {u ? <PersonnelIcon type={u.type} size={18} /> : null}
                        <span><strong>{actionLabel(a.action)}</strong> — {who}{parts.length ? ` · ${parts.join(", ")}` : ""}
                        {warn && <span style={{ color: "var(--amber)" }}> (this unit is now garrisoned — unassign it or remove this action)</span>}</span>
                      </span>
                      <button className="btn btn-sm btn-ghost" onClick={() => setDraft((d) => d && { ...d, unitActions: d.unitActions.filter((_, j) => j !== i) })}>REMOVE</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ---- NOTES ---- */}
          <div className="panel">
            <div className="panel-head"><span>&#9635; NOTES TO GAME MASTER</span><span className="td-dim" style={{ fontSize: 10 }}>optional</span></div>
            <div className="panel-body">
              <div className="field-hint" style={{ marginTop: 0, marginBottom: 8 }}>
                Free-text contingencies or trade confirmations for the host — one per line. These are not executed by the engine.
              </div>
              <textarea
                className="console-input"
                placeholder="e.g. If minerals sell below 0.45, hold instead…"
                value={draft.notes.join("\n")}
                onChange={(e) => setDraft((d) => d && { ...d, notes: e.target.value.split("\n").filter((x) => x.trim() !== "") })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="muted-note">
        Orders are validated by the engine when you submit and again at resolution. See your{" "}
        <Link href="/play/report">private report</Link> for full garrison, personnel, and building state.
      </div>
    </div>
  );
}

// Pre-seed the draft garrison from the units' current (start-of-turn) assignments.
function seedFromReport(rep: ReportResponse): DraftSubmission {
  const d = emptyDraft();
  for (const p of rep.own.personnel) {
    if (p.status === "GARRISONED" && p.assignedBuildingId != null) {
      d.garrison.push({ unitId: p.id, target: { kind: "BUILDING", buildingId: p.assignedBuildingId } });
    } else if (p.status === "CREWING" && p.assignedVehicleId != null) {
      d.garrison.push({ unitId: p.id, target: { kind: "VEHICLE", vehicleId: p.assignedVehicleId } });
    }
  }
  return d;
}

// Human-readable review shown in the submit confirmation modal.
function ReviewSummary({
  draft, understaffed, buildings, rivals, unitById, staffedUnits, totalActions,
}: {
  draft: DraftSubmission;
  understaffed: OwnBuilding[];
  buildings: OwnBuilding[];
  rivals: PublicSubdivision[];
  unitById: Map<number, OwnPersonnel>;
  staffedUnits: number;
  totalActions: number;
}) {
  return (
    <div>
      <div style={{ marginBottom: 10 }}>You are about to submit this turn&apos;s orders:</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <li>• <strong>{staffedUnits}</strong> personnel garrisoned across your buildings.</li>
        <li>• <strong>{draft.buildingActions.length}</strong> building action(s), <strong>{draft.unitActions.length}</strong> unit action(s).</li>
        <li>• Political: <strong>{draft.politicalAction ? actionLabel(draft.politicalAction.action) : "none"}</strong>.</li>
        <li>• Corporate: <strong>{draft.corporateActions.length ? draft.corporateActions.map((c) => actionLabel(c.action)).join(", ") : "none"}</strong>.</li>
        {draft.notes.length > 0 && <li>• {draft.notes.length} note(s) to the game master.</li>}
      </ul>
      {totalActions === 0 && (
        <span className="modal-warn">You have not queued any actions — only garrison assignments will be submitted.</span>
      )}
      {understaffed.length > 0 && (
        <span className="modal-warn">
          {understaffed.length} building(s) are understaffed and will not produce:{" "}
          {understaffed.map((b) => `${buildingLabel(b.type)} ${hexLabel(b.hex.col, b.hex.row)}`).join(", ")}.
        </span>
      )}
    </div>
  );
}
