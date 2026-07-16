# DECISIONS.md — Red Planet Corporate

Ambiguity resolutions made by the **spec-analyst** while translating
`docs/master-rulebook.xlsx` into `GAME_SPEC.md`. The rulebook was written for a
human host who exercises judgment ("host discretion"). This engine has **zero AI
at runtime**, so every point of host discretion must be replaced by a concrete,
deterministic rule. Each entry below records an ambiguity/contradiction/silence
in the source, the ruling made, and the reasoning. Downstream agents
(game-engine, backend, frontend, qa-simulator) treat these as binding.

Format: **D-NNN — Title** · *Source* · Ruling · Reasoning.

---

## A. Economy & Market

### D-001 — Dynamic Market vs. flat sell rates (MAJOR contradiction)
*Source: Starting Conditions + Action System (flat rates 3:1 LZ, 2:1 Transit Hub) vs. Dynamic Market System ("Replaces the flat Transit Hub/Landing Zone sell rates").*
**Ruling:** The **Dynamic Market System is authoritative** for *pricing*. Flat
ratios (3:1, 2:1, 1:1) are discarded as pricing rules. However, the **quantity
caps** described alongside the flat rates are retained as throughput limits:
- Landing Zone: colony-wide **15 units/turn**, per-subdivision **6 units/turn**.
- Transit Hub: **10 units/turn** base (+5 per Expansion Module).
- HQ Landing-Zone action: **6 units/turn**.
- Black Market Sale (Corporate Action): **6 units/turn**, bypasses LZ cap, flat 2 Cr fee.
Sale proceeds are computed from the live per-resource price (see GAME_SPEC §11).
**Reasoning:** The Market sheet explicitly says it *replaces* the flat rates; a
spec cannot implement two contradictory pricing systems. Caps are orthogonal to
price and are the only lever preventing infinite single-turn liquidation, so
they are preserved.

### D-002 — Credits and prices are fixed-point, not integers
*Source: Dividend example "0.33 Cr", share price "10.65", live prices "0.4955".*
**Ruling:** All Credits, prices, dividends, and Earth Relations deltas are stored
as **fixed-point integers in units of 1/10000 (0.0001 Cr)** internally.
Display rounds to 2 decimals (round-half-up). Resource stockpiles for the five
physical resources (E/Min/W/F/R) are **non-negative integers**.
**Reasoning:** Determinism forbids binary floats. Sub-credit dividends and prices
demand fractional credits; fixed-point gives exact reproducibility.

### D-003 — Base storage cap exists and is 100 per resource
*Source: Warehouse "+20 storage capacity (all resources)"; Commercial Hub Expansion "increases credit storage cap" — both imply a base cap that is never stated.*
**Ruling:** Base storage cap = **100** for each of the six resources per
subdivision. Warehouse adds **+20 to all six** (per Warehouse, and +20 per
Warehouse Expansion Module). Commercial Hub Expansion Module adds **+50 to the
Credits cap only**. Resources produced/received above the cap are **lost
(wasted)** and reported in the turn report. Credits above cap are also lost.
**Reasoning:** Modules explicitly raise caps, so a finite base cap must exist.
100 comfortably exceeds early stockpiles (25 Min max at start) so it never bites
turn 1, but becomes a real mid-game logistics pressure, which is the evident
design intent.

### D-004 — HQ starting subsidy is flat and permanent (no auto-decay)
*Source: Starting Conditions says both "does not scale — must build income" and "scales down as economy develops".*
**Ruling:** The subsidy (+5 E, +15 Cr, +12 W, +12 F, +3 Min, +0 R per turn) is a
**constant** applied every turn the HQ is operational. It never decays
automatically. Players "outgrow" it because it does not *grow*, not because it
shrinks.
**Reasoning:** "Does not scale" is the mechanically precise statement; "scales
down" is narrative flavor. A flat constant is deterministic; an unspecified decay
curve is not.

### D-005 — Landing Zone selling always routes to Earth at live × 0.80 unless a matched peer buyer exists
*Source: Dynamic Market "Earth vs Peer" table.*
**Ruling:** A `SELL` order names a resource + quantity + optional peer buyer.
Resolution: if a matching peer `BUY` for that resource exists this turn, match at
**full live price** (proportional allocation if oversubscribed, by ascending
subdivision ID); otherwise the sale routes to Earth at **live price × 0.80**.
Buying from Earth requires an active resupply mission and costs **live × 1.20**.
**Reasoning:** Direct restatement of the Market sheet; the tie-break (ascending
subdivision ID) replaces "host allocates by preference" for determinism.

### D-006 — Market price update timing and order
*Source: Price Movement Formula; no explicit phase placement.*
**Ruling:** Net Flow per resource is accumulated during Phase 5/6 trade
resolution. Prices are recomputed **once, at the start of Phase 8**, in fixed
resource order [E, Min, W, F, R], applying: shift → ±15% clamp → 25% reversion →
40%–250% floor/ceiling clamp. The *price used for this turn's trades* is the
price carried in from the previous turn (i.e., trades resolve at the price
standing at turn start; the update reflects this turn's flow for next turn).
**Reasoning:** The worked example computes a post-turn "Live Price (after
reversion)" consumed next turn. Freezing intra-turn price avoids order-dependence
among simultaneous trades.

### D-007 — Equity: 100 fixed shares, price recomputed Phase 8, trades in Phase 5/6
*Source: Subdivision Equity Market.*
**Ruling:** Share purchases/sales are `Trade Action` sub-actions resolved in
Phase 5 at the **anchor price carried from the previous Phase 8** plus this
turn's trading-pressure shift applied *incrementally is NOT done intra-turn*;
instead all equity trades in a turn execute at the pre-turn price, and the new
price (anchor from updated Composite + ±5%/10-net-shares pressure, ±15% clamp,
1 Cr floor) is computed in Phase 8. Dividends are paid in Phase 3 (passive) from
the issuer's Credits: `Economic Score ÷ 20`, split by shareholding, rounded per
D-002; if the issuer cannot afford the full dividend it pays what it can, pro
rata, and the shortfall is skipped (no debt).
**Reasoning:** Mirrors resource-market timing (D-006) for consistency; the
issuer-affordability rule prevents forced negative credits (see D-020).

### D-008 — Administrator passive income and Commercial Hub bonus
*Source: Credit economy layers; Commercial Hub "each Admin within range: +1 Cr".*
**Ruling:** Every Administrator (garrisoned, crewing, or available, anywhere,
including captured? — no, captured units are inert per D-031) generates **+2
Cr/turn** in Phase 3. If the subdivision has **≥1 operational Commercial Hub**,
every Administrator additionally generates **+1 Cr/turn** per Commercial Hub,
capped at **+1 total** regardless of Hub count unless the "Amplify Credit Yield"
action is taken. "Within range" is simplified to **subdivision-wide** (the Hub's
Amplify action text says "subdivision-wide"), so range is not spatially modeled.
Efficiency Modules on the Hub add +1 each to this per-Admin bonus.
**Reasoning:** The rulebook conflates "within range" and "subdivision-wide."
Subdivision-wide is the simpler, self-consistent reading and matches the Amplify
Credit Yield action; spatial range for credits is dropped.

### D-009 — Territory income requires an operational HQ
*Source: "HQ generates +1 Cr per claimed hex per turn."*
**Ruling:** If the subdivision has **≥1 operational HQ** (garrison min met), it
receives **+1 Cr per claimed hex** (Outposts + HQs) in Phase 3. With no
operational HQ, territory income is 0.
**Reasoning:** Direct reading; "operational" defined as garrison-minimum met per
the general operational rule (D-012).

## B. Buildings, Modules, Personnel

### D-010 — Base resource production is passive; "Harvest" action is not additive
*Source: Action System lists Resource Generation as a passive system AND "Harvest Resources" as a declared building action producing "base output".*
**Ruling:** A resource generator meeting its **minimum labor garrison** produces
its **base output (+2)** automatically in **Phase 3 (Passive)**. The "Harvest
Resources/Energy/Minerals/etc." building action is the *same* production and does
**not** stack on top. **Boost Output** (requires a *second full* labor garrison
set) adds **+2** in Phase 4. **Emergency Extraction** doubles that building's
*total* output for the turn (Phase 4) at 25% damage risk. Efficiency Modules add
+1 each (Phase 4 uplift). The Turn-1 burn reference omits generator output
because it illustrates upkeep-vs-subsidy coverage only.
**Reasoning:** The two descriptions are the same event described in two sheets;
treating them as additive would double all production. Passive placement keeps
generation automatic and deterministic.

### D-011 — Concrete numeric effects assigned to all "vague by design" building modules
*Source: Module Glossary + Module Actions (many effects are qualitative).*
**Ruling:** The engine uses the fixed numeric effect table in GAME_SPEC §7.3.
Highlights (all per-module, stacking where Repeatable=Yes):
- Efficiency: **+1** primary output (Commercial Hub: +1 to per-Admin Cr bonus; Warehouse: −1 Cr transfer cost, min 0).
- Operations Director: **+1** primary output **or** −1 on one upkeep line (declared per turn); non-stacking (1 per building).
- Expansion — Habitat **+4** capacity; Transit Hub **+5** sell cap; Comms Array **+1** intel-range hex; Power Facility/Conduit **+1** relay hex (+2 E relayed); Water Reclamation **−1** colony Water upkeep; Commercial Hub **+50** Cr cap; HQ/Outpost enables delivery target (no numeric).
- Terrain Exploit: **+2** output on matching terrain (Rare Minerals hex: +3; Water Reserve hex for Water Reclamation: +4). Terrain Harvest action adds **+3** more with the +2-Engineer specialist crew.
- Personnel Module: requires +2 of the named type; grants **+2** primary output while those 2 are garrisoned.
- Fortification: **+1** defense tier each (needs +1 Contractor each). Security Detail: **+1** defense tier + sabotage protection (needs +1 Contractor). Active Defense action: **+1** tier per Contractor garrison set. Lockdown: total immunity, 3 Cr.
- Automation: **−1** to the building's labor requirement (Engineer/Innovator/Admin), floor **1**; one per building.
- Research Link: **+1** Research to the subdivision pool/turn. Redundant Systems: on a would-disable event, building runs at **50%** output instead of 0.
- Hazard Shield: full immunity to environmental (dust/radiation/seismic/micrometeorite) damage. Command Suite: **+1** effectiveness tier to the assigned unit's actions from that building. Diplomatic Suite: unlocks political actions / Commercial-Hub trade rate → 1.5:1 (implemented as a **+25% credit multiplier** on that subdivision's sells this turn).
- Global Contribution: **+1** Oxygen to an inert colony track (D-034).
**Reasoning:** Vagueness is a host-adjudication convenience incompatible with a
deterministic engine. Values were chosen to match the few concrete numbers the
rulebook does give (Terrain Harvest +3, Optimized Harvest +1, Expansion sell cap
+5, defense tiers +1) and extrapolated conservatively so no single module
dominates.

### D-012 — Definition of "operational" and dormant buildings
*Source: repeated references to buildings being "operational", "staffed", "dormant".*
**Ruling:** A building is **operational** in a turn iff (a) it finished
construction on a prior turn AND (b) its current garrison meets its **minimum
labor requirement** for the primary role (after Automation reductions) AND (c) it
is not disabled by an event/sabotage this turn. A non-operational building still
pays **full upkeep** (Passive system) and produces nothing / enables no actions.
A building whose garrison is unmet for **3+ consecutive turns** is "dormant" and
triggers the Mismanagement event (−2 Earth Relations) and +15% event-target
weight.
**Reasoning:** Consolidates scattered language into one testable predicate.

### D-013 — Personnel upkeep, module/building upkeep are paid; shortfall handling
*Source: Passive systems (upkeep deducted each turn) but no rule for insufficient resources.*
**Ruling:** Phase 3 deducts, in this fixed order: (1) building upkeep, (2) module
upkeep, (3) personnel upkeep, (4) dividends (D-007). Each line is deducted from
the relevant resource pool. If a pool would go negative, see D-019/D-020
(shortfall → attrition/bankruptcy). Deduction order among personnel is ascending
unit ID.
**Reasoning:** A fixed deduction order is required for reproducibility.

### D-014 — Parent company selection: one of two perks + stored bonus; parents are non-exclusive
*Source: Starting Conditions parent table (Option A / Option B / Resource Bonus).*
**Ruling:** At registration a subdivision picks (1) a parent company, (2) one of
its two listed perks (usually a free pre-built building; Omega's are non-building
perks; the free building is placed adjacent to HQ on a claimed hex), and (3)
receives the stored resource bonus added to starting stockpiles. **Multiple
subdivisions may share a parent company.** Player count is variable (2–N);
6 example subdivisions in the dashboard are illustrative.
**Reasoning:** Nothing states exclusivity, and asynchronous PBEM games routinely
allow duplicates; keeping it open maximizes lobby flexibility.

### D-015 — The 2 "Player Choice" starting personnel
*Source: Starting Conditions "Player Choice ×2, chosen at registration".*
**Ruling:** At registration the player picks **any 2** of the five personnel
types. They are added to the starting 10 (total 12? — no): the starting roster is
**Engineer×5, Administrator×2, Contractor×1, plus 2 chosen = 10 total**. Housing
cap 18 leaves 8 vacant.
**Reasoning:** "10 total" is explicit; the 5+2+1 = 8 fixed plus 2 choice = 10.

## C. Turn Processing, RNG, Conflict

### D-016 — Deterministic seeded RNG and consumption order
*Source: Event System "host rolls privately"; Conflict "minor random element" — no seed defined.*
**Ruling:** Each game has a 64-bit `gameSeed`. Per turn, derive
`turnSeed = SplitMix64(gameSeed XOR (turnNumber * 0x9E3779B97F4A7C15))` and drive
a PCG/xoshiro256** stream. RNG is consumed in this exact order:
1. **Phase 4** action-triggered risks (Emergency Extraction damage rolls), iterated by ascending (subdivisionID, hex row-major index, declaration index).
2. **Phase 5** unit-action conflicts (Sabotage, Intercept, spotting, territorial disputes), iterated by ascending (targetSubdivisionID, targetHex, attackerSubdivisionID, attacker declaration index).
3. **Phase 6** political/corporate conflict rolls (e.g., Hostile Acquisition counter-bids), same ordering key.
4. **Phase 7** ambient event: event-trigger roll, then scope roll, then tone roll, then target selection, then per-event sub-rolls (e.g., micrometeorite per-subdivision).
Every random draw is a call to the single turn stream; ordering above is
canonical and MUST NOT change.
**Reasoning:** Reproducibility requires (a) a seed, (b) a fixed stream, (c) a
fully specified consumption order. All host "dice rolls" map onto this stream.

### D-017 — Conflict resolution formula (replaces host judgment)
*Source: Conflict Resolution framework — "large differential deterministic, close differential minor random".*
**Ruling:** For an attacker with investment `A` vs defender investment `D`
(weights in GAME_SPEC §14): let `ratio = A / (A + D)` (D=0 ⇒ ratio=1; A=0 ⇒ fail).
- If `|A − D| ≥ 0.5 × max(A, D)` (a "large differential"): deterministic — attacker succeeds iff `A > D`.
- Else (close): draw `r ∈ [0,1)`; attacker succeeds iff `r < ratio`.
Ties (`A == D`, both >0): treated as close, ratio = 0.5.
Investment weights: Analyst attack = 1/Analyst + 1/Comms-Array-module; Contractor
= 1/each; Security Detail stack = 1/tier; Fortification stack = 1/tier; active
Lockdown = auto-defend (attacker fails); Counter-Intel/Security Sweep = auto-defend.
**Reasoning:** Turns the qualitative "differential" language into a single
testable rule with a 50%-of-max threshold for "large", and uses the seeded stream
for the close case.

### D-018 — Simultaneous conflicting orders on the same target
*Source: Turn Structure "two units same target resolved independently".*
**Ruling:** Each attacking action resolves **independently** against the
defender's **full** investment (defense is not depleted by the first attacker —
"total capacity to respond to multiple threats"). Two Sabotages on one building
each roll separately against full defense. Two subdivisions claiming one unclaimed
hex via Place Outpost in the same turn: **both orders fail** (mutual cancellation)
and neither Outpost is built (costs refunded), unless one is uncontested.
Contested *claimed*-hex disputes use the Territorial Dispute rule (stronger
Contractor+Fortification side holds; ties → no change, incumbent holds).
**Reasoning:** Follows the sheet's explicit independence rule; mutual-cancel for
simultaneous new claims is the fair, order-independent outcome.

### D-019 — Personnel starvation (Food/Water shortfall) → attrition
*Source: silent.*
**Ruling:** If, during Phase 3 personnel-upkeep deduction, the Food **or** Water
pool cannot cover the next unit's upkeep, that unit is **lost** (removed
permanently) and the colony records a Mismanagement-style flavor note (no ER
penalty for starvation specifically). Units are culled in ascending unit ID until
upkeep balances. Energy shortfall for Innovators and Research shortfall for
Analysts follow the same rule (that unit is lost). Culled units vacate their
garrison; buildings may become non-operational as a result **for the next turn**
(this turn's production already computed pre-cull? — no: **cull happens before
production**; a building whose garrison drops below minimum after culling
produces nothing this turn).
**Reasoning:** A colony that cannot feed staff must lose staff; deterministic
ID-ordered culling is reproducible and mirrors the rulebook's "no permanent loss"
exceptions being explicitly *opposite* here (starvation is the one true loss).

### D-020 — Bankruptcy (Credits < 0)
*Source: silent.*
**Ruling:** Credits are clamped at **0**; they never go negative. Any Credit
obligation (upkeep, dividend, action cost) that cannot be fully paid is paid
partially down to 0, and the remainder is **skipped** (the action fails / the
dividend is short-paid per D-007 / upkeep debt is forgiven but the building is
flagged non-operational next turn if its own Cr upkeep went unpaid). A
subdivision at 0 Credits for **3+ consecutive turns** with net-negative Credit
flow is flagged "insolvent" for host/admin attention but is **not** auto-removed.
**Reasoning:** No negative-balance mechanic is defined; clamping at 0 with
action-failure is the least destructive deterministic rule and keeps a struggling
player in the game (rolling standings, no game end).

### D-021 — Invalid / unaffordable orders are rejected atomically
*Source: silent on malformed orders.*
**Ruling:** In Phase 2 every order is validated against **turn-start state**
(affordability, garrison sufficiency, range/adjacency, target existence,
ownership, caps). An order failing validation is **dropped** (no partial
execution, no cost charged) and reported as `INVALID` in the turn report. Orders
that are valid at Phase 2 but become unaffordable due to earlier same-phase
spending resolve in declaration order; the first to run out of a resource
fails and later ones may also fail (greedy, deterministic).
**Reasoning:** Atomic validation prevents half-applied state; declaration-order
greedy spending is deterministic and matches "no submission-order advantage"
only for *conflicts* (which are simultaneous) while intra-subdivision spending is
naturally self-ordered by the player's own list.

### D-022 — Construction/module/vehicle activation timing
*Source: Turn Structure "active starting Turn N+1".*
**Ruling:** Anything built in Turn N (building, module, tier upgrade, vehicle) is
created in a `pending` state during Phase 4/5 and becomes `active` at the **start
of Turn N+1** (before Phase 3 of N+1). It cannot be garrisoned, crewed, produce,
or enable actions during Turn N. Declared garrison for a pending building
auto-applies the turn it activates.
**Reasoning:** Direct restatement.

### D-023 — Colonist arrival, housing overflow, and the housing cap
*Source: Colonist Requisition (ETA 3 turns), Mismanagement (colonists arrive with no housing → −2 ER).*
**Ruling:** Housing capacity is the **sum of building capacities** (HQ 10, Habitat
8 + Expansions). Requisitioned colonists always arrive on schedule into the
**available pool at the HQ hex** in Phase 3. If, after arrival, total personnel >
housing capacity, the subdivision is **over-housed**: the excess (highest unit IDs)
are flagged **unhoused** — they still incur upkeep, **cannot be garrisoned/crewed**,
and each turn over-housed triggers **−2 Earth Relations** (Mismanagement). Building
new housing clears the flag automatically (lowest unit IDs re-housed first).
**Reasoning:** Makes the housing decision meaningful and deterministic while
honoring the explicit "arrive with no housing → −2 ER" trigger.

### D-024 — Earth Relations track mechanics made concrete
*Source: Earth Relations sheet.*
**Ruling:** Start 10, range **[0,30]** clamped. Increases: Resource Export +1 per
cumulative 20 units sold (tracked cumulatively, credited when crossing each
multiple of 20); Research Sharing +2 per submission; Colony Milestone +3 (first
subdivision only, host/admin-declared list in GAME_SPEC §13.3); Consistent Output
+1/turn while the physical-resource net (D-025) has been ≥0 for 3+ consecutive
turns; Earth's Favor event +1. Decreases: Appeal to Earth −3; Emergency Resupply
−1; Large Requisition −1 per 3 colonists above 3 in one action; Mismanagement −2
per event (dormant 3+ turns, or over-housed). Thresholds exactly as sheet (<5, 0,
>20, >25, >25 unlocks parent action, =30 universal bonus). ER updates apply in
**Phase 8** except event-driven ones (Phase 7) and action costs (deducted when the
action resolves in Phase 6).
**Reasoning:** Consolidates and phase-places every ER trigger.

### D-025 — "Consistent Output" / net production definition
*Source: "Positive net resource production for 3+ consecutive turns".*
**Ruling:** Net production for a turn = Σ over the **five physical resources**
{E, Min, W, F, R} of (produced − consumed) this turn, **excluding Credits and
excluding market/trade transfers** (production and upkeep only). ≥ 0 counts as
"positive/maintained"; a single turn < 0 resets the streak.
**Reasoning:** Credits are scored separately (Economic); trades would make the
metric gameable. ≥0 (not strictly >0) treats break-even as maintained, which is
the lenient, intuitive reading of "positive net" for a steady-state colony.

## D. Map, Movement, Spotting

### D-026 — Hex grid geometry and coordinates
*Source: "12×8 hex grid", UI uses "Hex A1"..."Hex L8".*
**Ruling:** Columns **A–L (1–12)**, rows **1–8**; 96 hexes. Layout is
**offset "odd-q" (flat-top) hexes**. Neighbor set for hex (col c, row r):
same-column (c, r−1) and (c, r+1); and for the two adjacent columns c−1, c+1 the
rows depend on column parity — for **even q** (c even): (c±1, r−1) and (c±1, r);
for **odd q** (c odd): (c±1, r) and (c±1, r+1). Out-of-range and Impassable (`~`)
hexes are excluded. Distance uses cube-coordinate conversion (GAME_SPEC §9.2).
**Reasoning:** A concrete, standard offset-hex scheme is required for adjacency,
range, and pathing; odd-q flat-top is a common, well-documented choice.

### D-027 — Movement is free adjacency; Transit Hub is a node-jump network
*Source: Map & Movement.*
**Ruling:** A unit may act at its current hex, an **adjacent** hex (movement is
free and implicit), or — if it is in a hex containing a Transit Hub in its own
network (own hubs + Landing Zone hub) — **any** hub hex in that network, then act
from there (still only adjacency from the arrival hub, i.e., act at the hub hex or
its neighbors — DECISION: **act at the hub hex only**, not the hub's neighbors,
to avoid unbounded reach; adjacency and hub-jump do not compose in one turn).
Difficult terrain (Mountains `M`, Rare Minerals `R`) consumes the full move: a
unit entering one cannot chain further; units arriving via Transit Hub are
unaffected. Impassable is never entered (even Long-Range Propulsion). Vehicle
Upgraded Drivetrain = range 2; Long-Range Propulsion = range 4 (Chebyshev/hex
distance), still blocked by Impassable.
**Reasoning:** The sheet says hub jump lets a unit "act from there"; restricting
to the hub hex itself (no further adjacency) keeps reach bounded and testable.

### D-028 — Spotting checks are integer percentages on the seeded stream
*Source: Closed borders & spotting; worked examples.*
**Ruling:** Spotting chance = clamp(Base 20% + Σ Fortification +10% each on the
target hex and hexes adjacent to a fortified building − 10% if crossing unit is an
Analyst (or vehicle crewed by Analyst), [0%,100%]). Rolled per unit per turn on
the seeded stream during Phase 5 (before the unit's action resolves). On success
(spotted) the unit is **CAPTURED** (removed to a held state, action cancelled,
owner notified). Transit-hub jumps never trigger spotting. Modifiers combine
additively (Analyst −10 and Fort +10s computed independently then summed, per the
worked example giving 30% for Analyst vs 2× Fort).
**Reasoning:** Direct from the worked examples; capture is the explicit outcome.

## E. Vehicles, Combat, Retirement

### D-029 — Vehicle predefined-module effects concretized; custom modules are admin-only
*Source: Vehicle Modules "vague by design", host confirms effect.*
**Ruling:** The engine implements the **predefined** vehicle modules with the
concrete values in GAME_SPEC §8.3 (e.g., Hauling Rig +10 cargo, Light Armament
weapon-investment 1, Plating defense-investment 1, Field Scanner sensor +1 range).
**Custom/freeform** modules are **out of automated scope** — the backend exposes
them only via an admin override that stamps a concrete stat block; the engine
never invents one. Role-matched crew grants a **+1 effectiveness** bonus to the
vehicle's relevant investment; mismatched crew operates at base.
**Reasoning:** Freeform host balancing cannot be automated; predefined modules
get fixed numbers so vehicles are engine-resolvable.

### D-030 — Vehicle combat resolution (open item) uses the conflict formula
*Source: Known Open Item — no vehicle combat table.*
**Ruling:** Vehicle-vs-vehicle and vehicle-vs-building contests use the **D-017
conflict formula** with investment = Σ weapon-module investment (+crew bonus,
+Heavy-hull +1) for the attacker, and defense = Σ Plating/Countermeasures
(+Fortification if target is a building, +Contractor garrison) for the defender.
A losing vehicle is **destroyed** (vehicle + modules lost; crew returns to the
available pool next turn, per the sheet). A losing building is **disabled 1 turn**.
**Reasoning:** The sheet explicitly defers vehicle combat to the general Conflict
Resolution framework; this binds it to the concrete D-017 rule.

### D-031 — Captured units are inert
*Source: Movement — captured units "do not count toward personnel, garrison, or scoring while held".*
**Ruling:** A captured unit is moved to a `captured` roster owned by the captor's
subdivision as a holding record. It generates no income, pays no upkeep, cannot be
garrisoned/crewed by either party, and is excluded from all scoring and housing
counts for both subdivisions until released by a host/admin-recorded resolution
(release/trade/ransom are social; the engine only toggles ownership/free state on
admin instruction).
**Reasoning:** Direct restatement; captured units are frozen data.

### D-032 — Subdivision retirement / abandonment
*Source: brief lists it as an edge case; rulebook silent.*
**Ruling:** On retirement (player leaves), the subdivision is marked `retired`:
its buildings become **derelict neutral ruins** (removed from play; hexes become
**unclaimed** and re-claimable), its personnel and vehicles are **removed**, its
**shares are frozen at their last price and pay no further dividends** (holders
keep the shares as dead assets — no refund), and it is excluded from standings.
Any units it had captured are **released** to their owners. Retirement is an
admin action processed at the start of a turn (before Phase 3).
**Reasoning:** No rule exists; this cleanly removes a player without corrupting
the market (frozen shares) or handing rivals free assets, and returns territory to
contest, matching the rolling-standings ethos.

### D-033 — Personnel / vehicle destruction bookkeeping
*Source: various.*
**Ruling:** Destroyed **vehicles** free their crew to the available pool next turn
(D-030). Units are only ever **permanently lost** via (a) starvation (D-019),
(b) Hostile Acquisition poaching (transferred, not destroyed), or (c) subdivision
retirement (D-032). Sabotage/events **disable buildings** and can make units
**unavailable next turn** (Personnel Dispute) but never destroy personnel. A
building destroyed by Demolish returns 50% of its Mineral cost and reassigns its
garrison to the available pool.
**Reasoning:** Consolidates the rulebook's scattered "no permanent unit loss"
statements with the explicit exceptions.

## F. Scoring, Misc

### D-034 — Inert systems: Oxygen/habitability, Research tech tree, freeform research
*Source: Known Open Items.*
**Ruling:** The Oxygen/habitability track and the tech tree are **tracked but
inert** — Global Contribution increments an Oxygen counter with **no mechanical
threshold effect**; "Apply Research" and tech-gated modules are resolved only via
**admin override** (the engine spends the Research cost the admin stamps and
applies the admin-specified effect). The engine never invents research effects.
The one concrete Oxygen hook — the Colony-Wide event "Atmospheric Processing
Breakthrough" (+1 Bio output) — still fires as a normal event.
**Reasoning:** The rulebook explicitly leaves these unformalized; the engine
exposes them as data + admin hooks rather than inventing balance.

### D-035 — Scoring counters, "season", normalization
*Source: Scoring System.*
**Ruling:** "This season" = whole game; cumulative counters (Credits earned via
sales, Research generated, successful actions, etc.) never auto-reset. Scores are
recomputed every turn in Phase 8 from current state + cumulative counters, using
the exact formulas in GAME_SPEC §12 and weights (1.0 for Economic/Industrial/
Research/Territorial, 0.75 for Security/Intelligence). **Normalization is
disabled by default** (an optional admin action), so composite scores are raw and
reproducible. Ties in ranking broken by ascending subdivision ID.
**Reasoning:** Auto-normalization would be non-deterministic/host-driven; making
it an explicit admin action preserves reproducibility while honoring the option.

### D-036 — HQ "+1 action/turn" interpreted as +1 building-action allowance at HQ
*Source: HQ base production line "+1 action/turn".*
**Ruling:** The HQ grants the subdivision **one extra building-action execution**
per turn that must be spent on an HQ building action (i.e., HQ may take one more
action than its garrison sets would normally allow). It does **not** add unit,
political, or corporate actions.
**Reasoning:** Least-disruptive concrete reading; low balance impact.

### D-037 — Action economy limits
*Source: scattered "1 per garrison set", "1 per turn", "1 per subdivision".*
**Ruling:** Per turn a subdivision may take: unlimited building actions subject to
per-building garrison-set limits (each action consumes one full garrison set of
the required type; surplus sets enable repeats where the action says "per garrison
set"); one Unit Action per **available** (ungarrisoned, non-crewing) unit; exactly
**one Political Action**; exactly **one Corporate Action** (two if ER=30 universal
bonus). Garrisoned/crewing units cannot take unit actions.
**Reasoning:** Consolidates the action-limit language into one rule set.

---

## G. Engine Implementation (game-engine agent)

### D-038 — PENDING→ACTIVE activation and retirement run before Phase 2 validation
*Source: GAME_SPEC §16 places activation "at the top of Phase 3", but Phase 2
validation and the Garrison Phase must see newly-active buildings for [D-022] to
hold ("a thing built in turn N is fully live for all of N+1 including N+1's
production", and its declared garrison auto-applies).*
**Ruling:** At the very start of turn processing — before Phase 2 validation and
before garrison application — the engine (1) processes queued admin retirements
[D-032] and (2) promotes every PENDING building/module/vehicle created last turn
to ACTIVE. Validation and garrison therefore operate on the activated state.
Newly-constructed things (created *this* turn in Phase 4/5) remain PENDING and are
excluded (they cannot act/garrison this turn, per [D-022]).
**Reasoning:** Activation is deterministic and non-discretionary, so hoisting it
ahead of read-only validation changes nothing except making the "fully live in
N+1" guarantee implementable. The §16 "top of Phase 3" wording describes the
turn-boundary write; performing it a few steps earlier is observationally
identical.

### D-039 — Production precedes attrition (GAME_SPEC §16 supersedes the D-019 parenthetical)
*Source: GAME_SPEC §16 Phase 3 step 4 states explicitly "compute production first
(uses current garrison), then upkeep, then attrition", and the cross-phase note
confirms "Attrition (P3f) can drop a building below garrison-min → it produced
this turn if min was met at P3a, but is flagged non-operational for N+1." This
directly contradicts the parenthetical in D-019 ("cull happens before
production").*
**Ruling:** The engine follows GAME_SPEC §16: within Phase 3 the order is
(a) production, (b) research-link/accumulation, (c) income, (d) dividends,
(e) upkeep (building→module→personnel), (f) attrition, (g) streak/dormant
bookkeeping. A unit culled by starvation in step (f) vacates its garrison and may
render a building non-operational for turn N+1, but this turn's production
(computed in step (a) when garrison-min was met) still stands. The D-019
parenthetical "cull happens before production" is treated as superseded; every
other clause of D-019 (Food/Water/Energy/Research shortfall culls units by
ascending id) is retained.
**Reasoning:** GAME_SPEC is the authoritative contract and resolves this exact
ambiguity in two places; honoring it keeps a single, testable ordering.

### D-040 — Persistent module output bonuses are applied in Phase 3; only declared actions are Phase-4 uplifts
*Source: GAME_SPEC §7.3 header says "Output computation (per building, per turn,
Phase 3+4)"; D-010 loosely calls Efficiency "+1 each (Phase 4 uplift)".*
**Ruling:** A building's passive per-turn output — base table value plus all
persistent output-boosting modules (Efficiency, Operations Director in OUTPUT
mode, Personnel Module with its named units garrisoned, Terrain Exploit on
matching terrain) — is computed and added to stockpiles in **Phase 3** for every
operational building. Research Link adds +1 R to the subdivision pool in Phase 3.
Only **declared building actions** (Boost Output +2/surplus set, Research Sprint
+2, Emergency Extraction ×2 with damage roll, Terrain Harvest +3) are Phase-4
uplifts. Emergency Extraction doubles the building's *total* output for the turn,
implemented in Phase 4 as an additional payout equal to the Phase-3 passive amount
(net ×2) plus any Phase-4 boosts, per §7.3.
**Reasoning:** Modules are passive systems, so they belong with passive production
(Phase 3); D-010's "Phase 4 uplift" phrasing was describing that Efficiency stacks
on the base, not mandating a phase. Since Phase 3 precedes Phase 4 spending, the
placement only matters at storage caps, where applying persistent bonuses first is
the natural reading.

### D-041 — Test runner is Vitest; package layout is an npm workspace with packages/engine
*Source: brief leaves the choice to the engine agent.*
**Ruling:** The engine lives in `packages/engine` (package name `@rpc/engine`),
exported via `exports["."]` (built `dist`) and `exports["./src"]` (raw TS for
same-repo importers). The repo root is an npm workspace (`workspaces:
["packages/*"]`) so the future Next.js backend can be added as a sibling package.
Tests use **Vitest** (fast, ESM-native, zero-config TS). The engine has zero
runtime dependencies — the seeded RNG (SplitMix64 + xoshiro256**) and fixed-point
money are implemented in-house.
**Reasoning:** Vitest matches the brief's recommendation and needs no Babel/ts-jest
plumbing; a workspace keeps engine/backend cleanly separated while sharing one
lockfile.

---

*End of DECISIONS.md (D-001 – D-041). Append new decisions as later phases surface
gaps; never renumber existing entries.*
