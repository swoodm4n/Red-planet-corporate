# GAME_SPEC.md — Red Planet Corporate (Mars Colonial Initiative)

**Authoritative implementation specification.** This document is the single
source of truth for the game-engine, backend, frontend, and qa-simulator agents.
Nobody else reads `docs/master-rulebook.xlsx`; this spec is the contract. Where
the rulebook was ambiguous, contradictory, or silent, a ruling was made and
recorded in `DECISIONS.md` (cited inline as **[D-NNN]**).

Design invariants:
- **Deterministic, zero-AI at runtime.** Given the same `gameSeed` and the same
  ordered set of player submissions, turn processing MUST produce byte-identical
  output. All randomness comes from one seeded stream with a fixed consumption
  order (§15).
- **Fixed-point money.** Credits, prices, dividends, and ER deltas are integers in
  units of 0.0001 Cr internally; displayed to 2 decimals, round-half-up **[D-002]**.
- **Integer physical resources.** E, Min, W, F, R are non-negative integers.
- **Asynchronous PBEM.** Players submit a turn; the host/scheduler processes all
  submissions together through the 8 phases (§16).

---

## Table of Contents
1. Glossary & Enumerations
2. Resources
3. Core Data Models
4. Starting Conditions
5. Parent Companies
6. Personnel (5 types)
7. Buildings (14 types) & Modules (16 types)
8. Vehicles
9. Map & Movement
10. Actions (Building / Module / Unit / Political / Corporate) & Garrison
11. Economy: Credit Layers, Dynamic Market, Equity Market
12. Scoring & Standings
13. Earth Relations
14. Conflict Resolution & Spotting
15. RNG & Determinism
16. The Eight-Phase Turn Resolution Algorithm
17. Events
18. Information Visibility
19. Edge Cases & Failure Semantics
20. Turn Report
21. Intelligence-Gated Visibility & Square Map

---

## 1. Glossary & Enumerations

```
ResourceType  = { CREDITS, ENERGY, MINERALS, WATER, FOOD, RESEARCH }
                short: Cr, E, Min, W, F, R
PhysicalRes   = { ENERGY, MINERALS, WATER, FOOD, RESEARCH }   // credits excluded
PersonnelType = { ENGINEER, CONTRACTOR, ADMINISTRATOR, INNOVATOR, ANALYST }
BuildingType  = { POWER_FACILITY, EXTRACTION_SITE, WATER_RECLAMATION, BIO_FACILITY,
                  RESEARCH_COMPLEX, COMMERCIAL_HUB, HABITAT_MODULE, OUTPOST,
                  HEADQUARTERS, POWER_CONDUIT, WAREHOUSE, COMMUNICATIONS_ARRAY,
                  TRANSIT_HUB, VEHICLE_WORKSHOP }                     // 14
ModuleType    = { EFFICIENCY, REDUNDANT_SYSTEMS, EXPANSION, FORTIFICATION,
                  SECURITY_DETAIL, OPERATIONS_DIRECTOR, TERRAIN_EXPLOIT,
                  SENSOR_ARRAY, COMMAND_SUITE, DIPLOMATIC_SUITE, AUTOMATION,
                  PERSONNEL_MODULE, HAZARD_SHIELD, RESEARCH_LINK, TRADE_NETWORK,
                  GLOBAL_CONTRIBUTION }                               // 16
                  // TIER_UPGRADE is treated as an action, not a persistent module.
HullClass     = { LIGHT, MEDIUM, HEAVY }
VehicleModCat = { CARGO, WEAPON, SENSOR, MOBILITY, UTILITY, DEFENSE }
Terrain       = { PLAINS, COLONY_EXPANSION, MOUNTAINS, ICE_DEPOSIT, RARE_MINERALS,
                  VOLCANIC_VENT, WATER_RESERVE, LANDING_ZONE, IMPASSABLE }
Tier          = { T0, T1 }        // Outpost=T0; all others T1
BuildStatus   = { PENDING, ACTIVE, DISABLED, DERELICT }
UnitStatus    = { AVAILABLE, GARRISONED, CREWING, CAPTURED, UNHOUSED, LOST }
```

Effectiveness "tiers" (defense, action effectiveness) are integers ≥ 0.

---

## 2. Resources

| Resource | Symbol | Type | Baseline Market Price (Cr/unit) | Storage |
|---|---|---|---|---|
| Credits | Cr | fixed-point (0.0001) | — (currency) | cap 100 base **[D-003]** |
| Energy | E | int ≥ 0 | 0.50 | cap 100 base |
| Minerals | Min | int ≥ 0 | 0.50 | cap 100 base |
| Water | W | int ≥ 0 | 0.75 | cap 100 base |
| Food/Bio | F | int ≥ 0 | 0.75 | cap 100 base |
| Research | R | int ≥ 0 | 1.50 | cap 100 base |

Storage cap per resource = 100 + 20×(Warehouses + Warehouse Expansion modules)
+ (Credits only) 50×(Commercial-Hub Expansion modules) **[D-003]**. Production or
income above the cap is **discarded** and reported. Credits clamp at **≥ 0**
**[D-020]**; physical resources clamp at ≥ 0 via attrition rules (§19).

---

## 3. Core Data Models

All IDs are stable integers assigned at creation, ascending, never reused.
Ordering by ID is the canonical tie-break everywhere.

### 3.1 Game
```
Game {
  id: int
  gameSeed: uint64                 // fixed at creation; drives all RNG
  turnNumber: int                  // 1-based, current turn being processed
  subdivisions: Subdivision[]
  map: Hex[96]                     // §9
  market: MarketState              // §11.2  (live prices, cumulative flow)
  equity: EquityState              // §11.3
  oxygen: int = 0                  // inert habitability counter [D-034]
  milestonesClaimed: Set<MilestoneId>   // for Earth Relations +3 firsts [D-024]
  activeMotions: Motion[]          // colony votes in progress
  resupplyMissions: ResupplyMission[]   // active Earth resupply windows
  config: { normalizationEnabled: bool = false }   // [D-035]
}
```

### 3.2 Subdivision
```
Subdivision {
  id: int
  name: string
  parentCompany: ParentCompany     // §5
  status: { ACTIVE, RETIRED }      // [D-032]
  resources: { Cr, E, Min, W, F, R }        // stockpiles
  storageCapBonus: { per resource }         // derived from Warehouses/Expansions
  earthRelations: int in [0,30] = 10        // [D-024]
  buildings: Building[]
  personnel: Personnel[]
  vehicles: Vehicle[]
  capturedUnits: Personnel[]       // units this subdivision holds captive [D-031]
  closedBordersAgainst: Set<subdivisionId | "ALL">
  // cumulative counters (never auto-reset) — feed scoring & Earth Relations
  cum: {
    resourcesSoldUnits: int             // for ER Resource Export
    creditsEarnedFromSales: fixed       // Economic score
    researchGenerated: int              // Research score
    researchSubmissions: int            // Research score & ER
    successfulSabotageDefenses: int      // Security
    successfulIntercepts: int            // Security
    successfulSabotageActions: int       // Intelligence
    successfulSurveillance: int          // Intelligence
    undetectedPlantIntel: int            // Intelligence
    consistentOutputStreak: int          // ER Consistent Output [D-025]
    dormantStreak: map<buildingId,int>   // ER Mismanagement [D-012]
  }
  earthRelationsBonusActive: bool        // ER==30 second corporate action [D-024]
}
```

### 3.3 Building
```
Building {
  id: int
  type: BuildingType
  tier: Tier
  hex: HexCoord                    // (col 1-12, row 1-8)
  status: BuildStatus
  builtOnTurn: int                 // activates turn builtOnTurn+1 [D-022]
  modules: Module[]                // installed (may be PENDING)
  garrison: { PersonnelType -> count }   // units currently assigned here
  disabledUntilTurn: int = 0       // event/sabotage disable [D-030]
  dormantTurns: int = 0            // consecutive turns garrison-min unmet
}
```

### 3.4 Module
```
Module {
  id: int
  type: ModuleType
  status: BuildStatus              // PENDING until turn after install
  operationsDirectorMode: {OUTPUT|UPKEEP} // only for OPERATIONS_DIRECTOR [D-011]
}
```

### 3.5 Personnel
```
Personnel {
  id: int
  type: PersonnelType
  status: UnitStatus
  assignedBuildingId: int?         // if GARRISONED
  assignedVehicleId: int?          // if CREWING
  unavailableUntilTurn: int = 0    // Personnel Dispute event
  arrivalTurn: int?                // if in transit from requisition
  requisitionType: PersonnelType?  // in-transit type
}
```

### 3.6 Vehicle
```
Vehicle {
  id: int
  hull: HullClass                  // slots: LIGHT 2, MEDIUM 4, HEAVY 6
  modules: VehicleModule[]         // sum of slot costs <= hull slots
  crew: personnelId[]              // count == hull crew req (1/2/3)
  hex: HexCoord
  status: { PENDING, ACTIVE, DESTROYED }
  cargo: { resource -> int }       // for hauling
}
```

### 3.7 Hex
```
Hex {
  coord: { col: 1..12, row: 1..8 }
  terrain: Terrain
  ownerSubdivisionId: int?         // claim (Outpost/HQ present) ; null = unclaimed
  deposits: { resource -> int }?   // revealed via Survey
}
```

### 3.8 Order (turn submission) — see §10.6 for the full submission schema.

---

## 4. Starting Conditions

Every subdivision begins identically, then parent bonuses (§5) are applied.

**Pre-built buildings (no cost):**
| Building | Notes |
|---|---|
| Headquarters (T1) | via Outpost + Tier Upgrade already applied. Starting hex claim. Garrison req 2 Admin + 1 Contractor. Upkeep 2 E + 3 Cr + 1 Min. Capacity 10. |
| Habitat Module (T1) | Garrison req 1 Admin. Upkeep 1 E + 2 Cr + 1 F. Capacity 8. |
| Bio Facility (T1) | Garrison req 2 Engineer. Upkeep 1 E + 1 Cr + 1 W. Produces +2 F. |

Housing capacity total = 18; starting personnel = 10; vacant = 8 **[D-015]**.

**Starting personnel (10 total) [D-015]:** Engineer×5, Administrator×2,
Contractor×1, **plus 2 of the player's choice** (any of the 5 types), chosen at
registration.

**Starting stored resources:** Credits 30, Minerals 25, Energy 15, Water 15,
Food 15, Research 0.

**HQ starting subsidy (flat, permanent, applied each turn HQ operational) [D-004]:**
`+5 E, +15 Cr, +12 W, +12 F, +3 Min, +0 R`. Does not scale or decay.

**Turn-1 net (informational, excludes generator output [D-010]):**
`+1 E, +6 Cr, +1 F, +1 W, +2 Min` after subsidy + Admin passive income − upkeep.

---

## 5. Parent Companies

At registration a subdivision picks a company, **one of its two perks**, and gains
the stored bonus. Companies are **non-exclusive** (may be shared) **[D-014]**.
Free-building perks are placed on a claimed hex adjacent to HQ.

| Company | Perk A | Perk B | Stored Bonus | ER-25 Bonus Action (cost) | Corporate Action (4 Cr unless noted) |
|---|---|---|---|---|---|
| Terra Agricultural Syndicate | free Bio Facility | free Water Reclamation | +10 F +10 W | Bumper Harvest: all Bio ×2 output for 2 turns (5 Cr) | Accelerated Growth: Bio +4 F this turn |
| Unified Mining Consortium | free Extraction Site | free Power Facility | +15 Min +5 E | Strategic Reserve: +20 Min now (free) | Deep Vein Survey: reveal deposits 2-hex radius |
| Stellar Dynamics Corporation | free Transit Hub | free Warehouse | +10 Cr +10 Min | Priority Freight: all TH sells ignore cap +0.5:1 rate (free) | Priority Routing: transfers/sales zero-cost, no cap this turn |
| Helix Pharmaceutical Group | free Research Complex | free Bio Facility | +10 F +5 R | Accelerated Trial: Apply Research cost halved 3 turns (free) | Breakthrough Research: +6 R this turn |
| Omega Security Solutions | HQ free Fortification installed | free Contractor Personnel Module on any building | +10 Cr +5 Min | Full Spectrum Lockdown: all own buildings immune to Sabotage+Intercept 2 turns (free) | Security Sweep: immune to sabotage this turn, reveal attackers |
| Genesis Tech Industries | free Communications Array | free Research Complex | +8 R +10 Cr | Patent Fast-Track: next research submission +4 ER instead of +2 (free) | Tech Integration: Research Link modules double output this turn |

The ER-25 bonus action and company Corporate Action are additional to the generic
Corporate Actions available to all (§10.5).

---

## 6. Personnel

| Type | Upkeep / turn | Role | Passive | Notes |
|---|---|---|---|---|
| Engineer | 1 F + 1 W | Labor, construction, physical ops | — | Cheapest. Backbone. Drives Transit Hub logistics. |
| Contractor | 1 F + 1 W + 1 Cr | Security, enforcement | — | Only unit that staffs Fortification/Security Detail; defends vs sabotage. |
| Administrator | 1 F + 1 W + 2 Cr | Management, trade, diplomacy | **+2 Cr/turn** (+1 with op. Commercial Hub) | Bottleneck for trade; drives market/political actions. |
| Innovator | 1 F + 1 W + 1 Cr + 1 E | Research | — | Energy draw; primary Research producer. |
| Analyst | 1 F + 1 W + 1 Cr + 1 R | Intel, espionage | — | Research upkeep; operates Sensor Arrays & Comms Array. |

Upkeep is deducted in Phase 3 (§16). Shortfall → attrition **[D-019]** (§19.1).
Administrator passive income is Phase 3 **[D-008]**.

---

## 7. Buildings & Modules

### 7.1 Building master table
Base Production is applied **passively in Phase 3** when garrison-min is met
**[D-010]**. "Slots" caps installed modules (each module = 1 slot unless noted).

| Building | Tier | Slots | Base Production/turn | Build Cost | Upkeep/turn | Garrison (min) | Capacity |
|---|---|---|---|---|---|---|---|
| Power Facility | T1 | 8 | +2 E | 12 Min + 8 Cr | 1 E + 1 Cr | 2 Engineer | — |
| Extraction Site | T1 | 8 | +2 Min | 12 Min + 8 Cr | 1 E + 1 Cr | 3 Engineer | — |
| Water Reclamation | T1 | 8 | +2 W | 12 Min + 8 Cr | 1 E + 1 Cr | 2 Engineer | — |
| Bio Facility | T1 | 8 | +2 F | 12 Min + 8 Cr + 3 W | 1 E + 1 Cr + 1 W | 2 Engineer | — |
| Research Complex | T1 | 8 | +2 R | 14 Min + 10 Cr | 1 E + 1 Cr + 1 R | 3 Innovator | — |
| Commercial Hub | T1 | 8 | Admin credit amplifier (§11.1) | 14 Min + 10 Cr | 1 E + 1 Cr | 2 Administrator | — |
| Habitat Module | T1 | 8 | Housing +8 | 10 Min + 12 Cr | 1 E + 2 Cr + 1 F | 1 Administrator | 8 |
| Outpost | T0 | 3 | Territorial claim only | 6 Min + 4 Cr | 1 E + 1 Cr | 2 Engineer | — |
| Headquarters | T1 | 8 | Housing +10; subsidy; +1 Cr/claimed hex; +1 HQ action **[D-036]** | via Tier Upgrade (18 Min + 24 Cr) | 2 E + 3 Cr + 1 Min | 2 Administrator + 1 Contractor | 10 |
| Power Conduit | T1 | 4 | Relays up to 4 E to adjacent hex | 6 Min + 4 Cr | 1 Cr | none | — |
| Warehouse | T1 | 6 | +20 storage all resources | 8 Min + 6 Cr | 1 E + 1 Cr + 1 Min | 2 Engineer | — |
| Communications Array | T1 | 8 | Intel range 2 hexes; 1 Analyst action | 10 Min + 14 Cr + 4 R | 2 E + 2 Cr + 1 R | 2 Analyst + 1 Engineer | — |
| Transit Hub | T1 | 8 | Sell cap 10/turn; network node | 12 Min + 10 Cr + 4 R | 2 E + 2 Cr | 2 Engineer + 1 Administrator | — |
| Vehicle Workshop | T1 | 8 | Vehicle construction | 14 Min + 10 Cr | 2 E + 2 Cr + 1 Min | 3 Engineer | — |

Difficult-terrain construction surcharge: **+50% Mineral cost** on Mountains and
Rare Minerals hexes **[D-026 terrain]**.

### 7.2 Module master table
`Rep` = repeatable (stacks). Effect column gives the **concrete engine value
[D-011]**. Personnel column is *additional* garrison the module requires.

| Module | Build Cost | Upkeep | +Garrison | Rep | Concrete Effect |
|---|---|---|---|---|---|
| Efficiency | 6 Cr | 1 Cr | — | Yes | +1 primary output. On Commercial Hub: +1 to per-Admin Cr bonus. On Warehouse: −1 Cr transfer cost (min 0). |
| Redundant Systems | 6 Cr | 1 Cr | — | Yes | On a would-disable event/sabotage, building runs at 50% output instead of 0. Removes +10% event-target weight. |
| Expansion | 6 Min + 6 Cr | 1 E + 1 Cr | — | Yes | Habitat +4 capacity; Transit Hub +5 sell cap; Comms Array +1 intel-range hex; Power Facility/Conduit +1 relay hex; Water Reclamation −1 colony Water upkeep; Commercial Hub +50 Cr cap; HQ/Outpost enable direct delivery. |
| Fortification | 10 Min + 6 Cr | 1 E + 1 Cr | +1 Contractor | Yes | +1 defense tier (needs Contractor garrisoned). Adds +10% spotting on hex + adjacent. |
| Security Detail | 6 Min + 6 Cr | 1 E + 1 Cr | +1 Contractor | — | +1 defense tier; enables Active Defense/Lockdown; protects vs Analyst Sabotage. |
| Operations Director | 6 Cr | 1 Cr | +1 Administrator | — | +1 primary output **or** −1 on one upkeep line (declared each turn). |
| Terrain Exploit | 10 Min + 8 Cr | 1 E + 1 Cr | +2 Engineer | — | +2 output if on matching terrain (+3 on Rare Minerals; +4 for Water on Water Reserve). Enables Terrain Harvest action (+3 more). |
| Sensor Array | 6 Cr + 3 R | 1 E + 1 Cr | +1 Analyst | — | Reveals adjacent-hex / rival / market intel per host action (§10). |
| Command Suite | 10 Cr + 3 R | 1 E + 1 Cr | +1 [unit] | — | +1 effectiveness tier to the assigned unit type's actions from this building. |
| Diplomatic Suite | 12 Cr | 1 Cr | — | — | Unlocks Political actions (HQ) / colony broadcast (Comms) / Commercial-Hub sell rate +25% credit multiplier. |
| Automation | 10 Cr + 3 R | 1 E + 1 Cr | — | — | −1 to labor garrison requirement (floor 1). One per building. |
| Personnel Module | 6 Cr | 1 Cr | +2 [named] | — | +2 primary output while the 2 named units are garrisoned. |
| Hazard Shield | 6 Min + 6 Cr | 1 E + 1 Cr | — | — | Immune to dust/radiation/seismic/micrometeorite damage. |
| Research Link | 4 Cr + 6 R | 1 E + 1 Cr | — | — | +1 Research to subdivision pool/turn. |
| Trade Network | 12 Min + 18 Cr | 2 E + 2 Cr | +2 Administrator | — | Enables inter-subdivision resource trades (Transit Hub only). |
| Global Contribution | 6 Cr + 6 F | 1 Cr | — | — | +1 Oxygen (inert counter **[D-034]**). |

Availability per building follows the Module Glossary; the backend seeds the
allowed-module set per building type from Appendix table 7.4 (below). **Tier
Upgrade** is an action (§10.3), not a persistent module; cost 18 Min + 24 Cr,
Outpost(T0)→HQ(T1).

### 7.3 Output computation (per building, per turn, Phase 3+4)
```
baseOutput      = table 7.1 base (0 if garrison-min unmet or building not ACTIVE/disabled)
+ efficiencyBonus   = +1 * count(active Efficiency modules)
+ opsDirectorBonus  = +1 if Operations Director present and mode=OUTPUT
+ personnelModBonus = +2 * count(active Personnel modules with their 2 units garrisoned)
+ terrainExploit    = +2/+3/+4 if matching terrain (module active)
+ researchLink      = +1 R to pool (added to subdivision Research, not this building's primary)
+ boostOutput       = +2 per surplus full labor garrison set (Phase 4 action)
+ terrainHarvest    = +3 (Phase 4 action, requires +2 Engineer specialist crew)
× emergencyExtract  = ×2 total (Phase 4 action; 25% damage roll [D-016])
× eventModifiers    = dust storm −1, seismic −1, etc. (Phase 7 applies to NEXT? no: same-turn where stated)
```
Redundant Systems: if the building would be disabled this turn, output = 50% of
the above (rounded down) instead of 0. Operations Director UPKEEP mode instead
reduces one upkeep line by 1 (min 0) in Phase 3.

### 7.4 Module availability (allowed-on sets) — backend seed data
- **Efficiency**: all Resource Generators, Warehouse, Transit Hub, Vehicle Workshop, Commercial Hub.
- **Redundant Systems**: all Resource Generators, Habitat, Power Conduit, Warehouse, Transit Hub, HQ, Vehicle Workshop, Research Complex, Commercial Hub.
- **Expansion**: Power Facility, Water Reclamation, Habitat, Outpost, HQ, Power Conduit, Commercial Hub, Comms Array, Transit Hub, Vehicle Workshop, Warehouse, Research Complex.
- **Fortification**: Outpost, HQ, Warehouse, Comms Array.
- **Security Detail**: all buildings except Power Conduit.
- **Operations Director**: all buildings except Power Conduit and Outpost.
- **Terrain Exploit**: Extraction Site, Water Reclamation.
- **Sensor Array**: Extraction Site, Commercial Hub, Outpost, HQ, Comms Array.
- **Command Suite**: HQ (+Admin), Comms Array (+Analyst), Transit Hub (+Engineer).
- **Diplomatic Suite**: Research Complex, Commercial Hub, HQ, Comms Array.
- **Automation**: all Resource Generators, Habitat, Research Complex, Commercial Hub.
- **Personnel Module**: all Resource Generators, Habitat, HQ, Comms Array, Transit Hub, Vehicle Workshop.
- **Hazard Shield**: Power Facility, Extraction Site, Water Reclamation, Habitat, Power Conduit, Comms Array, Transit Hub, Vehicle Workshop.
- **Research Link**: Power Facility, Bio Facility, Research Complex, Habitat, Vehicle Workshop.
- **Trade Network**: Transit Hub only.
- **Global Contribution**: Bio Facility only.

---

## 8. Vehicles

Built at Vehicle Workshop via `Produce Vehicle` (Phase 4), active next turn
**[D-022]**. Crewed by existing personnel (Garrison-phase assignment); crew count
= hull requirement. Crew are treated as unavailable for their own unit actions but
act through the vehicle.

### 8.1 Hulls
| Hull | Slots | Build Cost | Crew | Upkeep | Base Move |
|---|---|---|---|---|---|
| Light | 2 | 8 Min + 6 Cr | 1 | 1 Cr | 1 |
| Medium | 4 | 16 Min + 12 Cr | 2 | 2 Cr | 1 |
| Heavy | 6 | 28 Min + 22 Cr | 3 | 4 Cr | 1 (+1 combat investment) |

### 8.2 Crew rules
- Crewing is declared in the Garrison Phase alongside building garrison.
- A destroyed/disabled vehicle: **crew returns to available pool next turn**; only
  the vehicle + modules are lost **[D-030/D-033]**.
- Role-matched crew (module's Best Crew) grants **+1 effectiveness** to that
  module's relevant investment; mismatch operates at base **[D-029]**.

### 8.3 Predefined module concrete stats **[D-029]**
| Cat | Module | Slots | Build Cost | Concrete Effect | Best Crew |
|---|---|---|---|---|---|
| Cargo | Hauling Rig | 1 | 4 Min + 3 Cr | +10 cargo capacity | Engineer |
| Cargo | Reinforced Hold | 2 | 8 Min + 6 Cr | +25 cargo; cargo protected from loss | Engineer |
| Weapon | Light Armament | 1 | 6 Cr + 2 R | weapon investment 1 | Contractor |
| Weapon | Heavy Armament | 3 | 14 Min + 12 Cr + 4 R | weapon investment 3 | Contractor |
| Sensor | Field Scanner | 1 | 4 Cr + 3 R | +1 intel range/quality | Analyst |
| Sensor | Deep Array | 2 | 8 Cr + 6 R | +2 intel range; reveals hidden/planted intel | Analyst |
| Mobility | Upgraded Drivetrain | 1 | 4 Min + 4 Cr | move range 2 | Engineer |
| Mobility | Long-Range Propulsion | 2 | 8 Min + 8 Cr | move range 4 | Any |
| Utility | Mobile Workshop | 2 | 6 Min + 6 Cr + 2 R | field Repair Building action | Engineer |
| Utility | Mobile Relay | 2 | 6 Cr + 4 R | field Passive Intel Scan | Analyst |
| Utility | Command Module | 2 | 6 Cr + 4 R | field Trade Action | Administrator |
| Defense | Plating | 1 | 5 Min + 3 Cr | defense investment 1 | Any |
| Defense | Active Countermeasures | 2 | 8 Min + 6 Cr + 3 R | defense investment 2; may deflect | Contractor |

Custom/freeform modules are **admin-override-only** (§19.7) — the engine never
invents stats.

---

## 9. Map & Movement

> **SUPERSEDED (geometry only) by §21 / [D-050].** As of the intelligence-gated
> visibility revision, the map is a **12×8 square grid** with **8-directional
> (Chebyshev) adjacency**, not odd-q hexes. All *rules* in §9 (movement is free
> adjacency, Transit-Hub node-jumps, difficult-terrain full-move consumption,
> Impassable blocking, vehicle ranges, terrain effects) are unchanged — only the
> neighbor set and the distance metric change. Read every "hex" below as "tile"
> and every `neighbors()`/`hexDistance()` as its §21 square-grid replacement.
> The `HexCoord {col,row}` shape and the `col 1–12 / row 1–8` bounds are retained.

### 9.1 Grid
12 columns (A–L = 1–12) × 8 rows (1–8) = 96 tiles (§21 square grid; formerly
odd-q flat-top hexes **[D-026]**, now **[D-050]**). The Landing Zone occupies one fixed hex (host-configured;
unclaimable, permanent Transit Hub, always accessible to all).

Terrain effects:
| Terrain | Move Cost | Resource Bonus | Build |
|---|---|---|---|
| Plains (P) | 1 | none | standard |
| Colony Expansion (C) | 1 | none | standard |
| Mountains (M) | 2 (consumes whole move) | Mineral Terrain Exploit | +50% Min |
| Ice Deposit (I) | 1 | Water Terrain Exploit | standard |
| Rare Minerals (R) | 2 (consumes whole move) | Extraction +1 above standard | +50% Min |
| Volcanic Vent (V) | 1 | Power Terrain Exploit | standard |
| Water Reserve (W) | 1 | major Water bonus (+4) | standard |
| Landing Zone (L) | 1 | none, unclaimable | none |
| Impassable (~) | cannot enter | none | none |

### 9.2 Adjacency & distance
Neighbors of (c,r) **[D-026]**:
```
same column:  (c, r-1), (c, r+1)
if c even:    (c-1, r-1),(c-1, r),(c+1, r-1),(c+1, r)
if c odd:     (c-1, r),  (c-1, r+1),(c+1, r), (c+1, r+1)
```
Exclude out-of-bounds and Impassable. Distance = hex/cube distance after odd-q →
cube conversion.

### 9.3 Movement (per turn, implicit with an action) **[D-027]**
A unit may act at: its current hex; an **adjacent** hex; or (if it stands in a hex
with a Transit Hub in its own network) **any hub hex** in that network — but after
a hub jump it acts **at the hub hex only** (hub-jump and adjacency do not compose).
Entering Mountains/Rare Minerals consumes the whole move (no chaining). Impassable
never entered. Vehicle range: Drivetrain 2, Long-Range 4 (still blocked by
Impassable). Transit-hub jumps do not trigger spotting (§14.4).

### 9.4 Transit Hub network
All Transit Hubs owned by one subdivision + the Landing Zone hub form one network;
any unit standing in any of those hexes may jump to any other. No garrison
required — presence in the hex suffices. Rival network access is social (no
engine mechanic); the engine models only own-network + Landing Zone.

---

## 10. Actions & Garrison

### 10.1 Garrison Phase (declared first)
Each unit is assigned to a building (GARRISONED), a vehicle (CREWING), or left
AVAILABLE. Garrisoning is free. A building is **operational** only if its
garrison meets the minimum labor requirement **[D-012]**. Surplus full garrison
sets enable repeatable actions ("1 per garrison set"). Garrisoned/crewing units
cannot take unit actions **[D-037]**.

### 10.2 Building Actions (Phase 4)
Consume garrison sets; a building completed this turn cannot act **[D-022]**.

| Building | Action | Garrison | Effect | Limit |
|---|---|---|---|---|
| Any Generator | Harvest | labor min | base output (already applied passively, §7.3/[D-010]) | 1/set |
| Any Generator | Boost Output | 2× labor min | +2 output | 1/surplus set |
| Any Generator | Emergency Extraction | labor min | ×2 output this turn; 25% damage roll | 1/turn, uses Corporate slot |
| Research Complex | Research Sprint | 2× Innovator | +2 R | 1/surplus set |
| Research Complex | Apply Research | Innovator min | spend R to unlock tech (**admin-override [D-034]**) | 1/turn |
| Commercial Hub | Amplify Credit Yield | 2 Admin | all Admins +1 bonus Cr this turn | 1/turn |
| Habitat | Colonist Processing | 1 Admin | arriving colonists immediately available | 1/turn |
| HQ | Colonist Requisition | 1 Admin/set | order ≤5 colonists, arrive in 3 turns; 5 Cr/colonist + 2 Cr fee | 1/Admin set |
| HQ | Territorial Claim | 1 Admin | register hex claim → territory income | 1/turn |
| HQ | Command Coordination | 2 Admin | ally +1 action effectiveness; 3 Cr | 1/turn |
| Warehouse | Resource Transfer | 2 Engineer | move ≤20 res between own buildings / to LZ; 1 Cr per 5 to/from LZ | 1/set |
| Warehouse | Stockpile Audit | 2 Engineer | confirm own totals | 1/turn |
| Comms Array | Passive Intel Scan | 2 Analyst | report unit presence within range | 1/turn |
| Comms Array | Enhanced Surveillance | 2 Analyst (+Sensor Array) | detailed report on 1 rival; 2 Cr | 1/turn |
| Comms Array | Broadcast | 1 Admin (+Diplomatic Suite) | colony-wide statement; 2 Cr | 1/turn |
| Transit Hub | Market Sale | 1 Admin/set | sell ≤10 res at live price (§11.2) | 1/Admin set |
| Transit Hub | Resource Routing | 2 Engineer | transfer to any own building free | 1/set |
| Outpost | Hold Territory | 2 Engineer | maintain claim (passive) | passive |
| Vehicle Workshop | Produce Vehicle | 3 Engineer | build 1 vehicle (hull+modules cost) | 1/set |
| Vehicle Workshop | Repair Vehicle | 2 Engineer | restore damaged vehicle; 2 Cr + 2 Min | 1/set |

### 10.3 Unit Actions (Phase 5) — 1 per AVAILABLE unit
Engineer: Construct Building, Install Module, Tier Upgrade, Place Outpost, Survey
Hex, Demolish (recover 50% Min), Repair Building (2 Cr + 2 Min).
Contractor: Patrol, Intercept, Enforce Territory, Escort.
Analyst: Field Surveillance, Sabotage, Counter-Intel (2 Cr), Plant Intel (3 Cr),
Investigate (2 Cr).
Administrator: Trade Action (§11), Negotiate, Lobby (3 Cr/vote), Denounce (2 Cr).
Innovator: Field Research (+1 R + insight), Tech Consult (2 Cr, +1 building output).
Range/target/cost per Unit Action Reference; movement per §9.3.

### 10.4 Political Actions (Phase 6) — exactly 1/subdivision/turn **[D-037]**
Public Statement (2 Cr), Propose Motion (3 Cr), Form Agreement (0 Cr, social),
Denounce (2 Cr), Appeal to Earth (5 Cr, −3 ER, +10 of one resource next turn),
Vote on Motion (0 Cr). Require HQ/Comms Diplomatic Suite as noted.

### 10.5 Corporate Actions (Phase 6) — exactly 1/subdivision/turn (2 if ER=30)
Generic (all): Expedited Delivery (5 Cr), Emergency Resupply (8 Cr, −1 ER, +8 of
one resource next turn), Corporate Audit (4 Cr), Hostile Acquisition (10 Cr, poach
1 unit — resolved via §14 counter-bid), Black Market Sale (2 Cr fee, sell ≤6 res
at live price bypassing LZ cap), Disinformation Campaign (5 Cr).
Company-specific: see §5.

### 10.6 Turn submission schema
```
Submission {
  subdivisionId, turnNumber
  garrison: [{ unitId, target: {buildingId | vehicleId | AVAILABLE} }]
  buildingActions: [{ buildingId, action, params }]     // ordered
  unitActions:     [{ unitId, action, targetHex/targetId, params }]  // ordered
  politicalAction: PoliticalAction | NONE
  corporateAction: CorporateAction | NONE  (or 2 if ER==30)
  notes: [{ contingency instructions }]                 // host/admin hints
}
```
Late/missing submission default: **repeat last turn's garrison, no new actions**
(Phase 1 rule).

---

## 11. Economy

### 11.1 Credit layers (Phase 3, passive)
1. **Administrator passive**: +2 Cr per Administrator **[D-008]**. +1 more per
   Admin if ≥1 operational Commercial Hub (cap +1, +1 more per Hub Efficiency
   module). "Amplify Credit Yield" action grants an additional +1/Admin this turn.
2. **Landing Zone public market**: sell via §11.2 (caps: colony 15/turn,
   per-subdivision 6/turn) **[D-001]**.
3. **Territory income**: +1 Cr per claimed hex if ≥1 operational HQ **[D-009]**.
4. **Transit Hub**: primary sell engine, 10/turn (+5 per Expansion).

### 11.2 Dynamic resource market **[D-001, D-006]**
One colony-wide market per physical resource. State: `livePrice[res]` (fixed-point),
`cumulativeBought[res]`, `cumulativeSold[res]`.

Trades resolve in Phase 5/6 at the **price standing at turn start** (frozen intra-turn).
Per-turn flow is accumulated; then in **Phase 8**, for each resource in order
[E, Min, W, F, R]:
```
netFlow   = boughtThisTurn - soldThisTurn
shift     = livePrice * (1 + clamp((netFlow/100)*0.03, -0.15, +0.15))
reverted  = shift + 0.25*(baseline - shift)          // 25% toward baseline
livePrice = clamp(reverted, 0.40*baseline, 2.50*baseline)
```
Sale routing **[D-005]**: matched peer buyer → full livePrice (proportional
allocation by ascending subdivisionId on oversubscription); else Earth sale at
livePrice × 0.80. Earth purchase (needs active resupply mission) at livePrice ×
1.20. No buyer + no resupply → buy UNAVAILABLE.

Worked check (Minerals, baseline 0.50): T1 bought 20 sold 60 → net −40 →
`0.50×(1−0.012)=0.494` → reversion `0.4955`. ✓

### 11.3 Subdivision equity market **[D-007]**
100 fixed shares/subdivision, start 10 Cr. Trades (Trade Action sub-action) execute
Phase 5 at the pre-turn price. Phase 8 recompute:
```
anchor      = CompositeScore/10 + 5
pressure    = clamp((netSharesTraded/10)*0.05, -0.15, +0.15)
sharePrice  = max(1.0, anchor * (1 + pressure))
```
Dividend (Phase 3, paid by issuer from its Credits): `EconomicScore/20`, split by
shareholding; if issuer cannot pay in full, pay pro-rata down to 0 Cr, skip the
rest **[D-007/D-020]**. No control/intel from ownership.

Worked check: Composite 56.5 → anchor 10.65 ✓; Economic 22 → dividend 1.1;
30/100 held → 0.33 ✓.

---

## 12. Scoring & Standings (Phase 8) **[D-035]**

Per-turn snapshot per subdivision:
| Category | Weight | Formula |
|---|---|---|
| Economic | 1.0 | `Credits + (cum.creditsEarnedFromSales_and_Amplify / 10)` |
| Industrial | 1.0 | `(E + Min + W + F) / 4 + 1×(active Resource Generators)` |
| Research | 1.0 | `cum.researchGenerated + 2×cum.researchSubmissions` |
| Territorial | 1.0 | `2×(claimed hexes) + 3×(HQ held) + 1×(Outposts held)` |
| Security | 0.75 | `2×cum.successfulSabotageDefenses + 2×cum.successfulIntercepts + (Fortification + Security Detail modules)` |
| Intelligence | 0.75 | `2×(cum.successfulSabotageActions + cum.successfulSurveillance) + 3×cum.undetectedPlantIntel` |

`Composite = Σ (categoryScore × weight)`. Verified: A=63.5, B=78.5, C=54.5 against
the dashboard example. Ranking ties → ascending subdivisionId. Category leader =
max raw score per category. Normalization off by default (admin-toggle). Earth
Relations is **not** part of scoring.

---

## 13. Earth Relations (Phase 7 events / Phase 8 accrual) **[D-024]**

Start 10, clamp [0,30]. **Increases**: Resource Export +1 per cumulative 20 units
sold; Research Sharing +2/submission; Colony Milestone +3 (first only); Consistent
Output +1/turn while physical-net ≥0 for 3+ turns **[D-025]**; Earth's Favor event +1.
**Decreases**: Appeal to Earth −3; Emergency Resupply −1; Large Requisition −1 per
3 colonists above 3 in one action; Mismanagement −2/event (dormant building 3+
turns, or over-housed **[D-023]**).

Thresholds: **<5** colonist ETA 4 turns, Emergency Resupply unavailable; **=0**
Appeal unavailable, Requisition +50% Cr; **>20** Requisition −25% Cr, Expedited
Delivery free; **>25** parent bonus action unlocked; **=30** +1 Corporate Action
slot (suspended if it drops below 30).

### 13.3 Milestone list (first-to-achieve; admin-extendable)
First HQ tier upgrade beyond start, first of each building type, first Transit Hub,
first vehicle, first 5th claimed hex, first Research Complex, first personnel count
≥ 15. (Backend seeds; +3 ER once, to the first subdivision only.)

---

## 14. Conflict Resolution & Spotting

### 14.1 General formula **[D-017]**
```
A = attacker investment ; D = defender investment
if A==0: fail
if |A-D| >= 0.5*max(A,D):   success = (A > D)         // large differential, deterministic
else:                       success = (rng() < A/(A+D))// close, seeded
Lockdown / Counter-Intel / Security Sweep active on defender ⇒ attacker auto-fails.
```

### 14.2 Investment weights
- Sabotage attack: +1 per Analyst, +1 per Comms Array module aiding.
- Defense: +1 per Contractor garrisoned, +1 per Security Detail tier, +1 per
  Fortification tier, +1 per Active Defense Contractor set this turn.
- Intercept: +1 per Contractor (effective vs all unit types) vs target-unit weight 1.
- Territorial dispute: Σ(Contractors + Fortification tiers) each side; higher holds;
  tie → incumbent/owner holds; loser's units displaced to nearest owned hex (no loss).
- Vehicle combat **[D-030]**: attacker Σ weapon investment (+crew match, +Heavy +1)
  vs defender Σ Plating/Countermeasures (+Fortification+Contractors if building).
- Hostile Acquisition: bidder 10 Cr vs target's optional counter-bid; higher Cr wins
  (tie → target keeps unit).

### 14.3 Outcomes
Sabotage success → target building `disabledUntilTurn = turn+1` (Redundant Systems
→ 50% output instead). Attacker exposed on failure. Vehicle loss → destroyed, crew
freed next turn. All success/failure feeds cumulative scoring counters (§12).

### 14.4 Spotting (closed borders) **[D-028]**
> **Relationship to intel tiers (§21 / [D-054]):** Spotting and intelligence-gated
> visibility are **separate, non-interacting systems**. Spotting is a *defender-side
> capture event* triggered when the **mover's** unit crosses into a rival's
> **closed** tile; it is unchanged by §21 except that "adjacency" is now 8-dir
> (§21.2). Intel tiers are a *viewer-side standing visibility level* (§21.3) and do
> **not** modify spotting chance, and spotting does **not** modify intel tier.
> Closed borders no longer gate *tile-content visibility* (that is now the intel
> tier's job, §21.4); closed borders govern **only** movement spotting/capture.

For a unit crossing a rival's closed tile (adjacency movement only; hub jumps exempt):
```
chance = clamp(20 + 10*(Fortification modules on hex or adjacent to fortified bldg)
                  - 10*(unit is Analyst or Analyst-crewed vehicle), 0, 100)   // percent
spotted = rng_percent() < chance
```
Spotted → unit **CAPTURED** (removed to captor's `capturedUnits`, action cancelled,
owner notified). Captured units are inert **[D-031]** until admin-recorded
resolution. Worked check: Analyst vs 2×Fort = 20 −10 +20 = 30% ✓.

---

## 15. RNG & Determinism **[D-016]**

Single 64-bit `gameSeed`. Per turn:
`turnSeed = SplitMix64(gameSeed XOR (turnNumber * 0x9E3779B97F4A7C15))`, driving a
xoshiro256** stream. **Consumption order (canonical, never change):**
1. Phase 4 Emergency-Extraction damage rolls — iterate by (subdivisionId, hex
   row-major index, declaration index).
2. Phase 5 unit-action conflicts + spotting — iterate by (targetSubdivisionId,
   targetHex, attackerSubdivisionId, attacker declaration index).
3. Phase 6 political/corporate conflict rolls (e.g., Hostile Acquisition) — same key.
4. Phase 7 event: trigger roll → scope roll → tone roll → target selection →
   per-event sub-rolls (e.g., micrometeorite per subdivision by ascending id).
Every random decision is a draw from this one stream in this order. No wall-clock,
no map iteration order other than specified, no hash-map iteration.

---

## 16. The Eight-Phase Turn Resolution Algorithm

Fixed order regardless of submission-window length. **Reads current state / writes
new state** are called out; RNG only where §15 says.

### Phase 1 — Submission Window
Collect all `Submission`s. **Writes:** none to game state. Missing/late → default
"repeat last garrison, no new actions." Admin actions (retirement **[D-032]**,
tech-unlock overrides **[D-034]**) are queued here and applied at the very start of
Phase 3.

### Phase 2 — Simultaneous Resolution Check (validation, read-only)
**Reads** turn-start state. For every order, validate: affordability (vs turn-start
resources), garrison sufficiency, adjacency/range, target existence & ownership,
caps, Diplomatic-Suite prerequisites, ER thresholds. Cross-reference: matching
trade terms, contested hex claims, multiple units same hex, Intercept targets.
**Writes:** an annotated, validated order plan; invalid orders flagged `INVALID`
and dropped atomically **[D-021]**. No effects applied yet.

### Phase 3 — Passive Systems (pure arithmetic, no RNG, no discretion)
Applied in this sub-order (all read turn-start state, write new stockpiles):
1. Apply queued admin actions (retirement, tech unlocks).
2. Activate anything `PENDING` from last turn → `ACTIVE`; auto-apply its declared
   garrison **[D-022]**.
3. Colonist arrivals scheduled for this turn → available pool at HQ; apply housing
   overflow flags **[D-023]**.
4. **Attrition pre-check** for starvation is deferred to after production? — No:
   compute production first (uses current garrison), then upkeep, then attrition:
   a. **Resource generation**: base output for each operational generator (§7.3,
      passive part) → stockpiles (respect caps, overflow discarded).
   b. Research Link (+1 R each), Research accumulation.
   c. Administrator passive income + Commercial Hub bonus + territory income.
   d. Equity dividends paid by each issuer from its Credits **[D-007]**.
   e. **Upkeep deduction** in order: building → module → personnel **[D-013]**.
   f. **Shortfall → attrition** **[D-019]**: cull units (ascending id) whose Food/
      Water/Energy(Innovator)/Research(Analyst) upkeep can't be met; Credits clamp
      at 0, unpaid Cr upkeep forgiven but building flagged non-operational next
      turn **[D-020]**.
5. Update `dormantTurns`, `consistentOutputStreak` inputs.
**Ordering note:** Phase 3 must run before Building/Unit actions so those actions
see post-upkeep resources. Production uses **this turn's** garrison (Phase 1).

### Phase 4 — Building Actions
**Reads** post-Phase-3 state; **writes** stockpiles/intel/orders. Resolve each
building action (Boost Output, Emergency Extraction [RNG per §15], Market Sale
[accrues market flow, §11.2], Colonist Requisition [schedules arrival T+3],
Territorial Claim, Passive Intel Scan, Produce Vehicle [creates PENDING], etc.).
A building completed this turn cannot act **[D-022]**. Intra-subdivision spending is
greedy in declaration order **[D-021]**. Buildings act; garrison sets are the gate.

### Phase 5 — Unit Actions
**Reads** post-Phase-4 state; **writes** map/buildings/intel. All unit actions are
**simultaneous by default**. Direct conflicts (Sabotage, Intercept, Enforce,
spotting, vehicle combat) resolved via §14 using the seeded stream in the §15
order. Construction/Place Outpost create PENDING or claim hexes; simultaneous
new-claim collisions mutually cancel (costs refunded) **[D-018]**. Trade Actions
accrue market/equity flow and match peer trades (§11).

### Phase 6 — Political & Corporate Actions
**Reads** post-Phase-5 state (so new buildings/captures are visible). Each
subdivision's single Political + single Corporate action (2 corporate if ER=30).
Tally active Motion votes (simple majority; abstain = neutral; Lobby adds weight).
Company-specific + ER-25 bonus actions applied. Appeal to Earth / Emergency Resupply
schedule next-turn resource drops and adjust ER. Hostile Acquisition counter-bids
resolved via §14/§15. Political effects (agreements/denouncements) are social —
recorded, no mechanical enforcement.

### Phase 7 — Event Roll
**RNG** per §15 step 4. 15% base trigger. If triggered: scope (20% Colony / 35%
Regional / 45% Subdivision), tone (40% Hazard / 30% Opportunity / 30% Neutral),
target selection (risk-weighted for Subdivision: +10% weight per building lacking
Redundant Systems/Hazard Shield, +15% for dormant-3+, +15% for undefended vehicle
in contested territory; regional = host/admin-seeded cluster or deterministic
default = densest contested cluster by ascending hex index). Apply effect (§17).
Events react to this turn's actions (why they run last). Earth's Favor / Mismanagement
adjust ER here.

### Phase 8 — Reporting (recompute & persist)
1. Recompute resource market prices (§11.2) and equity anchors/prices (§11.3).
2. Recompute all six category scores + composite per subdivision (§12).
3. Apply Phase-8 Earth Relations accrual (Resource Export thresholds, Consistent
   Output, Research Sharing credited, milestones) **[D-024]**.
4. Toggle ER=30 universal bonus.
5. Emit public dashboard (§18) + per-subdivision private reports (§20).
6. Increment `turnNumber`.

**Cross-phase ordering sensitivities (call-outs):**
- Production (P3) precedes actions (P4/P5) → actions spend post-income resources.
- Actions (P4/P5/P6) precede events (P7) → risk-weighting reflects this turn.
- Scoring/prices (P8) run last → equity anchor uses this turn's composite; next
  turn's trades use this turn's updated prices (frozen intra-turn) **[D-006]**.
- PENDING→ACTIVE happens at the top of P3 → a thing built in turn N is fully live
  for all of N+1 including N+1's production.
- Attrition (P3f) can drop a building below garrison-min → it produced this turn if
  min was met at P3a, but is flagged non-operational for N+1.

---

## 17. Events

Trigger 15%/turn; scope 20/35/45; tone 40/30/30 (§7 Event tables). Effects:

**Colony-Wide (roll 1–8):** 1 Dust Storm Season (−1 output to unshielded, 2 turns);
2 Solar Flare (no Intelligence actions colony-wide this turn); 3 Earth Supply Convoy
(each may buy ≤10 of one resource at 1:1 once); 4 Atmospheric Breakthrough (all Bio
+1 F); 5 Micrometeorite Shower (per subdivision, 30% a random unshielded building
disabled 1 turn); 6 Quiet Skies (none); 7 Comms Festival (Political actions −1 Cr);
8 Equipment Recall (one random module type at half effect this turn).

**Regional (roll 1–6):** 1 Dust Devil (buildings in hex+adjacent w/o Hazard Shield
disabled 1 turn); 2 Mineral Vein Discovery (first to Survey gains free Terrain
Exploit there); 3 Seismic (region buildings w/o Redundant Systems −1 output); 4
Equipment Cache (a unit present claims 5 Min + 5 Cr once); 5 Territorial Tension
(prompt, no auto effect); 6 Ice Deposit Shift (region Water Terrain Exploit suspended
1 turn; a new hex gains Ice tag permanently).

**Subdivision (roll 1–8):** 1 Equipment Malfunction (a building w/o Redundant Systems
disabled 1 turn, risk-weighted); 2 Personnel Dispute (one garrisoned unit
unavailable next turn); 3 Surplus Shipment (+5 of one themed resource); 4 Innovator
Insight (+3 R if ≥1 Innovator); 5 Routine Inspection (none); 6 Personnel Request
(flavor); 7 Minor NPC Sabotage (weak Analyst attack, §14 vs defense); 8 Earth's Favor
(+1 ER).

Action-triggered risk (independent of ambient): Emergency Extraction 25% damage;
building w/o Redundant/Hazard +10% subdivision-event target weight; dormant 3+ turns
+15% weight + Mismanagement −2 ER; undefended vehicle in contested territory +15%
regional target weight.

---

## 18. Information Visibility

> **REFINED by §21 / [D-053].** The map level now shows **only HQ and Outpost
> icons** (plus terrain and claimed-tile ownership/closed-border status). The
> existence and type of **all other buildings** is no longer public — it is gated
> per-opponent by the viewer's **intel tier** (§21.4). The "building existence &
> type on the map" clause below therefore applies **only to HQ/Outpost icons**;
> everything else is delivered through the §21 gated tile view.

**Public:** composite score & category rankings, category leaders, **HQ/Outpost
icons** on the map (other buildings gated by intel tier, §21), claimed-tile
ownership & closed-border status, public statements/broadcasts, denouncements,
formal agreements, active motions.
**Private:** exact stockpiles (reveal via Corporate Audit / Market Surveillance /
trade), garrison assignments (partial reveal via Patrol/Enhanced Surveillance/Field
Surveillance), Earth Relations (never auto), module loadouts (mostly; Enhanced
Surveillance/Audit reveal), research (until shared), captured units (only the two
parties), vehicle module loadouts, individual motion votes.

---

## 19. Edge Cases & Failure Semantics

19.1 **Insufficient resources for upkeep** → §16 P3f attrition: cull units (asc id)
on Food/Water/Energy/Research shortfall **[D-019]**; Credits clamp 0, unpaid Cr
upkeep forgiven, building non-operational next turn **[D-020]**.
19.2 **Insufficient resources for an order** → order dropped `INVALID` (P2) or fails
in declaration order if depleted intra-phase; no partial execution, no charge
**[D-021]**.
19.3 **Simultaneous conflicting orders** → independent resolution vs full defense;
simultaneous new-claim on same unclaimed hex mutually cancels (refunded); contested
claimed hex → §14 territorial dispute **[D-018]**.
19.4 **Personnel destruction** → only via starvation, poaching (transfer), or
retirement; events/sabotage never destroy personnel (disable buildings / make units
unavailable) **[D-033]**.
19.5 **Vehicle destruction** → vehicle+modules lost, crew freed next turn **[D-030/33]**.
19.6 **Bankruptcy** → Credits clamp 0; insolvent-flag after 3+ turns at 0 w/
negative flow; no auto-removal **[D-020]**.
19.7 **Subdivision retirement** → buildings derelict/hexes unclaimed, personnel &
vehicles removed, shares frozen (no dividends), captives released, excluded from
standings; processed at turn start **[D-032]**. Freeform/custom vehicle modules &
tech unlocks are admin-override-only **[D-029/D-034]**.
19.8 **Housing overflow** → colonists arrive, excess UNHOUSED (upkeep yes, garrison
no), −2 ER/turn until housed **[D-023]**.
19.9 **Captured units** → inert for both sides until admin-recorded resolution
**[D-031]**.
19.10 **Storage overflow** → excess discarded, reported **[D-003]**.
19.11 **Dormant buildings** → full upkeep, no output; 3+ turns → −2 ER + event weight.

---

## 20. Turn Report (per subdivision, Phase 8)

Sections: **Resource Summary** (6 totals + net change), **Building Status**
(garrison, actions taken, status changes, newly completed), **Unit Status**
(garrisoned/available/lost/captured/gained), **Action Results** (success/failure +
private intel), **Event Notification**, **Earth Relations Update** (value + causes),
**Scoring Snapshot** (six categories + composite + public rank). Public dashboard
posts composite rank + each subdivision's leading category. Split per §18.

---

## 21. Intelligence-Gated Visibility & Square Map

New mechanic (post-rulebook, player-requested). Replaces the hex map with a square
grid and gates opponent-tile detail behind a per-opponent intelligence tier derived
from the viewer's espionage vs the target's operational security (opsec). This
section is authoritative for engine/backend/frontend and **supersedes/refines** the
cited clauses of §9, §14.4, §18. Decisions **[D-050]–[D-054]**.

### 21.1 Square grid coordinate system (supersedes §9 geometry, [D-026]) **[D-050]**

- **Same tile count and bounds as the old hex map:** 12 columns × 8 rows = **96
  tiles**. Coordinate type is the existing `HexCoord { col: 1..12, row: 1..8 }`
  (name retained to avoid churn; read as "tile coord"). `map: Tile[96]`, row-major
  (the `Hex`/`HexCoord` types and `rowMajorIndex` are unchanged; `Hex.terrain`,
  `ownerSubdivisionId`, `deposits`, `surveyed` unchanged).
- **Terrain is a straight reskin, not a redesign.** The `Terrain` enum is
  unchanged `{ PLAINS, COLONY_EXPANSION, MOUNTAINS, ICE_DEPOSIT, RARE_MINERALS,
  VOLCANIC_VENT, WATER_RESERVE, LANDING_ZONE, IMPASSABLE }`. Every tile keeps its
  terrain and all §9.1 terrain effects (move cost, resource bonuses, build
  surcharge, Impassable blocking) verbatim. `terrainMoveCost`,
  `terrainBuildMineralSurcharge`, `makeDefaultMap` are unchanged.
- **The Landing Zone** remains one fixed, unclaimable tile that is a permanent
  Transit Hub node accessible to all (§9.1/§9.4), unchanged.

### 21.2 Adjacency & distance (8-directional / Chebyshev) **[D-050]**

Replaces the odd-q 6-neighbor `neighbors()` and cube `hexDistance()`:

```
neighbors(col,row) = { (col+dc, row+dr) : dc∈{-1,0,1}, dr∈{-1,0,1}, (dc,dr)≠(0,0) }
                     filtered to inBounds (1..12 × 1..8).           // 8-neighbour Moore set
gridDistance(a,b)  = max(|a.col−b.col|, |a.row−b.row|)              // Chebyshev
isAdjacent(a,b)    = gridDistance(a,b) == 1                          // ⇔ b ∈ neighbors(a)
```

- **Adjacency is 8-directional (Moore neighbourhood).** Every §9/§10/§14 use of
  "adjacent hex" or `hexDistance ≤ 1` (movement to adjacent tile, Vehicle Attack
  range ≤1, Patrol/Enforce Territory range ≤1, Power Conduit relay to adjacent,
  Fortification "hex + adjacent" spotting bonus) now uses the 8-neighbour set.
- **Range** (`hexDistance` in code → `gridDistance`) uses Chebyshev distance:
  Drivetrain range 2, Long-Range Propulsion range 4, Comms/Sensor intel ranges,
  Survey radius, etc. all read the same numbers against the Chebyshev metric.
- **Impassable/difficult terrain** rules are unchanged: `neighbors()` excludes
  out-of-bounds; movement/range still refuse IMPASSABLE and treat
  Mountains/Rare-Minerals entry as consuming the full move (§9.3, [D-027] retained).
- **Reach delta vs old hex (documented, accepted [D-050]):** tiles within
  distance 1 = **8** (was 6); within distance 2 = 24 (was 18). This modestly widens
  adjacency-based reach; it is the closest square analogue that keeps omnidirectional
  (diagonal) connectivity, matching the "Chebyshev/hex distance" already named for
  vehicle range in [D-027]. QA should watch spotting frequency and vehicle-range
  balance; the map is otherwise byte-for-byte the same size.

### 21.3 Espionage, opsec & intel score (live-recomputed, [D-051])

Both quantities are **recomputed live each turn from current state** (no stored
accumulators, no drift). They are small non-negative integers. "count personnel of
type T" = personnel in `sub.personnel` whose `status ∉ {CAPTURED, LOST, UNHOUSED}`
(i.e. active roster that can actually staff intel/security roles). "active module"
= `status == ACTIVE` (same predicate as the existing defense-investment code,
§14.2). "active building" = `status == ACTIVE`.

```
# --- named, rebalanceable constants ---
INTEL_ESPIONAGE_BASE      = 1
INTEL_OPSEC_BASE          = 1
INTEL_W_ANALYST           = 1    # Analyst = intelligence-coded personnel (§6)
INTEL_W_SENSOR_ARRAY      = 1    # active SENSOR_ARRAY modules (intel module, §7.2)
INTEL_W_COMMS_ARRAY       = 1    # active COMMUNICATIONS_ARRAY buildings (already aids Sabotage, §14.2)
INTEL_W_COMMAND_SUITE     = 1    # active COMMAND_SUITE modules on a COMMUNICATIONS_ARRAY (Analyst amplifier, §7.2)
INTEL_W_CONTRACTOR        = 1    # Contractor = security-coded personnel (§6)
INTEL_W_SECURITY_DETAIL   = 1    # active SECURITY_DETAIL modules (defense, §14.2)
INTEL_W_FORTIFICATION     = 1    # active FORTIFICATION modules (defense, §14.2)

function espionage(sub):
  e  = INTEL_ESPIONAGE_BASE
  e += INTEL_W_ANALYST        * countPersonnel(sub, ANALYST)
  e += INTEL_W_SENSOR_ARRAY   * countActiveModules(sub, SENSOR_ARRAY)
  e += INTEL_W_COMMS_ARRAY    * countActiveBuildings(sub, COMMUNICATIONS_ARRAY)
  e += INTEL_W_COMMAND_SUITE  * countActiveCommandSuitesOnCommsArrays(sub)
  return e

function opsec(sub):
  o  = INTEL_OPSEC_BASE
  o += INTEL_W_CONTRACTOR      * countPersonnel(sub, CONTRACTOR)
  o += INTEL_W_SECURITY_DETAIL * countActiveModules(sub, SECURITY_DETAIL)
  o += INTEL_W_FORTIFICATION   * countActiveModules(sub, FORTIFICATION)
  return o

function intelScore(viewer, target):          # a rational in (0,1); denom ≥ 2 always
  return espionage(viewer) / (espionage(viewer) + opsec(target))
```

Rationale for grounding: Analyst is the only intelligence-coded unit and already
"operates Sensor Arrays & Comms Array" (§6); Sensor Array / Comms Array / Command
Suite are the intel modules; Contractor is the only security-coded unit and
Fortification / Security Detail are the only defensive modules — these are exactly
the weights the existing §14.2 Sabotage-vs-defense math already uses, so espionage
and opsec reuse the same signals rather than inventing disconnected stats.

### 21.4 Intel tiers (named thresholds, integer-exact, [D-051])

```
INTEL_TIER_LOW_MAX    = 0.60    # score <  0.60            -> LOW
INTEL_TIER_MEDIUM_MAX = 0.75    # 0.60 <= score < 0.75     -> MEDIUM
INTEL_TIER_HIGH_MAX   = 0.90    # 0.75 <= score < 0.90     -> HIGH
                                # score >= 0.90            -> FULL

function intelTier(viewer, target):
  e = espionage(viewer); o = opsec(target)
  # Determinism forbids floats ([D-002]/[D-016]); evaluate the thresholds as exact
  # integer cross-multiplications (0.60=3/5, 0.75=3/4, 0.90=9/10):
  if 2*e <  3*o:  return LOW       # e/(e+o) <  0.60
  if 1*e <  3*o:  return MEDIUM    # e/(e+o) <  0.75  (and >= 0.60)
  if 1*e <  9*o:  return HIGH      # e/(e+o) <  0.90  (and >= 0.75)
  return FULL                      # e/(e+o) >= 0.90
```

The four `INTEL_TIER_*_MAX` and nine `INTEL_*` constants above are the only
rebalance knobs; changing a threshold or weight changes nothing else.

**Critical start invariant (verified [D-051]).** With the default starting roster
(Engineer×5, Admin×2, Contractor×1, +2 non-Analyst choice, no intel/security
modules, §4): every viewer has `espionage = 1` and every target has
`opsec = 1 (base) + 1 (starting Contractor) = 2`, so `intelScore = 1/3 = 0.333 →
LOW`, and `espionage (1) ≤ opsec (2)` holds. The only parent that raises starting
espionage is Genesis Tech (free Comms Array → `espionage = 2`); worst symmetric case
`espionage 2 / opsec 2 = 0.5 → LOW`, with `espionage = opsec` (not exceeding). Thus
**every player starts at LOW against everyone**, and *equal espionage and opsec ⇒
score 0.5 ⇒ LOW* (0.5 < `INTEL_TIER_LOW_MAX`). A player who *chooses* 2 Analysts as
starting choice-personnel (a deliberate intel investment, sacrificing labor) can
reach `espionage 3 / opsec 2 = 0.6 → MEDIUM` against a bare target turn 1; this is
intended (Medium reveals only a building count). If playtesting deems it too strong,
the single lever is `INTEL_TIER_LOW_MAX` (raise toward 0.67), per the design
directive — no other constant need change.

### 21.5 Intel-level data model (derived on demand, not stored, [D-052])

- Intelligence is tracked **per (viewerSubdivisionId, targetSubdivisionId)** pair
  and is **global per opponent**: the single `intelTier(viewer, target)` applies to
  **all** of the target's tiles (not per tile).
- It is a **pure derived function of current state**, computed on demand (during
  Phase 8 report generation, or on any live map/tile query). It is **never stored**
  in `Game` state and never persisted — matching the engine's deterministic,
  pure-function style ([D-045] snapshot-authoritative). No new fields on
  `Subdivision`/`Game`.
- `intelTier(v, v)` (self) is not computed; a subdivision always sees its own tiles
  in full (§21.6). Retired/inactive targets: a `RETIRED` subdivision has no tiles
  (buildings derelict, hexes unclaimed per [D-032]), so no view is produced.

### 21.6 Gated tile view — exact shape per tier ([D-053])

Clicking a tile opens a `TileView`. Only **HQ and Outpost icons** render at the map
level (§18 refined); all other detail comes from the tile view, gated as follows.
For counting, a "building on the tile" = a building whose `hex == tile` and whose
`status ∈ {ACTIVE, PENDING, DISABLED}` — i.e. real standing structures, **excluding
DERELICT** ruins ([D-032]). "units on the tile" = personnel with
`status ∈ {GARRISONED, CREWING}` physically located on the tile (garrisoned in a
tile building, or crewing a vehicle whose `hex == tile`) **plus** vehicles with
`hex == tile`; AVAILABLE/UNHOUSED personnel have no tile and are never shown here.

**Always-present (public) fields, every tier incl. LOW and non-owned tiles:**
```
TileView {
  coord:        HexCoord
  terrain:      Terrain              # public (visible on the map)
  owner:        subdivisionId | null # public claim (§18)
  isLandingZone: bool
  hasHQ:        bool                 # public HQ icon   (owner tiles & opponent tiles)
  hasOutpost:   bool                 # public Outpost icon
  intelTier:    "OWN" | LOW | MEDIUM | HIGH | FULL   # viewer's tier vs owner ("OWN" if self)
  ...gated fields below...
}
```

**Own tiles (`intelTier = OWN`, requirement 2):** always full detail — the complete
building list with per-building modules/status/garrison, all units, all outputs,
and stockpile-independent info. (Stockpiles remain subdivision-level and private per
§18; the tile view exposes per-building output, not the Credits/resource pool.)

**Opponent tiles — additive reveal by tier:**

| Field | LOW | MEDIUM | HIGH | FULL |
|---|---|---|---|---|
| `terrain`, `owner`, `hasHQ`, `hasOutpost` (public) | ✓ | ✓ | ✓ | ✓ |
| `buildingCount` — # non-DERELICT buildings on tile | — | ✓ | ✓ | ✓ |
| `buildings[]` — `BuildingType` of each non-DERELICT building (canonical order by building id; duplicates listed) | — | — | ✓ | ✓ |
| `unitCount` — (# personnel garrisoned/crewing on tile) + (# vehicles on tile) | — | — | ✓ | ✓ |
| `resourceOutput` — per-resource sum of each tile building's **passive per-turn primary output** (base + persistent module bonuses, the Phase-3 value of §7.3/[D-040]); keyed by ResourceType | — | — | — | ✓ |
| `units` — breakdown by `{ PersonnelType: count }` for personnel on tile **and** `{ HullClass: count }` for vehicles on tile | — | — | — | ✓ |

Reveal rules and exclusions (all [D-053]):
- **LOW reveals nothing beyond the public map fields** — no counts, no lists. (The
  viewer still sees the tile exists, its terrain, its owner, and any HQ/Outpost icon,
  because those are public under §18; LOW simply adds no private detail.)
- **MEDIUM** adds `buildingCount` only. The count **includes** garrison-less /
  disabled / pending (non-DERELICT) buildings and **includes** any HQ/Outpost already
  shown as icons (so the number is truthful), and **excludes** DERELICT ruins.
- **HIGH** adds the `buildings[]` type list and the aggregate `unitCount`. It does
  **not** reveal per-building output, module loadouts, or which unit types.
- **FULL** additionally reveals `resourceOutput` (productive capacity, the computed
  passive output — **not** stockpiles, which stay private) and `units` as
  **type/hull counts only**. Individual personnel identity (unit `id`) and vehicle
  module loadouts are **never** exposed by the intel tier; those remain obtainable
  only through the existing point-in-time intel actions (Enhanced Surveillance,
  Corporate Audit, Patrol/Field Surveillance) per §10/§18.

### 21.7 Relationship to spotting & closed borders (overlap resolved, [D-054])

Two systems, **fully decoupled**:

| | Spotting (§14.4/[D-028]) | Intel tier (§21, [D-051–053]) |
|---|---|---|
| Nature | Point-in-time **capture event** | Standing **visibility level** |
| Trigger | Mover crosses a **closed** rival tile (8-dir move) | Any time viewer inspects a tile |
| Direction | Defender detects the **mover's** unit | Viewer sees the **target's** tiles |
| Granularity | Per crossing unit/vehicle | Global per opponent (all their tiles) |
| Inputs | Base 20% + Fortification − Analyst (§14.4) | espionage/opsec ratio (§21.3) |
| RNG | Yes (seeded, Phase 5) | No (pure derivation) |

Resolution of the previously-silent overlap:
- **Intel tier does NOT modify spotting chance, and spotting does NOT modify intel
  tier.** They never read each other. (Analyst and Contractor influence each system
  through its own channel — spotting via the §14.4 ±10% terms, intel via the §21.3
  weights — so mixing them would double-count. They stay separate by design.)
- **Closed borders no longer gate tile-content visibility.** Under the old §18,
  border status implicitly hid detail; that job now belongs **entirely** to the
  intel tier. A viewer sees a target's tiles at their intel tier **regardless of
  whether the border is open or closed**. Closed borders retain only their §14.4
  role: triggering movement spotting/capture (and remaining public status, §18).
- Consequently a FULL-tier viewer already has standing unit-and-output visibility on
  a target's tiles; spotting remains the orthogonal mechanic by which that same
  target catches the viewer's **intruding** units. The two never contradict.

---

## 22. Attention (per-unit, per-turn action budget) & Building Available-Action Derivation **[D-056–D-061]**

Every unit has one unit of **attention** per turn. Taking an action spends the
attention of the unit(s) that action *requires*; a spent unit backs no further
action until attention **resets at the start of the next turn** (never carries
over, never stockpiles). This is the single mechanism that stops a player
re-running the same action all turn on the same unit (the pre-existing Phase-2 gap
where N Sabotage orders could all name the same lone Analyst — [D-057]).

### 22.1 Data model addition ([D-056])

Add one field to Personnel (§3.5 / `types.ts` `Personnel`):
```
Personnel {
  ...
  attentionSpentThisTurn: boolean = false   // true once this unit has backed an action this turn
}
```
- Type `boolean`; valid values `{false, true}`; persisted on the snapshot exactly
  like `status` / `unavailableUntilTurn`.
- `false` = attention unspent (unit can still back an action). `true` = spent.
- New personnel (starting roster, requisition arrivals, colonist processing) are
  created with `attentionSpentThisTurn = false`.
- **Reset:** in **Phase 8**, as a new step **5c** (after `tickEffects`, *before*
  `turnNumber += 1`), set `attentionSpentThisTurn = false` for **every** unit of
  **every** subdivision, regardless of `status` (CAPTURED/LOST units simply never
  get read). Placing the reset at end-of-turn (not start) keeps Phase 1/2 of turn
  N+1 reading an already-clean board.
- Attention is **not** a resource in the §2 sense (never bought/sold/scored). It is
  purely an intra-turn action-budget flag.

### 22.2 What "required units" means per action class ([D-057], [D-060])

| Action class | How the required units are identified | Count |
|---|---|---|
| **Unit action** (§10.3) | The **explicit `order.unitId`** — that exact acting unit. | Always exactly 1 (the actor). Vehicle actions: see 22.4. |
| **Building action** (§10.2) | **Implicit by type**: the garrisoned personnel of the type(s) named in the row's Garrison column, resolved to concrete units via `sub.personnel.filter(p => p.assignedBuildingId === b.id && p.status === "GARRISONED" && p.type === T)`. | The row's count (labor min, `2×` set, `2 Admin`, `2 Analyst`, `3 Engineer`, …). |
| **Political / Corporate** (§10.4/§10.5) | Bind **no** `unitId` in the current schema → require **no** unit → spend **no** attention. Capped by their own 1-per-subdivision-per-turn allowance. See 22.5. | 0 (see [D-059]). |

Requirements are **type + count**, never specific IDs — matching how `garrisonMin`
already works (§7/[D-012]). Which *specific* qualifying unit pays is a deterministic
tie-break (22.3), not player choice.

### 22.3 Deterministic unit-selection tie-break ([D-057])

When an action requires `count` units of type `T` and more than `count` qualifying
units have unspent attention, spend the attention of the **lowest-`id` units**,
canonical with the engine's ID-ordering tie-break ([D-016]/[D-018]).
```
selectAttentionUnits(candidates: Personnel[], T: PersonnelType, count: int, claimed: Set<id>):
  pool = candidates
         .filter(p => p.type == T
                   && p.status ∈ eligibleStatus         // GARRISONED for building actions; AVAILABLE for unit actions
                   && p.attentionSpentThisTurn == false
                   && p.unavailableUntilTurn < turnNumber
                   && !claimed.has(p.id))
         .sort(by p.id ascending)
  if pool.length < count: return FAIL           // not enough unspent attention
  return pool.slice(0, count)                    // the `count` lowest ids
```
- **Unit actions:** `count == 1` and the actor is fixed by `order.unitId`; there is
  no set to choose from — the check is simply "is `unit.attentionSpentThisTurn`
  false (and not already claimed this submission)". If true → reject.
- **Building actions:** candidates = that building's garrison of type `T`; select
  the `count` lowest-id garrisoned units of that type.
- **Multi-type requirements** (e.g. Command Coordination needs `2 Admin`, a
  hypothetical `2 Engineer + 1 Contractor`): run `selectAttentionUnits` once per
  `(type,count)` group; the order is offered/valid **only if every group succeeds**,
  and taking it spends **all** selected units atomically ([D-060]). If any group
  fails, the whole order is rejected and **no** attention is spent.

### 22.4 Phase-2 attention accounting (closes the duplicate-unit bug, [D-057])

Phase 2 (`validateActionsPhase`) must carry a per-subdivision working set
`claimed: Set<unitId>` seeded empty (turn-start attention is all-false, [D-056]).
Orders are validated in **declaration order** (greedy, consistent with [D-021]):
```
for each buildingAction / unitAction in submission order:
    ...existing precondition checks (operational, type, cost, garrison-set)...
    picked = selectAttentionUnits(...)          // per 22.3, reading `claimed`
    if picked == FAIL: reject(order, "insufficient unspent attention"); continue
    claimed ∪= picked.ids                        // reserve so a later order can't reuse them
    accept(order); record picked.ids on the validated order for Phase 4/5 to spend
```
Then Phase 4 (building actions) and Phase 5 (unit actions), when they execute an
accepted order, set `attentionSpentThisTurn = true` on exactly the recorded
`picked.ids`. Because Phase 2 already reserved via `claimed`, execution never
double-spends. This is the fix for the current gap: five Sabotage orders naming the
same Analyst now yield **one** accepted order (first in declaration order) and four
`INVALID: insufficient unspent attention` rejections.

Ordering note: attention claiming is **intra-subdivision** and happens entirely in
Phase 2 against turn-start state; it does not read other subdivisions and consumes
no RNG, so it is invariant to inter-subdivision resolution order.

### 22.5 Attention is turn-global, not phase/building-scoped ([D-059])

Attention is a property of the **unit for the whole turn**, not scoped to a building
or a phase. A unit whose attention is spent by *any* accepted order is unavailable
to *every* other attention-gated order that turn, across building, unit, political,
and corporate classes and across all buildings.
- **Political/Corporate:** the current `PoliticalActionOrder`/`CorporateActionOrder`
  schemas carry **no `unitId`**, so today they bind no unit and spend no attention —
  they are limited solely by their 1-per-subdivision-per-turn caps (§10.4/§10.5). If
  a future political/corporate action is made unit-bound (adds a required
  `unitId`/type), it participates in the identical turn-global exclusion: that unit,
  once spent politically, cannot then take a building/unit action the same turn, and
  vice-versa. The principle is fixed even though no current entry exercises it.

### 22.6 Garrison assignment does NOT spend attention ([D-058])

Phase-1 garrison assignment (stationing a unit in a building / crewing a vehicle /
leaving it AVAILABLE) is **presence/stationing, not an action** and spends **no**
attention. A unit garrisoned this turn still has full unspent attention and can back
a building action that same turn (subject to the building being operational and not
built-this-turn, [D-022]). Attention is spent **only** by an accepted building/unit
(or unit-bound political/corporate) **action order** in Phase 2/4/5/6.

### 22.7 Vehicle (crewed) actions ([D-060])

`VEHICLE_MOVE` / `VEHICLE_ATTACK` act through a crewed vehicle, not an AVAILABLE
unit. Required units = the vehicle's **entire crew** (`v.crew`). The action is
offered only if every crew member has `attentionSpentThisTurn == false`; executing
it spends the attention of **all** crew members. This gates a vehicle to **one**
crewed action per turn using the same all-crew rule as personnel (no separate
per-vehicle flag needed). Crew are CREWING (not AVAILABLE) so they already cannot
take personnel unit actions ([D-037]); attention additionally prevents two vehicle
orders from sharing one crew.

### 22.8 Which §10 action-table entries are attention-gated

**Unit actions (§10.3): ALL are attention-gated** — each names an actor `unitId`
and spends that 1 unit's attention. Full list (each = 1 unit of the stated type):
Engineer — Construct Building, Install Module, Tier Upgrade, Place Outpost, Survey
Hex, Demolish, Repair Building; Contractor — Patrol, Intercept, Enforce Territory,
Escort; Analyst — Field Surveillance, Sabotage, Counter-Intel, Plant Intel,
Investigate; Administrator — Trade Action, Negotiate, Lobby, Denounce; Innovator —
Field Research, Tech Consult. Vehicle — Vehicle Move, Vehicle Attack (crew, 22.7).

**Building actions (§10.2):** every row that carries a Garrison-personnel
requirement is attention-gated on those garrisoned units; the two **passive** rows
that issue no order are **not** gated:

| Building action | Attention-gated? | Units whose attention is spent |
|---|---|---|
| Harvest | **No** (passive base output, already applied §7.3/[D-010]; no order) | — |
| Outpost · Hold Territory | **No** (passive maintenance; no order) | — |
| Boost Output | Yes | surplus set's labor units (`2× labor min`) |
| Emergency Extraction | Yes | labor-min units |
| Research Sprint | Yes | `2×` Innovator (surplus set) |
| Apply Research | Yes | Innovator-min units |
| Amplify Credit Yield | Yes | `2` Administrator |
| Colonist Processing | Yes | `1` Administrator |
| Colonist Requisition | Yes | `1` Administrator / set |
| Territorial Claim | Yes | `1` Administrator |
| Command Coordination | Yes | `2` Administrator |
| Resource Transfer | Yes | `2` Engineer |
| Stockpile Audit | Yes | `2` Engineer |
| Resource Routing | Yes | `2` Engineer |
| Produce Vehicle | Yes | `3` Engineer |
| Repair Vehicle | Yes | `2` Engineer |
| Passive Intel Scan | Yes | `2` Analyst |
| Enhanced Surveillance | Yes | `2` Analyst (+Sensor Array module) |
| Broadcast | Yes | `1` Administrator (+Diplomatic Suite module) |
| Market Sale | Yes | `1` Administrator / set |
| Lockdown (`orders.ts`) | Yes | `1` labor/security garrison unit (+Security Detail module) |

Characterization for the engine agent: **~19 of 21 building-action rows and 100% of
unit actions are attention-gated; only Harvest and Hold Territory (both passive,
order-less) are not.** Political and corporate actions are attention-neutral today
(22.5). An attention-gated row's per-turn repeat count is now emergent — bounded by
`floor(unspent garrisoned units of the required type / required count)` — which
subsumes the old textual "1/set", "1/surplus set", "1/turn" limits (those remain the
*upper* cap; attention can only lower the count when units are already spent).

### 22.9 Building's currently-available action list ([D-061])

The UI must show, per building, the set of actions **currently fully valid** — this
**supersedes any standalone/global action list**. Nothing invalid is ever offered.
```
availableActions(B, S, turn):
  candidate = base(B.type)                         // (a) intrinsic actions for the building type
            ∪ garrisonUnlocked(B, S)               // (b) actions unlocked by units currently garrisoned in B
            ∪ moduleUnlocked(B)                    // (c) actions unlocked by installed ACTIVE modules
                                                   //     e.g. Lockdown←Security Detail, Enhanced
                                                   //     Surveillance←Sensor Array, Broadcast←Diplomatic Suite
  return { a ∈ candidate : isOffered(a, B, S, turn) }

isOffered(a, B, S, turn):
  return isOperational(B, turn)                      // §7/[D-012]  (exception: Produce Vehicle needs only the Workshop present, per validation.ts)
     AND B.builtOnTurn < turn                        // built-this-turn cannot act [D-022]
     AND selectAttentionUnits(...) != FAIL for every (type,count) group of a   // required units present WITH unspent attention (22.3)
     AND garrisonSetCount / surplus-set predicate of a is met                  // §10.2 set gating
     AND affordable(turnStartResources[S], cost(a))                            // Cr/resource cost
     AND action-specific preconditions of a (building type, required module active, target validity)
```
- `base`, `garrisonUnlocked`, `moduleUnlocked` are the **union** sources; an action
  from any source appears **only if** `isOffered` passes.
- The list is **live**: because `selectAttentionUnits` reads
  `attentionSpentThisTurn`, once a garrisoned unit is spent (by an earlier accepted
  order this turn) any action that needed it **drops off** the building's list until
  next turn — exactly requirement (2)/(3).
- This derivation is the **same predicate** Phase 2 uses to accept/reject
  (22.4); the offered list and the validator can never disagree.
- **Garrison ordering in a live preview ([D-065]):** because garrison is applied in
  Phase 1 and building actions run in Phase 4, a preview of `availableActions` for a
  draft submission MUST apply that draft's garrison (§10.1, reset-then-assign) to the
  evaluated state **first**, then derive per-building actions against the resulting
  garrison. Otherwise a building the player re-garrisons this turn would still show
  last turn's `garrisonUnlocked`/operational/set-count gating — misleading, since at
  resolution the new garrison is already in place before those actions run.

---

*End of GAME_SPEC.md. Companion: DECISIONS.md (D-001 – D-061). Amend both together
as later build phases surface gaps.*
