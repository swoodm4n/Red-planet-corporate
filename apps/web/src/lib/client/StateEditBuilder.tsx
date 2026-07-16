"use client";

import { useState } from "react";

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

// field spec: [key, label, type]
type FieldType = "num" | "text" | "bool" | "resource" | "effectType" | "effectScope";
const FIELDS: Record<string, [string, string, FieldType][]> = {
  SET_RESOURCE: [["subdivisionId", "Subdivision", "num"], ["resource", "Resource", "resource"], ["value", "Value", "num"], ["asCredits", "As whole Cr", "bool"]],
  ADD_RESOURCE: [["subdivisionId", "Subdivision", "num"], ["resource", "Resource", "resource"], ["amount", "Amount", "num"], ["asCredits", "As whole Cr", "bool"]],
  SET_EARTH_RELATIONS: [["subdivisionId", "Subdivision", "num"], ["value", "Value 0-30", "num"]],
  ADJUST_EARTH_RELATIONS: [["subdivisionId", "Subdivision", "num"], ["delta", "Delta", "num"]],
  DISABLE_BUILDING: [["subdivisionId", "Subdivision", "num"], ["buildingId", "Building", "num"], ["untilTurn", "Until turn", "num"]],
  SET_HEX_OWNER: [["col", "Col", "num"], ["row", "Row", "num"], ["ownerSubdivisionId", "Owner sub (blank=unclaim)", "num"]],
  SET_OXYGEN: [["value", "Value", "num"]],
  ADD_MILESTONE: [["milestoneId", "Milestone id", "text"]],
  REGISTER_EFFECT: [
    ["effectType", "Effect type", "effectType"],
    ["scope", "Scope", "effectScope"],
    ["source", "Source label", "text"],
    ["turnsRemaining", "Turns", "num"],
    ["magnitude", "Magnitude", "num"],
    ["subdivisionId", "Subdivision", "num"],
    ["buildingId", "Building", "num"],
  ],
  RELEASE_CAPTIVE: [["captorSubdivisionId", "Captor sub", "num"], ["personnelId", "Personnel id", "num"], ["toSubdivisionId", "Return to sub (blank=remove)", "num"]],
};

export type StateEdit = Record<string, unknown> & { op: string };

export function StateEditBuilder({
  edits,
  onChange,
}: {
  edits: StateEdit[];
  onChange: (edits: StateEdit[]) => void;
}) {
  const [op, setOp] = useState<string>(OPS[0]);
  const [vals, setVals] = useState<Record<string, string | boolean>>({});

  function addEdit() {
    const edit: StateEdit = { op };
    for (const [key, , type] of FIELDS[op]) {
      const v = vals[key];
      if (type === "bool") {
        if (v) edit[key] = true;
        continue;
      }
      if (v == null || v === "") continue;
      if (type === "num") edit[key] = Number(v);
      else edit[key] = v;
    }
    onChange([...edits, edit]);
    setVals({});
  }

  return (
    <div>
      <div className="btn-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
        <label className="field" style={{ margin: 0 }}>
          <span className="field-label">Op</span>
          <select className="console-input inline-input" value={op} onChange={(e) => { setOp(e.target.value); setVals({}); }}>
            {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        {FIELDS[op].map(([key, label, type]) => {
          if (type === "bool") {
            return (
              <label key={key} className="field" style={{ margin: 0, display: "flex", flexDirection: "column" }}>
                <span className="field-label">{label}</span>
                <input type="checkbox" checked={!!vals[key]} onChange={(e) => setVals((s) => ({ ...s, [key]: e.target.checked }))} />
              </label>
            );
          }
          if (type === "resource" || type === "effectType" || type === "effectScope") {
            const opts = type === "resource" ? RESOURCES : type === "effectType" ? EFFECT_TYPES : EFFECT_SCOPES;
            return (
              <label key={key} className="field" style={{ margin: 0 }}>
                <span className="field-label">{label}</span>
                <select className="console-input inline-input" value={(vals[key] as string) ?? ""} onChange={(e) => setVals((s) => ({ ...s, [key]: e.target.value }))}>
                  <option value="">—</option>
                  {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            );
          }
          return (
            <label key={key} className="field" style={{ margin: 0 }}>
              <span className="field-label">{label}</span>
              <input className="console-input inline-input" style={{ width: 110 }} type={type === "num" ? "number" : "text"} value={(vals[key] as string) ?? ""} onChange={(e) => setVals((s) => ({ ...s, [key]: e.target.value }))} />
            </label>
          );
        })}
        <button className="btn btn-sm" onClick={addEdit}>+ ADD EDIT</button>
      </div>

      {edits.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {edits.map((e, i) => (
            <div className="order-slot filled" key={i}>
              <code style={{ fontSize: 11, color: "var(--cyan)" }}>{JSON.stringify(e)}</code>
              <button className="btn btn-sm btn-ghost" onClick={() => onChange(edits.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
