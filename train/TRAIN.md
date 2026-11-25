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

Locomotive, quiet car, dining car, greenhouse, apiary car, mirror corridor, surveillance car, cinema car. The route is a 9 km loop: the angel on her column, the viaduct, the other train pacing on the second road, the Aksum stelae, a tunnel, a salt lake at dusk with honeycomb monoliths over it and the jerikan in the shallows, the halt, the impossible hive, a second tunnel.

The train is the fixed frame and the land is resampled under it. That is what lets a camera be attached to the traveler, a carriage, a bee, the train or the land with the same few lines.

## Cameras (`js/rig.js`)

Sixteen mounts and eight moves. A mount is a place for the lens; a move travels on its own clock.

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

## Seeds for world-model takes

The aim is a starting frame that already holds what the take needs: him in third person, the aisle, a door ahead, something wrong in the carriage and something wrong outside the windows.

1. **Compose** in the train. `data/seeds.json` holds each seed's carriage, his position and direction, the kilometre (so the right apparition is outside), and the shot. `index.html?seed=<id>` stands you there.
2. **Capture** with `node tools/seed_capture.js <dir>`: the picture, linear depth in metres from the same lens (skinned figures included), and the camera pose.
3. **Dress** with `tools/dress_seed.py`: World Labs Atlas `atlasChisel` paints a photographic frame onto that depth, steered by a style reference from the level's own keyframes and the seed's `frame` description. The geometry stays where the game put it.
4. **Hand over** the dressed frame with the seed's `genie` prompt, then issue its `events` one at a time. `seeds.html` has copy buttons.

Twelve seeds ship: the eight carriages on foot, the traveler at the glass, the doorway between carriages, the dollhouse track, leaning out, and the witness over the viaduct. No Genie take has been run from them yet.

## Thresholds and worlds

Each carriage has a pane onto worlds made from frames of the clips and from generated keyframes (36 in `data/worlds.json`): an image, a depth map and a field of view. Stepping through builds the relief; "Play inside" runs the clip across it within one shot. Adding a Genie take as a world is two files and one entry.

## Scripting

`window.trainFilm`: `camera`, `take`, `act`, `stand`, `sit`, `walkTo`, `seed`, `capture`, `seeds`, `enter`, `exit`, `next`, `live`, `swarm`, `jump`, `still`, `record`, `observe`, `log`, `rig`.

## Tools

`ATLAS_API_KEY` in the environment; `curl`, `ffmpeg`, Node with Playwright, Python with Pillow, NumPy and OpenEXR.

- `seed_capture.js`, `dress_seed.py`: the seed pipeline above.
- `atlas_gen.py`, `keyframes.json`, `textures.json`: the generated keyframes, panoramas and flats.
- `footage_depth.py`, `footage.json`, `pack_world.py`: a frame of a clip to a depth world.
