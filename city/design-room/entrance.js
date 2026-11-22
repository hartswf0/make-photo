// Brief 1, Brief 8 & Brief 9 — Design Room & Cinematic Entrance Controller
// Multiplane WEAVE WebGL stage + 23 GPU Shaders + 5-Bus Door-Coupled Audio + Live 9-Brief Pilot Sync
// Strict zero-emoji policy across code and UI.

import * as THREE from 'three';
import { ALL_CITY_LOOKS, CityShaderPipeline, projectWorldLabel } from '../shader-suite-bar.js';
import {
  loadPilotState,
  savePilotState,
  subscribePilotState,
  applyPilotUrlHash,
  formatPilotHash,
  deriveClockMapping,
  resetPilotState,
  scrubPilotTimeline,
  TIDE_PHASES,
  SEVERN_PILOT_CONTRACT,
} from './pilot-state.js';

const POEMS = [
  { id: '01', title: 'Out of Life', district: 'Naraka Market / Severn', hour: 18.5, line: 'Every room keeps the trace of who crossed the sill before dark.' },
  { id: '02', title: 'Flashing Lights', district: 'The Overseer', hour: 19.25, line: 'Across the wet stone curb a relay lamp answers the second gate.' },
  { id: '03', title: 'How to Break Off an Engagement', district: 'Mirror Thread Bay', hour: 17.0, line: 'The tide takes only what was left unfastened at the quay.' },
  { id: '04', title: 'Nevermore', district: 'The Threshold', hour: 20.0, line: 'Two footsteps pause on gravel; one crosses into the stone hall.' },
  { id: '05', title: 'Bloodlines', district: 'The Ascent', hour: 21.5, line: 'Behind the mullioned glass an upstairs lamp names the landing.' },
  { id: '06', title: 'Resurrecting Atlantis', district: 'Light Gate Plaza', hour: 16.5, line: 'A stair survives from harbor street to submerged masonry.' },
  { id: '07', title: 'DJ Turn Me Up', district: 'Naraka Market', hour: 22.25, line: 'Close the street door and the distant bass drops behind limestone.' },
  { id: '08', title: 'Newly Single', district: 'Ankhu Spires', hour: 23.0, line: 'Red over the lintel, teal beside the cistern valve, dry stone inside.' },
  { id: '09', title: 'Yet, Heard', district: 'Shrouded Arcade', hour: 18.0, line: 'Three calls across the arcade before the courier hands off the parcel.' },
  { id: '10', title: 'Magic Ride', district: 'Orange Haze', hour: 6.5, line: 'Morning replaces sodium lamp light one window reveal at a time.' },
  { id: '11', title: 'New Day', district: 'Cenotaph Rail', hour: 8.25, line: 'Course by course, ceramic repair marks the four-metre salt datum.' },
  { id: '12', title: 'Reunion', district: 'White Temple Pools', hour: 13.5, line: 'Open the vestibule and let the courtyard water carry into the street.' },
  { id: '13', title: 'How to Win My Heart', district: 'Mirror Thread Bay', hour: 19.75, line: 'Counted pauses become alleys; each breath widens into a piazza.' },
  { id: '14', title: 'Always Ascending', district: 'The Ascent', hour: 5.75, line: 'Weather settles on damp paving while the threshold stays dry.' },
];

const CORTEX_PLANES = [
  { id: 'P6', name: 'Sky and upper atmosphere', src: './cortex/P6.svg', z: -14.0, par: 0.0 },
  { id: 'P5', name: 'Distant city massing', src: './cortex/P5.svg', z: -10.2, par: 0.08 },
  { id: 'P4', name: 'Midground street facades', src: './cortex/P4.svg', z: -6.2, par: 0.37 },
  { id: 'P3', name: 'Atmospheric light and mist', src: './cortex/P3.svg', z: -4.4, par: 0.281 },
  { id: 'P2', name: 'Street figures and encounter', src: './cortex/P2.svg', z: -1.8, par: 1.0 },
  { id: 'P1', name: 'Foreground curb occlusion', src: './cortex/P1.svg', z: 0.85, par: 1.627 },
];

const TOOL_DIRECTORY = [
  {
    id: 'tool-city',
    group: 'Walk & inhabit',
    verb: 'Walk the Severn street and threshold',
    toolName: 'Nolli Block 3D City',
    href: '../',
    thumb: './cortex/poster.webp',
    alt: 'Eye-level street view of the Nolli block and Severn threshold.',
    desc: 'Cross the wet stone street at eye height, open or close the Severn vestibule door, pour water at the cooling cistern, and hear interior reverb shift.',
    carries: ['building', 'worldTime', 'shader', 'doorOpen', 'parcelHolder', 'waterLiters'],
  },
  {
    id: 'tool-island',
    group: 'Walk & inhabit',
    verb: 'Traverse the harbor island and curbs',
    toolName: 'Island District Slice',
    href: '../island/',
    thumb: './cortex/thumb_commons.webp',
    alt: 'Harbor island district street network with grounded curbs and planters.',
    desc: 'Move between Mount Vernon and harbor piers with usable loading curbs, soil-bound street trees, and shared parcel and water delivery state.',
    carries: ['district', 'building', 'worldTime', 'tidePhase', 'doorOpen', 'parcelHolder'],
  },
  {
    id: 'tool-maps',
    group: 'Walk & inhabit',
    verb: 'Locate the Severn across city and movie maps',
    toolName: 'City, Movie & Mood Maps',
    href: '../maps/',
    thumb: './cortex/thumb_overseer.webp',
    alt: 'Spatial map aligning district blocks, street routes, and camera pins.',
    desc: 'Select the Severn on the plan, trace metric street routes while keeping The Black outside the road graph, and step straight into eye-level frames.',
    carries: ['district', 'building', 'shot', 'poem', 'tidePhase', 'parcelHolder'],
  },
  {
    id: 'tool-foundry',
    group: 'Evolve & inspect buildings',
    verb: 'Evolve rooms and stairs inside the Severn',
    toolName: 'Inverse Interior Foundry',
    href: '../foundry/',
    thumb: './cortex/thumb_temple.webp',
    alt: 'Architectural massing and interior room graph inside a fixed shell.',
    desc: 'Hold Severn to its 20 by 12 metre envelope, mutate connected rooms and furniture with recorded seed and parent, and test threshold door clearance.',
    carries: ['building', 'room', 'seed', 'doorOpen', 'parcelHolder', 'provenanceFilter'],
  },
  {
    id: 'tool-heroes',
    group: 'Evolve & inspect buildings',
    verb: 'Inspect all six hero buildings under raw and graded light',
    toolName: 'HDL Hero Building Inspector',
    href: '../heroes/',
    thumb: './cortex/thumb_arcade.webp',
    alt: 'Close material inspection of brick, mullioned windows, and warm threshold light.',
    desc: 'Audit Severn, chapel, NEW SINGLE, pier cafe, clock tower, and Atlantis rowhouse with a neutral raw daylight toggle and fixture-bound color.',
    carries: ['building', 'poem', 'worldTime', 'rawDaylight', 'doorOpen', 'provenanceFilter'],
  },
  {
    id: 'tool-weave',
    group: 'Compose & reconstruct depth',
    verb: 'Weave archive plates and staged encounters',
    toolName: 'WEAVE Multiplane Composer',
    href: '../weave/',
    thumb: './cortex/poster.webp',
    alt: 'Multiplane street composition uniting separated depth sheets and grounded figures.',
    desc: 'Stage resident arrival and parcel handoff across separated depth planes, inspect provenance masks, and recover the exact source camera in one click.',
    carries: ['shot', 'poem', 'worldTime', 'shader', 'doorOpen', 'parcelHolder'],
  },
  {
    id: 'tool-pointcloud',
    group: 'Compose & reconstruct depth',
    verb: 'Compare source photo, WEAVE planes, and metric 3D depth',
    toolName: 'Spatial Depth & Hybrid Set Lab',
    href: '../pointcloud/',
    thumb: './cortex/thumb_moon.webp',
    alt: 'Spatial reconstruction aligning planar distant facades with solid doorway geometry.',
    desc: 'Inspect supported camera viewing cones, repair stretched depth edges around steps and handrails, and compare 2D and 3D views side by side.',
    carries: ['shot', 'building', 'rawDaylight', 'provenanceFilter', 'shader'],
  },
  {
    id: 'tool-worldtext',
    group: 'Read & score through time',
    verb: 'Compile situated readings into spatial gate rules',
    toolName: 'Worldtext & Calvino Rule Compiler',
    href: '../worldtext/',
    thumb: './cortex/thumb_haze.webp',
    alt: 'Warm district facade marked by flood datum wear and historical additions.',
    desc: 'Switch Calvino readings across memory, exchange, desire, signs, and loss to change who may pass a gate while keeping +4m flood wear distinct.',
    carries: ['building', 'poem', 'account', 'doorOpen', 'parcelHolder', 'tidePhase'],
  },
  {
    id: 'tool-atlantis',
    group: 'Read & score through time',
    verb: 'Follow one threshold from living street to submerged ruin',
    toolName: 'Atlantis Time & SCION Route',
    href: '../atlantis/',
    thumb: './cortex/thumb_commons.webp',
    alt: 'Registered Nolli voice rings and submerged architectural ruin route.',
    desc: 'Align word-duration frontage with Verne chapter 32 ruins and follow a six-shot SCION route where the same stair, doorway, and bridge survive.',
    carries: ['poem', 'account', 'shot', 'era', 'tidePhase', 'doorOpen'],
  },
  {
    id: 'tool-design-room',
    group: 'Read & score through time',
    verb: 'Coordinate the nine briefs, sound buses, and shared pilot record',
    toolName: 'The Design Room & Freesound Ledger',
    href: '#briefs',
    thumb: './cortex/thumb_temple.webp',
    alt: 'Design room overview linking nine briefs, provenance tags, and shared state.',
    desc: 'Test door acoustics, five-bus speech ducking, provenance filters, and the versioned make_photo_pilot_v1 record connecting every workbench.',
    carries: ['version', 'seed', 'worldTime', 'shader', 'doorOpen', 'parcelHolder'],
  },
];

const DESIGN_BRIEFS = [
  {
    num: '01',
    id: 'entrance',
    slug: 'entrance',
    kicker: 'Page & navigation',
    title: 'The cinematic entrance',
    lead: 'Let the first screen establish the world. Make the working tools easy to reach from it.',
    toolHref: '../weave/',
    toolLabel: 'Open WEAVE Stage (../weave/)',
    summary: 'Rebuild the entrance around the registered Cortex multiplane street scene, relay silhouette, and wet stone ground contact. Place title and invitation in the quiet sky opening with zero permanent dock covering the frame, three clear primary routes, and a verb-grouped tool directory below.',
    acceptance: 'A first-time visitor sees the shared street, switches GPU looks or explodes the six depth planes without losing ground contact, starts sound by explicit action, and enters WEAVE or the 3D city with poem and look preserved.',
    fullPrompt: 'Rebuild the WYGWYL entrance around the existing multiplane street scene and the quality of WEAVE. Use the actual source image, its separated depth layers and its established palette. Retain the figures, the shared ground, the sky opening and the suspended architectural mass. Arrange the title and a short invitation in the scene quiet region. Give the first screen three clear routes: watch the work, enter the world, and inspect the nine briefs. Place the complete tool collection in a searchable directory grouped by concrete verbs with zero emoji and zero permanent dock covering the scene.',
    sources: [
      { label: 'WEAVE Stage', href: '../weave/' },
      { label: 'Nolli Block 3D', href: '../' },
      { label: 'WYGWYL Prompts', href: 'https://hartswf0.github.io/wygwyl-world-arch/design-prompts.html#entrance' },
    ],
    provenance: [
      { kind: 'recorded', text: 'Cortex Commons source plate (bdc7d6ec, 1456x816) and 14 spoken poem timings.' },
      { kind: 'checked', text: 'Six separated vector planes (P6..P1) verified at 1280x800 desktop and 390x844 mobile.' },
      { kind: 'inferred', text: 'Frustum-compensated parallax ratios (0.00x sky to 1.63x foreground curb).' },
      { kind: 'invented', text: 'Suspended 3D relay dish silhouette and live wet pavement reflection apron.' },
    ],
    controlType: 'entrance',
  },
  {
    num: '02',
    id: 'interiors',
    slug: 'interiors',
    kicker: 'Inverse topology',
    title: 'Evolve the interior',
    lead: 'Search the space inside a building while its exterior, windows and stairs remain accountable.',
    toolHref: '../foundry/',
    toolLabel: 'Open Inverse Foundry (../foundry/)',
    summary: 'Preserve Severn declared 20 by 12 metre envelope, four storeys, stair landings, and facade openings while evolving connected interior rooms, door swings, and furniture with recorded seed, parent, and mutation.',
    acceptance: 'Approach from the street, cross the Severn vestibule, climb to Flat 2A, and close the threshold door: both navigation walkability and exterior street sound transmission change together.',
    fullPrompt: 'Extend the Foundry from landscapes to inhabited volumes. Begin with the Severn entry in the hero descriptions (20 by 12 metre envelope, storey heights, stair landings, facade openings). Classify references as exterior, threshold, interior, object or body. Mutate partitions, door positions, furniture and practical lights while recording seed, parent and mutation. Attach sound transmission and practical light to the same door records that control circulation.',
    sources: [
      { label: 'Inverse Foundry', href: '../foundry/' },
      { label: 'Hero Inspector', href: '../heroes/' },
      { label: 'Brief 02 Source', href: 'https://hartswf0.github.io/wygwyl-world-arch/design-prompts.html#interiors' },
    ],
    provenance: [
      { kind: 'recorded', text: 'Severn HDL shell dimensions (20.0m x 12.0m) and poem-linked interior reference stills.' },
      { kind: 'checked', text: 'Actor clearance (0.9m), door swing arc, stair landing continuity, and facade window bearings.' },
      { kind: 'inferred', text: 'Concealed hallway depth and party-wall partition hypotheses behind unphotographed bays.' },
      { kind: 'invented', text: 'Seed 2086 candidate table/chair footprints and vestibule pendant lamp placement.' },
    ],
    controlType: 'interiors',
  },
  {
    num: '03',
    id: 'inhabited-shots',
    slug: 'inhabited-shots',
    kicker: 'People & contact',
    title: 'Stage an inhabited shot',
    lead: 'Give the landscape an encounter, a foreground, a destination and a consequence.',
    toolHref: '../weave/',
    toolLabel: 'Stage in WEAVE (../weave/)',
    summary: 'Stage a social action with a visible consequence at the Severn curb: a courier arrives, hands a parcel to Bekele across the open threshold, a secondary witness responds, and ownership persists after the cut.',
    acceptance: 'Hold the camera as the courier hands the parcel to Bekele and crosses the threshold; switch to reverse angle or another tool and confirm Bekele still holds the parcel and feet stay grounded.',
    fullPrompt: 'Select one strong Foundry shot with exact world, poem, start/end time, camera and lens. Choose a social action with a visible result: an arrival, a delivery, or a gate being opened. Assemble foreground contact, human action, middle-distance architecture and sky with scale anchors, ground contact, viewing cones and doorway occlusion.',
    sources: [
      { label: 'WEAVE Encounter', href: '../weave/' },
      { label: 'Island Curb', href: '../island/' },
      { label: 'Brief 03 Source', href: 'https://hartswf0.github.io/wygwyl-world-arch/design-prompts.html#inhabited-shots' },
    ],
    provenance: [
      { kind: 'recorded', text: 'Shot S01 35mm street framing and Poem 01 spoken performance window.' },
      { kind: 'checked', text: 'Tire-to-curb contact, planter soil bounds, and grounded character ankle pivots.' },
      { kind: 'inferred', text: 'Permitted +-24 deg cutout viewing cone and doorway reveal shadow falloff.' },
      { kind: 'invented', text: 'Parcel handoff beat (player -> bekele -> maren) and witness head-turn reaction.' },
    ],
    controlType: 'inhabited',
  },
  {
    num: '04',
    id: 'hero-buildings',
    slug: 'hero-buildings',
    kicker: 'Materials & light',
    title: 'Inspect the hero buildings',
    lead: 'Make aura emerge from a building openings, materials, use and surrounding light.',
    toolHref: '../heroes/',
    toolLabel: 'Open Hero Inspector (../heroes/)',
    summary: 'Inspect all six HDL heroes (Severn, chapel, NEW SINGLE, pier cafe, clock tower, Atlantis rowhouse) starting with a neutral raw daylight pass before enabling poem-hour theatrical grading.',
    acceptance: 'Disable bloom, grain, and colored fill via Neutral Raw Daylight: brick, wood, glass, damp stone, Severn red exit lamp, and teal cistern valve remain distinct at eye level.',
    fullPrompt: 'Inspect all six HDL heroes: Severn, chapel, NEW SINGLE, pier cafe, clock tower and Atlantis rowhouse. Start with a neutral daylight pass. Repair scale, normals, wall thickness, stairs and window depth before grading. Attach Severn red and teal color to identifiable fixtures and restrict wet reflection to wet surfaces.',
    sources: [
      { label: 'Six Hero Buildings', href: '../heroes/' },
      { label: 'Nolli Block Materials', href: '../' },
      { label: 'Brief 04 Source', href: 'https://hartswf0.github.io/wygwyl-world-arch/design-prompts.html#hero-buildings' },
    ],
    provenance: [
      { kind: 'recorded', text: 'Six HDL hero descriptions, material names, and exterior/interior reference walls.' },
      { kind: 'checked', text: 'Metre-based texture scale, mullion recess depth, and wet-only pavement specular mask.' },
      { kind: 'inferred', text: 'Seated (1.20m) vs standing (1.65m) sightlines back out through Severn windows.' },
      { kind: 'invented', text: 'Reusable severn-dusk-v1 fixture recipe (red exit lintel lamp + teal cistern valve).' },
    ],
    controlType: 'heroes',
  },
  {
    num: '05',
    id: 'worldtext',
    slug: 'worldtext',
    kicker: 'Rules & accounts',
    title: 'Compile the worldtext',
    lead: 'Let a reading change the rules of access, encounter, memory and movement.',
    toolHref: '../worldtext/',
    toolLabel: 'Open Worldtext Compiler (../worldtext/)',
    summary: 'Treat Gazetteer passages as situated accounts (speaker, date, POV) and interlace Calvino readings (memory, exchange, desire, signs, loss) so changing the reading visibly alters gate access while keeping the +4.0m flood datum distinct.',
    acceptance: 'Two people approach the Severn gate with different histories; switching the active reading from memory to exchange or loss changes their available gate operation for a traceable textual reason.',
    fullPrompt: 'Build from the Gazetteer, architectural language and poem briefs. Treat each account as a situated description with speaker, date, source passage and POV. Use Calvino interlacing series (memory, exchange, desire, signs, loss) to give each reading an observable spatial rule. Keep the physical +4m flood datum distinct from symbolic stripes and flag unexecuted rules as unresolved requirements.',
    sources: [
      { label: 'Worldtext Compiler', href: '../worldtext/' },
      { label: 'Brief 05 Source', href: 'https://hartswf0.github.io/wygwyl-world-arch/design-prompts.html#worldtext' },
    ],
    provenance: [
      { kind: 'recorded', text: 'Gazetteer & Poem 01 source passages with speaker attribution and stanza timestamps.' },
      { kind: 'checked', text: 'Physical +4.0m harbor flood salt line separated from small prop stripe markings.' },
      { kind: 'inferred', text: 'Visitor vs resident threshold permissions derived from competing district accounts.' },
      { kind: 'invented', text: 'Five executable Calvino gate rules; unexecuted fire-escape choir rule marked unresolved.' },
    ],
    controlType: 'worldtext',
  },
  {
    num: '06',
    id: 'atlantis',
    slug: 'atlantis',
    kicker: 'Map & section',
    title: 'Read Atlantis through time',
    lead: 'Make the map reveal the relation between a functioning city and the city read from its remains.',
    toolHref: '../atlantis/',
    toolLabel: 'Open Atlantis Through Time (../atlantis/)',
    summary: 'Keep Nolli voice-plan durations (word frontage, pause alleys, breath piazzas) distinct from metric dimensions, and stage Verne "A Vanished Continent" alongside living Baltimere so one stair, doorway, and bridge survive across eras.',
    acceptance: 'Follow the Severn threshold from living harbor street to submerged volcanic-lit ruin and back to the map; opening, stair direction, and bridge alignment survive with explicit account labels.',
    fullPrompt: 'Start with the Nolli-like voice plan (word duration = frontage, pauses = alleys, breaths = piazzas, line breaks = cross streets) kept distinct from metric dimensions. Use Verne chapter 32 "A Vanished Continent" as an explicit second account (keeping the extinct-volcano submarine shelter separate). Deliver an aligned plan/section, living-to-submerged landmark register and six-shot SCION route.',
    sources: [
      { label: 'Atlantis Time & SCION', href: '../atlantis/' },
      { label: 'City & Movie Maps', href: '../maps/' },
      { label: 'Brief 06 Source', href: 'https://hartswf0.github.io/wygwyl-world-arch/design-prompts.html#atlantis' },
    ],
    provenance: [
      { kind: 'recorded', text: 'Plato concentric ring schema, 14 poem line intervals, and Verne Chapter 32 text.' },
      { kind: 'checked', text: 'Explicit scale transform registering voice-duration frontage to metric 20x12m block.' },
      { kind: 'inferred', text: 'Submerged masonry erosion and silt level across the surviving Severn stair.' },
      { kind: 'invented', text: 'Six-shot SCION discovery itinerary (extinct-volcano shelter isolated as separate episode).' },
    ],
    controlType: 'atlantis',
  },
  {
    num: '07',
    id: 'image-to-space',
    slug: 'image-to-space',
    kicker: '2D & 3D',
    title: 'Give the image depth',
    lead: 'Keep the photographic composition while making supported movements through it believable.',
    toolHref: '../pointcloud/',
    toolLabel: 'Open Spatial Depth Lab (../pointcloud/)',
    summary: 'Combine planar distant facades with solid 3D doorway jambs, steps, and handrails where bodies make contact. Mark supported camera bounds, repair stretched depth edges, and recover the exact source camera anytime.',
    acceptance: 'Begin at the registered source camera, shift laterally to expose foreground overlap, inspect provenance masks, and click Recover Source Camera to snap back to zero-error registration.',
    fullPrompt: 'Choose a Shot Lab frame and preserve source image, masks, depth and camera. Separate image planes, estimated geometry, collision surfaces and navigable ground. Keep distant facades as planes where edges stay hidden; model solid doorways, handrails and steps where bodies pass. Compare original, layered WEAVE and spatial 3D views side by side.',
    sources: [
      { label: 'Pointcloud & Hybrid 3D', href: '../pointcloud/' },
      { label: 'WEAVE Planes', href: '../weave/' },
      { label: 'Brief 07 Source', href: 'https://hartswf0.github.io/wygwyl-world-arch/design-prompts.html#image-to-space' },
    ],
    provenance: [
      { kind: 'recorded', text: 'Original source frame, alpha cutouts, and calibrated 35mm horizon line.' },
      { kind: 'checked', text: '1.65m standing eye height against 0.17m stone step riser and 2.10m doorway head.' },
      { kind: 'inferred', text: 'Monocular metric depth map and +-0.32m lateral viewing cone boundary.' },
      { kind: 'invented', text: 'Repaired 3D limestone jambs, stoop tread collision plane, and occluded wall fill.' },
    ],
    controlType: 'depth',
  },
  {
    num: '08',
    id: 'sound-and-time',
    slug: 'sound-and-time',
    kicker: 'Sound & clock',
    title: 'Hear a place changing',
    lead: 'Use replayable timing and a restrained mix of sounds with visible or discoverable causes.',
    toolHref: './freesound-ledger.json',
    toolLabel: 'Inspect freesound-ledger.json',
    summary: 'Separate Voice, Close Action, Local Ambience, Distant City, and Music into five buses with zero default voice delay, -8.5 dB speech ducking, replaceable CC0/CC-BY Freesound slots, and Severn door-coupled muffling.',
    acceptance: 'Start audio explicitly, listen outside Severn, close the threshold door (640 Hz low-pass + 1.55s stone reverb), trigger a spoken line to hear distant bed ducking, and scrub without event bursts.',
    fullPrompt: 'Separate voice, close action, local ambience, distant city and music into controllable buses. Default delay sends to zero. Doors affect transmission and reverberation using the same state that affects navigation. Start audio only after an explicit user action and keep an obvious mute. Save Freesound ID, creator, URL, license, trim points and replaceable slots.',
    sources: [
      { label: 'Freesound Ledger JSON', href: './freesound-ledger.json' },
      { label: '5-Bus Console (Above)', href: '#sound-stage' },
      { label: 'Brief 08 Source', href: 'https://hartswf0.github.io/wygwyl-world-arch/design-prompts.html#sound-and-time' },
    ],
    provenance: [
      { kind: 'recorded', text: 'Six Freesound CC0 / CC BY 4.0 field & foley MP3s with IDs, authors, and URLs.' },
      { kind: 'checked', text: 'Measured durations (1.13s to 52.75s), loop boundaries, and voice delaySend = 0.0.' },
      { kind: 'inferred', text: '640 Hz closed-door stone muffling cutoff and -8.5 dB speech ducking envelope.' },
      { kind: 'invented', text: 'Tide-coupled storm-grate water pitch and coolingWet rhythmic cistern pulse.' },
    ],
    controlType: 'sound',
  },
  {
    num: '09',
    id: 'shared-world',
    slug: 'shared-world',
    kicker: 'State & interchange',
    title: 'Keep one world across tools',
    lead: 'Make the city map, interior solver, shot composer and player agree on the same place and state.',
    toolHref: './pilot-state.js',
    toolLabel: 'Inspect pilot-state.js Module',
    summary: 'Bind world, district, Severn building, room, poem, Calvino account, shot, seed, local hour, tide phase, 23-look shader, door state, and parcel holder into make_photo_pilot_v1 across localStorage and URL hash.',
    acceptance: 'Close the Severn door and hand the parcel to Bekele here; open Heroes, Foundry, WEAVE, Island, or Maps and confirm Bekele still holds the parcel, the door stays closed, and the hour and shader match.',
    fullPrompt: 'Choose one complete pilot location: the Severn, its adjacent street, a doorway, a room and a shot. Establish one versioned scene record (pilot-v1) carrying world, district, building, room, poem, account, shot, seed, worldTime, tidePhase, shader, doorOpen, parcelHolder and provenance. Preserve meaningful state across every view switch and keep nongeographic transitions outside the street network.',
    sources: [
      { label: 'pilot-state.js ES Module', href: './pilot-state.js' },
      { label: 'Foundry Adapter', href: '../foundry/' },
      { label: 'Heroes Adapter', href: '../heroes/' },
      { label: 'WEAVE Adapter', href: '../weave/' },
    ],
    provenance: [
      { kind: 'recorded', text: 'Canonical Severn asset ID, Baltimere Mount Vernon district, and Poem 01 shot S01.' },
      { kind: 'checked', text: 'Idempotent localStorage + URL hash + cross-tab storage event round-trip.' },
      { kind: 'inferred', text: 'Explicit mapping between performance seconds, 24h local clock, and four tide gates.' },
      { kind: 'invented', text: 'make_photo_pilot_v1 adapter contract and isolated nongeographic the-black rule.' },
    ],
    controlType: 'shared',
  },
];

const CALVINO_GATE_RULES = {
  memory: 'Memory reading: Worn threshold groove admits returning courier and Bekele; trace of prior parcel stays etched on ledger.',
  exchange: 'Exchange reading: Vestibule gate opens conditionally on active parcel or 1L cistern water transfer at second-gate tide.',
  desire: 'Desire reading: Upstairs Flat 2A lamp draws sightline from street; stair hall unlocks while street market quiets.',
  signs: 'Signs reading: Red lintel fixture signals safe harbor to residents while reading as closed customs post to strangers.',
  loss: 'Loss reading: +4.0m salt datum closes lower cellar stair; access routes shift to exterior iron fire escape.',
};

// ---------- WebAudio 5-Bus Door-Coupled Engine (Brief 8) ----------
class DesignRoomSoundEngine {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.muted = false;
    this.quietMode = false;
    this.duckingActive = false;
    this.ledger = null;
    this.buffers = {};
    this.loopNodes = {};
    this.busGains = {};
    this.exteriorFilter = null;
    this.convolver = null;
    this.reverbSend = null;
    this.master = null;
  }

  async loadLedger() {
    if (this.ledger) return this.ledger;
    const res = await fetch('./freesound-ledger.json');
    if (!res.ok) throw new Error(`Ledger HTTP ${res.status}`);
    this.ledger = await res.json();
    return this.ledger;
  }

  _buildStoneImpulse(seconds = 1.55, decay = 2.9) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let seed = 2086 + ch * 977;
      for (let i = 0; i < length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const white = (seed / 0xffffffff) * 2 - 1;
        data[i] = white * Math.pow(1 - i / length, decay) * 0.26;
      }
    }
    return impulse;
  }

  async ensureStarted(pilot) {
    await this.loadLedger();
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);

      this.exteriorFilter = this.ctx.createBiquadFilter();
      this.exteriorFilter.type = 'lowpass';
      this.exteriorFilter.frequency.value = pilot.doorOpen ? 13500 : 640;
      this.exteriorFilter.Q.value = 0.72;

      this.convolver = this.ctx.createConvolver();
      this.convolver.buffer = this._buildStoneImpulse(1.55, 2.9);
      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = pilot.doorOpen ? 0.06 : 0.34;
      this.convolver.connect(this.reverbSend);
      this.reverbSend.connect(this.master);
      this.exteriorFilter.connect(this.master);

      const buses = ['voice', 'closeAction', 'localAmbience', 'distantCity', 'music'];
      for (const id of buses) {
        const g = this.ctx.createGain();
        g.gain.value = pilot.audioBuses?.[id] ?? 0.6;
        if (id === 'voice') {
          // Strict Brief 8: dry voice signal first, zero default delay/echo send
          g.connect(this.master);
        } else if (id === 'distantCity' || id === 'localAmbience') {
          g.connect(this.exteriorFilter);
          g.connect(this.convolver);
        } else {
          g.connect(this.master);
          g.connect(this.convolver);
        }
        this.busGains[id] = g;
      }
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    if (!this.started) {
      this.started = true;
      await this._decodeSlots();
      this._startAmbientSlots();
    }
    this.muted = false;
    this.syncToPilot(pilot);
  }

  async _decodeSlots() {
    if (!this.ledger?.sourceSlots) return;
    await Promise.all(
      this.ledger.sourceSlots.map(async (slot) => {
        try {
          const res = await fetch(slot.assetUrlFromDesignRoom);
          if (!res.ok) return;
          const buf = await res.arrayBuffer();
          this.buffers[slot.slotId] = await this.ctx.decodeAudioData(buf);
        } catch {
          // Graceful offline fallback
        }
      })
    );
  }

  _startAmbientSlots() {
    if (!this.ctx || !this.ledger?.sourceSlots) return;
    for (const slot of this.ledger.sourceSlots) {
      if (!slot.loopEnabled) continue;
      const buffer = this.buffers[slot.slotId];
      if (!buffer) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = slot.loopStartSec || 0;
      src.loopEnd = Math.min(buffer.duration, slot.loopEndSec || buffer.duration);
      src.playbackRate.value = slot.playbackRate || 1.0;
      const slotGain = this.ctx.createGain();
      slotGain.gain.value = slot.gainRange ? slot.gainRange[0] : 0.12;
      src.connect(slotGain);
      slotGain.connect(this.busGains[slot.bus] || this.master);
      src.start(0, slot.trimStartSec || 0);
      this.loopNodes[slot.slotId] = { src, gain: slotGain, slot };
    }
  }

  setMuted(muted, pilot) {
    this.muted = Boolean(muted);
    if (this.ctx && this.master) {
      const now = this.ctx.currentTime;
      const target = this.muted ? 0.0001 : this.quietMode ? 0.42 : 0.85;
      this.master.gain.setTargetAtTime(target, now, 0.08);
    }
    savePilotState({ audioBuses: { ...(pilot.audioBuses || {}), muted: this.muted } });
  }

  setQuietMode(enabled, pilot) {
    this.quietMode = Boolean(enabled);
    if (this.ctx && this.master && !this.muted) {
      this.master.gain.setTargetAtTime(this.quietMode ? 0.42 : 0.85, this.ctx.currentTime, 0.12);
    }
    this.syncToPilot(pilot);
  }

  syncToPilot(pilot) {
    if (!this.ctx || !this.started) return;
    const now = this.ctx.currentTime;
    const buses = pilot.audioBuses || {};
    const duckFactorDistant = this.duckingActive ? 0.37 : 1.0; // -8.5 dB during speech
    const duckFactorMusic = this.duckingActive ? 0.50 : 1.0;   // -6.0 dB during speech
    const duckFactorLocal = this.duckingActive ? 0.71 : 1.0;   // -3.0 dB during speech
    const quietScale = this.quietMode ? 0.55 : 1.0;

    if (this.busGains.voice) this.busGains.voice.gain.setTargetAtTime(buses.voice ?? 0.9, now, 0.08);
    if (this.busGains.closeAction) this.busGains.closeAction.gain.setTargetAtTime((buses.closeAction ?? 0.72) * quietScale, now, 0.08);
    if (this.busGains.localAmbience) this.busGains.localAmbience.gain.setTargetAtTime((buses.localAmbience ?? 0.58) * duckFactorLocal * quietScale, now, 0.12);
    if (this.busGains.distantCity) this.busGains.distantCity.gain.setTargetAtTime((buses.distantCity ?? 0.36) * duckFactorDistant * quietScale, now, 0.08);
    if (this.busGains.music) this.busGains.music.gain.setTargetAtTime((buses.music ?? 0.42) * duckFactorMusic * quietScale, now, 0.10);

    // Door-coupled transmission & reverb (Brief 8)
    const submerged = pilot.era === 'submerged-ruin';
    const cutoff = !pilot.doorOpen ? 640 : submerged ? 1800 : 13500;
    const rev = !pilot.doorOpen ? 0.34 : 0.06;
    this.exteriorFilter.frequency.setTargetAtTime(cutoff, now, 0.20);
    this.reverbSend.gain.setTargetAtTime(rev, now, 0.20);

    const isNight = pilot.worldTime >= 18.0 || pilot.worldTime <= 6.0;
    const clock = deriveClockMapping(pilot);
    const tideNorm = Math.min(1, clock.waterLevelM / 4.0);

    const voicesLoop = this.loopNodes.slot_distant_voices_bed;
    if (voicesLoop) {
      const g = !pilot.doorOpen ? 0.08 : submerged ? 0.05 : isNight ? 0.12 : 0.22;
      voicesLoop.gain.gain.setTargetAtTime(g, now, 0.25);
    }
    const waterLoop = this.loopNodes.slot_tide_conduit_water;
    if (waterLoop) {
      waterLoop.gain.gain.setTargetAtTime(0.08 + tideNorm * 0.18, now, 0.25);
      waterLoop.src.playbackRate.setTargetAtTime(submerged ? 0.72 : 0.92, now, 0.25);
    }
    const nightLoop = this.loopNodes.slot_nocturnal_courtyard_insects;
    if (nightLoop) {
      nightLoop.gain.gain.setTargetAtTime(submerged ? 0.01 : isNight ? 0.16 : 0.03, now, 0.25);
    }
  }

  triggerOneShot(slotId, rate = 1.0, maxDur = 0.65) {
    if (!this.ctx || !this.started || this.muted) return;
    const buf = this.buffers[slotId];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = 0.35;
    src.connect(g);
    g.connect(this.busGains.closeAction || this.master);
    src.start(0, 0.03, Math.min(maxDur, buf.duration - 0.04));
  }

  speakPoemLine(pilot, onDuckChange) {
    const poemObj = POEMS.find((p) => p.id === pilot.poem) || POEMS[0];
    this.duckingActive = true;
    this.syncToPilot(pilot);
    if (onDuckChange) onDuckChange(true, poemObj.line);

    const finish = () => {
      this.duckingActive = false;
      this.syncToPilot(loadPilotState());
      if (onDuckChange) onDuckChange(false, poemObj.line);
    };

    if (typeof window !== 'undefined' && 'speechSynthesis' in window && !this.muted) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(poemObj.line);
        utter.rate = 0.94;
        utter.pitch = 0.98;
        utter.volume = Math.min(1, pilot.audioBuses?.voice ?? 0.9);
        utter.onend = finish;
        utter.onerror = finish;
        window.speechSynthesis.speak(utter);
        setTimeout(finish, 4600);
        return;
      } catch {
        // Fallback timed ducking window
      }
    }
    setTimeout(finish, 3200);
  }
}

// ---------- Registered Multiplane WEAVE + 3D Relay & Severn Hero Stage ----------
class HeroMultiplaneStage {
  constructor(canvas, fallbackImg) {
    this.canvas = canvas;
    this.fallbackImg = fallbackImg;
    this.renderer = null;
    this.pipeline = null;
    this.scene = null;
    this.camera = null;
    this.planeMeshes = [];
    this.reflectionPlanes = [];
    this.doorPivot = null;
    this.doorWarmLight = null;
    this.doorSpillMesh = null;
    this.parcelMesh = null;
    this.cisternGlow = null;
    this.relayBeacon = null;
    this.waterApronMat = null;
    this.skyMat = null;
    this.explodeAmount = 0;
    this.pointerX = 0;
    this.pointerY = 0;
    this.camOffsetX = 0;
    this.camOffsetY = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.pilot = loadPilotState();
    this.ready = false;
  }

  async init() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = Math.max(300, Math.round(this.canvas.clientWidth || rect.width || 1200));
    const h = Math.max(220, Math.round(this.canvas.clientHeight || rect.height || 640));

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);

    this.pipeline = new CityShaderPipeline(this.renderer, w, h);
    this.pipeline.setSize(w, h);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, w / h, 0.25, 110);
    this.camera.position.set(0, 0.35, 12.0);
    this.camera.lookAt(0, 0.15, 0);

    this._buildSkyBackdrop();
    await this._loadCortexPlanes();
    this._buildRelayDishSilhouette();
    this._buildSevernThresholdAndCast();
    this._buildWetStreetReflection();
    this._buildDiegeticStreetRoutes();

    this.applyPilot(this.pilot);
    this.ready = true;
    this.canvas.classList.add('is-ready');

    window.addEventListener('resize', () => this.resize());
    this._bindRouteRaycaster();

    this._animate();
  }

  _buildSkyBackdrop() {
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color('#09162a') },
        uHorizon: { value: new THREE.Color('#2c5882') },
        uWarm: { value: new THREE.Color('#d88c46') },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uWarm;
        varying vec2 vUv;
        void main() {
          float h = clamp(vUv.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uTop, smoothstep(0.18, 0.92, h));
          float band = exp(-pow((h - 0.24) * 5.5, 2.0));
          col += uWarm * band * 0.22;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthWrite: false,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(54, 30), this.skyMat);
    sky.position.set(0, 1.2, -18.5);
    this.scene.add(sky);

    const amb = new THREE.HemisphereLight(0x9ec4e8, 0x24201c, 1.45);
    this.scene.add(amb);
    const key = new THREE.DirectionalLight(0xffdfb8, 1.65);
    key.position.set(-6, 9, 8);
    this.scene.add(key);
  }

  async _rasterizeSvgToTexture(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const cw = 1736;
        const ch = 976;
        const off = document.createElement('canvas');
        off.width = cw;
        off.height = ch;
        const ctx = off.getContext('2d');
        ctx.drawImage(img, 0, 0, cw, ch);
        const tex = new THREE.CanvasTexture(off);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        resolve(tex);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async _loadCortexPlanes() {
    const camZ = 12.0;
    const baseHAtZero = 8.95;
    const aspect = 1736 / 976;
    const groundY = -2.25;

    const textures = await Promise.all(CORTEX_PLANES.map((p) => this._rasterizeSvgToTexture(p.src)));

    CORTEX_PLANES.forEach((p, idx) => {
      const tex = textures[idx];
      if (!tex) return;
      const distScale = (camZ - p.z) / camZ;
      const h = baseHAtZero * distScale;
      const w = h * aspect;

      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: idx > 0,
        alphaTest: 0.015,
        depthWrite: idx === 0,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      // Lock ground contact across depth planes so lateral moves preserve street contact
      const baseY = groundY + h * 0.43 - (idx === 0 ? 0.12 : 0);
      mesh.position.set(0, baseY, p.z);
      mesh.renderOrder = idx + 1;
      this.scene.add(mesh);
      this.planeMeshes.push({ mesh, spec: p, baseZ: p.z, baseY, w, h });

      // Mirrored wet reflection ghost for street-adjacent layers
      if (idx >= 2) {
        const refMat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: idx === 4 ? 0.24 : 0.14,
          depthWrite: false,
          color: 0x8fb8dc,
        });
        const refMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h * 0.55), refMat);
        refMesh.scale.y = -1;
        refMesh.position.set(0, groundY - h * 0.19, p.z + 0.05);
        refMesh.renderOrder = 20 + idx;
        this.scene.add(refMesh);
        this.reflectionPlanes.push({ mesh: refMesh, baseZ: p.z + 0.05 });
      }
    });
  }

  _buildRelayDishSilhouette() {
    // Monumental suspended relay dish silhouette in upper-right sky opening (clear of upper-left quiet title zone)
    const group = new THREE.Group();
    group.position.set(4.55, 2.55, -8.6);

    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x152233,
      roughness: 0.72,
      metalness: 0.38,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x243b56,
      roughness: 0.52,
      metalness: 0.55,
    });

    // Parabolic dish shell (LatheGeometry)
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const r = (i / 10) * 1.95;
      const y = (r * r) * 0.24;
      pts.push(new THREE.Vector2(r, y));
    }
    const dishGeo = new THREE.LatheGeometry(pts, 28);
    const dish = new THREE.Mesh(dishGeo, ironMat);
    dish.material.side = THREE.DoubleSide;
    dish.rotation.x = Math.PI * 0.42;
    dish.rotation.z = 0.34;
    group.add(dish);

    // Structural ring & feed-horn struts
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.045, 8, 32), rimMat);
    ring.rotation.copy(dish.rotation);
    group.add(ring);

    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 1.85, 6), rimMat);
      strut.position.set(Math.cos(a) * 0.55 - 0.25, -0.35, Math.sin(a) * 0.55 + 0.55);
      strut.rotation.z = 0.32 * Math.cos(a);
      strut.rotation.x = -0.35;
      group.add(strut);
    }

    // Pylon mast descending into midground massing
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.22, 5.2, 8), ironMat);
    mast.position.set(0.35, -2.55, -0.3);
    group.add(mast);

    // Live cyan relay telemetry beacon
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x18b4ff });
    this.relayBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), beaconMat);
    this.relayBeacon.position.set(-0.38, -0.45, 1.12);
    group.add(this.relayBeacon);

    this.relayGroup = group;
    this.scene.add(group);
  }

  _buildSevernThresholdAndCast() {
    // Grounded Severn doorway, red exit fixture, teal cistern valve, and courier/Bekele parcel handoff at y = -2.15
    const root = new THREE.Group();
    root.position.set(2.55, -2.15, -2.35);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x2a2726, roughness: 0.88 });
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x4b302b, roughness: 0.82 });
    const vestibuleMat = new THREE.MeshBasicMaterial({ color: 0xf2a541 });

    // Stoop & doorway surround
    const stoop = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.20, 1.25), stoneMat);
    stoop.position.set(0, 0.10, 0.35);
    root.add(stoop);

    const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.35, 0.38), brickMat);
    wallLeft.position.set(-0.72, 1.27, 0);
    root.add(wallLeft);

    const wallRight = new THREE.Mesh(new THREE.BoxGeometry(0.65, 2.35, 0.38), brickMat);
    wallRight.position.set(0.76, 1.27, 0);
    root.add(wallRight);

    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.42, 0.42), stoneMat);
    lintel.position.set(0.02, 2.46, 0);
    root.add(lintel);

    // Warm interior vestibule portal
    this.vestibulePortal = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 2.05), vestibuleMat);
    this.vestibulePortal.position.set(0, 1.22, -0.12);
    root.add(this.vestibulePortal);

    // Severn fixture-bound colors (Brief 4): red lintel exit fixture + teal cistern cooling valve
    const redLamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.09, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xd9483b })
    );
    redLamp.position.set(0, 2.34, 0.24);
    root.add(redLamp);

    this.cisternGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.58, 12),
      new THREE.MeshStandardMaterial({
        color: 0x1ca8bf,
        emissive: 0x0d5d6e,
        roughness: 0.35,
        metalness: 0.45,
      })
    );
    this.cisternGlow.position.set(0.82, 0.48, 0.36);
    root.add(this.cisternGlow);

    // Operable Severn Door hinged at x = -0.45
    this.doorPivot = new THREE.Group();
    this.doorPivot.position.set(-0.45, 0.20, 0.05);
    const doorLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.90, 2.02, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x3b2820, roughness: 0.68 })
    );
    doorLeaf.position.set(0.45, 1.01, 0);
    this.doorPivot.add(doorLeaf);
    root.add(this.doorPivot);

    // Warm light spill across wet pavement when doorOpen is true
    this.doorSpillMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.55, 2.6),
      new THREE.MeshBasicMaterial({
        color: 0xf2a541,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      })
    );
    this.doorSpillMesh.rotation.x = -Math.PI / 2;
    this.doorSpillMesh.position.set(-0.08, 0.02, 1.45);
    root.add(this.doorSpillMesh);

    this.doorWarmLight = new THREE.PointLight(0xf2a541, 2.2, 7.5);
    this.doorWarmLight.position.set(0, 1.5, 0.6);
    root.add(this.doorWarmLight);

    // Grounded silhouette actors (Courier on curb, Bekele at threshold) + Parcel prop
    const figMat = new THREE.MeshStandardMaterial({ color: 0x121722, roughness: 0.85 });
    const makeFigure = (x, yFoot, z) => {
      const g = new THREE.Group();
      g.position.set(x, yFoot, z);
      const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.68, 10), figMat);
      legs.position.y = 0.34;
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.62, 10), figMat);
      torso.position.y = 0.96;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 12), figMat);
      head.position.y = 1.42;
      g.add(legs, torso, head);
      return g;
    };

    this.courierFig = makeFigure(-0.68, 0.0, 0.92);
    this.bekeleFig = makeFigure(0.14, 0.20, 0.22);
    root.add(this.courierFig, this.bekeleFig);

    this.parcelMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.22, 0.24),
      new THREE.MeshStandardMaterial({
        color: 0xe6a145,
        emissive: 0x5c3609,
        roughness: 0.48,
      })
    );
    root.add(this.parcelMesh);

    this.severnRoot = root;
    this.scene.add(root);
  }

  _buildWetStreetReflection() {
    // Damp stone street plane at ground contact y = -2.15 with animated water ripples restricted to wet stone
    this.waterApronMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uDoorOpen: { value: 1.0 },
        uTide: { value: 0.75 },
        uWet: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uDoorOpen;
        uniform float uTide;
        uniform float uWet;
        varying vec2 vUv;
        void main() {
          float ripple = sin(vUv.y * 52.0 - uTime * 2.1 + sin(vUv.x * 19.0 + uTime)) * 0.5 + 0.5;
          float puddleMask = smoothstep(0.08, 0.65, vUv.y) * (0.45 + 0.45 * uTide);
          // Warm Severn doorway reflection column around x ~ 0.62
          float doorGlow = exp(-pow((vUv.x - 0.62) * 5.8, 2.0)) * uDoorOpen * (0.55 + 0.45 * ripple);
          // Cyan relay dish & cistern reflection streak around x ~ 0.68..0.76
          float cyanGlow = exp(-pow((vUv.x - 0.70) * 8.5, 2.0)) * (0.28 + 0.45 * uWet) * ripple;
          vec3 baseStone = vec3(0.05, 0.08, 0.13);
          vec3 col = baseStone + vec3(0.95, 0.62, 0.24) * doorGlow * 0.55 + vec3(0.10, 0.72, 1.0) * cyanGlow * 0.48;
          float alpha = clamp(puddleMask * (0.34 + 0.22 * doorGlow + 0.18 * cyanGlow), 0.0, 0.62);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(18, 9.5), this.waterApronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(0, -2.14, 1.8);
    apron.renderOrder = 30;
    this.waterApronMesh = apron;
    this.scene.add(apron);
  }

  _buildFolioPageTexture() {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 320;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#e7dcc4';
    ctx.fillRect(0, 0, cv.width, cv.height);
    // Center spine crease
    ctx.fillStyle = 'rgba(42, 31, 20, 0.32)';
    ctx.fillRect(cv.width * 0.5 - 3, 0, 6, cv.height);
    // Left page: Concentric Plato Atlantis Canal Rings
    const cx = cv.width * 0.26;
    const cy = cv.height * 0.52;
    for (const [r, col] of [[96, '#137aa8'], [72, '#8a5d2e'], [48, '#18b4ff'], [24, '#c78834']]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Right page: Ruled Oulipo stanza bars
    ctx.fillStyle = '#33281e';
    for (let row = 0; row < 8; row++) {
      const w = 130 + ((row * 37) % 64);
      ctx.fillRect(cv.width * 0.56, 48 + row * 28, w, 6);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildDiegeticStreetRoutes() {
    this.routePickables = [];
    this.hoveredRouteMeta = null;

    const addPick = (mesh, meta) => {
      mesh.userData.streetRoute = meta;
      this.routePickables.push(mesh);
      return mesh;
    };

    // 1. LIT SEVERN DOORWAY -> ../ (The Nolli Block)
    const severnHit = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 2.75, 1.45),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    severnHit.position.set(0, 1.35, 0.25);
    this.severnRoot.add(severnHit);
    addPick(severnHit, {
      id: 'severn-doorway',
      href: '../',
      anchorObj: this.severnRoot,
      anchorOffset: new THREE.Vector3(0, 2.68, 0.1),
      whisper: 'Lit Severn Doorway — Enter the Nolli Block',
    });

    // 2. RUNNING FIGURES (P2 WEAVE Street Cast) & MONUMENTAL RELAY DISH -> ../weave/ (WEAVE Stage)
    const runRoot = new THREE.Group();
    runRoot.position.set(-1.35, -0.35, -1.72);
    this.runningFiguresGroup = runRoot;
    this.scene.add(runRoot);

    const runnersHit = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 3.3, 0.65),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    runnersHit.position.set(0, 0, 0);
    runRoot.add(runnersHit);
    addPick(runnersHit, {
      id: 'running-figures',
      href: '../weave/',
      anchorObj: runRoot,
      anchorOffset: new THREE.Vector3(0.15, 1.55, 0),
      whisper: 'Running Street Figures — Enter WEAVE Stage',
    });

    const dishHit = new THREE.Mesh(
      new THREE.SphereGeometry(2.35, 12, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    dishHit.position.set(0, 0, 0);
    this.relayGroup.add(dishHit);
    addPick(dishHit, {
      id: 'relay-dish',
      href: '../weave/',
      anchorObj: this.relayGroup,
      anchorOffset: new THREE.Vector3(-0.2, 1.85, 0.4),
      whisper: 'Suspended Relay Dish — Enter WEAVE Stage',
    });

    // 3. WET FOREGROUND CANAL & STOOP FOLIO -> ../atlantis/ (Atlantis Rings)
    const folioRoot = new THREE.Group();
    folioRoot.position.set(-2.05, -2.13, 2.55);
    folioRoot.rotation.y = 0.28;

    const canalQuoin = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.22, 0.74),
      new THREE.MeshStandardMaterial({ color: 0x262e3a, roughness: 0.84 })
    );
    canalQuoin.position.y = 0.11;
    folioRoot.add(canalQuoin);

    const brassCover = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.035, 0.50),
      new THREE.MeshStandardMaterial({ color: 0xc99c58, roughness: 0.36, metalness: 0.68 })
    );
    brassCover.position.set(0, 0.24, 0);
    brassCover.rotation.x = 0.24;
    folioRoot.add(brassCover);

    const folioTex = this._buildFolioPageTexture();
    this.folioPagesMat = new THREE.MeshStandardMaterial({
      map: folioTex,
      emissive: new THREE.Color('#146a96'),
      emissiveIntensity: 0.42,
      roughness: 0.65,
    });
    const folioPages = new THREE.Mesh(new THREE.PlaneGeometry(0.70, 0.44), this.folioPagesMat);
    folioPages.position.set(0, 0.265, 0.008);
    folioPages.rotation.x = -Math.PI / 2 + 0.24;
    folioRoot.add(folioPages);

    this.folioLight = new THREE.PointLight(0x18b4ff, 1.35, 3.6);
    this.folioLight.position.set(0, 0.58, 0.15);
    folioRoot.add(this.folioLight);
    this.folioRoot = folioRoot;
    this.scene.add(folioRoot);

    const folioHit = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.85, 1.05),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    folioHit.position.set(0, 0.35, 0);
    folioRoot.add(folioHit);
    addPick(folioHit, {
      id: 'stoop-folio',
      href: '../atlantis/',
      anchorObj: folioRoot,
      anchorOffset: new THREE.Vector3(0, 0.68, 0),
      whisper: 'Stoop Folio & Wet Canal — Enter Atlantis Rings',
    });

    const canalHit = new THREE.Mesh(
      new THREE.PlaneGeometry(11.5, 4.4),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    canalHit.rotation.x = -Math.PI / 2;
    canalHit.position.set(-0.3, -2.11, 3.25);
    this.scene.add(canalHit);
    addPick(canalHit, {
      id: 'wet-canal',
      href: '../atlantis/',
      anchorObj: folioRoot,
      anchorOffset: new THREE.Vector3(1.65, 0.45, 0.55),
      whisper: 'Wet Foreground Canal — Dive to Atlantis Rings',
    });

    // 4. DISTANT STREET SKYLINE -> ../island/ (Island City)
    const skylineRoot = new THREE.Group();
    skylineRoot.position.set(-0.65, 0.55, -9.65);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x16283e,
      emissive: 0x0b1f33,
      roughness: 0.78,
    });
    const towerSpecs = [
      [-2.1, 0.25, 0.72, 2.2],
      [-1.15, 0.52, 0.64, 2.75],
      [-0.25, 0.38, 0.58, 2.45],
      [0.68, 0.62, 0.66, 2.95],
      [1.55, 0.20, 0.62, 2.1],
    ];
    for (const [tx, ty, tw, th] of towerSpecs) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(tw, th, 0.45), towerMat);
      m.position.set(tx, ty, 0);
      skylineRoot.add(m);
    }
    this.skylineBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xf2a541 })
    );
    this.skylineBeacon.position.set(0.68, 2.18, 0.15);
    skylineRoot.add(this.skylineBeacon);
    this.skylineMat = towerMat;
    this.skylineRoot = skylineRoot;
    this.scene.add(skylineRoot);

    const skylineHit = new THREE.Mesh(
      new THREE.PlaneGeometry(6.8, 3.1),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    skylineHit.position.set(0, 0.65, 0.3);
    skylineRoot.add(skylineHit);
    addPick(skylineHit, {
      id: 'distant-skyline',
      href: '../island/',
      anchorObj: skylineRoot,
      anchorOffset: new THREE.Vector3(0, 1.85, 0.2),
      whisper: 'Distant Street Skyline — Enter Island City',
    });
  }

  _bindRouteRaycaster() {
    const raycaster = new THREE.Raycaster();
    const ptrNdc = new THREE.Vector2();
    const whisperEl = document.getElementById('world-whisper');
    const worldTmp = new THREE.Vector3();
    let downPos = null;

    const pickAt = (e) => {
      if (
        document.body.classList.contains('sheet-open') ||
        document.body.classList.contains('mp-tab-open')
      ) {
        return null;
      }
      const r = this.canvas.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      ptrNdc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ptrNdc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(ptrNdc, this.camera);
      const hits = raycaster.intersectObjects(this.routePickables, false);
      return hits.length ? hits[0].object.userData.streetRoute : null;
    };

    this._syncRouteWhisper = () => {
      if (!whisperEl) return;
      const meta = this.hoveredRouteMeta;
      if (
        !meta ||
        document.body.classList.contains('sheet-open') ||
        document.body.classList.contains('mp-tab-open')
      ) {
        whisperEl.classList.remove('visible');
        return;
      }
      meta.anchorObj.updateMatrixWorld();
      worldTmp.copy(meta.anchorOffset);
      meta.anchorObj.localToWorld(worldTmp);
      const p = projectWorldLabel(this.camera, worldTmp, this.canvas);
      if (!p.inFront) {
        whisperEl.classList.remove('visible');
        return;
      }
      whisperEl.textContent = meta.whisper;
      whisperEl.classList.add('visible');
      const halfW = Math.ceil((whisperEl.offsetWidth || 240) * 0.5) + 16;
      const cx = THREE.MathUtils.clamp(p.x, halfW, Math.max(halfW, window.innerWidth - halfW));
      const cy = THREE.MathUtils.clamp(p.y, 36, window.innerHeight - 28);
      whisperEl.style.left = `${Math.round(cx)}px`;
      whisperEl.style.top = `${Math.round(cy)}px`;
    };

    const stageEl = this.canvas.parentElement;
    stageEl.addEventListener(
      'pointermove',
      (e) => {
        if (!this.reducedMotion) {
          const r = stageEl.getBoundingClientRect();
          this.pointerX = ((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2;
          this.pointerY = ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2;
        }
        this.hoveredRouteMeta = pickAt(e);
        this.canvas.style.cursor = this.hoveredRouteMeta ? 'pointer' : 'default';
        this._syncRouteWhisper();
      },
      { passive: true }
    );

    stageEl.addEventListener('pointerleave', () => {
      this.pointerX = 0;
      this.pointerY = 0;
      this.hoveredRouteMeta = null;
      this.canvas.style.cursor = 'default';
      if (whisperEl) whisperEl.classList.remove('visible');
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0) downPos = { x: e.clientX, y: e.clientY };
    });

    this.canvas.addEventListener('pointerup', (e) => {
      if (e.button !== 0 || !downPos) return;
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      downPos = null;
      if (moved > 8) return;

      const picked = pickAt(e);
      if (!picked) return;

      // Shift+Click on Severn Doorway toggles doorOpen in-place; normal Click enters ../
      if (picked.id === 'severn-doorway' && e.shiftKey) {
        const cur = loadPilotState();
        savePilotState({ doorOpen: !cur.doorOpen });
        return;
      }
      window.location.assign(destinationWithHash(picked.href, loadPilotState()));
    });
  }

  setExplode(amount01) {
    this.explodeAmount = Math.max(0, Math.min(1, Number(amount01) || 0));
  }

  recoverSourceCamera() {
    this.explodeAmount = 0;
    this.pointerX = 0;
    this.pointerY = 0;
    this.camOffsetX = 0;
    this.camOffsetY = 0;
  }

  applyPilot(pilot) {
    this.pilot = pilot;
    if (!this.scene) return;

    // Door angle + light spill
    if (this.doorPivot) {
      this.doorPivot.rotation.y = pilot.doorOpen ? -1.18 : 0.0;
    }
    if (this.doorSpillMesh) {
      this.doorSpillMesh.material.opacity = pilot.doorOpen ? 0.30 : 0.03;
    }
    if (this.vestibulePortal) {
      this.vestibulePortal.material.color.set(pilot.doorOpen ? '#f2a541' : '#3a2b1a');
    }
    if (this.doorWarmLight) {
      this.doorWarmLight.intensity = pilot.doorOpen ? 2.4 : 0.25;
    }

    // Parcel ownership position
    if (this.parcelMesh) {
      if (pilot.parcelHolder === 'bekele') {
        this.parcelMesh.position.set(0.02, 1.12, 0.36);
      } else if (pilot.parcelHolder === 'maren') {
        this.parcelMesh.position.set(0.02, 2.15, -0.05);
      } else {
        this.parcelMesh.position.set(-0.46, 0.96, 0.96);
      }
    }

    // Cistern wet state
    if (this.cisternGlow) {
      this.cisternGlow.material.emissive.set(pilot.coolingWet ? '#18b4ff' : '#0b4452');
    }

    // Sky colors by worldTime & era
    if (this.skyMat) {
      const h = pilot.worldTime;
      const submerged = pilot.era === 'submerged-ruin';
      if (submerged) {
        this.skyMat.uniforms.uTop.value.set('#051824');
        this.skyMat.uniforms.uHorizon.value.set('#123d4f');
        this.skyMat.uniforms.uWarm.value.set('#b8332a'); // Verne Ch.32 volcanic red glow
      } else if (h >= 7 && h < 16.5) {
        this.skyMat.uniforms.uTop.value.set('#38628a');
        this.skyMat.uniforms.uHorizon.value.set('#8db0cc');
        this.skyMat.uniforms.uWarm.value.set('#f3dfc1');
      } else if (h >= 16.5 && h < 20.2) {
        this.skyMat.uniforms.uTop.value.set('#0a1930');
        this.skyMat.uniforms.uHorizon.value.set('#2c5c88');
        this.skyMat.uniforms.uWarm.value.set('#f2a541');
      } else {
        this.skyMat.uniforms.uTop.value.set('#060b16');
        this.skyMat.uniforms.uHorizon.value.set('#162844');
        this.skyMat.uniforms.uWarm.value.set('#8c5327');
      }
    }

    if (this.waterApronMat) {
      const clock = deriveClockMapping(pilot);
      this.waterApronMat.uniforms.uDoorOpen.value = pilot.doorOpen ? 1.0 : 0.12;
      this.waterApronMat.uniforms.uTide.value = Math.min(1, clock.waterLevelM / 4.0);
      this.waterApronMat.uniforms.uWet.value = pilot.coolingWet ? 1.0 : 0.2;
    }
  }

  resize() {
    if (!this.renderer || !this.canvas.parentElement) return;
    this.canvas.style.width = '';
    this.canvas.style.height = '';
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = Math.max(300, Math.round(this.canvas.clientWidth || rect.width));
    const h = Math.max(220, Math.round(this.canvas.clientHeight || rect.height));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.pipeline.setSize(w, h);
  }

  _animate() {
    const tick = (nowMs) => {
      const t = nowMs * 0.001;
      const ex = this.explodeAmount;
      const targetX = this.reducedMotion ? 0 : this.pointerX * 0.30 + ex * 2.35;
      const targetY = this.reducedMotion ? 0 : -this.pointerY * 0.09 + ex * 0.65;
      this.camOffsetX += (targetX - this.camOffsetX) * 0.09;
      this.camOffsetY += (targetY - this.camOffsetY) * 0.09;

      // Camera preset overrides from Brief 7 depth inspection
      let presetX = 0;
      let presetZ = 12.0;
      if (this.pilot.camera?.preset === 'lateral-curb') {
        presetX = 0.28;
      } else if (this.pilot.camera?.preset === 'vestibule-threshold') {
        presetX = 0.85;
        presetZ = 9.8;
      }

      this.camera.position.set(this.camOffsetX + presetX, 0.35 + this.camOffsetY, presetZ + ex * 1.6);
      this.camera.lookAt(ex * -0.45, 0.12, -2.5 * ex);

      // Subtle layer fan-out during "Take the scene apart" while keeping y ground contact locked
      for (let i = 0; i < this.planeMeshes.length; i++) {
        const item = this.planeMeshes[i];
        item.mesh.position.x = ex * (i - 2.5) * 0.55;
      }

      if (this.relayBeacon) {
        const isDishHover =
          this.hoveredRouteMeta?.id === 'relay-dish' || this.hoveredRouteMeta?.id === 'running-figures';
        const pulse = 0.55 + 0.45 * Math.sin(t * (isDishHover ? 5.2 : 2.4));
        this.relayBeacon.scale.setScalar((isDishHover ? 1.25 : 0.85) + pulse * 0.35);
      }
      if (this.runningFiguresMat) {
        const hRun =
          this.hoveredRouteMeta?.id === 'running-figures' || this.hoveredRouteMeta?.id === 'relay-dish';
        this.runningFiguresMat.emissive.setHex(hRun ? 0x185888 : 0x091d30);
      }
      if (this.doorWarmLight) {
        const hDoor = this.hoveredRouteMeta?.id === 'severn-doorway';
        const baseI = this.pilot.doorOpen ? 2.4 : 0.35;
        this.doorWarmLight.intensity = hDoor ? baseI + 1.45 : baseI;
      }
      if (this.folioPagesMat) {
        const hAtlantis =
          this.hoveredRouteMeta?.id === 'stoop-folio' || this.hoveredRouteMeta?.id === 'wet-canal';
        this.folioPagesMat.emissiveIntensity = hAtlantis ? 1.05 : 0.42;
      }
      if (this.skylineMat) {
        const hIsland = this.hoveredRouteMeta?.id === 'distant-skyline';
        this.skylineMat.emissive.setHex(hIsland ? 0x224b73 : 0x0b1f33);
      }
      if (this.waterApronMat) {
        this.waterApronMat.uniforms.uTime.value = t;
      }
      if (this._syncRouteWhisper && this.hoveredRouteMeta) {
        this._syncRouteWhisper();
      }

      const lookObj = ALL_CITY_LOOKS.find((l) => l.id === this.pilot.shader) || ALL_CITY_LOOKS[0];
      const useRawDaylight = Boolean(this.pilot.rawDaylight);

      this.pipeline.render(this.scene, this.camera, {
        time: t,
        focusM: 10.5,
        dofAmount: 0.0,
        ev: useRawDaylight ? 0.18 : 0.0,
        mode: useRawDaylight ? -1 : lookObj.mode,
        paletteColors: lookObj.colors,
      });

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

// ---------- UI Rendering & Interactive Bindings ----------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function destinationWithHash(baseHref, state) {
  if (baseHref.startsWith('#')) return baseHref;
  const hash = formatPilotHash(state);
  return `${baseHref}${hash}`;
}

async function boot() {
  const initialPilot = applyPilotUrlHash();
  const queryParams = new URLSearchParams(window.location.search || '');
  const qPatch = {};
  if (queryParams.has('shader')) {
    const qShader = queryParams.get('shader');
    if (ALL_CITY_LOOKS.some((l) => l.id === qShader)) qPatch.shader = qShader;
  }
  if (queryParams.has('time')) {
    const timeMap = { dawn: 6.5, midday: 13.0, bluehour: 18.5, night: 22.5 };
    const qTime = queryParams.get('time')?.toLowerCase();
    if (qTime && Object.prototype.hasOwnProperty.call(timeMap, qTime)) qPatch.worldTime = timeMap[qTime];
  }
  savePilotState({ ...initialPilot, ...qPatch }, { syncHash: false });

  const sound = new DesignRoomSoundEngine();
  sound.loadLedger().then((ledger) => renderFreesoundLedgerTable(ledger)).catch(() => {});

  const closeSheetBtn = document.getElementById('close-sheet-btn');
  if (closeSheetBtn) {
    closeSheetBtn.addEventListener('click', () => {
      document.body.classList.remove('sheet-open');
    });
  }

  window.addEventListener('keydown', async (e) => {
    const tag = (e.target?.tagName || '').toUpperCase();
    if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // Summon searchable directory/briefs sheet on Tab; when already open, allow normal Tab focus traversal unless Shift+Tab at top or Escape
      if (!document.body.classList.contains('sheet-open')) {
        e.preventDefault();
        document.body.classList.add('sheet-open');
        const whisperEl = document.getElementById('world-whisper');
        if (whisperEl) whisperEl.classList.remove('visible');
        return;
      }
      if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA' && tag !== 'A' && tag !== 'BUTTON') {
        e.preventDefault();
        document.body.classList.remove('sheet-open');
        return;
      }
    }
    if (e.key === 'Escape' && document.body.classList.contains('sheet-open')) {
      e.preventDefault();
      document.body.classList.remove('sheet-open');
      return;
    }
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '[' || e.key === ']') {
      e.preventDefault();
      const cur = loadPilotState();
      const idx = Math.max(0, ALL_CITY_LOOKS.findIndex((l) => l.id === cur.shader));
      const delta = e.key === ']' ? 1 : -1;
      const nextLook = ALL_CITY_LOOKS[(idx + delta + ALL_CITY_LOOKS.length) % ALL_CITY_LOOKS.length];
      savePilotState({ shader: nextLook.id });
    } else if (e.key >= '1' && e.key <= '4') {
      const hrs = { '1': 6.5, '2': 13.0, '3': 18.5, '4': 22.5 };
      savePilotState({ worldTime: hrs[e.key], rawDaylight: false });
    } else if (e.key === 'm' || e.key === 'M') {
      const cur = loadPilotState();
      if (!sound.started) {
        await sound.ensureStarted(cur);
      } else {
        sound.setMuted(!sound.muted, cur);
      }
    } else if (e.key === 'e' || e.key === 'E') {
      if (stage) {
        stage.setExplode(stage.explodeAmount > 0.2 ? 0 : 0.85);
      }
    }
  });

  // Populate 23 GPU Shader selectors
  const heroShaderSelect = document.getElementById('hero-shader-select');
  const masterShaderSelect = document.getElementById('master-shader-select');
  const shaderOptionsHtml = ALL_CITY_LOOKS.map(
    (look, idx) => `<option value="${escapeHtml(look.id)}">${String(idx + 1).padStart(2, '0')} · ${escapeHtml(look.name)}</option>`
  ).join('');
  if (heroShaderSelect) heroShaderSelect.innerHTML = shaderOptionsHtml;
  if (masterShaderSelect) masterShaderSelect.innerHTML = shaderOptionsHtml;

  // Populate 14-Poem strip
  const poemStrip = document.getElementById('poem-strip');
  if (poemStrip) {
    poemStrip.innerHTML = POEMS.map(
      (p) =>
        `<button type="button" class="poem-pill" data-poem="${p.id}" aria-pressed="false" title="Poem ${p.id}: ${escapeHtml(p.title)} (${escapeHtml(p.district)})">P${p.id}</button>`
    ).join('');
    poemStrip.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-poem]');
      if (!btn) return;
      const pObj = POEMS.find((x) => x.id === btn.dataset.poem);
      if (pObj) {
        savePilotState({ poem: pObj.id, worldTime: pObj.hour });
      }
    });
  }

  // Initialize WebGL Multiplane Hero without blocking synchronous UI mount
  const canvas = document.getElementById('hero-canvas');
  const fallbackImg = document.querySelector('.hero-fallback-poster');
  let stage = null;
  if (canvas) {
    stage = new HeroMultiplaneStage(canvas, fallbackImg);
    stage
      .init()
      .then(() => stage.applyPilot(loadPilotState()))
      .catch(() => {
        // Fallback poster stays cleanly visible if WebGL is unavailable
      });
  }

  // Render Searchable Tool Directory
  let activeVerbGroup = 'all';
  let searchQuery = '';
  const dirContainer = document.getElementById('directory-groups');
  const toolCountEl = document.getElementById('tool-count');
  const toolSearchInput = document.getElementById('tool-search');

  function renderDirectory(pilot) {
    if (!dirContainer) return;
    const q = searchQuery.trim().toLowerCase();
    const filtered = TOOL_DIRECTORY.filter((item) => {
      if (activeVerbGroup !== 'all' && item.group !== activeVerbGroup) return false;
      if (!q) return true;
      const hay = `${item.verb} ${item.toolName} ${item.group} ${item.desc} ${item.carries.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });

    if (toolCountEl) {
      toolCountEl.textContent = `${filtered.length} of ${TOOL_DIRECTORY.length} destinations`;
    }

    const groups = [
      'Walk & inhabit',
      'Evolve & inspect buildings',
      'Compose & reconstruct depth',
      'Read & score through time',
    ];

    const clock = deriveClockMapping(pilot);
    const carrySummary = `Poem ${pilot.poem} | Severn Door: ${pilot.doorOpen ? 'Open' : 'Closed'} | Parcel: ${pilot.parcelHolder} | ${clock.formattedLocalTime} | ${pilot.shader}`;

    dirContainer.innerHTML = groups
      .map((grp) => {
        const items = filtered.filter((i) => i.group === grp);
        if (!items.length) return '';
        const cardsHtml = items
          .map(
            (it) => `
          <article class="dir-card">
            <a class="dir-card-link" href="${escapeHtml(destinationWithHash(it.href, pilot))}" data-dest-base="${escapeHtml(it.href)}">
              <figure class="dir-thumb">
                <img src="${escapeHtml(it.thumb)}" alt="${escapeHtml(it.alt)}" loading="lazy" width="728" height="408">
                <span class="dir-tool-tag">${escapeHtml(it.toolName)}</span>
              </figure>
              <div class="dir-body">
                <h4 class="dir-verb">${escapeHtml(it.verb)}</h4>
                <p class="dir-desc">${escapeHtml(it.desc)}</p>
                <div class="dir-state-carry">
                  <span class="carry-label">Carried pilot state:</span>
                  <code>${escapeHtml(carrySummary)}</code>
                </div>
              </div>
            </a>
          </article>`
          )
          .join('');
        return `
        <section class="verb-group" aria-label="${escapeHtml(grp)}">
          <header class="verb-group-head">
            <h3>${escapeHtml(grp)}</h3>
            <span>${items.length} ${items.length === 1 ? 'workbench' : 'workbenches'}</span>
          </header>
          <div class="dir-grid">${cardsHtml}</div>
        </section>`;
      })
      .join('');
  }

  if (toolSearchInput) {
    toolSearchInput.addEventListener('input', () => {
      searchQuery = toolSearchInput.value || '';
      renderDirectory(loadPilotState());
    });
  }

  document.querySelectorAll('[data-verb-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeVerbGroup = btn.dataset.verbFilter || 'all';
      document.querySelectorAll('[data-verb-filter]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      renderDirectory(loadPilotState());
    });
  });

  // Render All 9 Interactive Design Brief Cards
  const briefsContainer = document.getElementById('briefs-list');

  function buildBriefInteractiveWidget(b, pilot) {
    switch (b.controlType) {
      case 'entrance':
        return `
          <div class="brief-live-box">
            <div class="brief-live-title">Live Pilot Binding · Entrance & Shader</div>
            <div class="brief-live-row">
              <button type="button" class="act-btn" data-pilot-act="cycle-shader">Next GPU Look (${escapeHtml(pilot.shader)})</button>
              <button type="button" class="act-btn" data-pilot-act="explode-toggle">Toggle 6-Plane Layer Reveal</button>
              <a class="act-link" href="${escapeHtml(destinationWithHash('../weave/', pilot))}">Watch the work -></a>
            </div>
          </div>`;
      case 'interiors':
        return `
          <div class="brief-live-box">
            <div class="brief-live-title">Live Pilot Binding · Severn 20x12m Shell & Threshold</div>
            <div class="brief-live-row">
              <label class="inline-field">Room
                <select data-pilot-field="room" aria-label="Severn room">
                  ${SEVERN_PILOT_CONTRACT.rooms
                    .map((r) => `<option value="${r}" ${pilot.room === r ? 'selected' : ''}>${r}</option>`)
                    .join('')}
                </select>
              </label>
              <button type="button" class="act-btn ${pilot.doorOpen ? 'is-on' : ''}" data-pilot-act="toggle-door">
                Severn Door: ${pilot.doorOpen ? 'Open (Walkable / 13.5 kHz)' : 'Closed (Blocked / 640 Hz)'}
              </button>
              <button type="button" class="act-btn" data-pilot-act="mutate-seed">Mutate Seed (${pilot.seed})</button>
              <a class="act-link" href="${escapeHtml(destinationWithHash('../foundry/', pilot))}">Open Foundry -></a>
            </div>
          </div>`;
      case 'inhabited':
        return `
          <div class="brief-live-box">
            <div class="brief-live-title">Live Pilot Binding · Resident Parcel Handoff (Shot ${escapeHtml(pilot.shot)})</div>
            <div class="brief-live-row">
              <button type="button" class="act-btn ${pilot.parcelHolder === 'player' ? 'is-on' : ''}" data-pilot-set-holder="player">Courier Holds Parcel</button>
              <button type="button" class="act-btn ${pilot.parcelHolder === 'bekele' ? 'is-on' : ''}" data-pilot-set-holder="bekele">Hand Parcel to Bekele</button>
              <button type="button" class="act-btn ${pilot.parcelHolder === 'maren' ? 'is-on' : ''}" data-pilot-set-holder="maren">Deliver Upstairs to Maren (2A)</button>
              <a class="act-link" href="${escapeHtml(destinationWithHash('../weave/', pilot))}">Verify in WEAVE -></a>
            </div>
          </div>`;
      case 'heroes':
        return `
          <div class="brief-live-box">
            <div class="brief-live-title">Live Pilot Binding · Six HDL Heroes & Neutral Daylight Pass</div>
            <div class="brief-live-row">
              <label class="inline-field">Hero
                <select data-pilot-field="building" aria-label="HDL Hero Building">
                  ${['severn', 'chapel', 'new-single', 'pier-cafe', 'clock-tower', 'atlantis-rowhouse']
                    .map((h) => `<option value="${h}" ${pilot.building === h ? 'selected' : ''}>${h}</option>`)
                    .join('')}
                </select>
              </label>
              <button type="button" class="act-btn ${pilot.rawDaylight ? 'is-on' : ''}" data-pilot-act="toggle-raw-daylight">
                ${pilot.rawDaylight ? 'Pass: Neutral Raw Daylight' : 'Pass: Authored Poem-Hour'}
              </button>
              <a class="act-link" href="${escapeHtml(destinationWithHash('../heroes/', pilot))}">Open Heroes -></a>
            </div>
          </div>`;
      case 'worldtext':
        return `
          <div class="brief-live-box">
            <div class="brief-live-title">Live Pilot Binding · Calvino Reading & +4.0m Flood Datum</div>
            <div class="brief-live-row">
              <label class="inline-field">Reading
                <select data-pilot-field="account" aria-label="Calvino worldtext reading">
                  ${['memory', 'exchange', 'desire', 'signs', 'loss']
                    .map((a) => `<option value="${a}" ${pilot.account === a ? 'selected' : ''}>${a}</option>`)
                    .join('')}
                </select>
              </label>
              <a class="act-link" href="${escapeHtml(destinationWithHash('../worldtext/', pilot))}">Open Worldtext -></a>
            </div>
            <p class="brief-rule-readout">${escapeHtml(CALVINO_GATE_RULES[pilot.account] || CALVINO_GATE_RULES.memory)}</p>
          </div>`;
      case 'atlantis':
        return `
          <div class="brief-live-box">
            <div class="brief-live-title">Live Pilot Binding · Living Street vs Verne Ch. 32 Submerged Ruin</div>
            <div class="brief-live-row">
              <button type="button" class="act-btn ${pilot.era !== 'submerged-ruin' ? 'is-on' : ''}" data-pilot-set-era="living-harbor">Living Baltimere Street</button>
              <button type="button" class="act-btn ${pilot.era === 'submerged-ruin' ? 'is-on' : ''}" data-pilot-set-era="submerged-ruin">Verne Submerged Ruin</button>
              <label class="inline-field">Tide
                <select data-pilot-field="tidePhase" aria-label="Harbor tide phase">
                  ${TIDE_PHASES.map((t) => `<option value="${t.id}" ${pilot.tidePhase === t.id ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}
                </select>
              </label>
              <a class="act-link" href="${escapeHtml(destinationWithHash('../atlantis/', pilot))}">Open Atlantis -></a>
            </div>
          </div>`;
      case 'depth':
        return `
          <div class="brief-live-box">
            <div class="brief-live-title">Live Pilot Binding · Camera Cone & Source Recovery</div>
            <div class="brief-live-row">
              <button type="button" class="act-btn ${pilot.camera?.preset === 'street-eye' ? 'is-on' : ''}" data-pilot-cam="street-eye">Recover Source Camera</button>
              <button type="button" class="act-btn ${pilot.camera?.preset === 'lateral-curb' ? 'is-on' : ''}" data-pilot-cam="lateral-curb">Lateral Move (+0.28m)</button>
              <button type="button" class="act-btn ${pilot.camera?.preset === 'vestibule-threshold' ? 'is-on' : ''}" data-pilot-cam="vestibule-threshold">Walk to Threshold</button>
              <a class="act-link" href="${escapeHtml(destinationWithHash('../pointcloud/', pilot))}">Open Spatial 3D -></a>
            </div>
          </div>`;
      case 'sound':
        return `
          <div class="brief-live-box">
            <div class="brief-live-title">Live Pilot Binding · Door-Coupled Acoustics & Cistern Foley</div>
            <div class="brief-live-row">
              <button type="button" class="act-btn" data-pilot-act="audio-door-test">
                Toggle Door & Hear Cutoff (${pilot.doorOpen ? '13.5 kHz Open' : '640 Hz + 1.55s Reverb'})
              </button>
              <button type="button" class="act-btn" data-pilot-act="pour-water">
                Pour 1L Cistern Water (${pilot.waterLiters.toFixed(1)}L left · ${pilot.coolingWet ? 'Cooled' : 'Dry'})
              </button>
              <button type="button" class="act-btn" data-pilot-act="speak-line">Test Speech Ducking (-8.5 dB)</button>
            </div>
          </div>`;
      case 'shared':
      default:
        return `
          <div class="brief-live-box">
            <div class="brief-live-title">Live Pilot Binding · Cross-Tool Journey Verification (make_photo_pilot_v1)</div>
            <div class="brief-live-row">
              <a class="act-link" href="${escapeHtml(destinationWithHash('../heroes/', pilot))}">Jump to Heroes -></a>
              <a class="act-link" href="${escapeHtml(destinationWithHash('../foundry/', pilot))}">Jump to Foundry -></a>
              <a class="act-link" href="${escapeHtml(destinationWithHash('../weave/', pilot))}">Jump to WEAVE -></a>
              <a class="act-link" href="${escapeHtml(destinationWithHash('../island/', pilot))}">Jump to Island -></a>
              <a class="act-link" href="${escapeHtml(destinationWithHash('../maps/', pilot))}">Jump to Maps -></a>
              <button type="button" class="act-btn" data-pilot-act="reset-pilot">Reset Pilot Record</button>
            </div>
          </div>`;
    }
  }

  function renderBriefs(pilot) {
    if (!briefsContainer) return;
    const provFilter = pilot.provenanceFilter || 'all';

    briefsContainer.innerHTML = DESIGN_BRIEFS.map((b) => {
      const provItems = b.provenance.filter((p) => provFilter === 'all' || p.kind === provFilter);
      const provHtml = provItems
        .map(
          (p) => `
          <li class="prov-item prov-${escapeHtml(p.kind)}">
            <span class="prov-badge">${escapeHtml(p.kind)}</span>
            <span>${escapeHtml(p.text)}</span>
          </li>`
        )
        .join('');

      const sourcesHtml = b.sources
        .map((s) => `<a href="${escapeHtml(s.href.startsWith('..') ? destinationWithHash(s.href, pilot) : s.href)}">${escapeHtml(s.label)}</a>`)
        .join('');

      return `
        <article class="brief-card" id="${escapeHtml(b.id)}">
          <header class="brief-side">
            <div class="brief-num">Brief ${escapeHtml(b.num)} · ${escapeHtml(b.kicker)}</div>
            <h3>${escapeHtml(b.title)}</h3>
            <p class="brief-lead">${escapeHtml(b.lead)}</p>
            <div class="brief-side-actions">
              <a class="brief-open-btn" href="${escapeHtml(b.toolHref.startsWith('..') ? destinationWithHash(b.toolHref, pilot) : b.toolHref)}">${escapeHtml(b.toolLabel)}</a>
              <button type="button" class="copy-brief-btn" data-copy-brief="${escapeHtml(b.id)}">Copy brief</button>
            </div>
            <p class="copy-feedback" id="copy-fb-${escapeHtml(b.id)}" role="status" aria-live="polite"></p>
          </header>
          <div class="brief-main">
            <p class="brief-summary">${escapeHtml(b.summary)}</p>
            <div class="brief-acceptance">
              <strong>Acceptance scene:</strong> ${escapeHtml(b.acceptance)}
            </div>
            ${buildBriefInteractiveWidget(b, pilot)}
            <div class="brief-prov-wrap">
              <div class="brief-prov-hdr">Evidence & Provenance Ledger (${provFilter === 'all' ? 'all 4 classes' : escapeHtml(provFilter)})</div>
              <ul class="prov-list">${provHtml}</ul>
            </div>
            <div class="brief-sources">
              <span>Connected sources:</span>
              ${sourcesHtml}
            </div>
          </div>
        </article>`;
    }).join('');
  }

  // Event delegation for Brief cards & Master Pilot Console
  document.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('[data-copy-brief]');
    if (copyBtn) {
      const b = DESIGN_BRIEFS.find((x) => x.id === copyBtn.dataset.copyBrief);
      if (!b) return;
      const fb = document.getElementById(`copy-fb-${b.id}`);
      const payload = `WYGWYL — Brief ${b.num}: ${b.title}\n\n${b.fullPrompt}\n\nAcceptance scene: ${b.acceptance}`;
      try {
        await navigator.clipboard.writeText(payload);
        copyBtn.textContent = 'Copied';
        if (fb) fb.textContent = 'Full brief copied to clipboard.';
      } catch {
        copyBtn.textContent = 'Ready';
        if (fb) fb.textContent = 'Clipboard restricted; brief text ready in card.';
      }
      return;
    }

    const holderBtn = e.target.closest('[data-pilot-set-holder]');
    if (holderBtn) {
      const holder = holderBtn.dataset.pilotSetHolder;
      const cur = loadPilotState();
      savePilotState({ parcelHolder: holder });
      if (sound.started) sound.triggerOneShot('slot_contact_footsteps', 1.04, 0.25);
      return;
    }

    const eraBtn = e.target.closest('[data-pilot-set-era]');
    if (eraBtn) {
      savePilotState({ era: eraBtn.dataset.pilotSetEra });
      return;
    }

    const camBtn = e.target.closest('[data-pilot-cam]');
    if (camBtn) {
      const preset = camBtn.dataset.pilotCam;
      if (stage && preset === 'street-eye') {
        stage.recoverSourceCamera();
        const exSlider = document.getElementById('hero-explode-range');
        if (exSlider) exSlider.value = '0';
      }
      const cur = loadPilotState();
      savePilotState({ camera: { ...cur.camera, preset } });
      return;
    }

    const provBtn = e.target.closest('[data-prov-filter]');
    if (provBtn) {
      savePilotState({ provenanceFilter: provBtn.dataset.provFilter });
      return;
    }

    const actBtn = e.target.closest('[data-pilot-act]');
    if (actBtn) {
      const act = actBtn.dataset.pilotAct;
      const cur = loadPilotState();
      if (act === 'toggle-door') {
        savePilotState({ doorOpen: !cur.doorOpen });
        if (sound.started) sound.triggerOneShot('slot_cistern_relay_pump', cur.doorOpen ? 0.85 : 1.25, 0.22);
      } else if (act === 'audio-door-test') {
        await sound.ensureStarted(cur);
        savePilotState({ doorOpen: !cur.doorOpen });
        sound.triggerOneShot('slot_cistern_relay_pump', 0.95, 0.25);
      } else if (act === 'pour-water') {
        await sound.ensureStarted(cur);
        const nextLiters = Math.max(0, Number((cur.waterLiters - 1.0).toFixed(1)));
        savePilotState({ waterLiters: nextLiters > 0 ? nextLiters : 5.0, coolingWet: true });
        sound.triggerOneShot('slot_jerrycan_water_pour', 0.96, 0.85);
      } else if (act === 'speak-line') {
        await sound.ensureStarted(cur);
        const duckStatus = document.getElementById('ducking-status');
        sound.speakPoemLine(cur, (active, line) => {
          if (duckStatus) {
            duckStatus.textContent = active
              ? `Speaking Poem ${cur.poem} (distant bed ducked -8.5 dB): "${line}"`
              : 'Voice idle · Distant bed at nominal gain · Delay send 0.00';
          }
        });
      } else if (act === 'cycle-shader') {
        const idx = ALL_CITY_LOOKS.findIndex((l) => l.id === cur.shader);
        const nextLook = ALL_CITY_LOOKS[(idx + 1) % ALL_CITY_LOOKS.length];
        savePilotState({ shader: nextLook.id });
      } else if (act === 'explode-toggle') {
        if (stage) {
          const nextEx = stage.explodeAmount > 0.2 ? 0 : 0.85;
          stage.setExplode(nextEx);
          const exSlider = document.getElementById('hero-explode-range');
          if (exSlider) exSlider.value = String(Math.round(nextEx * 100));
        }
      } else if (act === 'mutate-seed') {
        savePilotState({ seed: cur.seed + 17 });
      } else if (act === 'toggle-raw-daylight') {
        savePilotState({ rawDaylight: !cur.rawDaylight });
      } else if (act === 'reset-pilot') {
        resetPilotState();
      }
    }
  });

  document.addEventListener('change', (e) => {
    const fieldEl = e.target.closest('[data-pilot-field]');
    if (fieldEl) {
      const field = fieldEl.dataset.pilotField;
      savePilotState({ [field]: fieldEl.value });
    }
  });

  // Hero & Master direct controls
  if (heroShaderSelect) {
    heroShaderSelect.addEventListener('change', () => savePilotState({ shader: heroShaderSelect.value }));
  }
  if (masterShaderSelect) {
    masterShaderSelect.addEventListener('change', () => savePilotState({ shader: masterShaderSelect.value }));
  }

  const explodeRange = document.getElementById('hero-explode-range');
  if (explodeRange) {
    explodeRange.addEventListener('input', () => {
      if (stage) stage.setExplode(Number(explodeRange.value) / 100);
    });
  }

  const recoverCamBtn = document.getElementById('hero-recover-cam');
  if (recoverCamBtn) {
    recoverCamBtn.addEventListener('click', () => {
      if (stage) stage.recoverSourceCamera();
      if (explodeRange) explodeRange.value = '0';
      const cur = loadPilotState();
      savePilotState({ camera: { ...cur.camera, preset: 'street-eye' } });
    });
  }

  // Sound & Time strip controls
  const startAudioBtn = document.getElementById('audio-start-btn');
  const muteAudioBtn = document.getElementById('audio-mute-btn');
  const quietModeBtn = document.getElementById('audio-quiet-btn');

  function syncAudioButtons() {
    if (startAudioBtn) {
      startAudioBtn.textContent = sound.started ? 'Soundscape Active' : 'Start Soundscape';
      startAudioBtn.setAttribute('aria-pressed', String(sound.started));
    }
    if (muteAudioBtn) {
      muteAudioBtn.textContent = sound.muted ? 'Unmute' : 'Mute';
      muteAudioBtn.setAttribute('aria-pressed', String(sound.muted));
    }
    if (quietModeBtn) {
      quietModeBtn.setAttribute('aria-pressed', String(sound.quietMode));
    }
  }

  if (startAudioBtn) {
    startAudioBtn.addEventListener('click', async () => {
      await sound.ensureStarted(loadPilotState());
      syncAudioButtons();
    });
  }
  if (muteAudioBtn) {
    muteAudioBtn.addEventListener('click', () => {
      sound.setMuted(!sound.muted, loadPilotState());
      syncAudioButtons();
    });
  }
  if (quietModeBtn) {
    quietModeBtn.addEventListener('click', async () => {
      if (!sound.started) await sound.ensureStarted(loadPilotState());
      sound.setQuietMode(!sound.quietMode, loadPilotState());
      syncAudioButtons();
    });
  }

  // 5-Bus Gain Sliders
  document.querySelectorAll('[data-bus-slider]').forEach((slider) => {
    slider.addEventListener('input', () => {
      const busId = slider.dataset.busSlider;
      const val = Number(slider.value);
      const cur = loadPilotState();
      const nextBuses = { ...(cur.audioBuses || {}), [busId]: val };
      savePilotState({ audioBuses: nextBuses }, { syncHash: false });
      sound.syncToPilot(loadPilotState());
    });
  });

  // World Time & Performance Timeline Scrubbers
  const worldTimeSlider = document.getElementById('world-time-slider');
  if (worldTimeSlider) {
    worldTimeSlider.addEventListener('input', () => {
      const wt = Number(worldTimeSlider.value);
      const matchedTide = TIDE_PHASES.find((t) => wt >= t.hourRange[0] && wt < t.hourRange[1]) || TIDE_PHASES[2];
      savePilotState({ worldTime: wt, tidePhase: matchedTide.id });
    });
  }

  const perfScrubSlider = document.getElementById('perf-scrub-slider');
  if (perfScrubSlider) {
    perfScrubSlider.addEventListener('input', () => {
      scrubPilotTimeline(Number(perfScrubSlider.value));
    });
  }

  // Master sync function on any Pilot State update
  function syncAllUI(pilot) {
    if (stage) stage.applyPilot(pilot);
    sound.syncToPilot(pilot);
    syncAudioButtons();

    const clock = deriveClockMapping(pilot);
    const poemObj = POEMS.find((p) => p.id === pilot.poem) || POEMS[0];
    const lookObj = ALL_CITY_LOOKS.find((l) => l.id === pilot.shader) || ALL_CITY_LOOKS[0];

    const heroKicker = document.getElementById('hero-kicker');
    if (heroKicker) {
      heroKicker.textContent = `WYGWYL · THE DESIGN ROOM · POEM ${pilot.poem} (${poemObj.title.toUpperCase()}) · ${clock.formattedLocalTime}`;
    }

    // Update primary route hrefs with live pilot hash
    const routeWatch = document.getElementById('route-watch');
    const routeEnter = document.getElementById('route-enter');
    if (routeWatch) routeWatch.href = destinationWithHash('../weave/', pilot);
    if (routeEnter) routeEnter.href = destinationWithHash('../', pilot);

    // Update quick-jump links in Pilot Console
    document.querySelectorAll('[data-jump-base]').forEach((a) => {
      a.href = destinationWithHash(a.dataset.jumpBase, pilot);
    });

    if (heroShaderSelect && heroShaderSelect.value !== pilot.shader) heroShaderSelect.value = pilot.shader;
    if (masterShaderSelect && masterShaderSelect.value !== pilot.shader) masterShaderSelect.value = pilot.shader;
    if (worldTimeSlider && Math.abs(Number(worldTimeSlider.value) - pilot.worldTime) > 0.01) {
      worldTimeSlider.value = String(pilot.worldTime);
    }

    const timeReadout = document.getElementById('world-time-readout');
    if (timeReadout) {
      timeReadout.textContent = `${clock.formattedLocalTime} · ${clock.tideLabel}`;
    }

    const acousticReadout = document.getElementById('door-acoustic-readout');
    if (acousticReadout) {
      acousticReadout.textContent = pilot.doorOpen
        ? 'Severn Door OPEN · Street LPF 13,500 Hz · Stone Reverb Send 0.06'
        : 'Severn Door CLOSED · Street LPF 640 Hz (-11 dB) · Stone Reverb Send 0.34 (1.55s)';
    }

    const scrubReadout = document.getElementById('perf-scrub-readout');
    if (scrubReadout) {
      const evCount = pilot.completedEvents?.length || 0;
      scrubReadout.textContent = `${Number(pilot.perfClockSec || 0).toFixed(1)}s (${evCount} idempotent beats)`;
    }

    // Update 5-bus slider readouts
    document.querySelectorAll('[data-bus-slider]').forEach((slider) => {
      const busId = slider.dataset.busSlider;
      const val = pilot.audioBuses?.[busId] ?? 0.6;
      slider.value = String(val);
      const out = document.getElementById(`bus-val-${busId}`);
      if (out) out.textContent = `${Math.round(val * 100)}%`;
    });

    // Update Master Console toggles
    const masterDoorBtn = document.getElementById('master-door-btn');
    if (masterDoorBtn) {
      masterDoorBtn.textContent = pilot.doorOpen ? 'Severn Door: Open' : 'Severn Door: Closed';
      masterDoorBtn.setAttribute('aria-pressed', String(pilot.doorOpen));
    }

    const masterParcelBtn = document.getElementById('master-parcel-btn');
    if (masterParcelBtn) {
      const nextMap = { player: 'bekele', bekele: 'maren', maren: 'player' };
      masterParcelBtn.textContent = `Parcel Holder: ${pilot.parcelHolder} (click -> ${nextMap[pilot.parcelHolder] || 'bekele'})`;
      masterParcelBtn.onclick = () => {
        savePilotState({ parcelHolder: nextMap[loadPilotState().parcelHolder] || 'bekele' });
      };
    }

    const masterTideSelect = document.getElementById('master-tide-select');
    if (masterTideSelect && masterTideSelect.value !== pilot.tidePhase) {
      masterTideSelect.value = pilot.tidePhase;
    }

    // Provenance filter buttons
    document.querySelectorAll('[data-prov-filter]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.provFilter === (pilot.provenanceFilter || 'all')));
    });

    // Poem pills
    document.querySelectorAll('[data-poem]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.poem === pilot.poem));
    });
    const activePoemLabel = document.getElementById('active-poem-label');
    if (activePoemLabel) {
      activePoemLabel.textContent = `Poem ${pilot.poem} · ${poemObj.title} (${poemObj.district}) · ${lookObj.name}`;
    }

    // JSON state readout
    const jsonPre = document.getElementById('pilot-json-preview');
    if (jsonPre) {
      const compact = {
        version: pilot.version,
        world: pilot.world,
        district: pilot.district,
        building: pilot.building,
        room: pilot.room,
        poem: pilot.poem,
        account: pilot.account,
        shot: pilot.shot,
        seed: pilot.seed,
        worldTime: pilot.worldTime,
        tidePhase: pilot.tidePhase,
        shader: pilot.shader,
        doorOpen: pilot.doorOpen,
        parcelHolder: pilot.parcelHolder,
        waterLiters: pilot.waterLiters,
        coolingWet: pilot.coolingWet,
        provenanceFilter: pilot.provenanceFilter,
      };
      jsonPre.textContent = JSON.stringify(compact, null, 2);
    }

    renderDirectory(pilot);
    renderBriefs(pilot);
  }

  const masterDoorBtn = document.getElementById('master-door-btn');
  if (masterDoorBtn) {
    masterDoorBtn.addEventListener('click', () => {
      const cur = loadPilotState();
      savePilotState({ doorOpen: !cur.doorOpen });
    });
  }

  const masterTideSelect = document.getElementById('master-tide-select');
  if (masterTideSelect) {
    masterTideSelect.addEventListener('change', () => {
      savePilotState({ tidePhase: masterTideSelect.value });
    });
  }

  subscribePilotState((next) => syncAllUI(next));
  syncAllUI(loadPilotState());
}

function renderFreesoundLedgerTable(ledger) {
  const tbody = document.getElementById('freesound-ledger-tbody');
  if (!tbody || !ledger?.sourceSlots) return;
  tbody.innerHTML = ledger.sourceSlots
    .map(
      (s) => `
      <tr>
        <td><code>${escapeHtml(s.slotId)}</code></td>
        <td><strong>${escapeHtml(s.file)}</strong><br><small>#${escapeHtml(s.freesoundId)} · ${escapeHtml(s.creator)}</small></td>
        <td>${escapeHtml(s.bus)}</td>
        <td>${escapeHtml(s.license)}</td>
        <td>${s.measuredDurationSec.toFixed(2)}s · ${s.loopEnabled ? `loop ${s.loopStartSec}-${s.loopEndSec}s` : 'one-shot'}</td>
        <td>${escapeHtml(s.activationRule)}</td>
      </tr>`
    )
    .join('');
}

boot();
