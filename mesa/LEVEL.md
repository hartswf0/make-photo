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
6. the ziggurat;
7. the triptych.

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
- **Painted bodies.** Uncle Mesa and the outlaws take paint where they are hit.
  - **Pinned to bones.** A hit is pinned to the nearest of sixteen bones, so it walks, falls and rides with the body.
  - **On the body.** A patch on the body's own materials, run after the cast's own shader hooks: the cloth or skin takes the paint with a ragged edge and runs downward while wet. For about 1.2 s it is glossy, then it crystallizes into small leaded cells and glows, as the world's paint does.
  - **Limit.** Up to 24 marks a body; the oldest goes first.
  - **The outlaws' paint.** They fire paintballs too, three at a time with a little lift for the drop, in Touki Bouki's colours: the red, yellow and green of Senegal's flag and the blue of the Dakar sky. One that reaches Uncle Mesa paints him and puts him down.
  - **Swimming.** Swimming in his own ink leaves it on his boots and shins.
- **Other targets.** Outlaws go down painted, and their colour pools under them. Prisms still crack and shatter.
- **The buffer.** Every splat and drip is one instance in a single instanced mesh, 1,600 at a time; the oldest is reused.

## The horned motorcycle (`touki.js`)

After Touki Bouki (Djibril Diop Mambéty, 1973). A 1970s road bike is parked by the title gate:
- spoked wheels and chrome fenders, a black tank, a long seat and a sissy bar;
- a finned twin engine and an exhaust;
- high chrome bars, with round mirrors on tall stalks;
- a round headlight over the plate "10";
- a zebu skull strapped over the bars, its horns sweeping out wide and nearly flat and curling up at the tips, as on the poster;
- the Dogon kanaga standing on the sissy bar: the cross the film puts on the rear of Mory's bike, which the poster does not show.

**Anta** waits beside it: a Black woman with short natural hair, an olive-green shirt, mustard trousers and a tan leather satchel. When Uncle Mesa rides, she rides pillion. She is from the one cast and takes paint like everyone else.

**Riding** (E, then W A S D, Shift to open it up):
- **Speed:** up to 19 m/s, or about 27 m/s with Shift, which also lifts the front into a wheelie.
- **The bike's body:** it leans into turns, pitches with the ground under each wheel, and the fork turns with the steer.
- **Engine:** the library's small two-stroke idle, pitched up with speed, with smoke from the exhaust.
- **Collisions:** a Rapier character controller keeps it out of walls. Hit one above 13 m/s and the horns hit first and everyone goes over.
- **Paint:** Uncle Mesa can still be painted while riding, because his body rides with the bike.

**Not yet:** there is no motorbike clip in the motion library, so the riders use `sitting-idle`, with their legs forward along the tank.

## The triptych (`triptych.js`)

Three windows of leaded glass stand behind the ziggurat on a wall as tall as it, the wings turned in like an open altarpiece. They are painted in code on canvases at load, after the way Afewerk Tekle built *The Total Liberation of Africa* (Africa Hall, Addis Ababa, 1961): jewel colour, frontal long-faced figures cut from big planes, and a heavy black line drawn with a broad nib. The drawing is this level's own, and its three verses are the level's opening line.

| Window | Verse | What is in it |
|---|---|---|
| THEN | it was dust | a herder with a staff and his zebu, face on, under a red sky; vultures; a pole whose wire carries nothing |
| THEN AND NOW | it is data | Uncle Mesa lifts a torch with a chip of blue glass in its flame; Anta's open hand beside him; four of the town behind |
| NOW AND THE FUTURE | and it remembers | a child holds the chip up to a rising sun; a woman's hand on his shoulder; the curtain wall; the horned bike small on a road of light |

**How a window is made.** Flat pieces of colour are drawn first. The sheet is then cut into jittered cells on rings around the torch flame, so every shard in all three windows points at the one light. Each cell takes its own tone. Lead follows the edges of the drawing, then faces, hands and lettering go on top, then the iron bars.

**The glass tracks three things:**
- **The sun.** The windows' colour is thrown through them onto the sand, the ziggurat steps, Uncle Mesa, Anta and the outlaws. It swings and stretches with the time of day (1–6): short at noon, a hundred metres down the canyon at golden hour. The lead falls as dark lines, and the verses can be read on the ground. A sandstorm puts it out.
- **Uncle Mesa.** Every painted eye follows him (twenty of them, the zebu's included). When he is far off or behind the glass they turn up to the flame. A glow walks behind the glass beside him.
- **The torch.** Light leaves the flame in slow rings and crosses all three windows.

Stand in each window's light and it gives its verse.

## The swarms (`swarm.js`)

A figure in a swarm is not a character. One hidden cast character plays the motion-capture clips, and its bones are recorded every frame. A figure is a few hundred flat panes, each with a lead rim, each pinned to one bone, all drawn as instances of a single triangle. Each figure reads the recording a little further back, so no two are in step.

| Swarm | Where | What it does | Cost |
|---|---|---|---|
| The procession | round the ziggurat | Ten robed figures led by a torchbearer pour out of the centre window as loose shards, take their bodies on the sand to the east, walk round the front through the windows' light, and go back into the glass on the west side. Walk behind the torch for five seconds | 1 hidden rig, 1 draw, about 1,900 panes |
| The stained-glass knight | the north window of the sunken cathedral | Come near on the cathedral floor and his panes leave the lead, form him on the mirror, and he comes for Uncle Mesa with a sword of red glass. In reach he swings (`hammering`) and puts him down. Each paintball knocks panes off him, stained with the paint; nine hits and he is in pieces. Later the pieces fly home | 1 hidden rig, 1 draw, about 300 panes |
| The zebu | the salt ring, 370 m out | Twelve long-horned cattle of glass, two calves among them. They walk the ring, graze when still, keep apart, and gallop from the bike. Ride beside them | 1 draw, about 950 panes |
| The spores | over the oasis | Ninety-six lit bodies, each trailing three beads. They come down and ring Uncle Mesa. Paint landing near them scatters them and stains them | 1 draw |
| The tail light | behind the bike | Above about 30 km/h a red streak follows the last seventeen metres of road, after Kaneda's | 1 draw |

**The knight is this level's own design:** steel-blue panes with gold trim, a red plume, a sun over a mesa on the breastplate. The idea of a knight stepping out of a window is from *Young Sherlock Holmes* (1985).

## The sky and the salt flats

Three references, used together:
- **The sky** follows Superstudio's airbrushed collages:
  - a soft gradient from a pale horizon to blue;
  - long horizontal strokes of cloud laid on as if with an airbrush, lit on top and blue in their shadows;
  - pale mountains drawn along the horizon.

  The six moods (1–6) still tint it, and the emerald-gold sunburst stays.
- **The salt flats** become the Supersurface (Superstudio, 1972): beyond 300 m from the town the ground turns into a glossy pale cyan plane.
  - **The grid:** fine lines every 4 m and major lines every 20 m, both fading with distance.
  - **The finish:** airbrushed blotches of blue-green and pale yellow, and a sheen that catches the horizon at grazing angles.
- **The Continuous Monument** (Superstudio, 1969): a colossal 64 m wall of green glass grid stands on the salt to the east, sixteen panels on an arc at 485 m.
- **The edge of the world** is al-Idrisi's sea from the Tabula Rogeriana (1154): deep blue, with white zigzag waves following the curve of the rim.
- **The buttes** are al-Idrisi's mountains: ten islands of rock at the rim, in bands of red, yellow, orange and purple, edged in dark ink and scalloped with scales.

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
- **The zebu's bones:** no cast skeleton fits a cow, so their gait is worked out in `swarm.js`, not motion capture.
- **The knight:** he keeps to the cathedral floor and has no way round obstacles.
- **The procession:** it cannot be touched or painted.
- **Tested** in a headless browser with software rendering only: not yet on a phone or a real graphics card.
