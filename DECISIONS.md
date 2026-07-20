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

### D-042 — Durational effects, Redundant-Systems floor, and wiring the remaining trade/vehicle/political actions
*Source: GAME_SPEC §7.3 (Redundant Systems), §9 (movement/Transit Hub), §11.3
(equity), §10.3/§14 (unit & political actions), §17 (multi-turn event modifiers).
These were previously logged as notifications only; this decision makes them
mechanical. Referenced in code as `[D-042]`.*
**Ruling (umbrella; each sub-point is the smallest sensible reading):**
(a) **Durational status effects.** A single generic list `game.activeEffects`
holds `ActiveEffect`s registered (usually by Phase 7) with a `turnsRemaining`
count and a `registeredTurn`. Effects are read where they bite — Phase 3/4
production (`OUTPUT_DELTA`, `MODULE_HALF_EFFECT`, `TERRAIN_EXPLOIT_SUSPEND`) and
Phase 5/validation (`NO_INTELLIGENCE`) — and ticked in Phase 8 *before* the turn
number increments. An effect is **not** ticked on the turn it was registered, so a
duration-N effect applies to the next N production phases (Dust Storm N=2, Solar
Flare / Seismic / Equipment Recall / Ice Deposit Shift N=1). Scope is
COLONY/SUBDIVISION/REGION/BUILDING with optional `requiresUnshielded` (Dust Storm
ignores Hazard-Shield buildings) and `requiresNoRedundant` (Seismic ignores
Redundant-Systems buildings) predicates.
(b) **Redundant Systems 50% floor (§7.3).** A building that *would* be operational
(built on a prior turn, garrison-min met, ACTIVE) but is `disabledUntilTurn`
this turn runs at **50% output rounded down** — instead of 0 — if it carries an
active Redundant Systems module. The floor also halves that building's
Research-Link pool contribution. Any other non-operational reason (DERELICT,
garrison unmet, built this turn) still yields 0.
(c) **Equity Trade Action (§11.3).** Modelled as an Administrator unit action
resolved in Phase 5 sub-step 1 at the **pre-turn (frozen) share price**. BUY draws
shares from the issuer's own retained treasury and pays Credits into the issuer's
treasury; SELL returns shares to the issuer treasury and the issuer buys them back
from its Credits (capped by what it can afford, per D-020). Each trade adjusts
`netSharesTradedThisTurn` for the Phase 8 price recompute. If treasury shares /
buyer Credits / seller holdings are insufficient the order is a logged no-op.
(d) **Vehicle Move & Attack (§9/§14, D-030).** Move validates a crewed ACTIVE
vehicle and a reachable destination: adjacency within `vehicleMoveRange` (max of
hull base and active Mobility modules), or a free node-jump between any two hexes
in the subdivision's Transit-Hub network (own active hubs + Landing Zone, per
D-027). IMPASSABLE and unaffordable difficult terrain are blocked. Moving onto a
hex owned by a rival with a **closed border** against the mover triggers a spotting
roll on the seeded stream in Phase 5 sub-step 2 (base 20%, +10% per Fortification
on the hex, −10% if the vehicle is Analyst-crewed); if spotted the move is
cancelled at origin, otherwise it proceeds. Attack requires the target vehicle /
building to be at range ≤ 1 and resolves through the standard §14 conflict formula
using `vehicleWeaponInvestment` vs `vehicleDefenseInvestment` / building defense
(Contractors + Security Detail + Fortification, auto-defend honoured). A destroyed
vehicle frees its crew back to AVAILABLE next turn (D-033).
(e) **Remaining unit/political actions.** *Patrol* (Contractor) logs a report of
rival buildings within range 1 of the patrolled hex. *Negotiate* (Administrator)
is a recorded social action. *Lobby* (Administrator) adds weight to an active
motion at 3 Cr/vote. *Enforce Territory* (Contractor) is a deterministic §14.2
territorial dispute — Σ(attacker Fortification +1) vs Σ(incumbent Contractors +
Fortification + Security Detail on the hex); strictly-greater attacker seizes the
hex, ties hold for the incumbent, no RNG. *Counter-Intel* (Analyst, 2 Cr) and
*Lockdown* (building action requiring a Security Detail module, 3 Cr) both add the
building to `scratch.autoDefendBuildings`, which makes any Sabotage / Intercept /
Vehicle-Attack against it auto-fail this turn.
**Reasoning:** A single generic effect list keeps event modifiers mechanically
enforced without bespoke flags per event, and centralising the read points means
Phase 3/5 stay the single source of truth. The trade/vehicle/political rulings pick
the least-surprising interpretation where §11.3/§14 leave counterparties, sourcing,
or tie-breaks unstated, and reuse the existing conflict/movement/equity helpers so
no new resolution math is introduced.

---

## H. Backend / Server (backend agent)

### D-043 — Submission-time validation reuses the engine (new `validateSubmission` export)
*Source: brief requires validating orders "at submission time and again at
resolution" without reimplementing game logic; the engine only exported
`resolveTurn`.*
**Ruling:** The engine gains one minimal export, `validateSubmission(state,
submission): InvalidOrder[]`, plus an extracted, exported `prepareTurnStart(ctx,
admin)` (the start-of-turn retirement/activation/arrivals/housing block hoisted
out of `resolveTurn`). `validateSubmission` clones the state, runs
`prepareTurnStart`, snapshots turn-start resources, and calls the engine's own
`validateGarrisonPhase` → `applyGarrison` → `validateActionsPhase`, returning the
`InvalidOrder`s for that submission. The backend calls this at submission; the
full Phase-2 validation runs again inside `resolveTurn` at resolution. No
validation logic is duplicated in the server.
**Reasoning:** Reusing the engine's real validation is the only way to keep
submission-time and resolution-time checks identical. Extracting
`prepareTurnStart` makes the pre-validation state match resolution exactly (a
building built last turn is seen ACTIVE). Engine tests remain green (81).

### D-044 — Auth is a custom signed-JWT session, not NextAuth
*Source: brief says "NextAuth or equivalent".*
**Ruling:** Sessions are stateless HS256 JWTs (via `jose`) in an httpOnly,
SameSite=Lax cookie (`rpc_session`); passwords are bcrypt (cost 12); password
resets use a random token whose SHA-256 hash is stored with a 1-hour expiry. The
token carries only `{ sub: userId }`; role, approval status, and subdivision
ownership are **always re-read from the DB per request**, so a revoked/downgraded
user cannot act on stale claims. Password-reset email delivery is out of scope
(the request endpoint returns the token directly in non-production).
**Reasoning:** The app needs bespoke pending-approval and admin-assignment flows
that are simpler and more auditable with owned primitives than NextAuth's
adapters; re-reading authz from the DB every request is the safer default.

### D-045 — Snapshot-authoritative persistence with read-only projections
*Source: brief requires both a normalized schema (subdivisions/buildings/…/active
effects) AND lossless round-trip into the engine's `Game` types.*
**Ruling:** The **authoritative** state is the serialized engine `Game` stored on
`Game.stateJson`. Round-trip is `deserializeGame(stateJson) → resolveTurn → new
Game → serializeGame`; the only non-JSON values (bigint seed, two `Set`s) are
converted explicitly. The per-entity tables (`SubdivisionState`, `BuildingState`,
`ModuleState`, `PersonnelState`, `VehicleState`, `HexState`, `MarketPriceState`,
`EquityPriceState`, `EquityHoldingState`, `ActiveEffectState`) are **read-only
projections rebuilt from the snapshot after every resolution/edit**; nothing
writes gameplay through them. Turn logs are immutable (`TurnLog`, unique per
`gameId+turnNumber`).
**Reasoning:** The engine owns the canonical, deeply-nested shape; mirroring it
bidirectionally in SQL would risk divergence and break determinism. Snapshot =
truth guarantees clean round-trip; projections satisfy the relational/queryable
requirement without becoming a second source of truth.

### D-046 — Admin manual events & direct edits are STRUCTURED data authored onto the snapshot
*Source: brief requires "manually trigger any event type" and "directly edit game
state" while never reimplementing engine logic; the engine's `AdminActions` hook
only supports retirement.*
**Ruling:** Retirements flow through the engine's `AdminActions.retireSubdivisionIds`
(queued in `AdminQueuedAction`, applied at the next resolution — [D-032]). All
other admin actions (manual events, direct state edits) are expressed as a fixed
set of **structured ops** (`SET_RESOURCE`, `ADD_RESOURCE`,
`SET/ADJUST_EARTH_RELATIONS`, `DISABLE_BUILDING`, `SET_HEX_OWNER`, `SET_OXYGEN`,
`ADD_MILESTONE`, `REGISTER_EFFECT`, `RELEASE_CAPTIVE`) applied to the engine
snapshot as **data**, then persisted + re-projected; the engine computes every
consequence on the next resolution. A "manual event" is just the structured
effect(s) that event would produce (e.g. Dust Storm = `REGISTER_EFFECT
OUTPUT_DELTA/COLONY -1 requiresUnshielded, 2 turns`). `REGISTER_EFFECT` defaults
`registeredTurn = turnNumber - 1` so the effect bites the very next resolved turn
for `turnsRemaining` turns (per the tick rule in [D-042]). Every manual change is
written to the `AuditLog` (before/after).
**Reasoning:** Authoring `ActiveEffect` records / resource numbers is data entry,
not game logic — the engine still derives all outcomes. A closed op set keeps
"free-text effects" impossible while covering every event's mechanical result.

### D-047 — Freeform research adjudication grants structured effects only
*Source: brief — player submits text proposal; admin grants stat modifiers/unlocks
through structured fields, never free-text effects. Aligns with [D-034].*
**Ruling:** A player POSTs a `ResearchProposal` (free text). An admin resolves it
APPROVED/REJECTED; on approval the admin attaches `grantedEffects` — an array of
the same structured ops as D-046 (e.g. `ADD_RESOURCE`, `REGISTER_EFFECT`,
`SET_OXYGEN`) — which are applied via the audited edit pipeline. The proposal
text is never executed; the granted structured effects are stored on the proposal
and in the audit log.
**Reasoning:** Matches [D-034] (research effects are admin-stamped, engine never
invents them) and the brief's structured-effect-editor requirement.

### D-048 — Seed creates six parent-distinct subdivision slots; approval assigns a slot
*Source: brief seed = "fresh 6-player game"; [D-014] registration choices vs.
`makeGame` needing choices up front.*
**Ruling:** The seed builds one game via `makeGame` with **six subdivision slots**,
one per parent company (§5), perk A, generic names, default choice-personnel.
Registration captures the player's *preferences* (parent/perk/personnel/name) as
advisory fields. On approval the admin assigns the user to a slot
(`SubdivisionAssignment`, unique per user and per game-slot); admins may match the
player's requested parent or use the structured state-edit tools to reconfigure.
Players are variable in number (up to 6); unassigned slots simply run on default
"repeat garrison, no actions" until assigned or retired.
**Reasoning:** `makeGame` requires parent/perk at creation, so a ready 6-slot game
plus admin slot-assignment is the cleanest reconciliation of "fresh 6-player seed"
with per-player registration choices, and keeps [D-014]'s non-exclusive,
admin-assigned model intact.

### D-049 — Client label humanization also splits camelCase keys
*Source: QA of the private report's "Cumulative Counters" panel, which renders
engine counter keys (`researchGenerated`, `successfulIntercepts`, …) via the shared
`titleCase` helper.*
**Ruling:** `titleCase` (in `src/lib/client/labels.ts`) inserts a space at each
lower→upper boundary before splitting on `_`/whitespace, so camelCase engine keys
display as readable words ("Research Generated") rather than run-together text
("Researchgenerated"). This is display-only; the raw keys are never sent back to
the API, and ALL_CAPS enum values (building/action/hull types) are unaffected since
they contain no lower→upper transitions.
**Reasoning:** The engine emits counter keys in camelCase with no display labels of
their own; humanizing them client-side keeps the report legible without inventing
any game data or per-key label tables.

---

## I. Intelligence-Gated Visibility & Square Map (spec-analyst extension)

Player-requested new mechanic (post-rulebook): a square-grid map with per-opponent,
intelligence-gated tile visibility. Specified in GAME_SPEC §21. These extend the
same binding contract; they **supersede/refine** the cited map/visibility clauses of
categories D and F.

### D-050 — Square grid (12×8) with 8-directional Chebyshev adjacency replaces odd-q hexes
*Source: user request to change the map from hexagons to a grid of squares;
supersedes the geometry of [D-026] and the adjacency of [D-027]. GAME_SPEC §21.1–2.*
**Ruling:** The map becomes a **12×8 = 96-tile square grid** (same tile count and
`col 1..12 / row 1..8` bounds as the old hex map, to avoid disrupting map-size
assumptions elsewhere). The `HexCoord {col,row}` / `Hex` types and `rowMajorIndex`
are **retained by name** (read as "tile") to minimise churn. Adjacency is
**8-directional (Moore neighbourhood)**: `neighbors` = the up-to-8 cells with
`Δcol,Δrow ∈ {-1,0,1}` minus self, filtered in-bounds; distance is **Chebyshev**
`max(|Δcol|,|Δrow|)`, replacing the cube `hexDistance`. All §9 *rules* (free-adjacency
movement, Transit-Hub node-jumps, difficult-terrain full-move consumption, Impassable
blocking, vehicle ranges 2/4, Patrol/Enforce/Vehicle-Attack range ≤1, Fortification
"tile + adjacent" spotting) are unchanged — they simply read the new neighbor set and
metric. **Terrain is a straight reskin:** the `Terrain` enum and every §9.1 terrain
effect are unchanged; each tile keeps its terrain.
**Reasoning:** 8-dir Chebyshev is the square analogue that preserves omnidirectional
(diagonal) connectivity closest to hex's 6-neighbour feel and is already the metric
named for vehicle range in [D-027]; 4-dir (von Neumann) would remove diagonal
movement and shrink range-2 reach to a 12-tile diamond, a larger balance change than
Chebyshev's modest widening (distance-1: 8 vs old 6; distance-2: 24 vs old 18).
Keeping tile count, bounds, coordinate type, and terrain identical makes this a
reskin, not a redesign. The reach delta is logged for QA (spotting frequency,
vehicle range); `INTEL_TIER_*` and existing ranges remain the balance levers.

### D-051 — Espionage/opsec formula, starting values, live recomputation, and tier thresholds
*Source: user request for `intelScore = espionage/(espionage+opsec)` with named tier
constants and a hard "equal start ⇒ Low" invariant; grounding left to spec-analyst.
GAME_SPEC §21.3–4.*
**Ruling:** Espionage and opsec are **recomputed live every turn from current state**
(no stored accumulators — simpler, always consistent, no drift; matches the engine's
pure-function style). Grounded in the entities the §14.2 conflict math already uses:
`espionage = 1 (base) + 1·#Analysts + 1·#active SensorArray + 1·#active CommsArray
buildings + 1·#active CommandSuite-on-CommsArray`; `opsec = 1 (base) + 1·#Contractors
+ 1·#active SecurityDetail + 1·#active Fortification`. Personnel counted are active
roster (`status ∉ {CAPTURED, LOST, UNHOUSED}`); modules/buildings counted are
`ACTIVE`. Tier thresholds are named constants `INTEL_TIER_LOW_MAX = 0.60`,
`INTEL_TIER_MEDIUM_MAX = 0.75`, `INTEL_TIER_HIGH_MAX = 0.90`, evaluated by **exact
integer cross-multiplication** (`2e<3o`→LOW, `e<3o`→MEDIUM, `e<9o`→HIGH, else FULL)
so no floats are introduced ([D-002]/[D-016]).
**Start-invariant verification:** default roster gives every viewer `espionage = 1`
and every target `opsec = 1 + 1 (starting Contractor) = 2` → `intelScore = 0.333 →
LOW`, with `espionage (1) ≤ opsec (2)`. Worst symmetric parent case (Genesis's free
Comms Array) is `2/2 = 0.5 → LOW`, `espionage = opsec` (not exceeding). Hence every
player starts LOW against everyone and *equal espionage/opsec ⇒ 0.5 ⇒ LOW*. A
deliberate 2-Analyst *choice*-personnel opening can reach `3/2 = 0.6 → MEDIUM` vs a
bare target (intended, reveals only a building count); the documented rebalance lever
is raising `INTEL_TIER_LOW_MAX`, exactly the fallback the directive offered.
**Reasoning:** Reusing Analyst/Contractor headcount and the existing intel/defensive
modules keeps the new stats coupled to real investments the player already makes
(and that already feed Sabotage/defense), rather than inventing parallel counters. A
symmetric base of 1 avoids 0/0, keeps higher tiers reachable, and guarantees the
default start sits safely at 0.333 (below 0.60) while honouring the equal-values-⇒-0.5
property that the ratio formula gives for free.

### D-052 — Intel level is derived per (viewer,target) pair on demand, never stored, global per opponent
*Source: user requirement that intel is per-opponent (one level for all their tiles);
storage left open. GAME_SPEC §21.5.*
**Ruling:** `intelTier(viewerId, targetId)` is a **pure derived function of current
state**, computed on demand (Phase 8 report generation or any live query) and **never
stored** on `Subdivision`/`Game` or persisted. The single computed tier applies to
**all** of the target's tiles (global per opponent, not per tile). Self is always
"OWN" (full detail); a RETIRED target has no tiles and yields no view.
**Reasoning:** Deriving on demand is the simplest model, cannot drift, adds no new
serialized fields, and matches the snapshot-authoritative persistence rule ([D-045])
where the engine `Game` is the single source of truth and projections are rebuilt,
not written through.

### D-053 — Gated tile-view data shape per tier
*Source: user gave the four tiers' reveal levels; exact field membership left to
spec-analyst. GAME_SPEC §21.6, refines §18 [F].*
**Ruling:** The map level shows **only HQ/Outpost icons** (plus public
terrain/owner/closed-border status); all other building detail is delivered through a
gated `TileView`. A "building on the tile" for counting = `status ∈ {ACTIVE, PENDING,
DISABLED}` (excludes DERELICT ruins). "Units on the tile" = personnel
`GARRISONED`/`CREWING` physically on the tile + vehicles on the tile. Additive reveal:
**LOW** = public fields only (nothing private); **MEDIUM** = `+buildingCount` (includes
disabled/pending and the HQ/Outpost already iconned, excludes DERELICT); **HIGH** =
`+buildings[]` (BuildingType list, id-ordered, duplicates shown) and aggregate
`+unitCount`; **FULL** = `+resourceOutput` (per-building passive primary output per
§7.3/[D-040] — capacity, **not** stockpiles) and `+units` as **type/hull counts
only**. Individual personnel `id` and vehicle module loadouts are **never** exposed by
the intel tier (still only via Enhanced Surveillance/Corporate Audit/Patrol per §18).
Own tiles (`OWN`) are always full detail.
**Reasoning:** Counting non-DERELICT structures keeps the number truthful without
leaking removed ruins; capping FULL at type/hull counts (not identities/loadouts)
preserves the value of the dedicated point-in-time intel actions so the standing
tier and the active intel toolkit remain complementary rather than redundant.
Exposing computed output (capacity) but not stockpiles keeps §18's "stockpiles are
private" intact.

### D-054 — Spotting and intel tiers are separate, non-interacting systems; closed borders stop gating visibility
*Source: user asked to resolve the overlap between existing spotting/closed-border
mechanics (§14.4) and the new standing intel tiers. GAME_SPEC §21.7, refines §14.4/§18.*
**Ruling:** Spotting ([D-028]) and intel tiers ([D-051–053]) are **fully decoupled**:
neither reads the other, intel tier does **not** modify spotting chance, and spotting
does **not** modify intel tier. Spotting remains a defender-side, RNG, point-in-time
**capture** event on a **closed**-border crossing (now 8-dir); intel tier remains a
viewer-side, deterministic, standing **visibility** level. **Closed borders no longer
gate tile-content visibility** — that is now solely the intel tier's job; a viewer
sees a target's tiles at their intel tier regardless of border open/closed status.
Closed borders keep only their §14.4 role (trigger movement spotting/capture) and
their public-status role (§18).
**Reasoning:** Analyst and Contractor already influence each system through its own
channel (spotting's ±10% terms vs the §21.3 weights); letting them cross-modify would
double-count the same units. Moving visibility-gating off border status and onto the
explicit intel tier removes the previously-silent overlap between §18's implicit
border-hiding and the new mechanic, leaving one authoritative gate for "what can I see"
and one for "did my intruder get caught."

### D-055 — Tile-view edge cases the spec left implicit (unclaimed/off-map/RETIRED, output keying)
*Source: game-engine agent, implementing §21.6 `getGatedTileView`. §21 is fully
worked out for owned/opponent tiles but silent on a few boundary cases the pure
function must still return a value for. Smallest sensible rulings, per the
build directive.*
**Ruling:**
- **Unclaimed tiles** (`hex.ownerSubdivisionId == null`) return only the public
  fields (`terrain`, `owner=null`, `isLandingZone`, `hasHQ=false`, `hasOutpost=false`)
  with `intelTier = "LOW"`. There is no opponent to derive a tier from and no
  private content exists, so LOW (reveals nothing private) is the truthful floor.
- **RETIRED-owner tiles** are treated as unclaimed here (per [D-032] a RETIRED sub's
  hexes unclaim and buildings go derelict, so in practice `owner` is already null;
  the guard is defensive).
- **Off-map coords** (`getHex` miss) return `null` — the caller passed a coordinate
  outside the 12×8 bounds.
- **`resourceOutput` keying (FULL/OWN):** the per-tile output map sums each standing
  building's Phase-3 passive output (§7.3/[D-040]) under its primary `ResourceType`,
  and additionally folds any Research-Link module bonus into `RESEARCH` (it is
  genuine per-turn research capacity). Stockpiles (`CREDITS`/resource pools) are
  never included — §18 keeps those private.
- **Map-level projection.** A distinct `getMapView(viewer, game)` returns one
  public `MapTileMarker` per tile (terrain/owner/HQ/Outpost icons + tier) and never
  carries building lists, counts, or outputs — enforcing the §21.5 "only HQ/Outpost
  render at the map level" split. Full building detail is only ever delivered by
  `getGatedTileView` on tile inspection.
**Reasoning:** Each case is forced by the pure-function contract (it must return a
typed `TileView`/`null` for every input). LOW-for-unclaimed avoids inventing a new
enum value beyond the spec's `"OWN"|LOW|MEDIUM|HIGH|FULL` while never leaking
anything; folding Research-Link into RESEARCH keeps `resourceOutput` a faithful
"per-turn productive capacity" picture without exposing stockpiles.

---

## J. Unit Attention & Action Availability (spec-analyst extension)

Player-requested new mechanic (post-rulebook): every unit has one unit of
**attention** per turn; taking an action spends the attention of the unit(s) that
action requires, and a spent unit backs no further action until attention resets
next turn. This is the single mechanism that stops a player re-running the same
action all turn on the same unit. Specified in GAME_SPEC §22. These extend the same
binding contract and refine the §10 action tables and §16 turn structure.

### D-056 — Per-unit attention field & end-of-turn reset
*Source: GAME_SPEC §22.1; player-requested unit-attention-economy mechanic — the
rulebook has no per-unit action budget. New field on Personnel.*
**Ruling:** Add `attentionSpentThisTurn: boolean = false` to `Personnel` (§3.5 /
`types.ts`). `false` = unspent (unit can still back an action); `true` = spent. All
new personnel (starting roster, requisition arrivals, colonist processing) start
`false`. **Reset** happens in **Phase 8 as a new step 5c** (after `tickEffects`,
*before* `turnNumber += 1`): set `attentionSpentThisTurn = false` for **every** unit
of **every** subdivision regardless of `status` (CAPTURED/LOST units are simply never
read). Attention is **not** a §2 resource — never bought, sold, scored, carried over,
or stockpiled; it is purely an intra-turn action-budget flag persisted on the
snapshot like `status` / `unavailableUntilTurn`.
**Reasoning:** Placing the reset at end-of-turn (not start) keeps Phase 1/2 of turn
N+1 reading an already-clean board; a boolean persisted like the existing status
fields needs no new machinery and cannot drift.

### D-057 — Attention closes the duplicate-unit Phase-2 gap; type+count requirements, lowest-id tie-break
*Source: GAME_SPEC §22.2–22.4; the pre-existing Phase-2 gap where N Sabotage orders
could all name the same lone Analyst.*
**Ruling:** An accepted action spends the attention of the unit(s) it **requires**.
Requirements are **type + count, never specific IDs** (matching how `garrisonMin`
already works, §7/[D-012]): a **unit action** requires exactly the actor
`order.unitId` (count 1); a **building action** requires the row's `count` of that
building's garrisoned units of the named type. When more qualifying units have
unspent attention than needed, spend the **lowest-`id`** ones (canonical with
[D-016]/[D-018]) via `selectAttentionUnits`. Phase 2 (`validateActionsPhase`) carries
a per-subdivision working set `claimed: Set<unitId>` seeded empty, validates orders
in **declaration order** ([D-021]), reserves the picked ids in `claimed` so a later
order cannot reuse them, and records them on the accepted order; Phase 4/5 then set
`attentionSpentThisTurn = true` on exactly those recorded ids, so execution never
double-spends. Result: five Sabotages naming one Analyst yield **one** accepted order
(first in declaration order) and four `INVALID: insufficient unspent attention`
rejections.
**Reasoning:** Type+count with an id-ordered tie-break reuses the engine's existing
garrison and ID-ordering conventions rather than inventing per-ID targeting; claiming
against turn-start state makes it intra-subdivision, RNG-free, and invariant to
inter-subdivision resolution order, which is exactly what closes the duplicate-unit
bug deterministically.

### D-058 — Garrison assignment / crewing does not spend attention
*Source: GAME_SPEC §22.6; silence on whether stationing a unit is itself an action.*
**Ruling:** Phase-1 garrison assignment (stationing a unit in a building, crewing a
vehicle, or leaving it AVAILABLE) is **presence/stationing, not an action**, and
spends **no** attention. A unit garrisoned this turn keeps full unspent attention and
can back a building action that **same** turn (subject to the building being
operational and not built-this-turn, [D-022]). Attention is spent **only** by an
accepted building/unit (or future unit-bound political/corporate) **action order** in
Phase 2/4/5/6.
**Reasoning:** Stationing is a state change, not an action; charging attention for it
would wrongly forbid a freshly-garrisoned unit from ever acting the turn it takes up
its post, which no rule intends.

### D-059 — Attention is turn-global; political/corporate actions are attention-neutral today
*Source: GAME_SPEC §22.2/22.5; the current `PoliticalActionOrder` /
`CorporateActionOrder` schemas carry no `unitId`.*
**Ruling:** Attention is a property of the **unit for the whole turn**, not scoped to
a phase or a building: a unit spent by **any** accepted order is unavailable to
**every** other attention-gated order that turn, across building, unit, political, and
corporate classes and across all buildings. Political and corporate actions bind
**no** `unitId` in the current schema, so they require no unit and spend no attention
— they are limited **solely** by their 1-per-subdivision-per-turn caps (§10.4/§10.5).
If a future political/corporate action is made unit-bound (adds a required
`unitId`/type), it participates in the **identical** turn-global exclusion: that unit,
once spent politically, cannot then take a building/unit action the same turn, and
vice-versa.
**Reasoning:** Turn-global scope is the only reading that actually prevents an
all-turn repeat of an action on one unit; fixing the principle now keeps any future
unit-bound political action consistent without a schema-driven special case, even
though no current entry exercises it.

### D-060 — Multi-group and crewed actions spend all required units atomically; one crewed action per vehicle per turn
*Source: GAME_SPEC §22.2/22.3/22.7; multi-type building requirements and crewed
`VEHICLE_MOVE` / `VEHICLE_ATTACK`.*
**Ruling:** An action with multiple `(type,count)` requirement groups (e.g. a
hypothetical `2 Engineer + 1 Contractor`) runs `selectAttentionUnits` once per group;
it is offered/valid **only if every group succeeds**, and taking it spends **all**
selected units **atomically** — if any group fails the whole order is rejected and
**no** attention is spent. **Vehicle** actions require the vehicle's **entire crew**
(`v.crew`): offered only if every crew member has `attentionSpentThisTurn == false`,
and executing spends the attention of **all** crew, gating a vehicle to **one** crewed
action per turn using the same all-crew rule as personnel (no separate per-vehicle
flag). Crew are CREWING (already barred from personnel unit actions, [D-037]);
attention additionally prevents two vehicle orders from sharing one crew.
**Reasoning:** All-or-nothing atomic spend avoids partially-charged rejected orders
(no attention leaks on a rejected multi-group action); treating the whole crew as the
required unit set reuses the personnel attention rule so vehicles need no new
per-vehicle bookkeeping.

### D-061 — Building's available-action list is the validator's own predicate
*Source: GAME_SPEC §22.8/22.9; the UI must show only currently-valid actions and this
**supersedes any standalone/global action list**.*
**Ruling:** `availableActions(B, S, turn)` = union of `base(B.type)` ∪
`garrisonUnlocked(B, S)` ∪ `moduleUnlocked(B)`, filtered to those where `isOffered`
passes: `isOperational` ([D-012]; exception — Produce Vehicle needs only the Workshop
present) AND `builtOnTurn < turn` ([D-022]) AND `selectAttentionUnits != FAIL` for
every `(type,count)` group (22.3) AND the garrison-set / surplus-set predicate met
(§10.2) AND affordable against turn-start resources AND action-specific preconditions
(building type, required active module, target validity). The list is **live**:
because `selectAttentionUnits` reads `attentionSpentThisTurn`, once a garrisoned unit
is spent by an earlier accepted order this turn, any action that needed it **drops
off** the building's list until next turn. **All** unit actions and **~19 of 21**
building-action rows are attention-gated; only **Harvest** and **Outpost · Hold
Territory** (both passive, order-less) are not. An attention-gated row's per-turn
repeat count is **emergent** — bounded by `floor(unspent garrisoned units of the
required type / required count)` — which subsumes the old textual "1/set",
"1/surplus set", "1/turn" limits (those remain the *upper* cap; attention can only
lower the count). This is the **identical predicate** Phase 2 uses to accept/reject
(22.4), so the offered list and the validator can never disagree.
**Reasoning:** Deriving the offered list from the validator's own predicate
guarantees nothing invalid is ever offered and the two can never drift; making repeat
counts emergent from attention folds the scattered per-action limit text into one
authoritative mechanism.

### D-062 — `attentionSpentThisTurn` is an optional field; absent === unspent
*Source: implementation of §22.1; existing `Personnel` constructors across engine
and tests omit the new field.*
**Ruling:** `Personnel.attentionSpentThisTurn` is typed **optional** (`boolean?`).
Semantically an absent/`undefined` value is **false** (unspent) everywhere it is
read (`selectAttentionUnits`, `selectActorAttention`); the check is `x !== true`.
The engine nonetheless **writes it explicitly** at every creation site it owns
(starting roster in `state.ts`, colonist requisition in `phase4.ts`) and resets it
to `false` for every unit (including `capturedUnits`) in Phase 8 step 5c, so a
resolved snapshot always carries the field. It is deep-cloned like any other field.
**Reasoning:** Optional typing avoids touching the many existing `Personnel` object
literals (engine + 136 pre-existing tests) while preserving the D-056 semantics; the
engine still persists it authoritatively so the backend snapshot is never ambiguous.

### D-063 — Per-action attention requirement mapping, gate ordering, and availableActions scope
*Source: implementation of §22.8/22.9; the §22.8 table names units in prose that must
be turned into concrete (type,count) groups over the engine's implemented action set.*
**Ruling:** Attention requirements per implemented building action (groups over the
building's own garrison): **Boost Output** = 2× labor min per labor type; **Emergency
Extraction** = 1× labor min; **Research Sprint** = 2× Innovator min; **Market Sale /
Colonist Requisition / Territorial Claim** = 1 Administrator; **Amplify Credit Yield**
= 2 Administrator; **Resource Transfer** = 2 Engineer; **Produce Vehicle** = 3
Engineer; **Passive Intel Scan** = 2 Analyst; **Lockdown** = 1 Contractor (the
Security-Detail garrison). Counts derive from `laborGarrisonMin` so they track
Automation. Unit actions require the actor `unitId` (count 1); vehicle actions require
the whole `crew`. The attention check is appended as the **final** gate in Phase 2 —
after every existing precondition (operational, building-type, surplus-set, cost,
target) — so pre-existing reject **reasons** (e.g. "requires HQ", "surplus garrison
set", "not operational", "requires Transit Hub") are preserved and take precedence
over `insufficient unspent attention`. `availableActions(building, sub, game)` is a
**building-level** query: it applies the shared structural predicate (operational,
built-this-turn, surplus/module set gating, attention on live `attentionSpentThisTurn`
flags) but intentionally omits per-order **param** validation (quantity>0, valid hull,
specific target validity) and **variable-cost** affordability (Market Sale / Colonist
Requisition / Produce Vehicle / Lockdown costs depend on params or are charged at
execution) — those remain Phase-2/Phase-4 concerns. `garrisonUnlocked()` is currently
empty (this engine has no garrison-unlocked-only building actions); it is kept as an
explicit union member so future rows slot in without changing the query.
**Reasoning:** Deriving counts from the labor min keeps them consistent with the
existing garrison machinery; appending attention last keeps all existing
validation-reason tests green; scoping `availableActions` to structural + attention
gates (not order params) matches what a per-building UI can meaningfully answer while
still sharing the one attention predicate with the validator ([D-061]).

### D-064 — Draft-aware building available-actions endpoint reuses the engine's attention predicate
*Source: frontend needs a server-computed per-building action list while a player
composes orders (§22.9); the composer must not guess validity client-side.*
**Ruling:** The web layer exposes `POST /api/games/:gameId/orders/available-actions`
(`{draftOrders?}` → `{gameId,turnNumber,subdivisionId,buildings,unitAttention}`),
viewer-scoped to the caller's own subdivision via `requireOwnedSubdivision` exactly
like `…/orders/validate`. It **clones** turn-start state, walks the draft's
`buildingActions` then `unitActions` in declaration order (mirroring Phase 2's
`claimed` reservation, §22.4), tentatively marks the units each **offered** order
would commit as attention-spent using the engine's own
`buildingActionOffered`/`pickBuildingActionAttention`/`pickUnitActionAttention` +
`spendAttention`, then calls `availableActions(building, sub, game)` per building and
reports each unit's `attentionSpentThisTurn`. No selection/gating logic is
reimplemented in the server. To enable this without duplication, the engine's
`index.ts` now additionally exports the already-existing
`buildingActionOffered`, `selectActorAttention`, `pickBuildingActionAttention`,
`pickUnitActionAttention`, and `spendAttention` (previously internal to
`attention.ts`); no engine behaviour changed. `garrison`/political/corporate draft
entries are accepted but ignored (attention-neutral, [D-058]/[D-059]).
**Reasoning:** Reusing the validator's exact predicate on a clone guarantees the
offered list and the eventual accept/reject can never disagree ([D-061]) while
keeping persisted state untouched; exporting the existing helpers is a pure
API-surface widening (no logic moved or copied), the minimal change that lets the
backend show the live "spent → drops off" behaviour the composer needs.

---

## Decision categories at a glance

The 64 decisions group into ten categories A–J, numbered sequentially with no
gaps. Categories A–F were made by the **spec-analyst** while writing
`GAME_SPEC.md`; G by the **game-engine** agent as implementation surfaced further
ambiguity; H by the **backend** agent for server-only concerns; I by the
**spec-analyst** for the player-requested intelligence-gated visibility /
square-map extension (D-050–D-054), with D-055 added by the **game-engine** agent
for tile-view edge cases surfaced while implementing §21.6; J by the
**spec-analyst** for the player-requested unit-attention action-economy extension
(D-056–D-061), with D-062–D-063 added by the **game-engine** agent for
implementation-level rulings surfaced while building §22, and D-064 by the
**backend** agent for the draft-aware available-actions endpoint. All are binding on
downstream code.

| Cat | Theme | Decisions | Representative rulings |
|---|---|---|---|
| **A** | Economy & Market | D-001 – D-009 | Dynamic Market authoritative over flat rates (D-001); fixed-point money (D-002); base storage cap 100 (D-003); peer-vs-Earth sell routing (D-005); market/equity price-update timing (D-006/D-007); Admin/territory passive income (D-008/D-009) |
| **B** | Buildings, Modules, Personnel | D-010 – D-015 | passive production, no additive Harvest (D-010); concrete numbers for "vague by design" modules (D-011); "operational" predicate (D-012); upkeep/shortfall order (D-013); parent perks non-exclusive (D-014); the 2 choice personnel (D-015) |
| **C** | Turn Processing, RNG, Conflict | D-016 – D-025 | seeded RNG + consumption order (D-016); conflict formula (D-017); simultaneous-order resolution (D-018); starvation attrition (D-019); credits clamped at 0 / insolvency flag (D-020); atomic order validation (D-021); build activation N+1 (D-022); housing overflow (D-023); Earth Relations mechanics (D-024/D-025) |
| **D** | Map, Movement, Spotting | D-026 – D-028 | odd-q hex geometry (D-026); free-adjacency + Transit-Hub jump (D-027); spotting → capture (D-028) |
| **E** | Vehicles, Combat, Retirement | D-029 – D-033 | predefined vehicle modules only (D-029); vehicle combat via conflict formula (D-030); captured units inert (D-031); retirement cleanup (D-032); destruction bookkeeping (D-033) |
| **F** | Scoring & Misc | D-034 – D-037 | Oxygen/tech-tree/freeform-research inert + admin-stamped (D-034); scoring counters, normalization off by default (D-035); HQ +1 action (D-036); action-economy limits (D-037) |
| **G** | Engine Implementation | D-038 – D-042 | activation/retirement before validation (D-038); production before attrition (D-039); persistent module bonuses in Phase 3 (D-040); Vitest + workspace layout (D-041); durational effects, Redundant-Systems floor, equity/vehicle/political wiring (D-042) |
| **H** | Backend / Server | D-043 – D-049 | `validateSubmission` reuses the engine (D-043); custom JWT auth (D-044); snapshot-authoritative persistence (D-045); structured admin events/edits (D-046); structured research grants (D-047); six-slot seed + admin assignment (D-048); camelCase label humanization (D-049) |
| **I** | Intel Visibility & Square Map | D-050 – D-055 | square 12×8 grid, 8-dir Chebyshev adjacency (D-050); espionage/opsec formula + tiers + start invariant (D-051); intel tier derived per-pair, unstored, global per opponent (D-052); gated tile-view shape per tier (D-053); spotting vs intel-tier decoupled, borders stop gating visibility (D-054); tile-view edge cases — unclaimed/off-map/RETIRED, output keying, map-level split (D-055) |
| **J** | Unit Attention & Action Availability | D-056 – D-064 | per-unit `attentionSpentThisTurn` field + Phase-8 reset (D-056); type+count requirements, lowest-id tie-break, closes duplicate-unit Phase-2 gap (D-057); garrison/crewing spends no attention (D-058); attention is turn-global, political/corporate attention-neutral today (D-059); multi-group/crewed actions spend all units atomically, one crewed action per vehicle (D-060); building available-action list = the validator's own live predicate (D-061); optional field, absent===unspent (D-062); per-action requirement mapping, attention-gate ordering & availableActions scope (D-063); draft-aware available-actions endpoint reusing the engine predicate + widened attention exports (D-064) |

Cross-cutting themes: **determinism** (A-D-002, C-D-016, F-D-035) forbids floats,
wall-clock, and host dice; **admin-stamped structured effects** (F-D-034,
H-D-046/047) keep every "host discretion" hook as data the engine resolves, never
free-text logic; **snapshot = truth** (H-D-045) keeps the engine the single source
of game state. Items the engine deliberately leaves inert or admin-only (tech
tree, Oxygen thresholds, custom vehicle modules, captured-unit release,
normalization) are catalogued in [`BUILD_SUMMARY.md`](BUILD_SUMMARY.md).

---

*End of DECISIONS.md (D-001 – D-064). Append new decisions as later phases surface
gaps; never renumber existing entries.*
