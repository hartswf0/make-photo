# MERCATOR-ZERO compiled against Donkey Water 2086

Upstream: `night-post/rain/ONTOLOGY.md` (PRIME). Grounding: `night-post/world-model.json`, `night-post/night-post.js`.
Real numbers below come from the build: stop positions (`DEMO_SETS`), road legs in watches, signal reach (`state.signalRadius` 24..245 m, relays 28 m, Pueblo relay 38 m, awake groves 26 m), the abyss (`ABYSS_SURF_Y 86`, `ABYSS_BASE_Y 47.5`), the can (20 L, chalk at 4 L), the shift (18 watches).
Where the source world has no analogue (pursuers, interiors), the spec adapts the layer to what the world does have and says so.

### OUTPUT : EPISTEMIC_CARTOGRAPHY_SPEC

```yaml
EpistemicCartographySpec:
  world_id: donkey-water-2086
  title: Night Post · Ahiya Highlands and the Western Basin
  cartographic_thesis: >
    The only map in this world is the hill archive's wet trace: it knows a road only where a wet can has crossed it,
    a well only by its last reading, and a person only by their last sighting in signal. The player's map is that
    trace, partial and dated, never a god view. Locomotion is helped; custody, signal and thirst are never spoiled.

  seed_and_bilateral_filter:
    world_summary: Recordings travel inside water. A carrier walks a ring of four stops with a donkey and a 20 L can under keepers' law.
    spatial_scale_and_units:
      ahiya_ring: about 300 m x 235 m; basalt (-1460,760), beacon (-1610,590), hill (-1765,540), compound (-1680,775)
      western_basin: 8 stops, altitude 8..190 m, roads of 1 to 2 watches
      playable_extent: about 2 km west to east; z to 1020
      native_units: watches for time, litres for water, strength 0..6 for the animal; metres only for terminal approach
    diegetic_tech_horizon: 2086 consumer phones, a tablet, a radio desk, a monitor, mast relays; mesh signal carried by the donkey and lit relays
    locomotion_aids_amplified:
      - signal: road ribbon underfoot
        friction_solved: switchbacks and the beacon ridge are easy to lose in rain and dusk
        rendering_mechanism: a thin wet sheen on the road surface within 25 m ahead, only while a route is set
      - signal: grade cue
        friction_solved: the beacon is 69 m above basalt; climbs cost the donkey
        rendering_mechanism: rivulets on the glass run faster downhill of the route and pool on climbs
      - signal: terminal approach ticker
        friction_solved: finding the spout, the trough, the root bowl in the last metres
        rendering_mechanism: under 15 m the strip shows whole metres; beyond, watches
    epistemic_spoilers_removed:
      - legacy_mechanic_removed: omniscient chart of all stops with live distances (current rain chart)
        replacement_world_affordance: the hill's wet trace; unwalked roads appear only as what people said
        cognitive_shift: from "how far" to "what has my water reached"
      - legacy_mechanic_removed: instant Go to any stop
        replacement_world_affordance: road legs priced in watches; flight only on the western circuit (1 L local, 2 L Teton)
        cognitive_shift: travel is a spend of time, strength and water
      - legacy_mechanic_removed: live well levels everywhere
        replacement_world_affordance: a well is shown by its last reading and its reader; Saba's gauge and the hill's claim stay separate
        cognitive_shift: records lag; keepers know
      - legacy_mechanic_removed: requirements as hidden checks
        replacement_world_affordance: each stop shows its requirement as a basin of water to fill (9 L hill, 3 L yard) and a seal (the aunt's leave)
        cognitive_shift: readiness is read as water, not as a checklist

  diegetic_vessel_and_modes:
    vessel_artifact:
      name: the route tablet (Biruk's and Hanna's view)
      material_or_os: a phone/tablet slate receiving the hill's mesh; drawn behind the rain glass
      environmental_reactivity:
        - mast in sight or donkey within signalRadius: updates live
        - behind the ridge or beyond reach: freezes and shows the watch of its last update
        - direct sun in the compound: washes out to 20 percent contrast
        - dry can: your own trace stops drawing
      in_world_maker_or_authority: the hill archive operators; contested by keepers on the ground
    visibility_modes:
      fade_default:
        rest_state: zero chrome on foot at walk speed with no alert
        wake_triggers: [route set, thirst alert, can at or below chalk while giving, mount or wagon engaged, glance gesture]
        manual_glance_input: two-finger press on the glass, or hold the edge seam 0.4 s
        linger_duration_sec: 4
      cardinal_strip_mode:
        placement: top edge, 22 px tall water line
        bearing_format: named stops only where known; unknown bearings stay blank
        distance_ticker_precision: watches to one decimal beyond 15 m; whole metres under 15 m
        terminal_unit_switch_threshold: 15 m
      classic_dock_mode:
        anchors_available: [left flank, right flank]
      pure_zero_chrome_mode:
        world_signifiers_relied_upon: [the beacon mast light, the white wall, road chalk arrows, pump clank, the donkey's head turning toward water, singing from the compound at night]
    diegetic_transit_and_dispatch:
      point_to_point_travel: walk the road graph; a set route lays a current along it; no teleport on the Ahiya circuit
      mount_or_vehicle_retrieval: call the donkey by touching it at range under 40 m; beyond that it is found by the signal it carries
      asset_permanence_registration: the can, the wagon and plates stay where left and are logged on the trace with the watch they were left

  epistemic_hud_and_waypointing:
    hud_state_machine:
      - state_id: REST
        condition: speed <= walk and no route and no alert
        visible_elements: [none]
        suppressed_elements: [strip, gauge, act drop, trace]
      - state_id: READY
        condition: a thing within 6 m offers an act, or a route is set
        visible_elements: [one act drop on the thumb rail with a thread to its thing, can gauge with chalk line]
        suppressed_elements: [map, strip unless route]
      - state_id: WORKING
        condition: water is moving (draw, give, cool, screen)
        visible_elements: [the flow between can and thing, can gauge rising or falling, Stop by lifting]
        suppressed_elements: [everything else]
      - state_id: CHANGED
        condition: litres or permission changed in the last 2.5 s
        visible_elements: [before and after on the gauge, one bead holding the way back]
        suppressed_elements: [strip]
      - state_id: ALERT
        condition: donkey water < 0.3, or donkey down, or can at chalk with a giving act pending
        visible_elements: [amber act with one verb, thread to the thing, guide rain on it]
        suppressed_elements: [all non-alert drops]
    frustum_raycast_waypointing:
      input_gesture: press and hold on a far thing in the 3D view 0.5 s; release to set it as the route target
      max_raycast_range: 420 m
      candidate_projection_behavior: snaps to the nearest stop, keeper or road node within 30 m of the hit; otherwise a ground pin
      effect_on_fade_timer: wakes the strip for 4 s, then the route lives only as the road sheen and the strip
    chromatic_and_badge_semiotics:
      mandatory_story_vector: amber, the custody chain (leave, cool, screen)
      custom_player_vector: cyan, a route you set
      friendly_partner_blip: none; the donkey is found by its signal ring on the trace only
      competitive_peer_blip: none in this world
      minor_errand_pin: chalk white, the side post (three sounds from one room)
      expiring_deadline_badge: a tide mark that fills toward the 18th watch
      district_notoriety_polygon: not applicable; replaced by well closure shading (see below)
      novelty_index_marker: a single bead on the index tab with new entries
    conditional_vital_gauges:
      - gauge: can litres with chalk line at 4 of 20
        wake_condition: any water act, or below 1 L above chalk
        hide_condition: 4 s after the last change
      - gauge: donkey strength 0..6
        wake_condition: strength <= 2 or a road leg would exceed it
        hide_condition: strength >= 4
      - gauge: watches left in the shift
        wake_condition: 3 or fewer watches left
        hide_condition: handoff

  adversary_belief_system:
    omniscient_cones_enabled: false
    adaptation_note: Ahiya has no hunters. The adversary is the archive's partial knowledge and the world's attrition (drying, thirst, sun, closed wells). Belief is the hill's belief.
    belief_zone_geometry:
      inner_core_meaning: where the hill last saw your wet can in signal, radius 28 m
      outer_ring_meaning: where it could be by now at walking pace since that sighting, growing 0.8 m per second, capped at 240 m
      post_escape_persistence_rule: leaving signal freezes the core; the ring keeps growing until the next sighting
      max_escalation_map_state: after 3 watches unseen the trace marks the can "unconfirmed" and keepers ask where you have been
    peripheral_threat_indicator:
      surface: glass edge
      signal_encoding: dryness frosts the edge nearest the hottest, sunniest direction; a closing well chills its edge blue
    recognition_profile_vector:
      observable_tells: [the gray donkey, the chalk on the can, the saddle pad, Rahel's route time, the song you carry]
      witness_transmission_chain: keeper speaks to the hill on the radio; the hill updates the trace at the next sighting
      countermeasures_to_shed_profile: none needed; tells are recognition for trust, not for capture
    paid_active_sensing:
      ability_name: listen
      resource_cost: one watch
      occlusion_penetration_rule: reveals which stops behind the ridge have water and who is there, as the radio reports, dated now
    district_memory_overlay:
      trigger_threshold: an overdraw at a well
      map_tint_visual: the well's catchment shaded dry ochre on the trace
      systemic_world_effect: the well is closed for two shift changes and until stock exceeds floor; keepers mention it
      cooldown_condition: two handoffs and stock above floor

  volumetric_semantic_zoom:
    macro_urban_or_ruin_massing:
      enterable_volume_shader: stops with a keeper are a warm low glow on the trace
      sealed_volume_shader: everything else neutral slate
      estimated_enterable_ratio: 4 of about 30 visible structures on the Ahiya circuit
      threshold_entry_glyph: a short chalk tick on the road where a stop begins
    proximity_floorplan_streaming:
      activation_radius_meters: 18
      extruded_geometry_detail: the working parts only: spout and trough at basalt; the wall and the aunt's stool at the beacon; the rack and window at the hill; the root bowl, sheet and tap at the compound
      vertical_multi_floor_handling: the hill rack shows its inner bay only after cooling 9 L
    threat_jamming_interaction:
      jam_trigger: direct sun at the compound, or out of signal
      visual_override_behavior: the inner layout washes out; only the outline stays
      tactical_consequence: you must have read the yard before noon or read it with your own eyes

  z_axis_opacity_and_lifelines:
    elevation_culling_engine:
      applies_to_environments: [the Whale Fluke abyss (western circuit), the beacon ridge's lee]
      active_z_band_meters: 8
      unvisited_z_slice_state: not drawn; the trace shows only the surface of the water
      pause_atlas_pitch_ambiguity_rule: depth is never flattened onto the plan; descended bands stack as rings, unvisited bands are absent
    diegetic_lifelines:
      - id: saddle_tether
        physical_form: the donkey's lead line, its signal ring the true lifeline (signalRadius 24..245 m by elevation)
        directional_exit_encoding: the glass rivulets lean toward the donkey
        visibility_dependency: within signalRadius
        failure_or_severance_condition: descending below the abyss rim breaks line of sight; the ring collapses to 24 m
      - id: chalk_arrows
        physical_form: chalk marks keepers leave on stones at junctions
        directional_exit_encoding: arrow points toward the nearest well
        visibility_dependency: light; unreadable after dusk without a lamp
        failure_or_severance_condition: rain thins chalk over 6 watches
      - id: lamp_line
        physical_form: the convoy's lamps strung along the night trail (Yared films it)
        directional_exit_encoding: lamp spacing tightens toward the beacon
        visibility_dependency: night
        failure_or_severance_condition: lamps go out at the 18th watch
    sensory_decay_strata:
      - tier: surface
        depth_or_altitude_band: 86 to 78 m (abyss surface)
        illumination_and_turbidity: full dusk light, clear
        acoustic_and_vital_pressure: rain on water, donkey audible
        map_legibility_state: live trace
      - tier: kelp
        depth_or_altitude_band: 78 to 66 m
        illumination_and_turbidity: green, 30 m visibility
        acoustic_and_vital_pressure: rain gone, heartbeat audible
        map_legibility_state: frozen at entry watch
      - tier: fluke
        depth_or_altitude_band: 66 to 55 m
        illumination_and_turbidity: blue-grey, 12 m visibility, whale ribs
        acoustic_and_vital_pressure: low song of the whale geometry; breath tightens
        map_legibility_state: blank except your descent ring
      - tier: seabed
        depth_or_altitude_band: 55 to 47.5 m
        illumination_and_turbidity: near dark, ship hull, 4 m visibility
        acoustic_and_vital_pressure: silence
        map_legibility_state: none
    ecological_hazard_proxies:
      - proxy_sign: the donkey refusing the road
        observable_world_behavior: it plants its feet and turns its head
        hidden_hazard_indexed: a leg that would exceed its strength
        reliability_and_edge_case: always reliable; it also refuses when merely thirsty
      - proxy_sign: phones going dark
        observable_world_behavior: screens dim in the compound at midday
        hidden_hazard_indexed: direct sun drying an uncovered can
        reliability_and_edge_case: reliable in the yard, absent under the awning
      - proxy_sign: the thread on the pump handle
        observable_world_behavior: thread marks the last public draw
        hidden_hazard_indexed: the well is near its floor
        reliability_and_edge_case: only as recent as the last keeper
      - proxy_sign: fans going quiet at the hill
        observable_world_behavior: the rack fans slow
        hidden_hazard_indexed: the rack is warm and copies will not take
        reliability_and_edge_case: reliable
    hubris_threshold_trap:
      location_name: the fluke ribs, Whale Fluke Cistern (altitude 8)
      diegetic_warning_inscription: chalk on the cistern lip, "a dry can forgets"
      lure_artifact_or_reward: a lost recording's wet copy caught in the ribs
      severed_lifeline_twist: below the rim the donkey's signal ring collapses and the can begins to cloud; returning by memory of the ribs is the only way up with the copy still wet

  macro_atlas_and_temporal_archive:
    fog_of_war_mechanics:
      unlock_granularity: road legs and stop catchments, not a radius; a leg lifts when walked with a wet can
      boundary_crossing_feedback: the leg fills with cyan from the near end as you walk it
      total_named_parcels: 4 stop catchments and 4 road legs on Ahiya; 8 stops and 7 legs on the Western Basin
    categorized_discovery_index:
      slide_out_input: pull the edge seam inward past 40 percent of the width
      total_cataloged_nodes_target: 48
      tabs:
        - {tab_id: wells, symbol: a filled bead, tracked_subcategories: [stock reading, reader, floor, closures]}
        - {tab_id: keepers, symbol: a chalk line, tracked_subcategories: [who, what they grant, what they refuse]}
        - {tab_id: roads, symbol: a current, tracked_subcategories: [legs walked, watches, grade]}
        - {tab_id: recordings, symbol: a wet seal, tracked_subcategories: [wet copies aboard, phone copies, licensed cuts]}
        - {tab_id: leave, symbol: an open seal, tracked_subcategories: [granted, pending, refused]}
        - {tab_id: plates, symbol: a frame, tracked_subcategories: [field plates, projections permitted]}
        - {tab_id: voices, symbol: a drop with a line, tracked_subcategories: [what people said, by stop]}
        - {tab_id: signal, symbol: a ring, tracked_subcategories: [relays lit, groves awake, shadows]}
    temporal_consequence_rules:
      mission_replay_menu_enabled: false
      manual_save_slots_count: 3
      expiring_strands_examples:
        - quest_id: three_sounds_from_one_room
          badge: tide mark
          expiry_trigger: the 18th watch of the shift in which it is offered
          opportunity_cost_if_missed: the children set the sounds aside; the side post closes
        - quest_id: screening_night
          badge: moon
          expiry_trigger: dawn at the compound
          opportunity_cost_if_missed: the aunt's public answer waits a full shift
      completionist_pool_buffer_rule: no side strand blocks the custody chain
    zero_icon_visual_wonders:
      collection_name: what the light carries
      total_count: 9
      in_world_capture_mechanic: expose a field plate while it is in frame
      map_pin_policy: "strictly_zero_pins"
      examples: [the beacon beam at its many names, the whale fluke rising at the cistern, BOTH WAYS scratched on the overlook handle, five film loops visible from the switchback cut, the sheet lit at the compound, the thread on the pump handle, the shoe at Silver Ford, the lamps on the night trail, a grove waking]

  orthogonal_stress_tests:
    geodesic_xy_transect:
      start_boundary: western edge of the playable world near x = -2060
      end_boundary: the eastern ridge boundary
      locked_bearing_and_distance: due east, about 2 km
      allowed_hud_mode: cardinal strip only
      invisible_walls_permitted: 0
      sector_progression:
        - segment: Ahiya highlands, x -2060 to -1460
          biome_and_jurisdiction: ridge and the four keepers
          physical_or_legal_obstacles: the beacon ridge, 69 m climb; the hill rack is not public
          kinematic_or_tool_resolution: walk the ridge road; the bearing passes the wall, not through the rack
          fog_of_war_and_heat_effect: the legs walked lift; the hill sees you near the mast
        - segment: highland to basin drop, x -1460 to -1100
          biome_and_jurisdiction: open slope, no keeper
          physical_or_legal_obstacles: grade
          kinematic_or_tool_resolution: ride the donkey if strength allows
          fog_of_war_and_heat_effect: no road leg to lift; the trace stays blank
        - segment: Whale Fluke basin, around x -1085
          biome_and_jurisdiction: cistern, water
          physical_or_legal_obstacles: the abyss on the bearing
          kinematic_or_tool_resolution: skirt the lip or swim the surface band; no wall
          fog_of_war_and_heat_effect: the cistern catchment lifts
        - segment: Pueblo and plaza
          biome_and_jurisdiction: town, the plaza cooling operator
          physical_or_legal_obstacles: walls and stalls
          kinematic_or_tool_resolution: streets
          fog_of_war_and_heat_effect: Pueblo relay lights 38 m of signal
        - segment: Silver Ford to the ridge edge
          biome_and_jurisdiction: river and the print keeper
          physical_or_legal_obstacles: the ford
          kinematic_or_tool_resolution: wade or the ferry
          fog_of_war_and_heat_effect: legs lift; the eastern boundary is a ridge, not a wall
      pass_criteria: [no invisible wall crossed, strip never shows an unknown stop, every obstacle has a world solution, no teleport used]
    vertical_z_deprivation_test:
      target_labyrinth: the Whale Fluke abyss
      entry_coordinates_and_signage: around (-1085, -35), chalk on the cistern lip
      mid_dive_fault_injected: at 66 m the donkey's ring collapses; at 55 m the can starts to cloud
      tier_by_tier_trace:
        - {tier: surface, player_state: full can, hud_and_map_behavior: live trace, diegetic_cues_available: rain on water, donkey}
        - {tier: kelp, player_state: ring weakening, hud_and_map_behavior: trace frozen, diegetic_cues_available: kelp leans with the current toward the rim}
        - {tier: fluke, player_state: no signal, hud_and_map_behavior: blank except descent ring, diegetic_cues_available: the ribs as landmarks, whale song pitch rises toward the surface}
        - {tier: seabed, player_state: can clouding, hud_and_map_behavior: none, diegetic_cues_available: the ship hull points up the slope}
      severed_lifeline_climax: the copy in the ribs is wet only while you hold it; you must ascend by the ribs and the song before the can clears
      pass_criteria: [no map drawn below the visited band, return possible by landmarks alone, copy survives only with water]

  minimum_computable_schema:
    HUDVisibilityPredicate: "show(e) = route || alert || working || changed(<2.5s) || glance(<4s); on foot at walk with none of these: show nothing"
    InteriorStreamPredicate: "stream(stop) = dist(player, stop) < 18 && inSignal && !directSun"
    ZSliceRenderPredicate: "draw(band) = visited(band) && |band.y - player.y| <= 8 || band === surface"
    BeliefZoneUpdateRule: "if inSignal: core = player.pos, seenAt = now, ring = 28; else: ring = min(240, 28 + 0.8 * (now - seenAt))"
    ParcelUnlockRule: "unlock(leg) = walked(leg) && can.liters > 0 during the walk; trace(leg).alpha decays with litres spent since"
    HourglassExpiryPredicate: "expired(strand) = watch >= 18 of the offering shift || (strand.moon && dawnAt(compound))"
    ChalkPredicate: "giveable = max(0, can.liters - 4); keepers refuse when giveable < required"

  final_synthesis:
    compressed_principle: The map knows only where wet cans have been; the glass shows only what water can do now.
    architectural_formula: "MAP = hill trace(walked legs, last readings, dated) ; HUD = REST unless water moves or the animal needs it ; TRAVEL = legs in watches"
```

### QUICKCHECK
- bilateral filter applied (locomotion amplified / omniscience removed): yes
- viewport empty at rest on foot: yes
- pause-free frustum raycast waypointing defined: yes
- adversary belief separated from live enemy coordinates: yes (adapted: the archive's belief of where your can is)
- volumetric semantic zoom & pursuit jamming specified: yes (jamming by sun and signal shadow, no pursuit in this world)
- z-axis elevation culling & severable diegetic lifelines included: yes
- ecological hazard proxies & zero-icon wonders included: yes
- parcel fog-of-war, categorized index & hourglass expiry defined: yes
- geodesic x/y & vertical z stress tests executable: yes
- computable runtime predicates complete: yes

## What it means for the build, in order of leverage

1. **Chalk on the can gauge.** `ChalkPredicate`. Smallest change, removes the most confusion about what can be given.
2. **The REST state machine.** Empty on foot. This is mostly already true after the last pass; the spec formalises it.
3. **The trace replaces the chart.** Legs walked with a wet can glow; unwalked legs are blank; wells show their last reading and reader.
4. **Remove teleport on Ahiya.** A set route lays a sheen on the road and a current on the glass.
5. **Press-and-hold to set a route** on a far thing in the 3D view (frustum raycast).
6. **Signal shadow** freezes the trace with its watch.
7. The abyss dive and the index are later.
