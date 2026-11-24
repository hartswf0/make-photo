# The Jerry Can

**The jerry can** is one level packed into a standard container. **The trough** is the shared world it pours into.

The goal is a world that feels much bigger than it is. Many levels are on call, each poured in when it is needed and drained when you leave. They arrive behind weather, never behind a loading screen.

This document has three parts:
- a taxonomy of what we have, from a survey of every level on 2026-11-24;
- the format that taxonomy implies;
- the order in which the levels get poured.

---

## 1. What we have

Nine pieces, each a whole game.

### At a glance

| Level | Renderer / three.js | Ground and frame | Load | Hardest knot |
|---|---|---|---|---|
| **Donkey Water** (`night-post/`) | r160 UMD (`field-plates/three.js`) | Teton grids from MONOLITH-3, with Ahiya (GLO-30, 10 m) grafted in by `unifiedGround`; metres | 21 MB MONOLITH-3 parse plus about 35 MB of sound, voice and donkey files | A single 7,700-line `boot()` closure and 240 DOM ids |
| **zones** (`zones/`) | r160 UMD | Fork of Donkey Water, without Ahiya | Same as Donkey Water | Same closure; goes through `DWBridge` |
| **MONOLITH** (Snake River → Half Dome) | r160 inlined, with GLTFLoader | Two scenes in scaled units: SNAKE_SCALE 470 ×0.44, Half Dome 300 m per unit | 18.5 MB of JSON | Its own multi-pass renderer, and it re-parents `scene.children` |
| **MONOLITH-3** (Grand Teton) | r179 ES module from a blob, plus a donkey written for r160 | Metres, origin at Adams's overlook | 21 MB, entirely `<script type=text/plain>` | Assets addressed by DOM id |
| **Highland Exposure** | No three.js: raw WebGL2, with a Canvas2D fallback | 14 km square, heights 1015–4522 m, 36:1 north–south squeeze | 6.7 MB inline plus 1.25 MB of mp3 | Not three.js, so it needs a port or a composited canvas |
| **Ethiopia Highlands** | r160 UMD | Four 384² tiles, real 5.8–16.5 km squeezed into 2,400 m, vertical ×0.52–0.76 | About 340 KB of data and 270 KB of JS per tile | Monolithic boot. The flora and fauna module already stands apart |
| **Abyssinian roof + transect** | r160 UMD | Orbit view in km at ×6 vertical, the Ethiopia pack on the ground, real field polygons | 0.5–1 MB | Two cameras; walk code copied from Ethiopia |
| **WYGWYL city** (`city/island`) | r160 ES module | 9,600 × 6,400 m, heights in decimetres, no datum | 1.8 MB JSON plus 26 MB of heroes | A 3,946-line top-level-await module of singletons |
| **The trough** (`atlas/overworld.html`) | r160 ES module | 62 × 56 km archipelago at true scale | Streamed: 2 km tiles plus a horizon | none |

### Bodies we already have, and how often each is rebuilt

| Body | Canonical source | Separate copies |
|---|---|---|
| Walker (human) | `CAST_2086.make` (30 ids), animated by `Mesh2MotionWorldBridge` (39 clips) | Imani is re-specified by hand in Ethiopia and the roof |
| Beast (Mistletoe) | `makeDonkey`, whose mind can refuse | 3 definitions (donkey.js, motion-lab, MONOLITH-3) |
| Creature | `endemic-fauna.js`: gelada, walia ibex, Ethiopian wolf and nyala state machines | Abyss whale, manta and jelly in Donkey Water |
| Vehicle | `DWVehicles.wagon` (Woody) | 4 wagon copies. Physics with suspension and damage lives in `night-post/world-physics.js` |
| Wing | `DWVehicles.rogallo` | 2. Ridge lift exists only in Ethiopia |
| Vessel | Inline in the trough | 1 |
| Fixture | Pumps, standpipes, cisterns, doors, relays and beacons | Everywhere, never shared |
| Item | Jerikan (`makeJerikan`) | 3 |
| Emitter | Voices (Kokoro mp3s placed at the speaker's head), tape, radio, field sound | Per level |
| Lens | Plates, meter, zone system | Separately in MONOLITH-3, Highland Exposure and Donkey Water |

### Other shared systems

**Player controllers and ground samplers:** about 10 controllers and 9 or more ground samplers.

**The interaction standard** already exists:
- `AhiyaBridge`: `state()` describes the scene (water, place, mode, live, things); `act` holds the verbs (live, exit, steer, look, lean, restore, warp…).
- The rain surface reads only this contract.
- Its vocabulary is draw, pour, give, ask, ride, drive, glide, sail, enter, expose, listen, jump.
- `ONTOLOGY.md` defines PLACE as keeper + verbs offered + requirements + roads in watches + the last wet sighting.

**Memory:**
- About 15 localStorage keys, none namespaced per level.
- The only shared memory is `sessionStorage['dw.carry']`, holding litres, donkey thirst and mode.

**Chance:**
- Gameplay is deterministic almost everywhere: seeded LCG or mulberry32 by region.
- `Math.random` is cosmetic, apart from NPC line picks and hints.

**What is already a jerry can:**
- `EthiopiaEndemicFauna.createEndemicWorld(T, terrainAdapter) → {root, update, dispose, landmarks}`. It is the one module that takes a host's ground and returns living content.
- `AbyssinianKits.make*(T)` and `DWVehicles`: pure builders.
- Everything else owns its renderer, camera, loop, input and DOM.

---

## 2. The format

### How other engines do it (as analogy, not as a model to copy)

**Rockstar's RAGE** is described publicly by its modding community as streaming typed packets from archives:
- map placements (`.ymap`), each placed entity carrying its own streaming extents and LOD parent;
- archetypes, meaning what a thing *is* (`.ytyp`);
- drawables and textures, collision (`.ybn`), navmesh (`.ynv`), path nodes (`.ynd`), and scripts (`.ysc`);
- named *IPL groups* switched on and off to change the state of a place (a building intact or destroyed).

What we borrow:
- **typed packets**: placement apart from definition, collision apart from look;
- **distance bands**: each packet arrives when it is needed;
- **state variants**: switched whole, not edited.

On **Fable's Saga framework**: I don't know it well enough to borrow from it honestly. If you point me at a source, I'll fold in what fits.

Our own language: LEGOS for what a place *means*, probable / plausible / preposterous for how it *varies*, and chance / consequence / memory for how it *changes*.

### A can on disk

```
<level>/can.json      the label: id, frame, sites (which islands it pours into), bands, budget, entry, packets
<level>/legos.json    Location · Entity · Goal · Obstacle · Solution, each with probable / plausible / preposterous variants
<level>/…             the level's own modules and data, referenced by the label; the level page stays as a wrapper for work
atlas/cans.json       the trough's shelf: every can it may pour
```

### The label (`can.json`)

| Key | Meaning |
|---|---|
| `id`, `name`, `version`, `page` | Who it is, and the standalone page for working on it |
| `entry` | `{ script, global, call, adapter }`: how to pour it. `adapter` names the contract the trough must offer, e.g. `terrain@1` |
| `ground` | `"trough"` (ride the shared ground: the default and the goal) or a packet of the can's own ground |
| `frame` | How the level's coordinates map onto true scale: `{ span, kx, kz, datum, vScale }` |
| `sites` | `[{ island, region }]`: one can may pour into several islands |
| `bands` | `{ scent, pour, drain }` in metres from the island edge |
| `budget` | `{ js_kb, data_kb, build_ms }` the can promises to stay within |
| `packets` | Typed parts in the order they stream: `kinds` (archetypes), `places` (placements), `life` (creatures and people), `voice` (sound and speech) |

### The bands (the RAGE idea, in our weather)

| Band | When | What happens | Hidden by |
|---|---|---|---|
| **label** | Always, in the archipelago build | Footprint, beams, doors, map entry | — |
| **scent** | Within `bands.scent` (7 km) | Fetch the label, the legos and the scripts; build nothing | — |
| **pour** | Within `bands.pour` (2.6 km) | Chance picks this visit's variants; the entry builds onto the trough's ground; sources, doors and keepers register | A squall: fog closes, rain thickens on the glass, lightning, then it clears |
| **fill** | Within about 300 m | People wake, voices load, bodies get physics | Distance and fog |
| **drain** | Beyond `bands.drain` (5.2 km) | The can returns what changed; the trough writes it to memory and disposes | Distance |

### Bodies: one record for everything that moves or can be used

```
{ id, kind: walker|beast|creature|vehicle|wing|vessel|fixture|item|emitter|lens,
  can, at:{x,y,z,yaw}, mode, holds:{litres,…}, needs:{thirst,…}, mind?, affords:[verb…] }
```

- The trough owns walkers, beasts, vehicles, wings, vessels and the lens: one controller, physics and camera each.
- A can owns its creatures, fixtures and local people.
- The surface sees every body through `things` and every affordance through `live`.

### Interaction: an affordance is a verb with a price and a consequence

```
{ verb: draw|pour|give|ask|ride|drive|glide|sail|enter|expose|listen,
  range, needs:{…}, gives:{…}, consequence: "<what memory records>" }
```

Verbs come only from the surface's vocabulary, so every level feels the same in the hand.

### The LEGOS graph (`legos.json`)

| Letter | Meaning |
|---|---|
| **L**ocation | A place in the can: `{ id, at, keeper, offers:[verbs], requires }` (the ONTOLOGY definition of PLACE) |
| **E**ntity | A body kind the can brings, with its source in code |
| **G**oal | A want, `{ id, want, status }` (live, proposed) |
| **O**bstacle | A rule that resists, with its source |
| **S**olution | An affordance chain that meets a goal despite an obstacle |

Any L, E, G, O or S may carry **variants**:
- **probable**: the canon, most visits;
- **plausible**: what might be true today, e.g. the standpipe is dry;
- **preposterous**: what should not be, but is, e.g. the cloud sea rises over the rim.

### Chance, consequence, memory: the meta-rules every can obeys

1. **Chance.** One seeded roll per pour, keyed on can, island and visit number. It picks the variants. `Math.random` stays cosmetic only.
2. **Consequence.** Every solution writes an event (`who, verb, what, litres, where, when`). Rules on events change things: a standpipe drawn heavily is likelier to be dry next time.
3. **Memory.** One ledger, `localStorage['dw.ledger']`, namespaced by can. Pour reads it to weight chance, and drain writes it. `dw.carry` becomes the ledger's *you* entry.

---

## 3. Pouring order

1. **Ethiopia Highlands.** Poured: `ethiopia-highlands/can.json` and `legos.json`, read by `atlas/regions.js`. The standpipe's variant is rolled each visit and remembered.
2. **Abyssinian kits and the transect.** The builders are already pure; the HiAce and Bajaj become vehicle bodies.
3. **WYGWYL city.** Extract `buildExpeditionCruiser`, the Severn door and the residents into an entry that takes `terrain@1`. Move the pilot localStorage into the ledger.
4. **Donkey Water / Ahiya.** Split the closure into world (stays in the trough) and level (pumps, cisterns, relays, cast jobs, the text engine). Ahiya's ground becomes its island's tiles.
5. **MONOLITH-3 and MONOLITH.** Move the embedded blobs into fetched packets, and use one three.js. The lens (zones, plates) becomes a trough body that every can may use.
6. **Highland Exposure.** Port it to three.js, or composite its canvas. Its hydrology and relay line-of-sight become obstacles in its legos.

The rule of thumb: **a can never brings a renderer, a camera, a loop, a player, a HUD or a storage key.** If it needs one, the trough is missing a service, and the service goes in the trough.

---

## 4. v1.1 fold-in: the LEGOS lineage, SAGA, kits, and four fixes

### Checked against sources

**LEGOS** (read from the `tractor-dce-gyo` repository):
- `prompt-library/LEGOS-scene-template.yaml` gives the shape:
  - entities with `type`, `traits` and `location`;
  - goals with an `owner`;
  - obstacles that `affects` a goal;
  - **shifts** with `causes` and `results_in`;
  - **relations** as `[morphism] a -> b`.
- `LEGOS-COGNITIVE-ARCHITECTURE.md` gives:
  - the **9×9 tray**: Center (axis mundi), Inner (protagonists), Outer (environment), Rim (boundary);
  - **Micro-PLoT**: `score = 0.3·G + 0.4·M + 0.3·W`.

**RIPPLES** (read from the `ripples` repository): a headless engine whose GOAL, OBSTACLE and SHIFT vectors produce ticked ripples. I did not find the one-hop cascade rule stated there.

**SAGA** (read from the `fablestudio/fable-saga` README):
- *"SAGA itself doesn't know how to drive the simulation or characters"* (Bring Your Own Simulation).
- Skills are `{name, description, parameters}`.
- The answer is `{options:[{skill, parameters}], scores:[…]}`, with the highest score first.
- There is a `POST /generate-actions` endpoint.
- It warns that memories grow until the context runs out.
- It does not say action scores are confined to 0..1.

### What changed in the format

- **S is Solution and Shift.** A solution names the shift it causes (`shift: {causes, results_in, ledger_delta}`). `relations` holds `[verb, from, to]` triples.
- **`zone_ring`** (center, inner, outer or rim) on locations and placed entities. It is a placement budget: anchors at the centre, interactive bodies in the inner ring, sparse pressure outside it, silhouettes on the rim. It is declared, not yet enforced.
- **Skills, the SAGA shape.** A beast entity carries `skills` (`name`, `description`, `parameters`, `when`, `score`). Every half second the trough scores them deterministically into SAGA's `{options, scores}`, best first, and moves the body itself. An external SAGA server could answer the same call later without the can changing.
- **Ripple.** A solution may carry `ripple: {radius, vector}`. When it fires, bodies within the radius get the vector, one hop. Drawing at the Simien standpipe raises a nearby donkey's *approach* from 0.55 to 0.9.
- **kit@1, alongside can@1.** Kits are archetype packets (the `.ytyp` idea), registered once from the shelf and named by any can:
  - `donkey/kit.json`: `pack.donkey`, `woody_1942`, `rogallo`;
  - `abyssinian-highlands/kit.json`: `abyssinia.hiace`, `.bajaj`, `.isuzu`, `.mast`, `.kiosk`, `.cobra_light`.

  A can places one with a few lines of LEGOS: `{body, archetype, at, offset}`. Simien now places a pack donkey, a parked Woody and a HiAce this way, with no mesh or controller code in the Ethiopia can. The per-level copies of the donkey and the Woody go when those levels become cans.

### Four fixes

1. **Drought lockout.**
   - Memory keeps a *dry bias* per source: +0.01 per litre drawn, capped at 0.5.
   - It recharges 0.08 for every visit to anywhere else (a global visit clock).
   - A preposterous or weather variant takes 0.25 off it.
   - Older ledgers that kept litres are migrated.
   - Memory is compact: counters plus the last 12 tuples `[visit, verb, entity, delta, tier]`.
2. **Storm gate.** The squall cannot clear before the region has mounted, nor sooner than 4 s after it began and 1.5 s after the mount. Mounting at 2.6 km and draining at 5.2 km leave a wide gap, so turning round near the shore does not re-trigger it.
3. **The glass.**
   - There is still one actionable offer at a time, `live`.
   - If frames run over 28 ms for 2 s, the storm on the glass is capped at 0.35.
   - Not yet done: keeping rain clear of the player's and speaker's boxes, and checking that Look drags never wipe an offer.
4. **kit@1 versus can@1.** Done, as above.

### Read, but not adopted as fact

The longer report proposes:
- a 64 MB budget with a 20 MB trough;
- an eight-compartment binary `.jcan`;
- 120 Hz IK and 32-byte coarse tokens;
- a 20-second storm timeline with a 60 m clear pocket around the player.

These are good targets, but they are not measured from this codebase, so they stay proposals. Worth taking from it:
- the storm should swap distant ground while the player's near pocket stays clear;
- drained bodies should survive as small tokens that keep living on a slow tick;
- rising water is a second veil, besides weather.
