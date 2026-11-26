# MESA CHIP

A cyber-western of glass, built from the film's keyframe breakdown (`keyframes.json`). Open `mesa/index.html`.

**Uncle Mesa** is a Black man in his sixties with a long white beard and round white-rimmed glasses with gold lenses. He wears a cream wide-brimmed hat, a white guayabera-style shirt with a yellow-and-blue MESA CHIP pocket badge, khaki trousers and boots, and can put on a dark-weave poncho. He walks north from the title gate through the clockwork iris, past the sign, through the duel arena and down the glass canyon over the sunken cathedral, to the ziggurat under the curtain wall.

**The source film.** The 3-minute cut the breakdown describes is not in the repositories. The El Desierto clip #1147, "MESA CHIP: The Cyber-Western M", is 10 seconds of a cyan grid over the mesas, a chip in the fingers and a rider's eye. So this level follows the written breakdown, not measured frames.

## Keyframe → zone → mechanic

| Keyframe | Time | Zone (`mesa-world.js`) | Effect | Mechanic |
|---|---|---|---|---|
| kf_01 grid intro | 00:04 | `title_gate`: two frosted glass-block towers and a lintel | the glass-block grid over the lens, the barrel-scope mask, dust | the spawn: MESA CHIP resolves through blur; the grid fades after 6 s; **G** toggles it, **Wide** the mask |
| kf_02 iris portal | 00:16 | `clockwork_iris`: a brass ring with twelve glass blades across Main Street | the aperture opens and closes | **sightline**: stand in the iris with the gun up and the blades open wide, the lens closes to 22°, and the mesas sit in the aperture. This is Cinema camera #1 |
| kf_03 glasses and sand | 00:39 | `dune_open` | floating spectacles, gold sand ribbons | **T** sandstorm: the fog closes, gold ribbons wheel round him, white rings drift past |
| kf_04 mural sign | 01:01 | `main_street_glass`, and the sign monolith | stained-glass windows lit from inside; UNCLE MESA / MESA CHIP in leaded glass with the lawman | **prism cover**: glass prisms in the canyon stop the outlaws' shots, and two hits shatter one into physics shards with a cyan or amber flash |
| kf_05 glass canyon | 01:28 | `cathedral_trench`: two walls of stained-glass slabs; the floor sinks 7 m into a mirror-glass cathedral with ribs and god-rays | god-rays; a planar reflection on the floor | walk the trench and down the steps into the cathedral. This is Cinema camera #3, the crane descent |
| kf_06 horse standoff | 01:31 | `silhouette_wall`: an 80 m wall of horizontal stained-glass stripes, the lone horse in front | backlit stripes, coloured light on the sand | **E** saddle up; ride with W A S D, gallop with Shift; the rider plays the `horse-walk` and `horse-trot` clips |
| kf_07 poncho ridge | 01:56 | `hoodoo_ridge`: a raised ridge of hoodoos to the west | dust | **P** the dark-weave poncho |
| kf_08 outlaw glare | 02:01 | `duel_arena`: a ring of adobe walls before the sign | | **Game mode**: three waves of three outlaws. Each draws on a timer, and a red ring fills over his head before he fires. Shoot first, or be behind a prism, or he puts you down |
| kf_09 Mesa Chip fire | 02:13 | `uncle_chip_booth`: a counter, a blue awning, UNCLE CHIP in glass; E to sit | magenta muzzle plume, curved light tracers | **R** draw, **Space** or click fire: crimson and magenta plumes, two curved neon ribbons from the barrel to the hit |
| kf_10 curtain monolith | 02:24 | `north_curtain_wall`: twenty-two glass monoliths 110–200 m tall | vertical colour | ride north to it. This is Cinema camera #5, the wide pullback |
| kf_11 oasis mirror | 02:40 | `oasis_pond`: a still pond in a bowl, sixteen saguaros, stained-glass light on the sand | a planar reflection; the painted sky | **Z** fall and get up |
| kf_12 ziggurat end | 03:03 | `ziggurat_steps`: six stone tiers, glass columns behind | the low sun | **E** sit and rest (`sitting-idle`). This is Cinema camera #6, the closing shot |
| salt flats | 01:10 | a white ring beyond 300 m, fourteen orange buttes | the painted sky in horizontal yellow-and-blue strata | |
| sunburst | 02:53 | the sun | an emerald-gold sunburst in the sky shader; coloured glass light on the ground | **1–6**: six synth pads (detuned saws with tremolo and a sine whistle), each with its time of day: dawn, morning, noon, afternoon, golden hour, dusk |

**The outlaws** are three gaunt, dark-bearded men in dark dusters and hats:
- Jeb, a white man;
- Ramón, a Latino man;
- Silas, a Black man.

**Cinema** cuts between the breakdown's six cameras every 7 s, letterboxed:
1. the iris;
2. the sign;
3. the crane into the cathedral;
4. the silhouette wall in profile;
5. the curtain wall pullback;
6. the ziggurat.

## Paint: the graffiti game (`ink.js`)

Uncle Mesa's six-shooter fires paintballs. Hold Space or the mouse button to spray, as a Splatoon shooter does.

- **The ball.** A real projectile on an arc, stretched along its speed, dropping beads as it goes.
- **Where it lands.** The liquid follows the rain kit's membrane (`night-post/rain/demos/water.js`): blob fields added together and cut at a threshold, so touching drops merge into one body with one hard, bright edge. Each splat is that field, evaluated in a shader on a decal laid against the surface it hit:
  - a main blob;
  - satellite droplets thrown forward;
  - a streak along the line of travel;
  - small extra splats sprayed past it.
- **On a wall the ink runs.** Drips crawl down the face over about 1.8 s and stop in a bead.
- **Then it cures.** For about 1.2 s the ink is wet: bold, glossy, with a darker rim where the bead rolls over. Then it crystallizes from the rim inward: lead lines grow through it, each cell takes its own glass colour leaning toward the paint, and the glass glows with a little sparkle while it sets. The cells are laid out on the surface's own plane, so neighbouring splats share one window.
- **Swimming.** Hold Shift on ink: Uncle Mesa crouches and moves through it at 6 m/s, refilling the tank.
- **The ink tank.** Each shot costs 1.5 of 100. It refills slowly on its own and fast while swimming. The vial by the reticle shows how full it is, in the colour of the next shot.
- **Turf.** Each square metre of upward ground that you ink counts once. The goal is 250 m².
- **Tag spots.** Four frames on the Main Street fronts. Ten hits inside one and it blooms into a lettered stained-glass mural: MESA CHIP, DATA REMEMBERS, UNCLE MESA, THIS LAND.
- **Other targets.** Outlaws go down painted, and their colour pools under them. Prisms still crack and shatter.
- **The buffer.** Every splat and drip is one instance in a single instanced mesh, 1,600 at a time; the oldest is reused.

## Built on

| Part | Used for |
|---|---|
| `CAST_2086` | Uncle Mesa and the outlaws (`ownColors` keeps their colours) |
| Mesh2Motion clips through `m2m-world-bridge.js` | walk, jog, sprint, `horse-*`, `sitting-idle`, `angry` |
| Rapier | the heightfield, every wall and slab, the prisms and their shards, a character controller, outlaw capsules for the hits |
| `makeDonkey` | the horse. As in the Mars level, the cast has no horse yet |
| the trough's glass look | the reticle: seven drops closing as the hand steadies |

The glass is painted at load on canvases: leaded cells around a jittered grid, lead lines where the nearest two cells meet, used as both colour and glow.

## Not yet

- **The source film.** Measuring it would let the look be tuned the way Mars was (`mars/v2g`). The 3-minute cut is needed.
- **The horse:** it is still the donkey.
- **Sound:** gunfire and glass are synthesized.
- **Phones:** there are no touch controls.
- **The overworld:** not poured into the trough yet.
