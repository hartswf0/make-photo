# The Western: Ethiopia on Mars as an engine

The level is meant to work three ways from one world:

- **a game to play**, with verbs, goals and consequences;
- **a world to explore**, with nothing asked of you;
- **an engine that drives cinema**, where a director cuts shots while you play and the take records to a video file.

The bar at the bottom switches between **World**, **Game** and **Cinema**.

## What you can do, and where it comes from

Every verb is taken from the El Desierto clips the level was compiled from (`sources.json`):

| Verb | Keys | In the world | Clip |
|---|---|---|---|
| Ride, get down, get on | W A S D, Shift, E | Make-photo's donkey; Tex rides its saddle point with the `ride` pose. At a gallop into a wall, he is thrown | #988 |
| Walk | W A S D, Shift | A Rapier character controller: walls stop you, steps and porches are climbed | |
| Go into the saloon | walk through the batwing doors | A real room: bar, bottles, tables, chairs, two lamps, a stage. Inside, the camera comes in and the sound changes | #754, #760 |
| Play the krar | E at the stage, 1–6 | Six plucked strings (Karplus-Strong) in the Tezeta scale on G; the `krar` pose; the camera watches from the bar | #754, #760 |
| Light a cigarette | X | A match strike, the `smoke` pose bringing it to the lips, the ember brightening on each draw, smoke from the lips | #757 |
| Draw and fire a revolver | R, Space or click | The `aim` pose and recoil. A ray goes into the physics world: bottles break, cans ring, barrels roll, people fall | #988, #757 |
| Fall | Z | A ragdoll: capsules on spherical joints drive the cast's own bones until the body is still, then he gets up | |
| Draw water, give water | E at the tank, E by Selam | The windmill tank; 20 L carried to the telegraph | |
| Take the lift, board the monorail | E | After the storm, a glass lift to the platform; the train docks every 42 s; a tracking shot over the canyon | #761 |
| Call the storm | T | The storm comes up the street, whites everything out, and the future stands behind the town when it clears | #291 |

## Systems (`western.js`)

**Physics: Rapier** (WASM, vendored at `highland-exposure/motion-lab/vendor/`, Apache-2.0).
- **Ground:** the level's ground as a 1 m heightfield over 400 × 450 m. It matches the level within 9 mm at off-grid probes.
- **Static colliders:** every front, porch, saloon wall, the bar, the tables, the stage, tukuls, stelae, domes, the tank, the range rail, and the station (the station only after the storm). They all come from `mars-world.js → colliders`, which the jerry can uses too.
- **Rigid bodies:** bottles, cans, barrels and saloon chairs.
- **Characters:**
  - Tex walks with a character controller.
  - The donkey is kept out of walls by a second controller.
  - Settlers carry kinematic capsules, so shots can find them.
- **Ragdolls** for Tex and for settlers: 11 segments and 10 spherical joints, written back into the bones every frame.
- **Measured, not guessed:**
  - Rapier's heightfield runs rows along z and columns along x, stored column-major.
  - A vertical ray exactly on a grid line can miss.

**Sound.**
- **Real recordings** from the motion lab's library (credits in `highland-exposure/motion-lab/licenses/SOUND-CREDITS.md`), placed in 3D with HRTF:
  - wind and gusts (the gusts follow the storm);
  - hooves on every footfall of the donkey's gait (`onStep`);
  - footsteps on dirt outside and stone inside;
  - the donkey;
  - azmari music in the saloon, muffled to bass through the walls and full inside;
  - chant from the rock church's pit.
- **Synthesized:** the gunshot (crack, body, thump), glass, tin, ricochet, the match, the exhale, the doors, the krar, the lift, the train's hum.
- **Two rooms:**
  - outdoors, a canyon response with echoes from the mesas at 0.28 to 1.6 s;
  - indoors, a short wooden room.

**The director (Cinema).** The cuts follow what happens:

| Event | Shot |
|---|---|
| A shot is fired | an insert on the hands |
| A hit | a wide, or an insert on the target |
| The krar | a close-up |
| A fall | a wide |
| The storm | a wide |

Between events the director cycles through a Leone wide (the figure small in the land), a tracking shot, Kurosawa's low angle, an over-the-shoulder and a close-up on the eyes. The frame is letterboxed to 2.39:1. **Record** writes the canvas and the world's sound to a WebM file.

## Tested (headless, software GL, stepped)

- Get down.
- Walk in through the saloon doors.
- Play nine notes, which completes the krar goal.
- Draw, and knock bottles and cans off the rail.
- Smoke and exhale.
- Fall and get up.
- Shoot a settler, who falls and later gets up.
- After the storm, take the lift, board at the platform and ride out.
- Cinema cuts low, then track, then hands on the shot, then wide.
- Record produced a WebM file.
- All twelve recordings decoded, and the wind, gust, saloon and chant loops ran.

## Not yet

- **In the trough:** the can carries the saloon (room, walls, lamps) and the station, but the trough's player cannot yet draw, smoke, play or board. Those verbs belong in the trough's vocabulary (`atlas/JERRYCAN.md`), and its physics is its own.
- **Standoffs and duels:** no AI draws on you yet. The Matriarch's standoff (#757) is the next scene: a timed draw, a winner and a fall.
- **Bodies:** the horse in the film is still the donkey, and people who are shot get up again.
- **Realism:** ragdoll joints have no angle limits yet, so a fall can bend a knee the wrong way.
- **Sound:** gunshots are synthesized, not recorded.
