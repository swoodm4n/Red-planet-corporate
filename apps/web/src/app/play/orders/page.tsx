"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePlayer } from "@/lib/client/gameContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { api } from "@/lib/client/api";
import { fromSubmission, saveDraft, validateDraft, type DraftSubmission } from "@/lib/client/orders";
import type { InvalidOrder, OrdersResponse, ReportResponse } from "@/lib/client/types";
import {
  BUILDING_ACTIONS,
  CORPORATE_ACTIONS,
  PERSONNEL_LABELS,
  PHYSICAL_RESOURCES,
  POLITICAL_ACTIONS,
  RESOURCE_LABELS,
  UNIT_ACTIONS,
  hexLabel,
  titleCase,
  unitDotClass,
} from "@/lib/client/labels";

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

function ParamInputs({
  fields,
  values,
  onChange,
}: {
  fields: string[];
  values: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  return (
    <>
      {fields.map((f) => {
        if (f === "resource") {
          return (
            <select key={f} className="console-input inline-input" value={values[f] ?? ""} onChange={(e) => onChange(f, e.target.value)}>
              <option value="">resource…</option>
              {PHYSICAL_RESOURCES.map((r) => <option key={r} value={r}>{RESOURCE_LABELS[r]}</option>)}
            </select>
          );
        }
        if (f === "colonistType") {
          return (
            <select key={f} className="console-input inline-input" value={values[f] ?? ""} onChange={(e) => onChange(f, e.target.value)}>
              <option value="">colonist type…</option>
              {Object.keys(PERSONNEL_LABELS).map((r) => <option key={r} value={r}>{PERSONNEL_LABELS[r]}</option>)}
            </select>
          );
        }
        if (f === "hull") {
          return (
            <select key={f} className="console-input inline-input" value={values[f] ?? ""} onChange={(e) => onChange(f, e.target.value)}>
              <option value="">hull…</option>
              {HULLS.map((h) => <option key={h} value={h}>{titleCase(h)}</option>)}
            </select>
          );
        }
        const numeric = /count|quantity|Id|Col|Row/.test(f);
        return (
          <input
            key={f}
            className="console-input inline-input"
            style={{ width: 120 }}
            type={numeric ? "number" : "text"}
            placeholder={f}
            value={values[f] ?? ""}
            onChange={(e) => onChange(f, e.target.value)}
          />
        );
      })}
    </>
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

export default function OrdersPage() {
  const { gameId, subdivisionId, game } = usePlayer();
  const [draft, setDraft] = useState<DraftSubmission | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [turnNumber, setTurnNumber] = useState<number>(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invalids, setInvalids] = useState<InvalidOrder[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // add-form state
  const [baBuilding, setBaBuilding] = useState<number | "">("");
  const [baAction, setBaAction] = useState(BUILDING_ACTIONS[0]);
  const [baParams, setBaParams] = useState<Record<string, string>>({});
  const [uaUnit, setUaUnit] = useState<number | "">("");
  const [uaAction, setUaAction] = useState(UNIT_ACTIONS[0]);
  const [uaParams, setUaParams] = useState<Record<string, string>>({});
  const [polAction, setPolAction] = useState("");
  const [polParams, setPolParams] = useState<Record<string, string>>({});
  const [coAction, setCoAction] = useState(CORPORATE_ACTIONS[0]);
  const [coParams, setCoParams] = useState<Record<string, string>>({});

  useEffect(() => {
    if (subdivisionId == null) return;
    api.get<OrdersResponse>(`/api/games/${gameId}/orders`).then((r) => {
      setDraft(fromSubmission(r.submission));
      setTurnNumber(r.turnNumber);
      setStatus(r.status);
    }).catch((e) => setError(e.message));
    api.get<ReportResponse>(`/api/games/${gameId}/report`).then(setReport).catch(() => {});
  }, [gameId, subdivisionId]);

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
  const maxCorporate = own.earthRelations >= 30 ? 2 : 1;
  const availableUnits = own.personnel.filter((p) => p.status === "AVAILABLE");
  const unitById = new Map(own.personnel.map((p) => [p.id, p]));

  function garrisonTargetFor(unitId: number): string {
    const g = draft!.garrison.find((x) => x.unitId === unitId);
    if (!g) return "KEEP";
    if (g.target.kind === "BUILDING") return `B${g.target.buildingId}`;
    if (g.target.kind === "VEHICLE") return `V${g.target.vehicleId}`;
    return "AVAILABLE";
  }

  function setGarrison(unitId: number, value: string) {
    setDraft((d) => {
      if (!d) return d;
      const garrison = d.garrison.filter((x) => x.unitId !== unitId);
      if (value === "KEEP") return { ...d, garrison };
      if (value === "AVAILABLE") garrison.push({ unitId, target: { kind: "AVAILABLE" } });
      else if (value.startsWith("B")) garrison.push({ unitId, target: { kind: "BUILDING", buildingId: Number(value.slice(1)) } });
      else if (value.startsWith("V")) garrison.push({ unitId, target: { kind: "VEHICLE", vehicleId: Number(value.slice(1)) } });
      return { ...d, garrison };
    });
  }

  function addBuildingAction() {
    if (baBuilding === "") return;
    setDraft((d) => d && { ...d, buildingActions: [...d.buildingActions, { buildingId: Number(baBuilding), action: baAction, params: buildParams(baAction, baParams) }] });
    setBaParams({});
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
      setMsg(r.valid ? "Dry-run passed: all orders are currently valid." : `Dry-run: ${r.invalidOrders.length} invalid order(s).`);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  async function onSave() {
    setBusy(true); setMsg(null);
    try {
      const r = await saveDraft(gameId, draft!);
      setInvalids(r.invalidOrders);
      setStatus("SUBMITTED");
      setMsg(r.accepted ? "Orders saved and accepted by the engine." : `Saved. Engine flagged ${r.invalidOrders.length} invalid order(s) — they will be dropped at resolution unless revised.`);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">ORDERS <span className="dim">// TURN {turnNumber}</span></div>
          <div className="page-subtitle">
            Build this turn&apos;s submission. {status ? `Current status: ${status}.` : "Not yet submitted."}{" "}
            {game?.status === "ACTIVE" ? "Revise freely until the deadline." : `Game is ${game?.status}.`}
          </div>
        </div>
        <div className="page-meta">
          <button className="btn btn-ghost btn-sm" onClick={onValidate} disabled={busy}>VALIDATE</button>{" "}
          <button className="btn btn-primary" onClick={onSave} disabled={busy || game?.status !== "ACTIVE"}>SUBMIT TURN</button>
        </div>
      </div>

      {msg && <div className={invalids.length ? "error-box" : "ok-box"}>{msg}</div>}
      {invalids.length > 0 && (
        <div className="panel">
          <div className="panel-head"><span>&#9635; INVALID ORDERS ({invalids.length})</span></div>
          <div className="panel-body tight">
            <div className="table-scroll">
              <table>
                <thead><tr><th>KIND</th><th>REASON</th></tr></thead>
                <tbody>
                  {invalids.map((io, i) => (
                    <tr key={i}><td><span className="badge badge-red">{io.kind}</span></td><td className="td-dim">{io.reason}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="orders-layout">
        <div>
          <div className="panel">
            <div className="panel-head"><span>&#9635; GARRISON ASSIGNMENT</span></div>
            <div className="panel-body tight">
              <div className="table-scroll">
                <table>
                  <thead><tr><th>UNIT</th><th>STATUS</th><th>ASSIGN</th></tr></thead>
                  <tbody>
                    {own.personnel.map((p) => (
                      <tr key={p.id}>
                        <td><span className={unitDotClass(p.type)} style={{ marginRight: 6 }} />#{p.id} {p.type.slice(0, 3)}</td>
                        <td className="td-dim">{p.status}</td>
                        <td>
                          <select className="console-input inline-input" style={{ width: "100%" }} value={garrisonTargetFor(p.id)} onChange={(e) => setGarrison(p.id, e.target.value)}>
                            <option value="KEEP">— keep —</option>
                            <option value="AVAILABLE">Available</option>
                            {own.buildings.map((b) => <option key={b.id} value={`B${b.id}`}>{titleCase(b.type)} {hexLabel(b.hex.col, b.hex.row)}</option>)}
                            {own.vehicles.map((v) => <option key={v.id} value={`V${v.id}`}>Vehicle #{v.id}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span>&#9635; POLITICAL ACTION (1/turn)</span></div>
            <div className="panel-body">
              <select className="console-input" value={polAction} onChange={(e) => { setPolAction(e.target.value); setPolParams({}); }}>
                <option value="">— none —</option>
                {POLITICAL_ACTIONS.map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}
              </select>
              {polAction && (
                <div className="btn-row" style={{ marginTop: 8 }}>
                  <ParamInputs fields={FIELD_HINTS[polAction] ?? []} values={polParams} onChange={(k, v) => setPolParams((s) => ({ ...s, [k]: v }))} />
                </div>
              )}
              <button className="btn btn-sm btn-block" style={{ marginTop: 8 }} onClick={setPolitical}>SET POLITICAL ACTION</button>
              {draft.politicalAction && <div className="muted-note" style={{ margin: "8px 0 0 0" }}>Queued: {titleCase(draft.politicalAction.action)}</div>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span>&#9635; CORPORATE ACTION ({draft.corporateActions.length}/{maxCorporate})</span></div>
            <div className="panel-body">
              <select className="console-input" value={coAction} onChange={(e) => { setCoAction(e.target.value); setCoParams({}); }}>
                {CORPORATE_ACTIONS.map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}
              </select>
              <div className="btn-row" style={{ marginTop: 8 }}>
                <ParamInputs fields={FIELD_HINTS[coAction] ?? []} values={coParams} onChange={(k, v) => setCoParams((s) => ({ ...s, [k]: v }))} />
              </div>
              <button className="btn btn-sm btn-block" style={{ marginTop: 8 }} disabled={draft.corporateActions.length >= maxCorporate} onClick={addCorporate}>+ ADD CORPORATE ACTION</button>
              {draft.corporateActions.map((c, i) => (
                <div className="order-slot filled" key={i} style={{ marginTop: 8 }}>
                  <span>{titleCase(c.action)}</span>
                  <button className="btn btn-sm btn-ghost" onClick={() => setDraft((d) => d && { ...d, corporateActions: d.corporateActions.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="panel-head"><span>&#9635; BUILDING ACTIONS</span></div>
            <div className="panel-body">
              <div className="btn-row" style={{ alignItems: "flex-end", marginBottom: 10 }}>
                <select className="console-input inline-input" value={baBuilding} onChange={(e) => setBaBuilding(e.target.value === "" ? "" : Number(e.target.value))}>
                  <option value="">building…</option>
                  {own.buildings.map((b) => <option key={b.id} value={b.id}>{titleCase(b.type)} {hexLabel(b.hex.col, b.hex.row)}</option>)}
                </select>
                <select className="console-input inline-input" value={baAction} onChange={(e) => { setBaAction(e.target.value); setBaParams({}); }}>
                  {BUILDING_ACTIONS.map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}
                </select>
                <ParamInputs fields={FIELD_HINTS[baAction] ?? []} values={baParams} onChange={(k, v) => setBaParams((s) => ({ ...s, [k]: v }))} />
                <button className="btn btn-sm" onClick={addBuildingAction} disabled={baBuilding === ""}>+ ADD</button>
              </div>
              {draft.buildingActions.length === 0 && <div className="order-slot"><span className="order-slot-empty-text">No building actions queued.</span></div>}
              {draft.buildingActions.map((a, i) => (
                <div className="order-slot filled" key={i}>
                  <span><strong>{titleCase(a.action)}</strong> — building #{a.buildingId}{a.params && Object.keys(a.params).length ? ` (${JSON.stringify(a.params)})` : ""}</span>
                  <button className="btn btn-sm btn-ghost" onClick={() => setDraft((d) => d && { ...d, buildingActions: d.buildingActions.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span>&#9635; UNIT ACTIONS ({availableUnits.length} available units)</span></div>
            <div className="panel-body">
              <div className="btn-row" style={{ alignItems: "flex-end", marginBottom: 10 }}>
                <select className="console-input inline-input" value={uaUnit} onChange={(e) => setUaUnit(e.target.value === "" ? "" : Number(e.target.value))}>
                  <option value="">unit…</option>
                  {availableUnits.map((u) => <option key={u.id} value={u.id}>#{u.id} {u.type.slice(0, 3)}</option>)}
                </select>
                <select className="console-input inline-input" value={uaAction} onChange={(e) => { setUaAction(e.target.value); setUaParams({}); }}>
                  {UNIT_ACTIONS.map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}
                </select>
                <ParamInputs fields={FIELD_HINTS[uaAction] ?? []} values={uaParams} onChange={(k, v) => setUaParams((s) => ({ ...s, [k]: v }))} />
                <button className="btn btn-sm" onClick={addUnitAction} disabled={uaUnit === ""}>+ ADD</button>
              </div>
              {draft.unitActions.length === 0 && <div className="order-slot"><span className="order-slot-empty-text">No unit actions queued.</span></div>}
              {draft.unitActions.map((a, i) => (
                <div className="order-slot filled" key={i}>
                  <span>
                    <span className={unitDotClass(unitById.get(a.unitId)?.type ?? "")} style={{ marginRight: 8 }} />
                    <strong>{titleCase(a.action)}</strong> — unit #{a.unitId}
                    {a.targetHex ? ` @ ${hexLabel(a.targetHex.col, a.targetHex.row)}` : ""}
                  </span>
                  <button className="btn btn-sm btn-ghost" onClick={() => setDraft((d) => d && { ...d, unitActions: d.unitActions.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span>&#9635; NOTES TO HOST</span></div>
            <div className="panel-body">
              <textarea
                className="console-input"
                placeholder="Contingency instructions / trade confirmations (one per line)…"
                value={draft.notes.join("\n")}
                onChange={(e) => setDraft((d) => d && { ...d, notes: e.target.value.split("\n").filter((x) => x.trim() !== "") })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="muted-note">
        Orders are validated by the engine at submission and re-validated at resolution. See the{" "}
        <Link href="/play/report">private report</Link> for current garrison, personnel, and building state.
      </div>
    </div>
  );
}
