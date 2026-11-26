# Sunday at Eastminster

A custodian cowboy's Sunday morning in Knoxville, Tennessee. Open `knox/index.html`.

**Otis** is the custodian of Eastminster Presbyterian: a Black man in his fifties with a salt-and-pepper beard, a tan felt cowboy hat, a navy chore coat over a chambray shirt, dark jeans and boots. Worship is at eleven, and before then he has six jobs:

| Job | How | Systems |
|---|---|---|
| Unlock the church doors | up the steps, E at the doors | the doors swing on their hinges; the `push` clip |
| Ring the bell | E at the doors again | six strokes, each a synthesized bell of eight inharmonic partials; the `rope-pull` clip; pigeons leave the steeple |
| Run the raccoons off the trash | R for the paintball marker, Space or click to fire | three raccoons forage and knock over the trash cans, which are Rapier bodies. A paint hit sends each one running for the ridge |
| Fight back the kudzu | the marker again | nine clumps creep up the churchyard toward the walls once the doors are open. Three hits each, and each hit leaves its colour on the leaves |
| Haul four hay bales to the picnic at Holston Hills | E at the tractor; W A S D drive | an old red tractor pulls the hay wagon. The wagon trails the hitch. Its bed is a kinematic Rapier body, and the bales ride it while they sit between the rails. Drive rough and they bounce out |
| Fly the helicopter around the Sunsphere | the elevator in the lobby of World Headquarters to the roof, E at the helicopter | Space climbs, Shift sinks, W and S pitch, A and D turn. A full lap of the Sunsphere counts; near the sphere the camera frames it with the helicopter |

## The people

| Who | Is | Doing |
|---|---|---|
| Reverend Ruth, the pastor | a Black woman in her sixties, silver hair swept back, a plum shawl over a cream blouse | on the church steps, talking; she tells you what's next |
| Mr. Hollis, the greenskeeper at Holston Hills | a Black man in his seventies, short grey hair and beard, a green work parka | watering by the first green |
| Captain Dee, the pilot | a Black woman in her thirties, short locs, a brown flight jacket over a white shirt | on the roof by the helicopter, arms folded |

Everyone is from the one cast (`CAST_2086`), driven by Mesh2Motion's motion-capture clips through `m2m-world-bridge.js`, the same driver the overworld uses for Imani:
- `walk`, `jog` and `sprint` as you move;
- `rope-pull`, `push`, `idle-talking`, `farm-watering` and `idle-foldarms`.

## The map

The map is compressed about ten to one, with the landmarks near their true size. Their order is the real one, from west to east:
- **World's Fair Park and the Sunsphere:** a hexagonal steel truss carrying a 23 m gold glass sphere, 81 m to the top.
- **Downtown and World Headquarters:** a 92 m glass tower with the helipad on its roof.
- **Neyland Stadium:** a bowl of orange-and-white tiers around the field, by the river.
- **The Tennessee River:** with the Henley Street arches and the Gay Street truss.
- **East Knoxville:** frame houses with porches on a street grid along Magnolia Avenue.
- **Eastminster Presbyterian:** red brick, a white portico and steeple with the bell, the lawn, the lot and the custodian's shed.
- **Holston Hills:** six greens with flags and bunkers, and the stone-and-timber clubhouse with the picnic.
- **The Holston River:** along the course.
- **The Forks of the River:** where the Holston and the French Broad make the Tennessee.

It is late November, so most trees are bare and the oaks are rust and gold.

**Not checked against a map.** OpenStreetMap was not reachable from the build machine, so every position is approximate and laid out by hand. In particular, Eastminster's real address is not used. It sits in East Knoxville near Holston Hills because the story puts it there. "World Headquarters" is a generic tower with no company's name or marks.

## Files

| File | What it is |
|---|---|
| `knox-world.js` | the world, with no renderer, camera, player or loop: ground, rivers, roads, trees, buildings, colliders, places |
| `knox.js` | the game: physics, the cast and motion, the marker, kudzu and raccoons, the tractor and wagon, the helicopter, the jobs, sound and camera |
| `can.json`, `legos.json` | the level's label in the jerry-can vocabulary |

`window.__knox` exposes the state for tests, and `window.__knoxCam = { pos, at }` holds a free camera for stills.

## Not yet

- **In the overworld:** the trough has no Knoxville island. When it does, `knox-world.js` pours as Mars's world does. The tractor, wagon, helicopter and marker belong in the trough's vocabulary.
- **Inside the church:** there is no interior yet, only the doors opening on a dark sanctuary. The sanctuary, the pews and the organ are the next room.
- **Sound:** the paint, bell and rotor are synthesized. The tractor uses the library's small-engine loop (a Bajaj idle).
- **Phones:** there are no touch controls yet.
