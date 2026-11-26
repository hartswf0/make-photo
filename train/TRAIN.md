# The Sealed Line

Bees on a Train as a make-photo level: a train you walk through, film inside, and ride between islands. It first ran in synarchiv (`train-brain20.html`); this is its home.

- `index.html`: the playable train.
- `seeds.html`: starting frames for world-model takes, with their prompts.
- `can.json`, `legos.json`, `look.json`, `sources.json`, `line.json`: the level's label, in the jerry-can vocabulary.

## How it belongs to make-photo

| | |
|---|---|
| Cast | The one cast (`CAST_2086`) on the shared motion driver, loaded the way the overworld loads Imani. The traveler is Tex Lexington in a duster; Imani rides in the quiet car; Yared plays in the dining car; Makeda keeps the apiary car. |
| Water | Donkey Water's 20-litre cans (`makeWaterWifiCan`) sit by the seats and feed the greenhouse. A jerikan the size of a silo lies aground in the lake. |
| three.js | The r160 module vendored in `highland-exposure/motion-lab/vendor/`, as the cast requires. |
| Travel | `DW.go` carries litres, the donkey's thirst and your mode through the same rain wipe as every other door. |
| Overworld | Each halt in `line.json` is a place in `atlas/overworld.html` with a door that boards the train. One lap of the route is one leg; at the halt the brass button reads "Get off", and you step down at that island. |
| Sources | The nine El Desierto train clips, as `video@1` records in `sources.json`. |

### What is not done: the train as a trough vehicle

The jerry-can rule is that a can never brings a renderer, a camera, a loop or a player, and the trough owns vehicles. The train is a vehicle, so the right end state is a rail service in the trough, shaped like the ferry: a lane between islands, stations as piers, `board()`, and this train's carriages as the body you ride in. `can.json` records that under `status`. What exists now is the door at each halt, in both directions.

Two things to know before building the rail service: the trough has no rail data (the city's rails are dropped by `build_archipelago.py` because they are bare point lists), and the halts are added to the overworld at load time from `line.json`, so rebuilding the archipelago does not remove them.

## The train

Locomotive, quiet car, dining car, greenhouse, apiary car, mirror corridor, surveillance car, cinema car, and the hive. The way out of the cinema is through its screen. The route is a 9 km loop: the angel on her column, the viaduct, the other train pacing on the second road, the Aksum stelae, a tunnel, a salt lake at dusk with honeycomb monoliths over it and the jerikan in the shallows, the halt, the impossible hive, a second tunnel.

The train is the fixed frame and the land is resampled under it. That is what lets a camera be attached to the traveler, a carriage, a bee, the train or the land with the same few lines.

## Cameras (`js/rig.js`)

Eighteen mounts and eight moves. A mount is a place for the lens; a move travels on its own clock.

| Move | What it does |
|---|---|
| Lead | walks backwards ahead of him |
| Threshold | waits in the next doorway and lets him come |
| Push in | nine seconds from the far end of the aisle to his face |
| Heels | floor level, behind his boots |
| Overhead | straight down, inside the carriage |
| Orbit | a slow turn around him |
| Dollhouse | outside, level with the windows, tracking him through the glass |
| Crane | from his shoulder up through the roof to the whole train, and back |

The take (▶) cuts between them and walks him down the train. `trainFilm.rig()` returns every position as a posed pinhole camera.

## SPAM on a Train: all people are SPAM

The current run. One seed and eight door cues, written by the project's author, in `SPAM-HANDOFF.md` and `data/spam_session.json`. The seed picture is `seeds/spam_0_seed.jpg`: a living SPAM Classic can alone in an empty carriage, composed in the 3D train and dressed on its depth.

`index.html?run` rehearses it: the traveler and every passenger become walking cans (`js/cans.js`: a tin with a flavor label, a gold pull-tab lid that lifts to show the loaf, two eyes, metal arms and legs), the first carriage is empty, and each door shows its cue. The train's rooms are still in their built order, so the cue for a door does not always match the room behind it: the cues say dining, wax and gold, mailworks, cinema, apiary, slop sea, hive; the train has dining, greenhouse, apiary, mirror, surveillance, cinema, hive. The ninth room's cue falls at the far end of the hive. `?run=worlds` is the earlier run below.

## The run: one empty carriage, then seven doors

The main use of the seeds. One world-model session, third person, W held down.

- **One request.** The session starts from one picture and one prompt: an empty carriage (`data/session.json`, `request`). Everything after is sent into the running session, one cue per door. The other dressed frames show each carriage's room and framing; they are references, never inputs.
- **The seam.** The doors are real and shut. A carriage is not visible until he opens its door, and its cue is sent at that moment: door, dark gangway, door shutting behind him.
- **What the doors bring.** Each cue pours whole chapters of island-ecology's `BEES ON A TRAIN/worlds.json` into the next carriage as things that are physically there. 158 of the 228 worlds are in the seven cues, listed per carriage in `data/seeds.json` (`worlds`) and on `seeds.html`.

  | Door | Carriage | Chapters | Worlds |
  |---|---|---|---|
  | 1 | Dining car: sealed velocity | 03 Bullet Train, 04 Snowpiercer | 33 |
  | 2 | Greenhouse: half for me, half for them | 05 Honeyland | 17 |
  | 3 | Apiary: the beekeepers | 01 Beekeeper | 17 |
  | 4 | Mirror corridor: the angels | 06 and 07 Wings | 17 |
  | 5 | Surveillance: the breach | 00 Breach, 02 Surveillance | 27 |
  | 6 | Cinema: the arrival of a train | 08 Heist 1855, 09 Steam, 10 Lumière | 39 |
  | 7 | The hive | 11 Bee Movie, and every earlier carriage in miniature | 8 |

- **The lock and the beats.** Every cue has the same six fields (at the door, the carriage, bees, people, what happens to him, outside) and ends with the same lock paragraph. The bees go from none, to one, to all of them. What happens to him always leaves something visible on his body.
- **Names.** Cues describe by role and object. Real people and film titles in the worlds file are not named in the prompts.
- **Rehearsal.** `index.html?run` plays the session in the 3D train: the first carriage is emptied, and as each door opens the cue for the next carriage appears and is copied.
- **Rebuilding.** `tools/build_run.py <worlds_synthesized.json>` holds the cue text and regenerates `seeds.json` and `session.json`.

The 3D train's own contents are simpler than the cues: the bees aboard grow by carriage, passengers behave worse toward the rear, and F, G and V make him flinch, swat and stagger (`trainFilm.deed`).

## The heist (what Game mode is now)

The page opens in Game. It is a run of rooms to rob, after Void Bastards: read the map, pick a room, take what is in it, get out.

- **Map** across the top: every carriage, where you are, how much SPAM is left in each. Tap a carriage and he walks there.
- **Camera** is fixed behind him down the aisle and never needs aiming. ⟲ (or Z) turns him to face the other way.
- **Stick** pushes him along the train at a jog; doors open as he reaches them.
- **SPAM** lies in every aisle (walk over it), and is hidden in every prop and on every passenger: the yellow button reads ROB when one is in reach.
- **THROW** (Space) lobs a can. A can on the floor draws the bees for eight seconds; a can to a passenger staggers them; on the roof it flies at the great swarm and knocks 14% off it.
- **Stings** are the eight dots. At eight he comes round in the quiet car with half his SPAM gone.
- **Win**: 20 SPAM carried to the ENGINE.

`js/heist.js`. World mode (`?world`) keeps the inspect panel, stubs, cameras and the rest described below.

## SPAM Wars · Can Racers (`racers.html`)

A co-op pod race on the salt flat beside the Sealed Line. The craft is two SPAM-can engines joined by an energy binder, towing a pod on two cables. It opens in **Solo**: the craft drives itself and you steer with one thumb; let go and it eases back onto the line of the track. In **Co-op** each player holds one engine's throttle: the average is the speed and the difference is the turn. Steering is a bounded turn rate in both modes, so the craft arcs and cannot spin on the spot.

- Phone: a lever on each side of the screen, one thumb each, or two people on one phone. Keys: W/S and ↑/↓, E throw, Enter boost. Gamepad: the two sticks are the two engines (or two pads, one stick each).
- Physics is Rapier: rigid bodies for the engines, pod, rivals, thrown cans, walls, rotating sweepers and bumpers; the hover, the binder and the cables are spring forces in `js/racers.js`.
- **Glass on the flat** (`js/glass.js`), all made in code:
  - A stained-glass triptych inside the first bend, painted on canvases: *what the hive kept*, *what the train carried*, *what the can will hold*. It throws its colours on the salt.
  - A procession of glass figures walks out from under it behind a torch. They are a motion-capture skeleton that is never drawn, with shards pinned to its bones, so the whole crowd is one draw call.
  - A glass knight, called out of a smaller window across the road, patrols it with a red sword. A thrown can knocks panes off him; three break him and pay a long boost and three cans. He re-forms.
  - A herd of zebu flocks on the infield and shies from the racers. Anta rides a horned motorcycle with a kanaga cross on the rear and a red tail light that hangs in the air.
  - Luminous spores live at the oasis, come to you when you pass, and scatter from a thrown can.
- Five rivals, four cans to pick with different mass, grip and boost, boost pads, crates of ammunition, three laps.
- Sound is synthesised: one engine in each ear, and a 138 bpm march that adds parts on laps two and three.

### Passengers who talk (`js/talk.js`)

Walk up to anyone and press TALK (Y). Type, or tap a question. Each passenger has a persona and a memory stream: what you said, what they said, that you robbed them, that a bee stung them. Speech shows over their heads.

- **With a key** (☰ → Voices) they answer through a language model, in character, from that memory. The key stays in the browser and goes only to the endpoint you name (OpenAI chat or responses, or Anthropic). A key already saved on this site by el-desierto's Train Field or island-ecology's hive pages is picked up automatically.
- **Without a key** they answer the question asked from their own lines: who they are, what is behind the next door, how many bees, whether you can have their SPAM.
- This continues two earlier pieces. Train Field's four passengers ride here by name (Noor the dispatcher, Mila the student, Oren the old man, Cass the tourist) with their lists of what each one sees; the persona-plus-memory-stream shape is the hive simulation's.

### The bee (`js/beemodel.js`)

A small cartoon character, about fifteen centimetres long, readable at a glance: a big head with two large eyes, brows, a mouth and cheeks; two short arms; antennae that work like ears; a fat striped body that squashes and stretches; two round wings.

It has sixteen expressions: idle, happy, laugh, angry, charge, smug, scared, sad, curious, dizzy, sleepy, wave, point, shrug, yes, no. Each sets brows, lids, pupils, mouth, cheeks, antennae, arms and posture, and most add a motion (a bounce, a tremble, a wave, a nod, a head-shake, spinning eyes). It blinks, looks into its turns, leans with speed and rolls with the stick.

The game plays them: happy when a bee joins, angry when it locks on to someone, a wind-up and then smug when it stings (it laughs at the traveler), pointing when it sends the swarm, a shrug when there are too few, no when nobody is ahead, dizzy off the glass, and when left alone it gets curious, sleepy or waves. The ☺ button (X) plays the next one on demand. `trainFilm.emote(name)`.

The swarm is the same character cast simply: body, stripes, head, two eyes, antennae, wings.

### Being the bee (`js/beeworld.js`)

B, or the Bee button. Three things the traveler never has.

- **A bee's eye.** Full resolution and sharp where you look; hexagonal facets only at the edge of sight. A bee's colours are laid over ours so the room still reads. Ultraviolet shows as a violet-white that pulses.
- **Framed like a film.** The camera rides behind and above the bee, so the bee, its swarm and the length of the carriage are in one frame. Let go of the stick and it turns back to face down the train. Bars top and bottom hold the few controls, dim until touched.
- **A world written in ultraviolet**, drawn only for the bee's camera: bullseyes on every prop that still hides something sweet, nectar guides on the greenhouse flowers, a mark on every neck, a scent trail down the aisle to the queen, and one line the bees wrote on the wall of each carriage.
- **A body that is a swarm.** You start as one bee. Fly close to others and they join and stay with you from carriage to carriage; the count is top right. They bunch behind you when you slow and string out when you go. SEND (F) lets them go ahead to the nearest person in front, and they sting when enough arrive.

Flight is one stick: push to fly, lean to turn. Height looks after itself, and a face ahead draws you toward it. You hear your own wings, rising as you push and turn, with the swarm under them. People move at six-tenths speed while you are a bee.

**Being stung.** A flinch, a swat, a few steps back down the aisle at a walk, a hand to the neck, then back to their place. They keep to the aisle, stop short of the end wall and of each other, and someone seated only starts up out of the seat.

### The cast

Each passenger has their own skin tone, hair and coat, set per role in `js/cast.js`.

### Bees and sound in the heist

The bees inside are striped bodies that steer and face where they fly. Each keeps a place in its carriage; a share of them, growing toward the rear, are angry and go for his head, and a sting is a bee actually reaching him. A thrown can pulls every bee in the carriage onto it for eight seconds.

Sound starts on the first touch: rails and joints, a five-voice wing chord that swells with the bees near the lens and tightens when they are angry, footsteps, doors, pick-ups, robbing, throws, the can landing, stings, and a slow pentatonic line under the game.

## The game on the train

The bar at the bottom left switches **World** (walk and film, nothing asks anything of you), **Game** (goals, and the swarm is hostile) and **Cinema** (the unattended take). `?game` starts in Game.

| System | What it does | Where |
|---|---|---|
| Inspect | Walk up to anything and press E: a panel of facts and numbered verbs. Passengers, doors, thresholds, cans, the smoker, the ladders, the controls, the queen's cell. | `js/interact.js` |
| Props and stubs | The things the door cues describe are built in the carriages: 56 props across seven cars (the lockers and briefcase, the aquarium, the cliff with its comb, the rifles behind the honey jars, the graffiti wall, the treaty table, the safes and the sorting wall, the script unrolling in the hive). Each is built from several parts with drawn surfaces (locker numbers, chalk on the blackboard, a radar sweep, hazard tape, a treaty page, the ruling) and has a brass plaque naming it beside the aisle. Each keeps the stubs of the worlds it stands for, 158 in all. Inspect to read them; take them to keep them. | `js/props.js`, `data/corpus.json` |
| Passengers | Talk: each says a line for their carriage and does something to him. The child gives half a comb, the beekeeper the veil, the conductor the cab key for five stubs. | `TALK` in `js/main.js` |
| The bee | B: you are the lead bee. Fly where you look, through shut doors, Space up, Shift down. Two bee cameras. | `toggleBee` |
| The great swarm | One body of 1,100 with four states: it shadows him outside the glass, circles when he is on the roof, dives, and reels when smoked. A dive that lands stings twice unless he wears the veil. Tunnels strip some off; the horn scatters it. At zero it settles and the whole train goes quiet. Twelve stings from it and he comes round in the apiary car. | `js/game.js` |
| The roof | A ladder in every gangway. He walks the roofs the length of the train and ducks by himself in tunnels. | `js/game.js` |
| The smoker | In the apiary car. R puffs; smoke only counts when the swarm is within reach. | `js/game.js` |
| The cab | With the key, the controls give three verbs: faster or slower, stop the train anywhere (then you can get off there), and the horn. | `js/game.js` |
| Goals | Eight, shown in Game: stubs in seven carriages, the veil, the smoker, the roof, the swarm, the key, the train, the queen's cell. | `goals` in `js/game.js` |

### Passes

M cycles the frame through beauty, clay, normals, depth, object classes and wireframe (`?pass=normals`). `trainFilm.capture()` returns the picture, linear depth and the camera as before, and now also normals, classes, wireframe and clay of the same frame, for conditioning a generator or reading a take against the scene.

### Light

On desktop the sun casts: through the windows onto the seats and floor, and the train and the swarm onto the land and the roofs. Metals reflect a small sky. Phones skip the shadow pass.

### Interface

One camera button (the current shot; tap for the full list), one menu (run, take, record, still, sound, bee, passes, hide), the mode bar, the stick and one action button. In Game the goals fold to the next one; tap to see all eight. Keys still work on desktop: E, 1–3, B, R, M, Q, C, T, H, F, G, V.

## Seeds for world-model takes

The aim is a starting frame that already holds what the take needs: him in third person, the aisle, a door ahead, something wrong in the carriage and something wrong outside the windows.

1. **Compose** in the train. `data/seeds.json` holds each seed's carriage, his position and direction, the kilometre (so the right apparition is outside), and the shot. `index.html?seed=<id>` stands you there.
2. **Capture** with `node tools/seed_capture.js <dir>`: the picture, linear depth in metres from the same lens (skinned figures included), and the camera pose.
3. **Dress** with `tools/dress_seed.py`: World Labs Atlas `atlasChisel` paints a photographic frame onto that depth, steered by a style reference from the level's own keyframes and the seed's `frame` description. The geometry stays where the game put it.
4. **Hand over** the dressed frame with the seed's `genie` prompt, then issue its `events` one at a time. `seeds.html` has copy buttons.

Twenty seeds ship: the eight frames of the run (one seed and seven references), and twelve single frames: the carriages on foot, the traveler at the glass, the doorway between carriages, the dollhouse track, leaning out, and the witness over the viaduct. No Genie take has been run from them yet.

## Thresholds and worlds

Each carriage has a pane onto worlds made from frames of the clips and from generated keyframes (36 in `data/worlds.json`): an image, a depth map and a field of view. Stepping through builds the relief; "Play inside" runs the clip across it within one shot. Adding a Genie take as a world is two files and one entry.

## Scripting

`window.trainFilm`: `camera`, `take`, `act`, `mode`, `game`, `goals`, `bee`, `smoke`, `pass`, `deed`, `stand`, `sit`, `walkTo`, `seed`, `capture`, `seeds`, `enter`, `exit`, `next`, `live`, `swarm`, `jump`, `still`, `record`, `observe`, `log`, `rig`.

## Tools

`ATLAS_API_KEY` in the environment; `curl`, `ffmpeg`, Node with Playwright, Python with Pillow, NumPy and OpenEXR.

- `seed_capture.js`, `dress_seed.py`: the seed pipeline above.
- `atlas_gen.py`, `keyframes.json`, `textures.json`: the generated keyframes, panoramas and flats.
- `footage_depth.py`, `footage.json`, `pack_world.py`: a frame of a clip to a depth world.
