# Donkey Water 2086: deep world ontology, and what it says about the map

Input: the Ahiya circuit as it exists in the build: `night-post/world-model.json` (law, invariants, transition table, places, roads, wells, circuits), the demo dialogue in `night-post/night-post.js` (`DEMO_KB`, `DEMO_SETS`), and the rain surface in `night-post/rain/`.
Everything below is grounded in those files unless marked `[inferred]` or `[proposal]`.

### OUTPUT — DEEP_WORLD_ONTOLOGY_MAP

```yaml
DeepWorldOntology:
  title: Donkey Water · Night Post · Ahiya Highlands, 2086
  thesis: >
    A world where data is wet. Recordings travel only while the can that carries them holds water;
    a dry can forgets. Water is drawn under a keeper's chalk line, and every copy moves only with a custodian's leave.
    Place is defined less by coordinates than by what water and signal can reach, and who may grant what there.
    So a map of this world is not a picture of ground: it is a claim, made by an archive, about where water and
    permission have been.

  source_stack:
    source: world-model.json (schema 1) + demo dialogue + rendered 3D terrain
    author_or_maker: the project author [world-model 'author' field]
    narrator_or_speaker: none; the world is told through what keepers say aloud (only text inside “…” is spoken)
    translator_or_mediator: seven draft translations (am, zh, es, pt, fr, de, ru), not native-checked
    archive_or_medium: the Hill Archive inside the fiction; the JSON world model outside it
    worldtext_layer: 'law', 'invariants', 'storyGrammar', 'transitionTable' (the rules as text)
    prompt_or_interface_layer: the rain surface (glass, drops, edge menu, chart); the in-world tablet and monitor

  object_or_world:
    id: donkey-water-2086
    type: playable speculative ethnography / logistics game
    ontological_status: fiction with a formal rulebook; the rulebook is machine-checked (invariants)
    functions_as: [simulation, archive, custody ledger, route game, song-return story]
    primary_layers: [water law, signal reach, custody of recordings, roads and watches, keepers' testimony]

  upper_ontology:
    continuants:
      persons: [Rahel (carrier), Saba (pump keeper), Aunt Lemlem (custodian), Daniel (rack log), Hanna (radio/monitor),
                Tesfaye (unloads, pours), Desta (hitch), Biruk (child, tablet), Yared (films the convoy), Abba Gebre, Memhir Solomon]
      groups: [the night convoy, the compound household, the hill operators, the congregation at the wall]
      creatures: [Saba's gray donkey: a living carrier whose wet saddle keeps a recording 'in order while it moves']
      artifacts: [saddle can (20 L), chalk line, pump lever, gauge reading, cooling rack, lacquer seal, phones, tablet,
                  monitor, sheet screen, root bowl, field plates, film trees]
      places: [Basalt Pump, Cross-Beacon Watch, Hill Archive, Daylight Compound]
      institutions: [the hill archive (labels, files, cools), the pump (keeper's jurisdiction), the congregation (lends the wall)]
      cosmic_entities: [the beacon mast: line of sight is signal]
      information_entities: [AR–03 (three rehearsal takes), wet copies, phone copies, the hill's map, the catalog,
                             the log, Saba's signed gauge reading, dispatch slips]
    occurrents: [draw, overdraw, go (a road leg), ask leave, cool, copy, label, screen, listen, file, tap, water the animal,
                 rest, handoff at the 18th watch, a can drying]
    qualities: [liters aboard, reserve (≤4), wetness of a copy, signal (mast visible or not), well stock and floor,
                animal strength (0..6), watches spent (0..18), altitude]
    roles:
      carrier: valid while holding the can on a circuit (Rahel)
      keeper: valid at one well (Saba); may close the intake against the remote map
      custodian: valid over one recording (the aunt); grants public cut vs household take
      operator: valid at the rack (Daniel cools, Hanna labels)
    dispositions:
      can: forgets every copy when liters reach 0
      well: recovers at its recharge rate; closes after an overdraw
      donkey: keeps the moving recording legible while watered
      tablet: works only within sight of the mast

  spatial_ontology:
    places:
      basalt: {altitude: 16, role: source (only wells produce water), jurisdiction: Saba, chart: [20,73]}
      beacon: {altitude: 85, role: permission (the aunt's leave), jurisdiction: the congregation's wall, chart: [43,24]}
      hill:   {altitude: 71, role: hub/archive (cool 9 L, copy, label), jurisdiction: the operators, chart: [75,?]}
      compound: {altitude: 24, role: yard (screen 3 L, tap, listen), jurisdiction: the household, chart: [79,76]}
    topology: a ring of roads, not a field. basalt–beacon 1 watch, beacon–hill 1, hill–compound 1, compound–basalt 2.
    jurisdictions: each stop has a keeper whose word can override the remote record (Saba vs the hill's tank reading)
    access_rules:
      - hill copy requires the beacon visited (the aunt's leave)            # Hanna: "No leave from the white wall, no copy"
      - cooling requires 9 L above the chalk                                  # Daniel
      - screening requires 3 L above the reserve and the aunt's leave        # Tesfaye
      - reserve water (first 4 L) is travel water; keepers refuse it          # Tesfaye: "That is travel water"
    sacred_or_symbolic_status: the white wall (lent by a congregation; the beam has many names)
    memory_layers: [the thread on the pump handle marking the last public draw, the catalog, the log, chalk on the can]
    routes: road graph above; the rendered terrain lets you walk off-road, the law does not price that
    boundaries: [the ridge: behind it the tablet goes dark; direct sun: phones go dark in the compound]
    narrative_functions: source → permission → archive → screening; a song travels this ring inside water

  temporal_ontology:
    chronological_time: year 2086
    ritual_time: the night route; a screening at night; the aunt sings the answer in person, once
    mythic_time: none asserted
    seasonal_time: none modelled
    institutional_time: a shift of 18 watches; handoff at the last watch; an overdraw closes a well for two shift changes
    subjective_time: none
    simulated_time: one watch per pump action or road leg; reading costs zero time (invariant)
    uncertain_or_disputed_time: the hill's map is stale between sightings ("where a can was seen")
    retcon_or_version_time: the catalog is corrected by a returning credit ('returnTitle')

  event_ontology:
    - id: draw
      type: transfer
      participants: [carrier, keeper, well, can]
      place: basalt
      instruments: [lever, chalk line]
      caused_by: carrier's request
      produced: water aboard; reserve topped to 4
      changed_state_of: [well stock, can liters]
      asserted_by: transitionTable 'pump'
      certainty: rule
    - id: overdraw
      type: transfer with sanction
      produced: up to 4 L
      changed_state_of: well closed for two shift changes
      asserted_by: Saba ("I close this pump for two shift changes")
    - id: ask_leave
      type: speech act / grant
      participants: [carrier, custodian]
      place: beacon
      transferred: the right to copy and to screen
      asserted_by: Hanna, Tesfaye (both refuse without it)
    - id: cool_and_copy
      type: transformation of a recording's status
      place: hill
      instruments: [9 L of water above the chalk, the rack]
      produced: a licensed cut; a label naming the aunt as custodian
    - id: screen
      type: public exhibition
      place: compound
      instruments: [3 L, sheet, root bowl, the aunt's living voice]
      produced: the public verse with a live answer
      forbidden_variant: a household take entering the public screen (invariant)
    - id: can_dries
      type: loss
      destroyed: every wet copy
      asserted_by: invariant 'liters == 0 implies all wet copies clear'

  social_ontology:
    persons: see continuants
    groups: [convoy, household, operators, congregation]
    factions: none hostile; tension is between remote record and local keeper
    institutions: [pump, archive, compound]
    offices: [pump keeper, custodian, rack operator, radio operator, unloader]
    roles: carrier is the only travelling role; everyone else is placed
    statuses: [visited, wet, licensed, labelled, screened]
    powers:
      Saba: close the intake regardless of the map
      the aunt: grant or withhold listening and screening
      Hanna: write the custodian onto the seal
    obligations: [keep the donkey watered, keep reserve for the return, name the custodian on the seal]
    recognition: names go on the seal; both singers stay on the take
    contestation: the hill's map vs Saba's gauge; which take is "the one" (the wrong-key one is the one where they came in together)
    enforcement: keepers refuse; the can forgets; the well closes

  normative_ontology:
    laws: [the six law paragraphs in world-model.json]
    taboos: [drawing below the chalk without need; screening a household take]
    oaths: none
    ritual_rules: the aunt sings the public answer only in person
    permissions: [routine draw to the chalk; copy after leave; screen after leave with 3 L]
    prohibitions: [spending reserve on cooling, tap or screen]
    obligations: [return credit travels in a wet can back to the rack]
    exceptions: [explicit emergency release may empty the whole can]
    sanctions: [well closed; copies lost; keeper refusal]
    authority_sources: [keepers at their place; the custodian over the recording; the invariants over everyone]

  semiotic_ontology:
    signs:
      - sign: the chalk line
        sign_vehicle: a white line drawn across the can
        referent: the 4 L reserve (travel and animal care)
        interpreter: every keeper
        code_system: the water law
        force: normative (below it is not yours to give)
        ambiguity: none
        effect: keepers refuse reserve water
      - sign: wet cyan on the route
        sign_vehicle: the monitor and tablet draw the route in cyan where cans are wet
        referent: where data has physically travelled
        interpreter: Hanna, Biruk
        code_system: the hill's map
        force: informational, and partial ("nowhere else")
        possible_readings: [where the road is, where water has been, where the archive has seen you]
        effect: the map is a trace, not a territory
      - sign: the tank reading on the hill's map
        referent: well stock
        interpreter: operators
        force: contested; Saba can close the intake "even when the map up the hill says the tank is full"
      - sign: the beacon
        referent: the road (Gebre) and signal reach (Biruk: "When you can see the mast, the tablet works")
        possible_readings: [the road, the congregation's wall, the network]
    symbols: [the donkey as living storage; water as memory; drying as forgetting]
    omens: none
    names: the beam has different names from different people
    gestures: Saba listens for the short stroke before opening the valve
    sounds: the chair scrape before the first note identifies a take
    inscriptions: the seal naming the custodian

  source_ontology:
    sources:
      - id: hill_map
        type: remote map (in fiction)
        author: the hill operators
        medium: monitor / tablet
        bias: shows only where cans were seen wet; stale between sightings; claims tank levels it does not see
        authority_level: institutional
        canon_status: in-world document, explicitly contestable
        contradicted_by: Saba's signed gauge reading
      - id: saba_gauge
        type: signed local reading
        author: Saba
        authority_level: local, embodied
      - id: demo_dialogue
        type: testimony
        bias: each speaker knows their own stop
      - id: world_model
        type: rulebook
        authority_level: absolute inside the game
      - id: rain_chart
        type: the player's map (out of fiction)
        author: the interface
        bias: shows geometry and distance only; no custody, signal, watches, or provenance
        canon_status: non-diegetic; it contradicts the world's own idea of a map

  claim_ontology:
    claims:
      - id: c1
        content: the tank is full
        asserted_by: the hill's map
        contradicted_by: Saba's gauge
        certainty: disputed
        modality: remote claim
      - id: c2
        content: the route glows where cans are wet and nowhere else
        asserted_by: Biruk, Hanna
        certainty: canon
        modality: description of the in-world map
      - id: c3
        content: you are 235 m north-west of the Cross-Beacon
        asserted_by: the rain chart
        certainty: geometrically true
        modality: out-of-world fact that the world does not use (the law prices legs in watches, not metres)
      - id: c4
        content: you can travel instantly to any stop
        asserted_by: the rain chart's Go
        contradicted_by: transitionTable 'go' (adjacent road, watches, strength)
        canon_status: violates the law

  modal_ontology:
    actual_canon: the law, invariants, roads, keepers
    disputed_canon: the hill map's readings
    apocryphal: the ambient city layer from the parallel session (not part of the circuit law)
    prophecy: none
    possible_future: the screening; the return credit
    impossible_under_current_rules: [copy without leave; screen a household take; spend reserve on cooling; a wet copy in a dry can]
    dream_world: none
    simulated_outcome: the 12 s weather memory on the glass (looking back never changes state)
    alternate_timeline: the western circuit runs in parallel; switching hands leaves the other where it was
    retconned_timeline: the catalog corrected by the return credit
    fanon: none
    mythic_truth: water remembers while it moves

  ecology_ontology:
    species: [the gray donkey]
    habitats: [highland ridge, lower pump, yard in direct sun]
    predator_prey: none
    symbiosis: carrier and donkey share strength and water; the donkey drinks from the reserve
    cycles: [well recharge per shift; donkey thirst; 18-watch shift]
    resource_flows: well → can → (animal | cooling | tap | screen | flight); invariant 'drawn == aboard + every outflow'
    ecological_effects: overdraw closes a well
    cultural_meanings: water is both survival and the medium of memory
    economic_uses: cooling the rack; the public tap for households
    ritual_uses: the root bowl and sheet for the night screening

  artifact_ontology:
    artifacts:
      - id: saddle_can
        type: container and storage medium
        materials: [can, water, chalk]
        powers: carries wet copies; forgets them when dry
        activation_conditions: liters > 0
        symbolic_force: the player's body in the world of data
      - id: AR–03
        type: recording (three rehearsal takes)
        ownership_chain: cousin (recorder) → aunt (custodian) → hill (licensed cut) → compound (screening) / aunt's phone (household take)
        copies: wet copy (fragile), phone copy (survives), licensed cut (public)
        symbolic_force: the wrong-key take is the true one
      - id: hill_map
        type: information artifact
        powers: shows where cans were seen
        inscriptions: cyan wet trace
        source_attestations: Hanna, Biruk
        symbolic_force: the archive's view, partial and stale

  interface_ontology:
    interface_object: the rain surface over the 3D world (glass, drops, edge menu, chart), plus in-world monitor/tablet
    access_modes: [walk, ride, drive, glide; tap a thing; carry water; read the chart]
    user_positions: carrier (embodied, inside the world) and reader (above it, at the chart)
    reading_paths: currently chart-first (where is X); the world reads custody-first (who may grant what, and with how much water)
    interaction_modes: [direct (tap the pump), carried (drag the can), deferred (menu)]
    rendering_modes: [3D scene, glass layer, chart image]
    output_surfaces: phone screen in portrait
    machine_readability: world-model.json is fully machine-readable; the chart uses none of its law
    world_navigation_function: >
      should let the carrier decide where water and permission are needed next; today it only says how far away a dot is.

  structural_oppositions:
    - {opposition: remote vs local, side_a: the hill's map, side_b: the keeper's gauge, function: truth is local, records lag}
    - {opposition: wet vs dry, side_a: remembered, side_b: forgotten, function: water is the condition of memory}
    - {opposition: household vs public, side_a: the take on the aunt's phone, side_b: the licensed cut on the sheet, function: custody splits one recording into two lawful lives}
    - {opposition: signal vs shadow, side_a: mast in sight, side_b: behind the ridge, function: knowledge has a geography}
    - {opposition: reserve vs surplus, side_a: travel and animal water, side_b: water you may give, function: a moral line drawn in chalk}
    - {opposition: road vs field, side_a: priced legs in watches, side_b: open terrain, function: the law counts time, not distance}

  operative_worldtext_reading:
    as_archive: the hill files, labels and corrects; the catalog is mutable by return
    as_map: a wet trace drawn by the archive, partial by design
    as_lawbook: six paragraphs and five invariants, enforced by keepers and by the can itself
    as_calendar: 18 watches a shift; wells close for two shift changes
    as_simulation: transitionTable with requires/effects/watches per verb
    as_ecology: one closed water budget from well to every outflow
    as_ritual_score: the screening needs water, leave, the sheet, and a living voice
    as_artifact: the can is the save file
    as_interface: the monitor and tablet are the world's own UI: cyan where wet, dark behind the ridge, dark in direct sun

  minimum_computable_schema:
    Entity: {id, type, persists_through_time, current_state, source_claims}
    Event: {id, type, participants, place, time(watch), caused_by, produced, destroyed, changed_state_of, source_claims}
    Claim: {id, content, about, asserted_by, source(hill_map|keeper|law|chart), seen_at(watch), certainty, contradicted_by}
    Source: {id, type, author, authority_level, reach(signal), staleness}
    Place: {id, road_edges(watches), altitude, keeper, offers(verbs), requires(permissions, liters above chalk), wet_seen_at}
    Role: {id, holder, place, powers, obligations}
    Norm: {id, condition, required, permitted, forbidden, sanction, exception}
    Modality: {status: canon|disputed|remote|stale|impossible}

  final_interpretation:
    compressed: Water is memory, signal is reach, keepers are law, and the archive's map is a partial, stale claim.
    deepest_sentence: >
      In Donkey Water a map is not a view of the ground but the archive's memory of where wet cans have passed,
      and the carrier's real question is never "how far" but "what will this water and this leave let me carry next".
    formula: PLACE = keeper + verbs offered + what it requires (leave, litres above chalk) + roads in watches + last wet sighting
```

### QUICKCHECK
- upper ontology mapped: yes
- events modeled as transformations: yes
- claims separated from facts: yes
- source/provenance included: yes
- time layered beyond timeline: yes
- space layered beyond map point: yes
- social roles/institutions included: yes
- semiotic layer included: yes
- normative layer included: yes
- modal reality included: yes
- ecology/artifact/interface included: yes
- final interpretation clear: yes

---

## Why the map fails, read through this ontology

1. **It answers a question the world never asks.** The chart shows metres and compass bearings (claim c3). The law prices a leg in watches and animal strength along a ring of roads. Nobody in Ahiya measures in metres.
2. **It breaks the law it sits on top of.** "Go" teleports (claim c4). The transition table says a road leg needs an adjacent road, costs watches, and spends strength. The game's own rules call that move impossible.
3. **It hides the real dependencies.** The ring is a chain of custody, not four dots in an order. It carries water from the source, the aunt's leave at the wall, a 9 L cooling at the hill, and a 3 L screening at the yard. The chart numbers the stops 1–4, but the actual blockers ("no leave, no copy"; "not from your reserve") are invisible on it.
4. **It is omniscient where the world is partial.** In fiction, the only map is the hill's, which draws the route "in cyan where the cans are wet, and nowhere else". It goes dark behind the ridge and is contradicted by Saba at the pump. The chart is a god's-eye view that no one in the world could hold.
5. **It ignores the chalk line.** The single most important sign in the world, the 4 L reserve mark, appears nowhere on the map or on the can gauge.

## [proposal] A map that belongs to this world

- **The can gauge carries the chalk line.** A mark at 4 of 20. Water above it glows (yours to give); water below is dull (travel water).
- **The map is the hill's wet trace.** Roads you have carried water along are drawn in cyan, fading as that water is spent. Roads you have never walked are faint, dotted with what people told you ("the aunt is at the white wall").
- **Legs in watches, not metres.** Each road shows its cost (1 or 2 watches). The shift (18 watches) is a tide line that rises along the edge of the map.
- **Each stop shows what it requires and offers, as water.** The hill shows a 9-litre basin over the chalk, filling to the level you could pour. The yard shows 3 L. The wall shows a closed seal until the aunt's leave, then an open one. You read readiness at a glance, without words.
- **Disputed readings stay disputed.** The basalt well shows two levels: the hill's claim, and Saba's gauge once you have stood there. They are not merged.
- **Signal shadow.** Behind the ridge the map stops updating and shows its age, as the tablet does.
- **No teleport.** "Go" lays a current along the road. It becomes a direction on the glass, and the guide rain falls along it. Flight stays the only fast travel, and the law confines it to the western circuit.
