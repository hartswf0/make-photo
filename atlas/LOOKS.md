# Looks: keeping every world's colour in the trough

Pouring levels into one runtime must not flatten them into one generic look. This document records:

1. what each world's look **is**: every value read from its own shaders, with sources;
2. how the trough **carries** it (`look@1`);
3. the **house standard** every world follows;
4. the **evidence**: measured frames, level against trough;
5. what is **not yet carried**.

## 1. Each world's look, as its code defines it

| World | Renderer and tone | Sky and light | Ground and water | Its own treatment | Signature |
|---|---|---|---|---|---|
| **Donkey Water / zones** (`night-post/night-post.js`) | No tone mapping; `film()` (gamma .44, toe) and `paper()` grain (:49-54) | Grey photo sky plate (:64); hemi `#f6f4ee`/`#3b3c39` 1.35, key 2.35; 18-watch light curve (:6370) | Grayscale river radiance (:240-365) | 14 looks over a silver base (:1662-1677); filters Clear/#8/#15/#25/#58/#47B (:1712-1719); modes jerikan/threshold/shells/strata; **the jerikan mask**: only blue-dominant pixels burn cyan (:2539-2545) | Silver-gelatin paper, where only water, cans and rain glow electric cyan |
| **MONOLITH-3, Grand Teton** | No tone mapping; same `film`/`paper` | Storm sky plate; sun states high, storm break, low (:3191); hemi `#f2f0e9`/`#414140` 1.72 | Grayscale | Glass picker: Red darkens the sky ×.42 and the horizon ×.72; Green lifts foliage ×1.19 (:1767, :2228) | A grayscale film-plate storm over the Tetons |
| **MONOLITH, Snake River → Half Dome** | LinearSRGB, no tone mapping; multipass `renderFrame` (:6843) | Blue night sky (.024,.080,.193)→(.224,.317,.457), raymarched clouds (:5564-5595) | Planar reflection; absorption exp(−path·(1.15,.70,.49)) | Print pass: filter transmission → zone system → Reinhard → warm toning (1,.996,.984) (:6182-6230); filters #8/#21/#25/#58 | A colour night scene printed as a warm monochrome zone-system silver print |
| **Ethiopia Highlands** (`ethiopia-world.js`, `ethiopia-terrain.js`) | ACES 1.06, soft shadows | Sky dome `#28568a`/`#95bad8`/`#e6decb`; golden hour 0.36; mist 0.32 (:525-801) | Four geologies: Simien basalt and moor; Gheralta sandstone; Abay limestone tiers; GERD kolla earth and emerald (:223-680). Water `#24c4e4`/`#124858` | Look pills: raw, jerikan, silver, woodblock, cyanotype, risograph, inkwash, silhouette, set | ACES daylight over ochre and basalt cliffs; golden hour turns it amber |
| **Abyssinian roof** (`abyss-world.js`) | ACES 1.05 | Space orbit `#0a1016`, stars; ground fog as Ethiopia | Hypsometric relief with contour lines; field-texture crop colours by month | Reuses the look pills | Dark orbit relief, then a pale sage-paper field quilt |
| **Highland Exposure** | Raw WebGL2 | Presets dawn, noon, squall, night (:3952-3955) | Olive-ochre highland quilt; crops in 184×92 plots (:3624-3662) | Weather presets | A muted olive-ochre quilt under tinted haze |
| **WYGWYL city** (`city/island/island.js`) | ACES 1.12 | Dusk sky `#08182e`/`#0f2c52`/`#2c5278`; sun `#ffbe7d`; cyan fill `#18b4ff` (:87-166) | Harbour water `#081c36`/`#13466e` with cyan glints (:461-506) | `CITY_LOOKS`, including WEAVE (5-step cel, cobalt to ochre); time presets dawn, midday, blue hour, night (`shader-suite-bar.js:52-126`) | A cobalt dusk harbour with a sodium sun and an electric cyan fill |

The 14 named looks are **one shared catalogue**. They appear in `night-post.js`, `zones.js`, `study/look-audition-mv.js` and `city/shaders.js`. Each maps a silver base through colour ramps.

## 2. How the trough carries it: `look@1`

A look packet is part of the **label band**: it loads at startup, so every island is recognisable from afar.

**Files**

| File | Holds |
|---|---|
| `atlas/look-catalog.json` | The shared catalogue (14 looks plus the city's weave) and the house standard |
| `atlas/looks.json` | The islands no can claims yet: Teton, Half Dome, the Corridor, Ahiya |
| `ethiopia-highlands/look.json`, `city/island/look.json` | Each can's own packet (`can.json` → `look`) |

**What `atlas/overworld.html` does with them**

1. **Ground, by place.** Each island's palette lives in shader uniforms keyed to its rectangle: meadow pair, rock, shore sand, snow and snow line, rock slope band, how much of the painted map to keep. Simien's basalt reads as Simien even from the bridge.
2. **Atmosphere, by where you stand.** Sky, fog, hemisphere and sun, the cyan fill light, water, exposure and tone blend between islands, like RAGE's timecycle zones.
   - The island you stand on owns the look.
   - A neighbour across a strait lends a share that falls off with distance past its coast.
   - Crossing a bridge from a colour world into a silver one dissolves one into the other.
3. **The grade pass.** The scene renders to a buffer. One quad then applies, in order:
   - filter transmission (MONOLITH's and Donkey Water's filters);
   - saturation and contrast;
   - optional ACES;
   - the world's **ramp** through up to six stops, cel steps, edge line and scanlines;
   - the **jerikan mask**;
   - lift, gamma and gain;
   - vignette and grain.
4. **Named looks on the lens.** The surface's lens drop lists the current island's looks. Pull sideways to change, as in the levels. The list holds:
   - its own variations (golden hour, monsoon mist, Red #25, storm break, zone system, dawn, night…);
   - the catalogue entries it offers.

## 3. The house standard

Teton's look is the law every world follows: **a silver-gelatin world where only blue-dominant things (water, cans, rain, Wi-Fi) burn cyan.** It is the visual form of the thesis that data is wet.

Each world keeps its identity *inside* the law:
- **its own toning of the silver:**
  - Simien: cool basalt.
  - Gheralta: sandstone sepia.
  - Blue Nile: limestone.
  - Belaya: emerald.
  - The Corridor: olive.
  - WYGWYL: cobalt.
  - Half Dome: a warm print.
- **its own atmosphere and its own ground luminance by place.**

Under the standard, sky, fog and light lose their hue, so only blue *things* turn cyan, never the sky.

Every world's full original colour stays on the lens as **Its own colour**. `?standard=0` turns the standard off.

## 4. Evidence

Frames: the level at its own spawn, and the trough on the same island before and after the look work, with **Its own colour** selected for the colour worlds.

Distance is a colour-fingerprint difference from the level, where 0 means the same look. It sums luminance, contrast, saturation, colourfulness (Hasler–Süsstrunk) and a 12-bin hue histogram. The tools are `atlas/looks/lookstats.py` and `atlas/looks/make_looks.py`, which builds every packet from the surveyed values; the sheets are in `atlas/looks/`.

| World | Before | After |
|---|---|---|
| Simien | 0.99 | **0.80** |
| Gheralta | 1.77 | **0.90** |
| WYGWYL city | 1.95 | **0.84** |
| Grand Teton (MONOLITH-3 / Donkey Water) | 2.34 | **1.22** |
| Half Dome (MONOLITH) | 1.59 | **0.71** |

With the levels' own materials poured (JERRYCAN.md §6): Simien **0.74**, Gheralta **0.55**, WYGWYL **0.64**.

**Sheets in `atlas/looks/`:**
- `evidence-colour.jpg`: level, before and after, with palettes.
- `named-looks.jpg`: 19 named looks working in the world.
- `house-standard.jpg`: all nine islands under the standard, beside their own colour.

## 5. Not yet carried

These are listed so the gap stays visible.

- **Shadows.** The trough has no shadow maps. Ethiopia and the levels do, which is most of why the trough frames are flatter (Simien contrast 0.18 against the level's 0.20; Teton 0.09 against 0.16).
- **Content.** Teton's remaining distance is mostly content: its level is dark conifer forest, a black river and shadowed peaks, where the trough's Teton is mostly pale meadow and fog. That is a job for the Teton can (MONOLITH-3's grids and canopy), not for colour.
- **Sky shaders.** Not yet ported:
  - Ethiopia's dome sun disk and glow, and its valley cloud sea;
  - MONOLITH's raymarched clouds and moon;
  - the storm sky plate.

  The trough paints a gradient.
- **Water shaders.** Not yet ported: MONOLITH's fresnel, reflection and absorption, and the city's harbour shader. The trough's water is one Phong plane that takes each world's colours.
- **Donkey Water's post stack.** Not yet ported:
  - the accumulation trail;
  - depth of field;
  - the focus-driven modes (threshold, shells, strata).
- **Catalogue approximations.** The 14 looks are carried as ramps with steps, edges and scanlines. `spray` drips, `glass` x-ray edges and the `set` CRT bloom are approximations.
- **Time.** The 18-watch light curve and the city's hour-driven sky are offered as named presets (Night watch; Dawn, Midday, Blue hour, Night). They are not yet driven by the clock.
- **Cost.** The grade adds one full-screen pass. The scene buffer is half-float with 4× MSAA.
