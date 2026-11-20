# Highland Exposure · Motion Lab

One patch of real Entoto ground where the people, the donkey and the bajaj move by physics and motion data instead of hand-set poses. Open `index.html` (it needs to be served, for example by GitHub Pages).

Controls: W A S D or the thumb stick to move, Shift or a full stick to run, drag to look. E talks to someone near you, F gets in or out of the bajaj, G takes or drops Mistletoe's lead rope, Space brakes.

## What moves, and how

| Thing | How it moves |
|---|---|
| Ground | Highland Exposure's own terrain, sampled at 1 m over 783 × 799 m around the wellhead and the first 1.4 km of road. A 25 m version of the same terrain fills the horizon for 3 km. Physics and drawing use the same heights; ray casts against the physics ground land within 0.001 m of the drawn ground at the five check points. |
| People | The five Dawn Wellhead figures (104-bone MakeHuman rigs) driven by Mesh2Motion clips. The figures rest with arms down and the clips with arms out, so each figure bone is first turned to the clip skeleton's rest direction, then the clip's rotations are copied as world-space changes from that rest. Limb directions then match the clip exactly. |
| Feet | The body moves forward exactly as far as the planted foot pushes back in the clip, so feet stay planted. Two-bone leg IK then puts each foot on the real slope under it and lowers the hips on the downhill side. |
| Mistletoe | Mesh2Motion's horse rig, recoloured, made shorter in the leg and given larger ears. Same planted-foot advance on the front feet. Follows on a rope at walking pace and pitches with the slope. |
| Bajaj | A Rapier ray-cast vehicle: one steered front wheel, two driven rear wheels, sprung and damped suspension, tyre grip for a dirt road, 400 kg, 4 kW at the wheel, air drag and rolling resistance, engine braking off the throttle. It is set back on its wheels if it lies on its side for 2 s. |
| Talking | Walk up to someone and press E: they turn to you, greet you, talk with their jaw moving, and say their line from Highland Exposure. |

## Sound

All sound is real recordings from Freesound (CC0 and CC BY 4.0; credits in `licenses/SOUND-CREDITS.md`), placed in the world with spatial audio around the camera. It starts with your first tap or key.

| Sound | What sets it off |
|---|---|
| Footsteps | each heel landing, as detected from the walking motion; gravel on the road, dirt at its edge, grass off it, stone on the wellhead platform; a running set when running |
| Mistletoe | front hooves on each front-foot landing, the hind pair half a step later; braying every 35 to 90 s from her head; chewing when she grazes |
| The pump | an iron knock each time Makeda's stroke reaches the bottom, and water running into the bowl while she pumps |
| The bajaj | a starter and idle when you get in; the engine pitched by a three-speed gearbox model from the physics speed; on-board engine and tyre noise rising with speed; switched off if you leave it for 25 s |
| Radio | in the bajaj, through a small speaker: Azmari FM, Azmari Bet live, Tewahedo chant, and Merkato loudspeaker ads, all field recordings from Ethiopia. R changes station. Each station keeps playing while you are away, so you come back mid-song. |
| The place | wind that rises with height and speed and drops inside the wellhead, wind singing in the mast, the company's voices at the wellhead, a bird recorded in Ethiopia, sheep bells on the pasture, the Addis market far down the road, a dog by the house, gelada baboons from the Simien on the steepest slope |
| Space | a short courtyard reverb that grows as you walk in among the wellhead walls |

## Measured here (headless Chromium, software renderer)

| Test | Result |
|---|---|
| Walking on flat ground, 1.06 m/s | a planted foot drifts 3.7 cm during a stance in which the body travels 39 cm |
| Mistletoe on the lead, 0.98 m/s | a planted front foot drifts 1.4 cm per 43 cm stance |
| Walking up the road at 13.4 % | 0.92 m/s |
| Running on flat ground | 2.9 m/s |
| Bajaj 0 to 30 km/h, flat | 6.1 s |
| Bajaj stop from 30 km/h | 10.6 m in 2.7 s |
| Bajaj climbing 12 to 16 % on the real road | 14 to 21 km/h |
| Bajaj hard turn at 25 km/h | about 8° of body roll, no tip-over |
| Sound, 5 s walking | 10 footsteps fired by heel strikes |
| Sound, 5 s leading Mistletoe | 10 front-hoof landings |

`tests/measure_motion.cjs` and `tests/measure_bajaj.cjs` reproduce these with Playwright against a local server at the repository root.

Not measured: frame rate on a real phone or GPU (only a software renderer was available), and nobody has played it by hand yet.

## Not real yet

- The motion library has no clip for the things that matter most here: a 20 L can carried on the back with a strap, leading a donkey by the halter, working a lever pump, pouring coffee from a jebena. Makeda's pump stroke is a hammering clip blended at half strength; carrying uses a generic carry walk.
- Mistletoe is a resized horse, not a donkey rig. Its gait timing is a horse's.
- The bajaj body is modelled here from boxes and extruded profiles.
- The people say one line each. There is no conversation beyond that in this lab, and their lines are not voiced.
- Nobody has listened to the mix on headphones yet; levels were set by numbers, not by ear.
- Clothes are part of each figure's body mesh, so capes and shawls bend with the arms instead of hanging.

## Credits and licences

- Figures: Dawn Wellhead, CC0-1.0, with the MakeHuman and NAVER notices in `licenses/`.
- Motion clips and the horse rig: Mesh2Motion (github.com/scottpetrovic/mesh2motion-app), CC0-1.0.
- Physics: Rapier 0.14.0 (@dimforge/rapier3d-compat), Apache-2.0.
- Rendering: three.js 0.160.0, MIT.
- Terrain: Highland Exposure, from Copernicus GLO-30 per its release notes.
- Sound: Freesound recordings by bruno.auzet, Vortichez, felix.blume, kyles, kalhan, Malik Escopette, StephenSaldanha and others; see `licenses/SOUND-CREDITS.md`.
