// pages.js — page content templates for the mockup
const PAGES = {};

// ============================================================
// PAGE 1: DASHBOARD / OVERVIEW
// ============================================================
PAGES.dashboard = `
<div class="page-header">
  <div>
    <div class="page-title">SUBDIVISION OVERVIEW <span class="dim">// RED ROCK MINING 07</span></div>
    <div class="page-subtitle">Last sync: Turn 24, 0600 SOL // Next submission window closes in 41:12:07</div>
  </div>
  <div class="page-meta">PARENT CO: UNIFIED MINING CONSORTIUM<br>EARTH RELATIONS: 17 <span style="color:var(--green-bright)">&#9650;1</span></div>
</div>

<div class="grid-4">
  <div class="stat-block">
    <div class="stat-label">COMPOSITE SCORE</div>
    <div class="stat-value">56.5</div>
    <div class="stat-foot">Rank 3 of 6 colony-wide</div>
  </div>
  <div class="stat-block">
    <div class="stat-label">PERSONNEL (AVAILABLE)</div>
    <div class="stat-value cyan">8 <span style="font-size:13px;color:var(--text-tertiary)">/ 23</span></div>
    <div class="stat-foot">15 garrisoned across 6 buildings</div>
  </div>
  <div class="stat-block">
    <div class="stat-label">CLAIMED TERRITORY</div>
    <div class="stat-value amber">6 <span style="font-size:13px;color:var(--text-tertiary)">hexes</span></div>
    <div class="stat-foot">+6 Cr/turn territory income</div>
  </div>
  <div class="stat-block">
    <div class="stat-label">SHARE PRICE</div>
    <div class="stat-value">10.65<span style="font-size:13px;color:var(--text-tertiary)"> Cr</span></div>
    <div class="stat-foot">31 of 100 shares held by rivals</div>
  </div>
</div>

<div class="grid-sidebar-r">
  <div>
    <div class="panel">
      <div class="panel-head">
        <span>&#9635; RESOURCE FLOW THIS TURN</span>
        <span class="panel-head-actions"><span class="badge badge-dim">PROJECTED</span></span>
      </div>
      <div class="panel-body tight">
        <div class="table-scroll"><table>
          <thead><tr><th>RESOURCE</th><th class="td-num">INCOME</th><th class="td-num">UPKEEP</th><th class="td-num">NET</th><th>TREND</th></tr></thead>
          <tbody>
            <tr>
              <td>Credits</td><td class="td-num">+24</td><td class="td-num">-6</td>
              <td class="td-num" style="color:var(--green-bright)">+18</td>
              <td><div class="bar-track" style="width:80px"><div class="bar-fill" style="width:72%"></div></div></td>
            </tr>
            <tr>
              <td>Minerals</td><td class="td-num">+4</td><td class="td-num">-26</td>
              <td class="td-num" style="color:var(--red)">-22</td>
              <td><div class="bar-track" style="width:80px"><div class="bar-fill red" style="width:38%"></div></div></td>
            </tr>
            <tr>
              <td>Energy</td><td class="td-num">+9</td><td class="td-num">-6</td>
              <td class="td-num" style="color:var(--green-bright)">+3</td>
              <td><div class="bar-track" style="width:80px"><div class="bar-fill" style="width:55%"></div></div></td>
            </tr>
            <tr>
              <td>Water</td><td class="td-num">+6</td><td class="td-num">-10</td>
              <td class="td-num" style="color:var(--red)">-4</td>
              <td><div class="bar-track" style="width:80px"><div class="bar-fill amber" style="width:45%"></div></div></td>
            </tr>
            <tr>
              <td>Food/Bio</td><td class="td-num">+2</td><td class="td-num">-11</td>
              <td class="td-num" style="color:var(--red)">-9</td>
              <td><div class="bar-track" style="width:80px"><div class="bar-fill red" style="width:30%"></div></div></td>
            </tr>
            <tr>
              <td>Research</td><td class="td-num">+5</td><td class="td-num">-1</td>
              <td class="td-num" style="color:var(--green-bright)">+4</td>
              <td><div class="bar-track" style="width:80px"><div class="bar-fill cyan" style="width:62%"></div></div></td>
            </tr>
          </tbody>
        </table></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><span>&#9635; BUILDING STATUS</span></div>
      <div class="panel-body tight">
        <div class="table-scroll"><table>
          <thead><tr><th>BUILDING</th><th>HEX</th><th>GARRISON</th><th>STATUS</th><th></th></tr></thead>
          <tbody>
            <tr><td>Headquarters</td><td class="td-dim">A1</td><td class="td-dim">2 Adm + 1 Con</td><td><span class="badge badge-green">OPERATIONAL</span></td><td class="td-dim">&#8594;</td></tr>
            <tr><td>Extraction Site</td><td class="td-dim">B3</td><td class="td-dim">3 Eng</td><td><span class="badge badge-green">OPERATIONAL</span></td><td class="td-dim">&#8594;</td></tr>
            <tr><td>Bio Facility</td><td class="td-dim">B2</td><td class="td-dim">2 Eng</td><td><span class="badge badge-green">OPERATIONAL</span></td><td class="td-dim">&#8594;</td></tr>
            <tr><td>Research Complex</td><td class="td-dim">C3</td><td class="td-dim">1 / 3 Innovator</td><td><span class="badge badge-amber">UNDERSTAFFED</span></td><td class="td-dim">&#8594;</td></tr>
            <tr><td>Power Facility</td><td class="td-dim">C1</td><td class="td-dim">&mdash;</td><td><span class="badge badge-red">COMPLETED &mdash; NOT GARRISONED</span></td><td class="td-dim">&#8594;</td></tr>
            <tr><td>Communications Array</td><td class="td-dim">B1</td><td class="td-dim">2 Ana + 1 Eng</td><td><span class="badge badge-green">OPERATIONAL</span></td><td class="td-dim">&#8594;</td></tr>
          </tbody>
        </table></div>
      </div>
    </div>
  </div>

  <div>
    <div class="panel">
      <div class="panel-head"><span>&#9635; ACTIVITY LOG</span></div>
      <div class="feed">
        <div class="feed-line"><span class="feed-time">T24</span><span class="feed-text">Power Facility construction <span class="hl">COMPLETE</span> at Hex C1.</span></div>
        <div class="feed-line"><span class="feed-time">T24</span><span class="feed-text">Sabotage attempt vs. your Comms Array: <span class="hl-amber">FAILED</span> &mdash; attacker unidentified.</span></div>
        <div class="feed-line"><span class="feed-time">T24</span><span class="feed-text">Earth Relations <span class="hl">+1</span> &mdash; Resource Export threshold reached.</span></div>
        <div class="feed-line"><span class="feed-time">T23</span><span class="feed-text">Field Surveillance at Hex E2: <span class="hl-cyan">SUCCESS</span> &mdash; rival Research Complex (T1) detected.</span></div>
        <div class="feed-line"><span class="feed-time">T23</span><span class="feed-text">Trade executed: 4 Water <span class="hl">&#8596;</span> 4 Minerals with HELIX-09.</span></div>
        <div class="feed-line"><span class="feed-time">T22</span><span class="feed-text">Subdivision Event: <span class="hl">Surplus Shipment</span> &mdash; received 5 Minerals at no cost.</span></div>
        <div class="feed-line"><span class="feed-time">T22</span><span class="feed-text">1x Contractor <span class="hl-red">CAPTURED</span> crossing OMEGA-02 territory at Hex D4.</span></div>
        <div class="feed-line"><span class="feed-time">T21</span><span class="feed-text">Colonist Requisition submitted: 3x Engineer, 1x Analyst &mdash; ETA Turn 27.</span></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><span>&#9635; ALERTS</span></div>
      <div class="panel-body" style="display:flex;flex-direction:column;gap:8px;">
        <div class="muted-note" style="border-left-color:var(--red);color:#D98A8A;">Power Facility ungarrisoned &mdash; generating 0 Energy this turn.</div>
        <div class="muted-note" style="border-left-color:var(--amber);color:var(--amber);">Research Complex understaffed &mdash; 2 more Innovators needed for full output.</div>
        <div class="muted-note">Contractor held by OMEGA-02 &mdash; negotiate resolution via Diplomatic channel.</div>
      </div>
    </div>
  </div>
</div>
`;

// ============================================================
// PAGE 2: TERRITORY MAP
// ============================================================
function buildHexGrid() {
  const rows = 8, cols = 12;
  const ownedHexes = new Set(['3,2','4,2','3,3','4,3','5,3','4,4']);
  const hqHex = '3,2';
  const rivalHexes = new Set(['8,5','9,5','8,6']);
  const landingHex = '6,4';
  const mountainHexes = new Set(['1,1','2,0','10,2']);
  const fogHexes = new Set(['0,0','0,7','11,0','11,7','1,7','10,7']);
  const impassableHexes = new Set(['7,1','7,0']);

  let html = '';
  for (let r = 0; r < rows; r++) {
    html += `<div class="hexrow">`;
    for (let c = 0; c < cols; c++) {
      const key = `${c},${r}`;
      let cls = 'hex';
      let label = '';
      if (fogHexes.has(key)) { cls += ' fog'; }
      else if (key === landingHex) { cls += ' landing'; label = 'LZ'; }
      else if (key === hqHex) { cls += ' owned-hq'; label = 'HQ'; }
      else if (ownedHexes.has(key)) { cls += ' owned'; label = c+','+r; }
      else if (rivalHexes.has(key)) { cls += ' rival'; label = '!'; }
      else if (impassableHexes.has(key)) { cls += ' impassable'; label = '~'; }
      else if (mountainHexes.has(key)) { cls += ' terrain-mountain'; label = 'M'; }
      else { label = ''; }
      html += `<div class="${cls}" title="Hex ${c},${r}">${label}</div>`;
    }
    html += `</div>`;
  }
  return html;
}

PAGES.map = `
<div class="page-header">
  <div>
    <div class="page-title">TERRITORY MAP</div>
    <div class="page-subtitle">12&times;8 hex grid // showing known territory &mdash; fogged hexes require Survey or Sensor Array to reveal</div>
  </div>
  <div class="page-meta">6 hexes claimed // 3 rival hexes spotted</div>
</div>

<div class="map-wrap">
  <div class="panel" style="margin-bottom:0;">
    <div class="panel-head">
      <span>&#9635; REGIONAL SCAN &mdash; SECTOR 7</span>
      <span class="panel-head-actions">
        <button class="btn btn-sm btn-ghost">ZOOM OUT</button>
        <button class="btn btn-sm">SURVEY HEX</button>
      </span>
    </div>
    <div class="hexgrid">${buildHexGrid()}</div>
    <div class="map-legend">
      <div class="legend-item"><div class="legend-swatch" style="background:var(--green-dim);border:1px solid var(--green-bright)"></div>HQ</div>
      <div class="legend-item"><div class="legend-swatch" style="background:var(--green-faint);border:1px solid var(--green-dim)"></div>Owned</div>
      <div class="legend-item"><div class="legend-swatch" style="background:#3A1414;border:1px solid #6B2424"></div>Rival claim</div>
      <div class="legend-item"><div class="legend-swatch" style="background:var(--cyan)"></div>Landing Zone</div>
      <div class="legend-item"><div class="legend-swatch" style="background:repeating-linear-gradient(45deg,#0D140D,#0D140D 2px,#08100A 2px,#08100A 4px);border:1px solid var(--border-dim)"></div>Mountain (M)</div>
      <div class="legend-item"><div class="legend-swatch" style="background:#1A1A1A"></div>Impassable</div>
      <div class="legend-item"><div class="legend-swatch" style="background:#0A0A0A;border:1px solid #1A1A1A"></div>Unrevealed</div>
    </div>
  </div>

  <div>
    <div class="panel">
      <div class="panel-head"><span>&#9635; HEX DETAIL &mdash; B3</span></div>
      <div class="panel-body">
        <div class="detail-row"><span class="detail-label">Terrain</span><span class="detail-value">Rare Minerals</span></div>
        <div class="detail-row"><span class="detail-label">Movement Cost</span><span class="detail-value">2 (difficult)</span></div>
        <div class="detail-row"><span class="detail-label">Owner</span><span class="detail-value" style="color:var(--green-bright)">RED ROCK MINING 07 (you)</span></div>
        <div class="detail-row"><span class="detail-label">Building</span><span class="detail-value">Extraction Site (T1)</span></div>
        <div class="detail-row"><span class="detail-label">Border Status</span><span class="detail-value">Open</span></div>
        <div class="btn-row" style="margin-top:12px;">
          <button class="btn btn-sm">MANAGE BUILDING</button>
          <button class="btn btn-sm btn-ghost">CLOSE BORDER</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><span>&#9635; TRANSIT HUB NETWORK</span></div>
      <div class="panel-body">
        <div class="muted-note" style="margin:0 0 10px 0;">2-node network: 1 owned hub + Landing Zone anchor.</div>
        <div class="detail-row"><span class="detail-label">Transit Hub (A2)</span><span class="detail-value" style="color:var(--green-bright)">&#9679; ACTIVE</span></div>
        <div class="detail-row"><span class="detail-label">Landing Zone (6,4)</span><span class="detail-value" style="color:var(--cyan)">&#9679; UNIVERSAL</span></div>
        <div class="detail-row"><span class="detail-label">Granted access</span><span class="detail-value td-dim">None</span></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><span>&#9635; NEARBY ACTIVITY</span></div>
      <div class="panel-body" style="font-size:11px;color:var(--text-secondary);display:flex;flex-direction:column;gap:8px;">
        <div>OMEGA-02 Contractor patrol detected at Hex D4 &mdash; closed border.</div>
        <div>Unclaimed Rare Mineral deposit at Hex E5 &mdash; unsurveyed.</div>
      </div>
    </div>
  </div>
</div>
`;

// ============================================================
// PAGE 3: COLONY MANAGEMENT
// ============================================================
PAGES.colony = `
<div class="page-header">
  <div>
    <div class="page-title">COLONY MANAGEMENT</div>
    <div class="page-subtitle">Garrison assignment and module installation &mdash; changes apply at next turn processing</div>
  </div>
  <div class="page-meta">8 personnel available for reassignment</div>
</div>

<div class="grid-sidebar">
  <div>
    <div class="section-label">YOUR BUILDINGS</div>
    <div class="bldg-list">
      <div class="bldg-card selected">
        <div class="bldg-card-top">
          <div><span class="bldg-name">Extraction Site</span><span class="bldg-hex">HEX B3</span></div>
          <span class="badge badge-green">T1</span>
        </div>
        <div class="bldg-card-meta"><span>3/3 Engineer</span><span>+2 Min/turn</span></div>
        <div class="module-slots">
          <div class="slot filled">EF</div><div class="slot filled">TE</div><div class="slot filled">SA</div>
          <div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div>
          <div class="slot empty">+</div><div class="slot empty">+</div>
        </div>
      </div>
      <div class="bldg-card">
        <div class="bldg-card-top">
          <div><span class="bldg-name">Headquarters</span><span class="bldg-hex">HEX A1</span></div>
          <span class="badge badge-green">T1</span>
        </div>
        <div class="bldg-card-meta"><span>2 Adm + 1 Con</span><span>+6 Cr/turn territory</span></div>
        <div class="module-slots">
          <div class="slot filled">FO</div><div class="slot filled">CS</div>
          <div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div>
          <div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div>
        </div>
      </div>
      <div class="bldg-card">
        <div class="bldg-card-top">
          <div><span class="bldg-name">Bio Facility</span><span class="bldg-hex">HEX B2</span></div>
          <span class="badge badge-green">T1</span>
        </div>
        <div class="bldg-card-meta"><span>2/2 Engineer</span><span>+2 Food/turn</span></div>
        <div class="module-slots">
          <div class="slot filled">EF</div>
          <div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div>
          <div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div>
        </div>
      </div>
      <div class="bldg-card">
        <div class="bldg-card-top">
          <div><span class="bldg-name">Research Complex</span><span class="bldg-hex">HEX C3</span></div>
          <span class="badge badge-amber">UNDERSTAFFED</span>
        </div>
        <div class="bldg-card-meta"><span style="color:var(--amber)">1/3 Innovator</span><span>0 output</span></div>
        <div class="module-slots">
          <div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div>
          <div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div>
        </div>
      </div>
      <div class="bldg-card">
        <div class="bldg-card-top">
          <div><span class="bldg-name">Power Facility</span><span class="bldg-hex">HEX C1</span></div>
          <span class="badge badge-red">NOT GARRISONED</span>
        </div>
        <div class="bldg-card-meta"><span style="color:var(--red)">0/2 Engineer</span><span>0 output</span></div>
        <div class="module-slots">
          <div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div>
          <div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div>
        </div>
      </div>
      <div class="bldg-card">
        <div class="bldg-card-top">
          <div><span class="bldg-name">Communications Array</span><span class="bldg-hex">HEX B1</span></div>
          <span class="badge badge-green">T1</span>
        </div>
        <div class="bldg-card-meta"><span>2 Ana + 1 Eng</span><span>2-hex intel range</span></div>
        <div class="module-slots">
          <div class="slot filled">SA</div><div class="slot filled">FO</div>
          <div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div><div class="slot empty">+</div>
        </div>
      </div>
    </div>
  </div>

  <div>
    <div class="panel">
      <div class="panel-head">
        <span>&#9635; EXTRACTION SITE &mdash; HEX B3 &mdash; TIER 1 &mdash; 8 SLOTS</span>
        <span class="badge badge-green">OPERATIONAL</span>
      </div>
      <div class="panel-body">
        <div class="grid-2">
          <div>
            <div class="section-label">GARRISON (3/3 ENGINEER REQUIRED)</div>
            <div class="garrison-row">
              <div class="garrison-unit"><span class="unit-dot engineer"></span>Engineer</div>
              <div class="stepper"><button>&minus;</button><span class="stepper-val">3</span><button>+</button></div>
            </div>
            <div class="muted-note">Fully staffed &mdash; Harvest Resources and Boost Output building actions both available this turn.</div>

            <div class="section-label">BASE PRODUCTION</div>
            <div class="detail-row"><span class="detail-label">Output</span><span class="detail-value">+2 Minerals / turn</span></div>
            <div class="detail-row"><span class="detail-label">Build Cost</span><span class="detail-value td-dim">12 Min + 8 Cr (paid)</span></div>
            <div class="detail-row"><span class="detail-label">Upkeep</span><span class="detail-value" style="color:var(--amber)">1 Energy + 1 Cr / turn</span></div>
          </div>
          <div>
            <div class="section-label">INSTALLED MODULES (3/8 SLOTS)</div>
            <div class="detail-row"><span class="detail-label">&#11042; Efficiency Module</span><span class="detail-value td-dim">+1 Min/turn</span></div>
            <div class="detail-row"><span class="detail-label">&#11042; Terrain Exploit</span><span class="detail-value td-dim">+3 bonus (Rare Min hex)</span></div>
            <div class="detail-row"><span class="detail-label">&#11042; Sensor Array</span><span class="detail-value td-dim">requires 1 Analyst</span></div>
            <div class="btn-row" style="margin-top:12px;">
              <button class="btn btn-sm">+ INSTALL MODULE</button>
              <button class="btn btn-sm btn-ghost">TIER UPGRADE</button>
            </div>
          </div>
        </div>

        <div class="section-label">AVAILABLE BUILDING ACTIONS THIS TURN</div>
        <div class="table-scroll"><table>
          <thead><tr><th>ACTION</th><th>TYPE</th><th>EFFECT</th><th></th></tr></thead>
          <tbody>
            <tr><td>Harvest Minerals</td><td><span class="badge badge-green">Production</span></td><td class="td-dim">+2 Minerals</td><td><button class="btn btn-sm">QUEUE</button></td></tr>
            <tr><td>Boost Output</td><td><span class="badge badge-green">Production</span></td><td class="td-dim">+2 Minerals (surplus garrison)</td><td><button class="btn btn-sm btn-ghost">N/A</button></td></tr>
          </tbody>
        </table></div>
      </div>
    </div>
  </div>
</div>
`;

// ============================================================
// PAGE 4: ORDERS / TURN SUBMISSION
// ============================================================
PAGES.orders = `
<div class="page-header">
  <div>
    <div class="page-title">ORDERS &mdash; TURN 25</div>
    <div class="page-subtitle">Submission window open // closes in 41:12:07</div>
  </div>
  <div class="page-meta"><button class="btn btn-primary">SUBMIT TURN</button></div>
</div>

<div class="orders-layout">
  <div>
    <div class="panel">
      <div class="panel-head"><span>&#9635; AVAILABLE PERSONNEL (8)</span></div>
      <div class="panel-body tight">
        <div class="unit-pool-item"><span><span class="unit-dot engineer" style="display:inline-block;margin-right:7px;"></span>Engineer</span><span class="unit-pool-count">&times;4 available</span></div>
        <div class="unit-pool-item"><span><span class="unit-dot contractor" style="display:inline-block;margin-right:7px;"></span>Contractor</span><span class="unit-pool-count">&times;1 available</span></div>
        <div class="unit-pool-item"><span><span class="unit-dot administrator" style="display:inline-block;margin-right:7px;"></span>Administrator</span><span class="unit-pool-count">&times;1 available</span></div>
        <div class="unit-pool-item"><span><span class="unit-dot innovator" style="display:inline-block;margin-right:7px;"></span>Innovator</span><span class="unit-pool-count">&times;1 available</span></div>
        <div class="unit-pool-item"><span><span class="unit-dot analyst" style="display:inline-block;margin-right:7px;"></span>Analyst</span><span class="unit-pool-count">&times;1 available</span></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><span>&#9635; POLITICAL ACTION</span></div>
      <div class="panel-body">
        <div class="muted-note" style="margin:0 0 10px 0;">1 per turn. Currently: NONE queued.</div>
        <button class="btn btn-sm btn-ghost" style="width:100%;">+ DECLARE POLITICAL ACTION</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><span>&#9635; CORPORATE ACTION</span></div>
      <div class="panel-body">
        <div class="muted-note" style="margin:0 0 10px 0;">1 per turn. Currently: NONE queued.</div>
        <button class="btn btn-sm btn-ghost" style="width:100%;">+ DECLARE CORPORATE ACTION</button>
      </div>
    </div>
  </div>

  <div>
    <div class="panel">
      <div class="panel-head"><span>&#9635; QUEUED UNIT ACTIONS (2)</span></div>
      <div class="panel-body">
        <div class="order-slot filled">
          <span><span class="unit-dot engineer" style="display:inline-block;margin-right:8px;"></span><strong>Engineer</strong> &mdash; Garrison: Power Facility Hex C1 (newly completed)</span>
          <button class="btn btn-sm btn-ghost">&#10005;</button>
        </div>
        <div class="order-slot filled">
          <span><span class="unit-dot analyst" style="display:inline-block;margin-right:8px;"></span><strong>Analyst</strong> &mdash; Field Surveillance: Hex E5 (unclaimed Rare Minerals)</span>
          <button class="btn btn-sm btn-ghost">&#10005;</button>
        </div>
        <div class="order-slot">
          <span class="order-slot-empty-text">+ Drag an available unit here, or click below to add an order</span>
        </div>
        <button class="btn btn-row" style="margin-top:4px;">+ ADD UNIT ACTION</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><span>&#9635; QUEUED BUILDING ACTIONS (3)</span></div>
      <div class="panel-body tight">
        <div class="table-scroll"><table>
          <thead><tr><th>BUILDING</th><th>ACTION</th><th>GARRISON</th><th></th></tr></thead>
          <tbody>
            <tr><td>Extraction Site (B3)</td><td>Harvest Minerals</td><td class="td-dim">3 Eng</td><td><button class="btn btn-sm btn-ghost">&#10005;</button></td></tr>
            <tr><td>Bio Facility (B2)</td><td>Harvest Food/Bio</td><td class="td-dim">2 Eng</td><td><button class="btn btn-sm btn-ghost">&#10005;</button></td></tr>
            <tr><td>Comms Array (B1)</td><td>Passive Intel Scan</td><td class="td-dim">2 Ana</td><td><button class="btn btn-sm btn-ghost">&#10005;</button></td></tr>
          </tbody>
        </table></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><span>&#9635; NOTES TO HOST</span></div>
      <div class="panel-body">
        <textarea class="console-input" placeholder="Any clarifications, contingency instructions, or trade confirmations for the host...&#10;&#10;e.g. Trade offer to HELIX-09: 4 Water for 4 Minerals — void if unmatched."></textarea>
      </div>
    </div>
  </div>
</div>
`;

// ============================================================
// PAGE: MY STATS (Director-level personal stats, separate from colony standings)
// ============================================================
PAGES.mystats = `
<div class="page-header">
  <div>
    <div class="page-title">MY STATS</div>
    <div class="page-subtitle">Director-level performance, personnel roster, and Earth Relations detail &mdash; private to this subdivision</div>
  </div>
  <div class="page-meta">RED ROCK MINING CONSORTIUM // SUBDIVISION 07</div>
</div>

<div class="grid-4">
  <div class="stat-block">
    <div class="stat-label">COMPOSITE SCORE</div>
    <div class="stat-value">54.5</div>
    <div class="stat-foot">Rank 6 of 6 colony-wide</div>
  </div>
  <div class="stat-block">
    <div class="stat-label">EARTH RELATIONS</div>
    <div class="stat-value amber">17 <span style="font-size:13px;color:var(--text-tertiary)">/ 30</span></div>
    <div class="stat-foot">+1 this turn &mdash; Consistent Output</div>
  </div>
  <div class="stat-block">
    <div class="stat-label">TOTAL PERSONNEL</div>
    <div class="stat-value cyan">19</div>
    <div class="stat-foot">5 available, 14 garrisoned</div>
  </div>
  <div class="stat-block">
    <div class="stat-label">SHARE PRICE</div>
    <div class="stat-value">9.45<span style="font-size:13px;color:var(--text-tertiary)"> Cr</span></div>
    <div class="stat-foot">12 of 100 shares held by rivals</div>
  </div>
</div>

<div class="grid-2">
  <div>
    <div class="panel">
      <div class="panel-head"><span>&#9635; SCORING BREAKDOWN BY CATEGORY</span></div>
      <div class="panel-body">
        <div class="detail-row"><span class="detail-label">Industrial <span class="td-dim">(Engineer)</span></span><span class="detail-value" style="color:var(--green-bright)">24 &mdash; <span class="badge badge-green">LEADING</span></span></div>
        <div class="bar-track" style="margin:4px 0 10px 0;"><div class="bar-fill" style="width:88%"></div></div>

        <div class="detail-row"><span class="detail-label">Territorial <span class="td-dim">(Eng/Con)</span></span><span class="detail-value">18</span></div>
        <div class="bar-track" style="margin:4px 0 10px 0;"><div class="bar-fill cyan" style="width:64%"></div></div>

        <div class="detail-row"><span class="detail-label">Economic <span class="td-dim">(Administrator)</span></span><span class="detail-value">9</span></div>
        <div class="bar-track" style="margin:4px 0 10px 0;"><div class="bar-fill amber" style="width:32%"></div></div>

        <div class="detail-row"><span class="detail-label">Security <span class="td-dim">(Contractor)</span></span><span class="detail-value">2</span></div>
        <div class="bar-track" style="margin:4px 0 10px 0;"><div class="bar-fill red" style="width:9%"></div></div>

        <div class="detail-row"><span class="detail-label">Research <span class="td-dim">(Innovator)</span></span><span class="detail-value">1</span></div>
        <div class="bar-track" style="margin:4px 0 10px 0;"><div class="bar-fill red" style="width:4%"></div></div>

        <div class="detail-row"><span class="detail-label">Intelligence <span class="td-dim">(Analyst)</span></span><span class="detail-value">0</span></div>
        <div class="bar-track" style="margin:4px 0 0 0;"><div class="bar-fill red" style="width:2%"></div></div>

        <div class="muted-note" style="margin-top:14px;">Heavily Industrial/Territorial &mdash; classic extraction-forward build. Security and Intelligence are open weaknesses; consider an Engineer&rarr;Contractor requisition shift if rivals start probing your claims.</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><span>&#9635; EARTH RELATIONS LEDGER</span></div>
      <div class="panel-body tight">
        <div class="table-scroll"><table>
          <thead><tr><th>TURN</th><th>EVENT</th><th class="td-num">&Delta;</th></tr></thead>
          <tbody>
            <tr><td>31</td><td>Consistent Output (3+ turns positive)</td><td class="td-num" style="color:var(--green-bright)">+1</td></tr>
            <tr><td>29</td><td>Resource Export threshold (20 Minerals cumulative)</td><td class="td-num" style="color:var(--green-bright)">+1</td></tr>
            <tr><td>27</td><td>Colonist Requisition &mdash; 6 colonists (3 over threshold)</td><td class="td-num" style="color:var(--red)">-1</td></tr>
            <tr><td>24</td><td>Resource Export threshold (20 Minerals cumulative)</td><td class="td-num" style="color:var(--green-bright)">+1</td></tr>
            <tr><td>19</td><td>Colony Milestone &mdash; First Tier Upgrade</td><td class="td-num" style="color:var(--green-bright)">+3</td></tr>
          </tbody>
        </table></div>
      </div>
    </div>
  </div>

  <div>
    <div class="panel">
      <div class="panel-head"><span>&#9635; PERSONNEL ROSTER (19)</span></div>
      <div class="panel-body tight">
        <div class="table-scroll"><table>
          <thead><tr><th>TYPE</th><th class="td-num">TOTAL</th><th class="td-num">GARRISONED</th><th class="td-num">AVAILABLE</th><th class="td-num">UPKEEP/TURN</th></tr></thead>
          <tbody>
            <tr>
              <td><span class="unit-dot engineer" style="display:inline-block;margin-right:7px;"></span>Engineer</td>
              <td class="td-num">11</td><td class="td-num">9</td><td class="td-num" style="color:var(--green-bright)">2</td>
              <td class="td-num td-dim">11F + 11W</td>
            </tr>
            <tr>
              <td><span class="unit-dot contractor" style="display:inline-block;margin-right:7px;"></span>Contractor</td>
              <td class="td-num">2</td><td class="td-num">1</td><td class="td-num" style="color:var(--green-bright)">1</td>
              <td class="td-num td-dim">2F+2W+2Cr</td>
            </tr>
            <tr>
              <td><span class="unit-dot administrator" style="display:inline-block;margin-right:7px;"></span>Administrator</td>
              <td class="td-num">3</td><td class="td-num">2</td><td class="td-num" style="color:var(--green-bright)">1</td>
              <td class="td-num td-dim">3F+3W+6Cr</td>
            </tr>
            <tr>
              <td><span class="unit-dot innovator" style="display:inline-block;margin-right:7px;"></span>Innovator</td>
              <td class="td-num">2</td><td class="td-num">2</td><td class="td-num td-dim">0</td>
              <td class="td-num td-dim">2F+2W+2Cr+2E</td>
            </tr>
            <tr>
              <td><span class="unit-dot analyst" style="display:inline-block;margin-right:7px;"></span>Analyst</td>
              <td class="td-num">1</td><td class="td-num">0</td><td class="td-num" style="color:var(--amber)">1</td>
              <td class="td-num td-dim">1F+1W+1Cr+1R</td>
            </tr>
          </tbody>
        </table></div>
        <div class="muted-note">1 Analyst sitting idle &mdash; no Comms Array built yet. Consider a field action or hold for next Comms Array construction.</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><span>&#9635; PARENT COMPANY BONUS STATUS</span></div>
      <div class="panel-body">
        <div class="detail-row"><span class="detail-label">Company</span><span class="detail-value">Unified Mining Consortium</span></div>
        <div class="detail-row"><span class="detail-label">25+ Relations Bonus</span><span class="detail-value td-dim">Strategic Reserve Release (locked &mdash; need 8 more)</span></div>
        <div class="detail-row"><span class="detail-label">30 Universal Bonus</span><span class="detail-value td-dim">Sustained Excellence (locked &mdash; need 13 more)</span></div>
        <div class="bar-track" style="margin-top:10px;"><div class="bar-fill amber" style="width:57%"></div></div>
        <div class="muted-note" style="margin:8px 0 0 0;">17 / 30 toward Sustained Excellence</div>
      </div>
    </div>
  </div>
</div>
`;

// ============================================================
// PAGE: MARKET (Dynamic resource market + subdivision equity)
// ============================================================
PAGES.market = `
<div class="page-header">
  <div>
    <div class="page-title">MARKET</div>
    <div class="page-subtitle">Colony-wide dynamic pricing // peer trade always beats Earth when a buyer is present</div>
  </div>
  <div class="page-meta">Transit Hub network: 2 nodes active</div>
</div>

<div class="section-label">RESOURCE MARKET &mdash; LIVE PRICES</div>
<div class="panel">
  <div class="panel-body tight">
    <div class="table-scroll"><table>
      <thead><tr><th>RESOURCE</th><th class="td-num">BASELINE</th><th class="td-num">LIVE PRICE</th><th>TREND</th><th class="td-num">YOUR STOCK</th><th></th></tr></thead>
      <tbody>
        <tr>
          <td>Minerals</td><td class="td-num td-dim">0.50 Cr</td>
          <td class="td-num" style="color:var(--red)">0.41 Cr</td>
          <td><span class="badge badge-red">&#9660; heavy colony sell pressure</span></td>
          <td class="td-num">194</td>
          <td><button class="btn btn-sm">SELL</button></td>
        </tr>
        <tr>
          <td>Energy</td><td class="td-num td-dim">0.50 Cr</td>
          <td class="td-num">0.52 Cr</td>
          <td><span class="badge badge-dim">&mdash; stable</span></td>
          <td class="td-num">28</td>
          <td><button class="btn btn-sm">SELL</button></td>
        </tr>
        <tr>
          <td>Water</td><td class="td-num td-dim">0.75 Cr</td>
          <td class="td-num" style="color:var(--green-bright)">0.86 Cr</td>
          <td><span class="badge badge-green">&#9650; colony-wide demand</span></td>
          <td class="td-num">39</td>
          <td><button class="btn btn-sm btn-primary">BUY</button></td>
        </tr>
        <tr>
          <td>Food/Bio</td><td class="td-num td-dim">0.75 Cr</td>
          <td class="td-num" style="color:var(--green-bright)">0.91 Cr</td>
          <td><span class="badge badge-green">&#9650; colony-wide demand</span></td>
          <td class="td-num" style="color:var(--red)">22</td>
          <td><button class="btn btn-sm btn-primary">BUY</button></td>
        </tr>
        <tr>
          <td>Research</td><td class="td-num td-dim">1.50 Cr</td>
          <td class="td-num">1.47 Cr</td>
          <td><span class="badge badge-dim">&mdash; stable</span></td>
          <td class="td-num">11</td>
          <td><button class="btn btn-sm">SELL</button></td>
        </tr>
      </tbody>
    </table></div>
  </div>
</div>

<div class="grid-2">
  <div class="panel">
    <div class="panel-head"><span>&#9635; SELL ORDER &mdash; MINERALS</span></div>
    <div class="panel-body">
      <div class="detail-row"><span class="detail-label">Available to sell</span><span class="detail-value">194</span></div>
      <div class="detail-row"><span class="detail-label">Buyer present this turn?</span><span class="detail-value" style="color:var(--green-bright)">YES &mdash; HELIX-09 buying</span></div>
      <div class="detail-row"><span class="detail-label">Peer trade rate</span><span class="detail-value" style="color:var(--green-bright)">0.41 Cr/unit (full price, no discount)</span></div>
      <div class="detail-row"><span class="detail-label">Earth fallback rate</span><span class="detail-value td-dim">0.33 Cr/unit (20% export discount)</span></div>
      <div class="muted-note">Selling to HELIX-09 nets <strong style="color:var(--green-bright)">+0.08 Cr/unit</strong> over routing through Earth. Recommend selling via peer trade this turn.</div>
      <div class="btn-row" style="margin-top:10px;">
        <input type="number" value="40" class="console-input" style="width:90px;min-height:auto;padding:8px;display:inline-block;">
        <button class="btn btn-primary btn-sm">SELL TO HELIX-09</button>
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head"><span>&#9635; EARTH RESUPPLY &mdash; ACTIVE MISSION</span></div>
    <div class="panel-body">
      <div class="muted-note" style="margin:0 0 10px 0;">Cargo run ANNOUNCED Turn 30, arriving Turn 32. Narrative: routine UMC quarterly resupply.</div>
      <div class="detail-row"><span class="detail-label">Water available</span><span class="detail-value">40 units</span></div>
      <div class="detail-row"><span class="detail-label">Import rate</span><span class="detail-value" style="color:var(--amber)">0.86 &times; 1.20 = 1.03 Cr/unit</span></div>
      <div class="detail-row"><span class="detail-label">Cheaper alternative?</span><span class="detail-value td-dim">No peer seller for Water this turn</span></div>
      <div class="btn-row" style="margin-top:10px;">
        <input type="number" value="15" class="console-input" style="width:90px;min-height:auto;padding:8px;display:inline-block;">
        <button class="btn btn-primary btn-sm">BUY FROM EARTH</button>
      </div>
    </div>
  </div>
</div>

<div class="section-label">SUBDIVISION EQUITY MARKET</div>
<div class="panel">
  <div class="panel-head"><span>&#9635; SHARE PRICES &mdash; ALL SUBDIVISIONS</span></div>
  <div class="panel-body tight">
    <div class="table-scroll"><table>
      <thead><tr><th>SUBDIVISION</th><th class="td-num">PRICE</th><th class="td-num">&Delta;</th><th class="td-num">SHARES HELD BY YOU</th><th class="td-num">DIVIDEND/TURN (TO YOU)</th><th></th></tr></thead>
      <tbody>
        <tr>
          <td>HELIX-09</td><td class="td-num">12.85 Cr</td>
          <td class="td-num" style="color:var(--green-bright)">+0.40</td>
          <td class="td-num">0</td><td class="td-num td-dim">&mdash;</td>
          <td><button class="btn btn-sm">BUY</button></td>
        </tr>
        <tr class="you-row">
          <td><strong>RED ROCK 07</strong> <span class="badge badge-cyan" style="margin-left:6px;">YOU</span></td>
          <td class="td-num">9.45 Cr</td>
          <td class="td-num" style="color:var(--red)">-0.18</td>
          <td class="td-num td-dim">N/A</td><td class="td-num td-dim">N/A</td>
          <td><button class="btn btn-sm btn-ghost">BUY BACK</button></td>
        </tr>
        <tr>
          <td>OMEGA-02</td><td class="td-num">12.00 Cr</td>
          <td class="td-num" style="color:var(--red)">-0.22</td>
          <td class="td-num">8</td><td class="td-num" style="color:var(--green-bright)">0.09 Cr</td>
          <td><button class="btn btn-sm">TRADE</button></td>
        </tr>
        <tr>
          <td>GENESIS-11</td><td class="td-num">11.05 Cr</td>
          <td class="td-num" style="color:var(--green-bright)">+0.05</td>
          <td class="td-num">0</td><td class="td-num td-dim">&mdash;</td>
          <td><button class="btn btn-sm">BUY</button></td>
        </tr>
        <tr>
          <td>STELLAR-03</td><td class="td-num">9.75 Cr</td>
          <td class="td-num" style="color:var(--red)">-0.08</td>
          <td class="td-num">0</td><td class="td-num td-dim">&mdash;</td>
          <td><button class="btn btn-sm">BUY</button></td>
        </tr>
      </tbody>
    </table></div>
    <div class="muted-note" style="margin:10px 14px 14px 14px;">Your own share price is down 0.18 Cr this turn &mdash; likely trading pressure from a rival. 12 of your 100 shares are currently held by rivals.</div>
  </div>
</div>
`;

// ============================================================
// PAGE: PROJECTS (active construction / research / requisition queue)
// ============================================================
PAGES.projects = `
<div class="page-header">
  <div>
    <div class="page-title">PROJECTS</div>
    <div class="page-subtitle">Everything under construction, in transit, or pending completion</div>
  </div>
  <div class="page-meta">3 active projects</div>
</div>

<div class="grid-3">
  <div class="stat-block">
    <div class="stat-label">UNDER CONSTRUCTION</div>
    <div class="stat-value">1</div>
    <div class="stat-foot">Completes Turn 32</div>
  </div>
  <div class="stat-block">
    <div class="stat-label">IN TRANSIT FROM EARTH</div>
    <div class="stat-value cyan">1</div>
    <div class="stat-foot">Arrives Turn 33</div>
  </div>
  <div class="stat-block">
    <div class="stat-label">RESEARCH IN PROGRESS</div>
    <div class="stat-value amber">1</div>
    <div class="stat-foot">Self-paced, no fixed ETA</div>
  </div>
</div>

<div class="section-label">CONSTRUCTION QUEUE</div>
<div class="panel">
  <div class="panel-body tight">
    <div class="table-scroll"><table>
      <thead><tr><th>PROJECT</th><th>HEX</th><th>TYPE</th><th>ORDERED</th><th>COMPLETES</th><th>PROGRESS</th><th></th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Extraction Site</strong></td><td class="td-dim">D2</td>
          <td><span class="badge badge-amber">Construction</span></td>
          <td class="td-dim">Turn 31</td><td class="td-dim">Turn 32</td>
          <td style="width:140px;"><div class="bar-track"><div class="bar-fill amber" style="width:70%"></div></div></td>
          <td><button class="btn btn-sm btn-ghost">DETAILS</button></td>
        </tr>
      </tbody>
    </table></div>
  </div>
</div>

<div class="section-label">EARTH SHIPMENTS</div>
<div class="panel">
  <div class="panel-body tight">
    <div class="table-scroll"><table>
      <thead><tr><th>SHIPMENT</th><th>CONTENTS</th><th>ORDERED</th><th>ARRIVES</th><th>COST</th><th>STATUS</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Colonist Requisition #14</strong></td>
          <td>3&times; Engineer, 1&times; Contractor</td>
          <td class="td-dim">Turn 30</td><td class="td-dim">Turn 33</td>
          <td class="td-dim">22 Cr</td>
          <td><span class="badge badge-cyan">IN TRANSIT</span></td>
        </tr>
      </tbody>
    </table></div>
    <div class="muted-note" style="margin:10px 14px 14px 14px;">Earth Relations was at 16 when this was submitted &mdash; under the 4-colonist no-penalty threshold, no Relations cost incurred.</div>
  </div>
</div>

<div class="section-label">ACTIVE RESEARCH</div>
<div class="panel">
  <div class="panel-head"><span>&#9635; FREEFORM RESEARCH &mdash; "DEEP VEIN EXTRACTION ALGORITHMS"</span></div>
  <div class="panel-body">
    <div class="detail-row"><span class="detail-label">Proposed effect</span><span class="detail-value">Extraction Site Boost Output generates +3 Minerals instead of +2</span></div>
    <div class="detail-row"><span class="detail-label">Research cost (host-assigned)</span><span class="detail-value">14 Research</span></div>
    <div class="detail-row"><span class="detail-label">Accumulated so far</span><span class="detail-value" style="color:var(--green-bright)">11 / 14</span></div>
    <div class="bar-track" style="margin:8px 0;"><div class="bar-fill cyan" style="width:78%"></div></div>
    <div class="detail-row"><span class="detail-label">Generating from</span><span class="detail-value td-dim">Research Complex (Hex F2) &mdash; 2 Innovator garrison</span></div>
    <div class="detail-row"><span class="detail-label">Est. completion</span><span class="detail-value td-dim">Turn 33 at current rate</span></div>
    <div class="btn-row" style="margin-top:12px;">
      <button class="btn btn-sm">VIEW RESEARCH LOG</button>
      <button class="btn btn-sm btn-ghost">PROPOSE NEW RESEARCH</button>
    </div>
  </div>
</div>

<div class="section-label">COMPLETED LAST 5 TURNS</div>
<div class="panel">
  <div class="panel-body tight">
    <div class="table-scroll"><table>
      <thead><tr><th>PROJECT</th><th>TYPE</th><th>COMPLETED</th></tr></thead>
      <tbody>
        <tr><td>Tier Upgrade &mdash; Headquarters (Outpost &rarr; HQ)</td><td><span class="badge badge-violet">Tier Upgrade</span></td><td class="td-dim">Turn 28</td></tr>
        <tr><td>Terrain Exploit Module &mdash; Extraction Site (D2)</td><td><span class="badge badge-amber">Module</span></td><td class="td-dim">Turn 26</td></tr>
        <tr><td>Warehouse</td><td><span class="badge badge-amber">Construction</span></td><td class="td-dim">Turn 24</td></tr>
      </tbody>
    </table></div>
  </div>
</div>
`;

// ============================================================
// PAGE 5: STANDINGS
// ============================================================
PAGES.standings = `
<div class="page-header">
  <div>
    <div class="page-title">COLONY STANDINGS</div>
    <div class="page-subtitle">Rolling standings, updated every turn // Turn 24</div>
  </div>
  <div class="page-meta">6 active subdivisions</div>
</div>

<div class="section-label">CATEGORY LEADERS</div>
<div class="category-leader-strip" style="margin-bottom:18px;">
  <div class="leader-chip"><div class="leader-chip-cat">ECONOMIC</div><div class="leader-chip-name">HELIX-09</div></div>
  <div class="leader-chip"><div class="leader-chip-cat">INDUSTRIAL</div><div class="leader-chip-name">RED ROCK MINING 07</div></div>
  <div class="leader-chip"><div class="leader-chip-cat">RESEARCH</div><div class="leader-chip-name">HELIX-09</div></div>
  <div class="leader-chip"><div class="leader-chip-cat">TERRITORIAL</div><div class="leader-chip-name">OMEGA-02</div></div>
  <div class="leader-chip"><div class="leader-chip-cat">SECURITY</div><div class="leader-chip-name">HELIX-09</div></div>
  <div class="leader-chip"><div class="leader-chip-cat">INTELLIGENCE</div><div class="leader-chip-name">HELIX-09</div></div>
</div>

<div class="panel">
  <div class="panel-head"><span>&#9635; FULL STANDINGS</span></div>
  <div class="panel-body tight">
    <div class="table-scroll"><table>
      <thead>
        <tr>
          <th>RANK</th><th>SUBDIVISION</th><th>PARENT CO</th>
          <th class="td-num">ECON</th><th class="td-num">IND</th><th class="td-num">RES</th>
          <th class="td-num">TERR</th><th class="td-num">SEC</th><th class="td-num">INTEL</th>
          <th class="td-num">COMPOSITE</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="rank-badge gold">1</span></td>
          <td><strong>HELIX-09</strong></td>
          <td class="td-dim">Helix Pharmaceutical</td>
          <td class="td-num">28</td><td class="td-num">10</td><td class="td-num">16</td>
          <td class="td-num">8</td><td class="td-num">10</td><td class="td-num">12</td>
          <td class="td-num" style="color:var(--green-bright);font-weight:700;">78.5</td>
        </tr>
        <tr>
          <td><span class="rank-badge silver">2</span></td>
          <td><strong>OMEGA-02</strong></td>
          <td class="td-dim">Omega Security</td>
          <td class="td-num">11</td><td class="td-num">14</td><td class="td-num">5</td>
          <td class="td-num">22</td><td class="td-num">18</td><td class="td-num">6</td>
          <td class="td-num" style="color:var(--green-bright);font-weight:700;">70.0</td>
        </tr>
        <tr>
          <td><span class="rank-badge bronze">3</span></td>
          <td>VERDANT-04</td>
          <td class="td-dim">Terra Agricultural</td>
          <td class="td-num">14</td><td class="td-num">22</td><td class="td-num">8</td>
          <td class="td-num">12</td><td class="td-num">6</td><td class="td-num">4</td>
          <td class="td-num" style="color:var(--green-bright);font-weight:700;">63.5</td>
        </tr>
        <tr>
          <td><span class="rank-badge">4</span></td>
          <td>GENESIS-11</td>
          <td class="td-dim">Genesis Tech</td>
          <td class="td-num">16</td><td class="td-num">9</td><td class="td-num">14</td>
          <td class="td-num">6</td><td class="td-num">5</td><td class="td-num">9</td>
          <td class="td-num">60.5</td>
        </tr>
        <tr>
          <td><span class="rank-badge">5</span></td>
          <td>STELLAR-03</td>
          <td class="td-dim">Stellar Dynamics</td>
          <td class="td-num">19</td><td class="td-num">12</td><td class="td-num">3</td>
          <td class="td-num">9</td><td class="td-num">4</td><td class="td-num">2</td>
          <td class="td-num">47.5</td>
        </tr>
        <tr class="you-row">
          <td><span class="rank-badge">6</span></td>
          <td><strong>RED ROCK MINING 07</strong> <span class="badge badge-cyan" style="margin-left:6px;">YOU</span></td>
          <td class="td-dim">Unified Mining</td>
          <td class="td-num">9</td><td class="td-num">24</td><td class="td-num">1</td>
          <td class="td-num">18</td><td class="td-num">2</td><td class="td-num">0</td>
          <td class="td-num" style="color:var(--green-bright);font-weight:700;">54.5</td>
        </tr>
      </tbody>
    </table></div>
  </div>
</div>

<div class="grid-2">
  <div class="panel">
    <div class="panel-head"><span>&#9635; YOUR TREND &mdash; COMPOSITE SCORE</span></div>
    <div class="panel-body">
      <div style="display:flex;align-items:flex-end;gap:6px;height:90px;">
        <div style="flex:1;background:var(--green-faint);height:62%;border-top:1px solid var(--green-dim);"></div>
        <div style="flex:1;background:var(--green-faint);height:58%;border-top:1px solid var(--green-dim);"></div>
        <div style="flex:1;background:var(--green-faint);height:65%;border-top:1px solid var(--green-dim);"></div>
        <div style="flex:1;background:var(--green-faint);height:60%;border-top:1px solid var(--green-dim);"></div>
        <div style="flex:1;background:var(--green-faint);height:68%;border-top:1px solid var(--green-dim);"></div>
        <div style="flex:1;background:var(--green-faint);height:71%;border-top:1px solid var(--green-dim);"></div>
        <div style="flex:1;background:var(--green-dim);height:74%;border-top:1px solid var(--green-bright);"></div>
      </div>
      <div class="muted-note" style="margin-top:10px;">Turns 25&ndash;31 // steady Industrial growth, flat elsewhere &mdash; Research and Security categories have not moved in 6 turns</div>
    </div>
  </div>
  <div class="panel">
    <div class="panel-head"><span>&#9635; SHARE MARKET &mdash; TOP MOVERS</span></div>
    <div class="panel-body tight">
      <div class="table-scroll"><table>
        <thead><tr><th>SUBDIVISION</th><th class="td-num">PRICE</th><th class="td-num">&Delta;</th></tr></thead>
        <tbody>
          <tr><td>HELIX-09</td><td class="td-num">12.85 Cr</td><td class="td-num" style="color:var(--green-bright)">+0.40</td></tr>
          <tr><td>OMEGA-02</td><td class="td-num">12.00 Cr</td><td class="td-num" style="color:var(--red)">-0.22</td></tr>
          <tr><td>RED ROCK MINING 07</td><td class="td-num">9.45 Cr</td><td class="td-num" style="color:var(--red)">-0.18</td></tr>
          <tr><td>STELLAR-03</td><td class="td-num">9.75 Cr</td><td class="td-num" style="color:var(--red)">-0.08</td></tr>
        </tbody>
      </table></div>
    </div>
  </div>
</div>
`;
