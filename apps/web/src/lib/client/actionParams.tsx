"use client";

// Shared action-parameter helpers + inputs, extracted from the Orders screen so
// both the classic Orders page and the tactical HUD build identical param payloads.
// Display/entry only — the engine re-validates every field at submit + resolution.

import type { OwnBuilding, PublicSubdivision } from "@/lib/client/types";
import {
  BUILDING_TYPES,
  MODULE_TYPES,
  PERSONNEL_LABELS,
  PHYSICAL_RESOURCES,
  RESOURCE_LABELS,
  buildingLabel,
  hexLabel,
  paramLabel,
  titleCase,
} from "@/lib/client/labels";

// Which optional param fields each action commonly needs (advisory — engine validates).
export const FIELD_HINTS: Record<string, string[]> = {
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

export const HULLS = ["LIGHT", "MEDIUM", "HEAVY"];

export interface ParamCtx {
  buildings: OwnBuilding[];
  rivals: PublicSubdivision[];
}

export function ParamInputs({
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

export function buildParams(action: string, values: Record<string, string>): Record<string, unknown> {
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

export function paramValueLabel(key: string, value: unknown, buildings: OwnBuilding[], rivals: PublicSubdivision[]): string {
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

export function describeParams(params: Record<string, unknown> | undefined, buildings: OwnBuilding[], rivals: PublicSubdivision[]): string {
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
