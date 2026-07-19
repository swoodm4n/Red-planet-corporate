"use client";

import { useState } from "react";
import type { SubdivisionSlot } from "@/lib/client/types";
import { STATE_EDIT_OPS, EFFECT_TYPE_META } from "@/lib/client/labels";

// Mirrors the server StateEdit op set (src/server/stateEdit.ts). The admin authors
// DATA only; the engine derives all consequences on the next resolution.

const OPS = [
  "SET_RESOURCE",
  "ADD_RESOURCE",
  "SET_EARTH_RELATIONS",
  "ADJUST_EARTH_RELATIONS",
  "DISABLE_BUILDING",
  "SET_HEX_OWNER",
  "SET_OXYGEN",
  "ADD_MILESTONE",
  "REGISTER_EFFECT",
  "RELEASE_CAPTIVE",
] as const;

const RESOURCES = ["CREDITS", "ENERGY", "MINERALS", "WATER", "FOOD", "RESEARCH"];
const EFFECT_TYPES = ["OUTPUT_DELTA", "MODULE_HALF_EFFECT", "NO_INTELLIGENCE", "TERRAIN_EXPLOIT_SUSPEND"];
const EFFECT_SCOPES = ["COLONY", "SUBDIVISION", "REGION", "BUILDING"];
const MODULE_TYPES = [
  "EFFICIENCY", "REDUNDANT_SYSTEMS", "EXPANSION", "FORTIFICATION", "SECURITY_DETAIL",
  "OPERATIONS_DIRECTOR", "TERRAIN_EXPLOIT", "SENSOR_ARRAY", "COMMAND_SUITE", "DIPLOMATIC_SUITE",
  "AUTOMATION", "PERSONNEL_MODULE", "HAZARD_SHIELD", "RESEARCH_LINK", "TRADE_NETWORK", "GLOBAL_CONTRIBUTION",
];

// field spec: [key, label, type, hint?]
type FieldType = "num" | "text" | "bool" | "resource" | "effectType" | "effectScope" | "subdivision" | "moduleType";
const FIELDS: Record<string, [string, string, FieldType, string?][]> = {
  SET_RESOURCE: [["subdivisionId", "Subdivision", "subdivision"], ["resource", "Resource", "resource"], ["value", "New value", "num"], ["asCredits", "Value is whole Cr", "bool", "For Credits: tick to enter e.g. 30 instead of raw fixed-point."]],
  ADD_RESOURCE: [["subdivisionId", "Subdivision", "subdivision"], ["resource", "Resource", "resource"], ["amount", "Amount (+/-)", "num", "Negative to remove."], ["asCredits", "Amount is whole Cr", "bool"]],
  SET_EARTH_RELATIONS: [["subdivisionId", "Subdivision", "subdivision"], ["value", "Value (0-30)", "num"]],
  ADJUST_EARTH_RELATIONS: [["subdivisionId", "Subdivision", "subdivision"], ["delta", "Delta (+/-)", "num"]],
  DISABLE_BUILDING: [["subdivisionId", "Subdivision", "subdivision"], ["buildingId", "Building id", "num"], ["untilTurn", "Disabled until turn", "num"]],
  SET_HEX_OWNER: [["col", "Column (1-12)", "num"], ["row", "Row (1-8)", "num"], ["ownerSubdivisionId", "New owner", "subdivision", "Leave blank to unclaim the hex."]],
  SET_OXYGEN: [["value", "Oxygen value", "num"]],
  ADD_MILESTONE: [["milestoneId", "Milestone id", "text"]],
  REGISTER_EFFECT: [
    ["effectType", "Effect type", "effectType"],
    ["scope", "Scope", "effectScope"],
    ["source", "Label / source", "text", "Shown in reports, e.g. \"Dust Storm Season\"."],
    ["turnsRemaining", "Duration (turns)", "num"],
    ["magnitude", "Magnitude", "num", "e.g. -1 for OUTPUT_DELTA."],
    ["subdivisionId", "Subdivision", "subdivision", "Required for SUBDIVISION/BUILDING scope."],
    ["buildingId", "Building id", "num", "Only for BUILDING scope."],
    ["moduleType", "Module type", "moduleType", "Only for MODULE_HALF_EFFECT."],
    ["requiresUnshielded", "Only unshielded buildings", "bool", "Skip buildings with a Hazard Shield."],
    ["requiresNoRedundant", "Only non-redundant buildings", "bool", "Skip buildings with Redundant Systems."],
  ],
  RELEASE_CAPTIVE: [["captorSubdivisionId", "Captor subdivision", "subdivision"], ["personnelId", "Personnel id", "num"], ["toSubdivisionId", "Return to subdivision", "subdivision", "Leave blank to remove the unit entirely."]],
};

export type StateEdit = Record<string, unknown> & { op: string };

function subName(subs: SubdivisionSlot[] | undefined, id: unknown): string {
  const n = Number(id);
  const s = subs?.find((x) => x.subdivisionId === n);
  return s ? `#${n} ${s.name}` : `subdivision #${id}`;
}

// Turn a composed edit into a plain-language one-liner for review.
function describeEdit(e: StateEdit, subs?: SubdivisionSlot[]): string {
  switch (e.op) {
    case "SET_RESOURCE": return `Set ${e.resource} = ${e.value}${e.asCredits ? " Cr" : ""} for ${subName(subs, e.subdivisionId)}`;
    case "ADD_RESOURCE": return `${Number(e.amount) < 0 ? "Remove" : "Add"} ${Math.abs(Number(e.amount))}${e.asCredits ? " Cr" : ""} ${e.resource} ${Number(e.amount) < 0 ? "from" : "to"} ${subName(subs, e.subdivisionId)}`;
    case "SET_EARTH_RELATIONS": return `Set Earth Relations = ${e.value} for ${subName(subs, e.subdivisionId)}`;
    case "ADJUST_EARTH_RELATIONS": return `Earth Relations ${Number(e.delta) >= 0 ? "+" : ""}${e.delta} for ${subName(subs, e.subdivisionId)}`;
    case "DISABLE_BUILDING": return `Disable building #${e.buildingId} of ${subName(subs, e.subdivisionId)} until turn ${e.untilTurn}`;
    case "SET_HEX_OWNER": return `Hex (${e.col},${e.row}) -> ${e.ownerSubdivisionId != null ? subName(subs, e.ownerSubdivisionId) : "unclaimed"}`;
    case "SET_OXYGEN": return `Set colony oxygen = ${e.value}`;
    case "ADD_MILESTONE": return `Mark milestone "${e.milestoneId}" as claimed`;
    case "REGISTER_EFFECT": return `${e.effectType} (${e.scope}) mag ${e.magnitude ?? "—"} for ${e.turnsRemaining} turn(s)${e.subdivisionId != null ? ` on ${subName(subs, e.subdivisionId)}` : ""}`;
    case "RELEASE_CAPTIVE": return `Release captive #${e.personnelId} from ${subName(subs, e.captorSubdivisionId)}${e.toSubdivisionId != null ? ` -> ${subName(subs, e.toSubdivisionId)}` : " (removed)"}`;
    default: return e.op;
  }
}

export function StateEditBuilder({
  edits,
  onChange,
  subdivisions,
}: {
  edits: StateEdit[];
  onChange: (edits: StateEdit[]) => void;
  subdivisions?: SubdivisionSlot[] | null;
}) {
  const [op, setOp] = useState<string>(OPS[0]);
  const [vals, setVals] = useState<Record<string, string | boolean>>({});
  const subs = subdivisions ?? undefined;

  function addEdit() {
    const edit: StateEdit = { op };
    for (const [key, , type] of FIELDS[op]) {
      const v = vals[key];
      if (type === "bool") {
        if (v) edit[key] = true;
        continue;
      }
      if (v == null || v === "") continue;
      if (type === "num" || type === "subdivision") edit[key] = Number(v);
      else edit[key] = v;
    }
    onChange([...edits, edit]);
    setVals({});
  }

  const opMeta = STATE_EDIT_OPS[op];

  return (
    <div>
      <div className="btn-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
        <label className="field" style={{ margin: 0 }}>
          <span className="field-label">Operation</span>
          <select className="console-input inline-input" style={{ minWidth: 200 }} value={op} onChange={(e) => { setOp(e.target.value); setVals({}); }}>
            {OPS.map((o) => <option key={o} value={o}>{STATE_EDIT_OPS[o]?.label ?? o}</option>)}
          </select>
        </label>
        {FIELDS[op].map(([key, label, type, hint]) => {
          if (type === "bool") {
            return (
              <label key={key} className="field" style={{ margin: 0, display: "flex", flexDirection: "column" }} title={hint}>
                <span className="field-label">{label}</span>
                <input type="checkbox" style={{ width: 18, height: 18 }} checked={!!vals[key]} onChange={(e) => setVals((s) => ({ ...s, [key]: e.target.checked }))} />
              </label>
            );
          }
          if (type === "subdivision" && subs) {
            return (
              <label key={key} className="field" style={{ margin: 0 }} title={hint}>
                <span className="field-label">{label}</span>
                <select className="console-input inline-input" style={{ minWidth: 150 }} value={(vals[key] as string) ?? ""} onChange={(e) => setVals((s) => ({ ...s, [key]: e.target.value }))}>
                  <option value="">—</option>
                  {subs.map((s) => <option key={s.subdivisionId} value={s.subdivisionId}>#{s.subdivisionId} {s.name}</option>)}
                </select>
              </label>
            );
          }
          if (type === "resource" || type === "effectType" || type === "effectScope" || type === "moduleType") {
            const opts = type === "resource" ? RESOURCES : type === "effectType" ? EFFECT_TYPES : type === "moduleType" ? MODULE_TYPES : EFFECT_SCOPES;
            return (
              <label key={key} className="field" style={{ margin: 0 }} title={hint}>
                <span className="field-label">{label}</span>
                <select className="console-input inline-input" value={(vals[key] as string) ?? ""} onChange={(e) => setVals((s) => ({ ...s, [key]: e.target.value }))}>
                  <option value="">—</option>
                  {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            );
          }
          return (
            <label key={key} className="field" style={{ margin: 0 }} title={hint}>
              <span className="field-label">{label}</span>
              <input className="console-input inline-input" style={{ width: 120 }} type={type === "num" ? "number" : "text"} value={(vals[key] as string) ?? ""} onChange={(e) => setVals((s) => ({ ...s, [key]: e.target.value }))} placeholder={type === "subdivision" ? "sub id" : undefined} />
            </label>
          );
        })}
        <button className="btn btn-sm" onClick={addEdit}>+ ADD EDIT</button>
      </div>

      {opMeta && <div className="op-desc">{opMeta.desc}{op === "REGISTER_EFFECT" && vals.effectType ? ` — ${EFFECT_TYPE_META[vals.effectType as string] ?? ""}` : ""}</div>}

      {edits.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <span className="field-label">Queued edits ({edits.length})</span>
          {edits.map((e, i) => (
            <div className="edit-chip" key={i}>
              <div>
                <div className="edit-chip-op">{STATE_EDIT_OPS[e.op]?.label ?? e.op}</div>
                <div className="edit-chip-detail">{describeEdit(e, subs)}</div>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => onChange(edits.filter((_, j) => j !== i))}>REMOVE</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
