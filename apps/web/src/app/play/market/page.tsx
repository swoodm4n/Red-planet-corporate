"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePlayer } from "@/lib/client/gameContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { api } from "@/lib/client/api";
import { loadDraft, saveDraft, type DraftSubmission } from "@/lib/client/orders";
import type { DashboardResponse, ReportResponse } from "@/lib/client/types";
import { RESOURCE_LABELS, PHYSICAL_RESOURCES } from "@/lib/client/labels";

export default function MarketPage() {
  const { gameId, subdivisionId } = usePlayer();
  const [dash, setDash] = useState<DashboardResponse | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [draft, setDraft] = useState<DraftSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // market sale form
  const [saleResource, setSaleResource] = useState("MINERALS");
  const [saleQty, setSaleQty] = useState(5);
  const [saleBuilding, setSaleBuilding] = useState<number | "">("");

  // equity form
  const [equityIssuer, setEquityIssuer] = useState<number | "">("");
  const [equityKind, setEquityKind] = useState<"BUY" | "SELL">("BUY");
  const [equityShares, setEquityShares] = useState(1);
  const [equityUnit, setEquityUnit] = useState<number | "">("");

  useEffect(() => {
    api.get<DashboardResponse>(`/api/games/${gameId}/dashboard`).then(setDash).catch((e) => setError(e.message));
    if (subdivisionId != null) {
      api.get<ReportResponse>(`/api/games/${gameId}/report`).then(setReport).catch(() => {});
      loadDraft(gameId).then((d) => setDraft(d.draft)).catch(() => setDraft(null));
    }
  }, [gameId, subdivisionId]);

  if (error) return <ErrorMsg error={error} />;
  if (!dash) return <Loading label="LOADING MARKET" />;

  const nameById = new Map(dash.standings.standings.map((s) => [s.subdivisionId, s.name]));
  const transitHubs = report?.own.buildings.filter((b) => b.type === "TRANSIT_HUB") ?? [];
  const availableAdmins = report?.own.personnel.filter((p) => p.type === "ADMINISTRATOR" && p.status === "AVAILABLE") ?? [];
  const myHoldings = new Map((report?.own.equityHoldings ?? []).map((h) => [h.issuerSubdivisionId, h.shares]));

  async function queueMarketSale() {
    if (!draft || saleBuilding === "") return;
    setMsg(null);
    const next: DraftSubmission = {
      ...draft,
      buildingActions: [
        ...draft.buildingActions,
        { buildingId: Number(saleBuilding), action: "MARKET_SALE", params: { resource: saleResource, quantity: saleQty } },
      ],
    };
    try {
      const r = await saveDraft(gameId, next);
      setDraft(next);
      setMsg(r.accepted ? "Market sale queued and accepted by the engine." : `Queued, but engine flagged ${r.invalidOrders.length} invalid order(s). Review on the Orders page.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function queueEquityTrade() {
    if (!draft || equityIssuer === "" || equityUnit === "") return;
    setMsg(null);
    const next: DraftSubmission = {
      ...draft,
      unitActions: [
        ...draft.unitActions,
        {
          unitId: Number(equityUnit),
          action: "TRADE_ACTION",
          params: { equityIssuerSubdivisionId: Number(equityIssuer), shares: equityShares, tradeKind: equityKind },
        },
      ],
    };
    try {
      const r = await saveDraft(gameId, next);
      setDraft(next);
      setMsg(r.accepted ? "Equity trade queued and accepted by the engine." : `Queued, but engine flagged ${r.invalidOrders.length} invalid order(s). Review on the Orders page.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">MARKET &amp; EQUITY</div>
          <div className="page-subtitle">
            Colony-wide dynamic pricing. Trades resolve at turn-start price during turn processing (§11).
          </div>
        </div>
        <div className="page-meta">Turn {dash.turnNumber}</div>
      </div>

      {msg && <div className="ok-box">{msg}</div>}
      {subdivisionId == null && (
        <div className="muted-note amber">You have no assigned subdivision — trading is disabled; prices are shown for reference only.</div>
      )}

      <div className="section-label">RESOURCE MARKET — LIVE PRICES</div>
      <div className="panel">
        <div className="panel-body tight">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>RESOURCE</th>
                  <th className="td-num">LIVE PRICE</th>
                  <th className="td-num">EARTH BUY (×1.20)</th>
                  <th className="td-num">EARTH SELL (×0.80)</th>
                  <th className="td-num">YOUR STOCK</th>
                </tr>
              </thead>
              <tbody>
                {dash.market.map((m) => {
                  const stock = report?.own.resources[m.resource as keyof typeof report.own.resources];
                  return (
                    <tr key={m.resource}>
                      <td>{RESOURCE_LABELS[m.resource] ?? m.resource}</td>
                      <td className="td-num">{m.livePrice.toFixed(2)} Cr</td>
                      <td className="td-num td-dim">{(m.livePrice * 1.2).toFixed(2)} Cr</td>
                      <td className="td-num td-dim">{(m.livePrice * 0.8).toFixed(2)} Cr</td>
                      <td className="td-num">{stock ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {subdivisionId != null && (
        <div className="panel">
          <div className="panel-head"><span>&#9635; QUEUE MARKET SALE (Transit Hub)</span></div>
          <div className="panel-body">
            {transitHubs.length === 0 ? (
              <div className="muted-note" style={{ margin: 0 }}>You have no Transit Hub. Build one to run Market Sale actions, or use Black Market Sale (corporate action) on the Orders page.</div>
            ) : (
              <div className="btn-row" style={{ alignItems: "flex-end" }}>
                <label className="field" style={{ margin: 0 }}>
                  <span className="field-label">Resource</span>
                  <select className="console-input inline-input" value={saleResource} onChange={(e) => setSaleResource(e.target.value)}>
                    {PHYSICAL_RESOURCES.map((r) => <option key={r} value={r}>{RESOURCE_LABELS[r]}</option>)}
                  </select>
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="field-label">Quantity</span>
                  <input className="console-input inline-input" style={{ width: 90 }} type="number" min={1} value={saleQty} onChange={(e) => setSaleQty(Number(e.target.value))} />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="field-label">Transit Hub</span>
                  <select className="console-input inline-input" value={saleBuilding} onChange={(e) => setSaleBuilding(e.target.value === "" ? "" : Number(e.target.value))}>
                    <option value="">— select —</option>
                    {transitHubs.map((b) => <option key={b.id} value={b.id}>#{b.id} ({b.hex.col},{b.hex.row})</option>)}
                  </select>
                </label>
                <button className="btn btn-primary" disabled={saleBuilding === ""} onClick={queueMarketSale}>QUEUE SALE</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="section-label">SUBDIVISION EQUITY MARKET</div>
      <div className="panel">
        <div className="panel-head"><span>&#9635; SHARE PRICES</span></div>
        <div className="panel-body tight">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SUBDIVISION</th>
                  <th className="td-num">SHARE PRICE</th>
                  <th className="td-num">SHARES YOU HOLD</th>
                </tr>
              </thead>
              <tbody>
                {dash.equity.sharePrices.map((p) => {
                  const you = p.issuerSubdivisionId === subdivisionId;
                  return (
                    <tr key={p.issuerSubdivisionId} className={you ? "you-row" : ""}>
                      <td>
                        {nameById.get(p.issuerSubdivisionId) ?? `#${p.issuerSubdivisionId}`}
                        {you && <span className="badge badge-cyan" style={{ marginLeft: 6 }}>YOU</span>}
                      </td>
                      <td className="td-num">{p.sharePrice.toFixed(2)} Cr</td>
                      <td className="td-num">{myHoldings.get(p.issuerSubdivisionId) ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {subdivisionId != null && (
        <div className="panel">
          <div className="panel-head"><span>&#9635; QUEUE EQUITY TRADE (Administrator Trade Action)</span></div>
          <div className="panel-body">
            {availableAdmins.length === 0 ? (
              <div className="muted-note" style={{ margin: 0 }}>No available Administrator to execute a Trade Action. Free one up in the Garrison / Orders view.</div>
            ) : (
              <div className="btn-row" style={{ alignItems: "flex-end" }}>
                <label className="field" style={{ margin: 0 }}>
                  <span className="field-label">Issuer</span>
                  <select className="console-input inline-input" value={equityIssuer} onChange={(e) => setEquityIssuer(e.target.value === "" ? "" : Number(e.target.value))}>
                    <option value="">— select —</option>
                    {dash.equity.sharePrices.map((p) => <option key={p.issuerSubdivisionId} value={p.issuerSubdivisionId}>{nameById.get(p.issuerSubdivisionId) ?? `#${p.issuerSubdivisionId}`}</option>)}
                  </select>
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="field-label">Direction</span>
                  <select className="console-input inline-input" value={equityKind} onChange={(e) => setEquityKind(e.target.value as "BUY" | "SELL")}>
                    <option value="BUY">Buy</option>
                    <option value="SELL">Sell</option>
                  </select>
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="field-label">Shares</span>
                  <input className="console-input inline-input" style={{ width: 80 }} type="number" min={1} value={equityShares} onChange={(e) => setEquityShares(Number(e.target.value))} />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="field-label">Administrator</span>
                  <select className="console-input inline-input" value={equityUnit} onChange={(e) => setEquityUnit(e.target.value === "" ? "" : Number(e.target.value))}>
                    <option value="">— select —</option>
                    {availableAdmins.map((u) => <option key={u.id} value={u.id}>#{u.id}</option>)}
                  </select>
                </label>
                <button className="btn btn-primary" disabled={equityIssuer === "" || equityUnit === ""} onClick={queueEquityTrade}>QUEUE TRADE</button>
              </div>
            )}
            <div className="muted-note">Queued trades are appended to this turn&apos;s submission. Review and revise everything on the <Link href="/play/orders">Orders</Link> page before the deadline.</div>
          </div>
        </div>
      )}
    </div>
  );
}
