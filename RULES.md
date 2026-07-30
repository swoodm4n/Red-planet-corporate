# RED PLANET CORPORATE — SUBDIVISION MANAGER'S RULEBOOK

*"Every subdivision manager carries the weight of human expansion. Success opens the stars. Failure closes them forever."*
— Internal Corporate Consortium Memo

**Excellence is not optional.**

---

## 0. What this document is

This is the **operational rulebook** — the thing a subdivision manager (player) actually
reads to play a turn. It is the readable, in-fiction layer on top of
[`mars master rulebook.xlsx`](./mars%20master%20rulebook.xlsx), which remains the source of
truth for exhaustive numeric tables (every building, every module, every unit action, every
vehicle part, every event). Where this document gives a summary or a worked example, the
spreadsheet has the exhaustive version — if the two ever disagree, **the spreadsheet wins**
unless a specific ruling below explicitly overrides it (those are called out).

This is a **host-run NRP** (Nation Roleplay): one host adjudicates, turns are submitted
privately, and anything not written down is resolved by host discretion in the spirit of
what *is* written down. That's not a gap in these rules — it's how this genre works.

---

## 1. Premise & Corporate Structure

**Setting.** Following the establishment of Moon colonies in 2140, six corporations pooled
over **2.7 trillion credits** — the largest single investment in human history — into the
**Mars Colonial Initiative**: a 50-year program to prove that corporate competition and
survival-critical cooperation can coexist on another planet. You manage one subdivision.
Your parent company expects returns.

**Chain of command:**

```
EARTH SYSTEM CORPORATE COMMAND
├── Terra Agricultural Syndicate
├── Unified Mining Consortium
├── Stellar Dynamics Corporation
├── Helix Pharmaceutical Group
├── Omega Security Solutions
└── Genesis Tech Industries
    └── MARS COLONIAL AUTHORITY (neutral, colony-wide safety + emergency coordination)
        ├── Infrastructure Management Division
        ├── Emergency Response Coordination
        ├── Inter-Subdivision Relations Bureau
        └── Subdivision Management Tier
            └── [YOUR SUBDIVISION]
```

The Mars Colonial Authority enforces mandatory cooperation during declared emergencies and
stays neutral in ordinary competitive disputes. Everything else — resource competition,
diplomacy, intelligence-gathering, market pressure — is between subdivisions.

**The six parent companies**, their build-choice bonus (pick one), and their **Corporate
Action** (see §8.2 for cost/effect):

| Parent Company | Starting Building Bonus (choose 1) | Starting Resource Bonus | Corporate Action |
|---|---|---|---|
| Terra Agricultural Syndicate | Bio Facility *or* Water Reclamation | +10 Food + 10 Water stored | **Accelerated Growth** — Bio Facility +4 Food/Bio this turn |
| Unified Mining Consortium | Extraction Site *or* Power Facility | +15 Minerals + 5 Energy stored | **Deep Vein Survey** — reveal deposits in a 2-hex radius |
| Stellar Dynamics Corporation | Transit Hub *or* Warehouse | +10 Credits + 10 Minerals stored | **Priority Routing** — free, uncapped transfers/sales this turn |
| Helix Pharmaceutical Group | Research Complex *or* Bio Facility | +10 Food + 5 Research stored | **Breakthrough Research** — +6 Research this turn |
| Omega Security Solutions | HQ starts with Fortification *or* free Contractor Personnel Module | +10 Credits + 5 Minerals stored | **Security Sweep** — sabotage immunity + attacker ID this turn |
| Genesis Tech Industries | Communications Array *or* Research Complex | +8 Research + 10 Credits stored | **Tech Integration** — all Research Link modules produce double this turn |

Each Corporate Action costs a flat **4 Cr** and requires the relevant building operational
— full detail in the xlsx's "Action System Overview" sheet.

---

## 2. How the game is scored — phases and evaluation

Corporate oversight nominally grades subdivisions on four criteria: **Growth Trajectory**,
**Operational Efficiency**, **Innovation Leadership**, and **Market Position**. Mechanically
these map onto the six scoring categories in §14 (Economic, Industrial, Research,
Territorial, Security, Intelligence) — the flavor language is what a subdivision manager's
performance review says; the composite score is how it's actually computed.

The Initiative is framed in three narrative phases, which are **pacing guidance for the
host, not hard mechanical gates**:

- **Phase Alpha — Foundation** (roughly turns 1–8): establish infrastructure, claim
  territory, get the basic economy running.
- **Phase Beta — Expansion & Leverage** (roughly turns 9–16): exploit advantages, form or
  break alliances, start contesting territory and market position directly.
- **Phase Gamma — Market Dominance** (host-declared): aggressive endgame positioning, if
  and when the host chooses to call a season.

Standings are **rolling with no formal game end** (see §14) — Phase Gamma is not a
mandatory hard stop, it's a tone shift the host can invoke if they want to close out a
season and crown a leader before starting a new one.

---

## 3. Becoming a subdivision manager

At registration, each player selects:

- **Subdivision name** and **parent company** (§1).
- **2 "Player Choice" starting personnel** (in addition to the fixed 5 Engineer / 2
  Administrator / 1 Contractor baseline — see §4). This is the first meaningful strategic
  signal of intended playstyle.
- One of the two building-bonus options for their parent company (§1).

**In-fiction, your subdivision has four department heads** you write for when submitting a
turn (§8) — these are hats one player wears, not separate seats, unless a host explicitly
runs co-managed subdivisions:

| Department | Title |
|---|---|
| Operations Management | *(your primary character)* |
| Corporate Affairs | Corporate Liaison |
| Diplomatic Relations | Diplomatic Attaché |
| Public Relations | Communications Director |

> **Open item:** a Google Form exists (linked by the requester) that appears to be the
> subdivision registration/application form, but it returned a 403 on public view and
> Drive's API doesn't support reading Forms content even with direct file access. If this
> form is meant to be the actual player-facing sign-up, either share its questions
> directly or fix sharing permissions and it can be reconciled into this section.

---

## 4. Starting conditions

**Housing:** Headquarters (10 capacity, pre-built via Outpost Tier Upgrade) + 1 pre-built
Habitat Module (8 capacity) = **18 total capacity**, 10 starting personnel, 8 vacant slots.

**Starting personnel (10):**

| Unit | Qty | Upkeep/turn |
|---|---|---|
| Engineer | 5 | 5 Food + 5 Water |
| Administrator | 2 | 2 Food + 2 Water + 4 Cr |
| Contractor | 1 | 1 Food + 1 Water + 1 Cr |
| Player Choice | 2 | depends on type |

**Starting buildings (pre-built, no cost):** Headquarters, 1 Habitat Module, 1 Bio Facility.

**Starting stockpile:** 30 Credits, 25 Minerals, 15 Energy, 15 Water, 15 Food, 0 Research
(research is deliberately zero — it forces a real Research Complex investment).

**HQ subsidy** (parent-company operating budget, doesn't scale — build real generators):
+5 Energy, +15 Credits, +12 Water, +12 Food, +3 Minerals per turn.

**The credit economy has three layers**, roughly in order of when they matter:

1. **Administrator passive income** — 2 Cr/turn per Administrator, +1 Cr/turn bonus each if
   within a Commercial Hub's range. Early-game floor.
2. **Landing Zone public market** — sell without a Transit Hub, 3 resources = 1 Cr, capped
   at 15 resources/turn colony-wide, 6/turn per player. Bridge income; naturally phases out.
3. **Territory income via HQ** — +1 Cr per claimed hex/turn. Negligible early, 6–8 Cr/turn
   passively once you hold 6–8 hexes.

Plus the **Transit Hub**, once built: sell up to 10 resources/turn at 2:1 (better than
Landing Zone) and it's the only building that enables direct inter-subdivision trades (via
the Trade Network module). This is the main credit engine mid-to-late game.

Full parent-company starting-bonus table is in §1. Full turn-1 burn-rate math is in the
xlsx's "Starting Conditions" sheet.

---

## 5. Resources

| Resource | Role |
|---|---|
| Credits | Universal currency — construction, upkeep, market, diplomacy fees. |
| Energy | Powers every facility; independence is leverage. |
| Minerals | Construction and manufacturing. |
| Water | Life support + Bio Facility input. Scarcity is the closest thing to an existential threat. |
| Food/Bio | Personnel upkeep, less critical than Water but enables growth. |
| Research | Tech advancement — gated behind Innovator investment, deliberately scarce. |

---

## 6. Buildings, modules, personnel

14 buildings across four functional groups (Resource Generators, Infrastructure,
Production, and Territory), each with a tier, module slot count, base production, build
cost, upkeep, and personnel requirement. 16 standardized module types (Efficiency,
Redundant Systems, Expansion, Fortification, Security Detail, Operations Director, Terrain
Exploit, Sensor Array, Command Suite, Diplomatic Suite, Automation, Personnel Module,
Hazard Shield, Research Link, Trade Network, Global Contribution, Tier Upgrade) can be
installed where applicable.

**Personnel roles**, all with per-turn upkeep in Food/Water plus type-specific extras:

| Unit | Extra upkeep | Role |
|---|---|---|
| Engineer | — | Labor, construction, extraction. Cheapest, backbone of expansion. |
| Contractor | +1 Cr | Security/defense. Required to staff any protective module. |
| Administrator | +2 Cr | Management, trade, diplomacy. Generates 2 Cr/turn passively. |
| Innovator | +1 Cr +1 Energy | Research. Needs strong Energy infrastructure to field many. |
| Analyst | +1 Cr +1 Research | Intelligence/espionage. Sustainable only with strong Innovator output. |

→ Full building/module/personnel tables: xlsx sheets **"Buildings & Modules,"
"Module Glossary," "Personnel Reference."**

---

## 7. The turn cycle

| Property | Default (host-adjustable) |
|---|---|
| Turn cycle duration | 1 week |
| Submission deadline | Final 6 hours of the cycle |
| Processing window | 24 hours after deadline |
| Results published | Start of the next cycle |
| Late submission | Treated as **hold position** — repeats last turn's garrison, no new actions, no resources spent |

**Processing order, every turn (fixed regardless of window length):**

1. **Submission Window** — all four departments submitted privately to host.
2. **Simultaneous Resolution Check** — host reads everything for cross-references before
   applying anything: matching trades, contested hexes, Intercept targets.
3. **Passive Systems** — resource generation, upkeep, Administrator/territory income,
   Research accumulation, colonist arrivals. Pure arithmetic, no discretion.
4. **Building Actions** resolve (a building completed *this* turn cannot act this turn).
5. **Unit Actions** resolve simultaneously; direct conflicts go to host judgment (§Conflict
   Resolution, xlsx "Action System Overview").
6. **Political & Corporate Actions** (Diplomatic/Public Relations + Corporate Affairs
   department submissions) resolve, after state changes from steps 4–5 are known.
7. **Event Roll** — 15% base chance/turn; scope (Colony 20% / Regional 35% / Subdivision
   45%) and tone (Hazard 40% / Opportunity 30% / Neutral 30%) rolled if triggered.
8. **Reporting** — Earth Relations and scoring updated, public standings dashboard posted,
   private turn reports sent (§16).

**Construction always takes 1 turn minimum** — declared Turn N, active Turn N+1. Garrison
assignments to a not-yet-complete building can be declared this turn and auto-activate the
turn it finishes.

---

## 8. Submitting a turn — the four departments

Each subdivision submits through **four department channels** every cycle. This replaces
the flat "one submission" model with a structured template — but the *actions available*
are exactly the building/unit/political/corporate actions already defined in the master
rulebook; this section just tells you which department each one is submitted through.

> **Ruling on the department split:** the master rulebook caps **1 Political Action per
> subdivision per turn**. Diplomatic Relations and Public Relations are now separate
> departments, but by default they still **share that single Political Action slot** —
> submit whichever one fits your move that turn. A host who wants a more PR-heavy game can
> run the **expanded variant**: 1 Diplomatic action *and* 1 Public Relations action per turn
> (2 total). Pick one and say so up front; default is the shared-slot version.

### 8.1 Operations Management Department
*Manager: your primary character.* Everything physical: garrison assignments, Building
Actions (Harvest/Boost Output/Research/etc.), and Unit Actions for Engineers and Innovators
— Construct, Install Module, Tier Upgrade, Place Outpost, Survey Hex, Demolish, Repair,
Field Research. **There is no fixed action cap** — you get one action per available unit
and one action per fully-garrisoned building's unlocked actions, same as the base action
system. (If you've seen older drafts of this format capping "3 standard actions," that cap
is superseded — it doesn't match how garrison-gated actions actually work.)

```
=== OPERATIONS MANAGEMENT DEPARTMENT ===
SUBDIVISION: [Your Subdivision Name]
OPERATIONAL CYCLE: [Turn Number]
DEPARTMENT MANAGER: [Your Primary Character Name]

GARRISON: [assign every unit to a building or AVAILABLE — see §Garrison Phase, xlsx]

BUILDING ACTIONS:
  Extraction Site (Hex B3) — Harvest Minerals [3x Engineer garrison]
  Research Complex (Hex C3) — Generate Research [3x Innovator garrison]

UNIT ACTIONS:
  Engineer [AVAILABLE] — Construct: Power Facility at Hex C1
  Engineer [AVAILABLE] — Place Outpost at Hex D4
  Innovator [AVAILABLE] — Field Research at Hex D2

OPERATIONAL NOTES: [contingencies — see §Notes to Host guidance below]
=== END OPERATIONS SUBMISSION ===
```

### 8.2 Corporate Affairs Department
*Manager: Corporate Liaison.* **1 per subdivision per turn.** Your parent company's
costed Corporate Action (§1), or one of the generic Corporate Actions available to
everyone: Expedited Delivery, Emergency Resupply, Corporate Audit, Hostile Acquisition,
Black Market Sale, Disinformation Campaign (costs/effects: xlsx "Action System Overview").

```
=== CORPORATE AFFAIRS DEPARTMENT ===
SUBDIVISION: [Your Subdivision Name]  |  PARENT COMPANY: [Your Parent Corporation]
CORPORATE ACTION: [Company-specific ability, or generic Corporate Action]
Resource Cost: [per rulebook]  |  Expected Outcome: [what you're going for]
=== END CORPORATE AFFAIRS SUBMISSION ===
```

### 8.3 Diplomatic Relations Department
*Manager: Diplomatic Attaché.* Alliance formation (Form Agreement), colony votes (Propose
Motion / Vote on Motion), Administrator diplomatic unit actions (Negotiate, Lobby), and
Analyst intelligence-gathering (Field Surveillance, Investigate, Enhanced Surveillance via
Comms Array). Note: **diplomacy is intentionally unmechanized** — a Form Agreement carries
social weight from being public, not an enforcement mechanic. Breaking one has no automatic
penalty; it's visible to the whole colony, which is the actual teeth.

```
=== DIPLOMATIC RELATIONS DEPARTMENT ===
SUBDIVISION: [Your Subdivision Name]
DIPLOMATIC ACTION: [FORM_AGREEMENT / PROPOSE_MOTION / NEGOTIATE / INVESTIGATE / etc.]
Target Subdivision: [who]  |  Proposed Terms: [what]  |  Strategic Benefit: [why]

ONGOING STATUS: Current Alliances: [...]  Trade Relationships: [...]
                Competitive Tensions: [...]  Intelligence Assessment: [...]
=== END DIPLOMATIC RELATIONS SUBMISSION ===
```

### 8.4 Public Relations Department
*Manager: Communications Director.* Public Statement, Denounce, and Broadcast (all
already in the master rulebook, all public by nature — see §15). Plus three
**new, host-costed additions** bridging this document into the existing rules, priced in
line with existing Political Actions (2–5 Cr, 1/turn, same slot as Diplomatic Relations
under the default ruling above):

| PR Action | Cost | Effect |
|---|---|---|
| Reputation Campaign | 3 Cr | General image improvement, or reputational pressure on a named rival — social only, no mechanical penalty to the target. |
| Press Release | 2 Cr | Announce an achievement/capability; host posts it publicly, same channel as Public Statement. |
| Crisis Response | 2 Cr | Public damage-control message following an Event or a rival's Denounce. |
| Competitive Messaging | 3 Cr | Targeted public messaging naming a rival's weakness — same social-only rule as Denounce: no mechanical teeth, purely visible pressure. |

```
=== PUBLIC RELATIONS DEPARTMENT ===
SUBDIVISION: [Your Subdivision Name]
PR ACTION: [REPUTATION_CAMPAIGN / PRESS_RELEASE / CRISIS_RESPONSE / COMPETITIVE_MESSAGING]
Target Audience: [Colony / specific subdivision / MCA]  |  Messaging Strategy: [...]
Media Content: [the actual text the host posts publicly]

CURRENT STATUS: Colony Standing: [...]  Authority Relations: [...]
=== END PUBLIC RELATIONS SUBMISSION ===
```

### Submission-wide notes
- **Deadline discipline:** submission timing within the window is a real tactic — early
  submission locks in priority for genuinely contested actions (there's no other
  first-mover bonus; see §7, all actions resolve simultaneously by default).
  Late submission still means hold-position, no exceptions.
- **Security:** submissions are private to the host. Don't put actually-sensitive plans in
  a Public Relations submission — that one gets posted verbatim.
- **Notes to Host:** every department submission should include contingency instructions
  for anything that might fail (insufficient resources, contested claim, unmatched trade).
  Say what you want to happen instead, rather than leaving the host to guess.

---

## 9. Map & movement

12×8 hex grid. Free movement to one adjacent hex per turn as part of declaring an action
there — not a separate action. Mountains and Rare Minerals hexes are difficult terrain
(consume your entire movement) and Impassable terrain can never be entered, full stop.

**Transit Hub network:** hubs don't grant map-wide reach — they're nodes. A unit standing
in a connected hub's hex can jump to any other hub in that network (including the
permanent, universal Landing Zone hub) and act from there, no garrison required. Granting a
rival access to your network is a diplomatic outcome with no formal mechanic — track it
socially.

**Closed borders & spotting:** declare territory closed to a rival as a standing host
instruction. Crossing without permission risks a **20% base spotting chance**, +10% per
installed Fortification module in range, −10% for Analysts (stacks independently before
combining). A spotted unit is **captured** — held until the two players negotiate a
resolution directly; the host imposes no default.

→ Full terrain table and worked spotting-chance examples: xlsx "Map & Movement."

---

## 10. Vehicles

Built at the Vehicle Workshop: **hull (Light/Medium/Heavy) + modules**, crewed by existing
personnel (no new unit type). A destroyed/disabled vehicle's crew returns to the available
pool next turn — only the hardware is lost. Predefined modules are intentionally vague
(a category and a cost band, not a fixed stat block); players describe the effect within
the band, host confirms. Custom modules follow the same cost-band system.

→ Hull stats, predefined modules, custom-module cost bands: xlsx "Vehicle Hull Classes" /
"Vehicle Modules."

---

## 11. Events

15% base chance per turn. If triggered: scope roll (20% Colony-wide / 35% Regional / 45%
Subdivision), then tone roll (40% Hazard / 30% Opportunity / 30% Neutral). Subdivision
targeting is weighted toward real risk factors — no Hazard Shield, a dormant building, an
Emergency Extraction gamble — so under-investing in defense has a genuine (if small)
consequence. 8 Colony-wide, 6 Regional, and 8 Subdivision events are pre-written.

→ Full event tables: xlsx "Event System Overview" / "Colony-Wide Events" / "Regional
Events" / "Subdivision Events."

---

## 12. Earth Relations

Private, per-subdivision track (not shared), starting at **10**, range **0–30**.

**Rises from:** resource exports (+1 per 20 sold, cumulative), sharing completed Research
with Earth (+2 flat per submission), first-to-a-milestone (+3 one-time), 3+ consecutive
turns of positive net production (+1/turn, ongoing).

**Falls from:** Appeal to Earth (−3), Emergency Resupply (−1), Colonist Requisitions over 3
in one action (−1 per 3 above threshold), a building dormant 3+ turns or colonists arriving
with no housing (−2, Mismanagement Event).

**Thresholds:** below 5, colonist arrival slows to 4 turns and Emergency Resupply locks
out; at 0, Appeal to Earth locks out and Requisition costs +50%; above 20, Requisition
costs −25% and Expedited Delivery goes free; **above 25, your parent company's unique bonus
action unlocks** (§1 table, upgraded version — see xlsx); **at 30, the universal Sustained
Excellence bonus unlocks: a second Corporate Action slot per turn**, suspended if you drop
below 30.

---

## 13. Market & equity

**Dynamic resource market:** one colony-wide live price per resource, baseline 0.5 Cr
(Energy/Minerals) to 1.5 Cr (Research). Price moves with net colony-wide buy/sell flow each
turn (±15% cap per turn), then reverts 25% of the remaining distance to baseline —
moderate volatility, no permanent breaks. **Peer trade always beats Earth** when a buyer is
present (full live price vs. Earth's 0.80× sell / 1.20× buy through the Landing Zone).

**Subdivision equity:** 100 shares per subdivision at game start, all priced at 10 Cr.
Share price anchors to **(Composite Score ÷ 10) + 5**, shifted by trading pressure, floored
at 1 Cr. Dividends pay out of the issuing subdivision's own Credits at **Economic Score ÷
20**, split by ownership share — a strong Economic subdivision is attractive to invest in
but bleeds Credits to whoever owns its stock. No hostile-takeover mechanic exists; equity
is purely financial, never operational control.

→ Full formulas and worked examples: xlsx "Dynamic Market System" / "Subdivision Equity
Market."

---

## 14. Scoring & standings

Rolling standings, updated every turn, **no formal game end** by default (Phase Gamma in
§2 is the host-optional exception). Six category scores, weighted into one composite:

| Category | Linked Unit | Weight |
|---|---|---|
| Economic | Administrator | 1.0× |
| Industrial | Engineer | 1.0× |
| Research | Innovator | 1.0× |
| Territorial | Engineer/Contractor | 1.0× |
| Security | Contractor | 0.75× |
| Intelligence | Analyst | 0.75× |

Security and Intelligence are weighted down because they're partly reactive to rival
behavior rather than pure subdivision output. The colony dashboard shows composite rank
plus each subdivision's best category; per-category leaders get a cosmetic title
regardless of overall rank. Optional seasonal checkpoints (every 10–15 turns) recognize
current leaders with zero mechanical effect — a narrative beat, not a reset.

→ Category formulas: xlsx "Scoring System." Public-facing format: xlsx "Public Dashboard
Template."

---

## 15. Information visibility

Public by default: composite score/rankings, category leaders, building locations/types on
the map, claimed hex ownership, Public Statements/Broadcasts, Denouncements, Formal
Agreements, active colony Motions. **Private by default:** exact resource stockpiles,
garrison assignments, Earth Relations, module installations, research in progress,
captured-unit incidents (known only to the two subdivisions involved), vehicle loadouts.
Private information can be pried loose through specific intel actions (Corporate Audit,
Sensor Array, Surveillance) — not just asked for.

**Private turn report** (sent to each player every cycle): resource summary with net
change, building status, unit status (including anything captured), action results (intel
gathered stays private to you unless you choose to share it), event notification, Earth
Relations update, scoring snapshot with public rank.

→ Full table: xlsx "Information Visibility" / "Private Turn Report Template."

---

## 16. Operational boundaries & host protections

Corporate legal language, translated into actual house rules:

- **No sabotaging life support, full stop.** Direct sabotage of colony-critical
  infrastructure (as opposed to a rival's *specific* Extraction Site or Comms Array via the
  normal Sabotage unit action) is off the table regardless of "legal deniability." That's a
  hard line, not a competitive tactic.
- **Emergency cooperation is mandatory when declared.** Refusing to assist during a
  declared colony-wide emergency has real, host-applied consequences. Everything else —
  intelligence-gathering, market pressure, diplomatic isolation, "industrial accidents" that
  coincidentally help you — is fair game within the actions this rulebook actually defines.
- **Complaints and disputes go to the host privately**, not the public game thread. Litigate
  it in DMs; the public channel is for the game.
- **Host discretion is final** on genuinely ambiguous edge cases the rules didn't
  anticipate — resolved in the spirit of internal consistency and fairness, not a rigid
  algorithm. If you think a ruling is wrong, say so once, privately; repeated public
  litigating of a settled ruling is the fastest way to get deprioritized.
- **Spam, trolling, or deliberately wasting host time gets you removed.** No warnings owed
  beyond this sentence.
- **Send your turns on time.** The host is running eight processing phases by hand every
  cycle for every subdivision — showing up late and complaining about "hold position" is on
  you, not the host.

---

## 17. Known open items (intentionally unresolved — not bugs)

- **Tech tree / Apply Research** is deliberately freeform: players propose what they're
  researching, the host assigns a Research cost and effect at the table. No predefined tech
  tree exists by design.
- **Global habitability parameters** (Oxygen 0–14, Temperature 0–8, referenced by the Bio
  Facility's Global Contribution module) were sketched early but never rebuilt against the
  current ruleset — no defined thresholds or consequences yet. Host discretion until
  formalized.
- **Vehicle-vs-vehicle / vehicle-vs-building combat** has no dedicated resolution table —
  it currently falls under the general Conflict Resolution framework (§7, investment
  differential) via host judgment.
- **Political/PR department slot split** (§8) — default is a shared 1-per-turn slot between
  Diplomatic Relations and Public Relations; confirm if this table wants the expanded
  2-per-turn variant instead.
- **Subdivision registration form** — linked but unreadable in this pass (§3). Needs
  either its questions pasted in or sharing permissions fixed before it can be reconciled
  into the registration section.

---

## Appendix: where the crunch lives

This document is the field manual. `mars master rulebook.xlsx` is the codex — 24 sheets,
every number, every table, every worked example referenced above by name. When in doubt
about an exact cost or effect, that spreadsheet is authoritative.
