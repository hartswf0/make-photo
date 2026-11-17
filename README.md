# make-photo
After Ansel Adams ("You don’t take a photograph, you make it"): haul 8×10 plates by burro or woody roof-deck and sculpt living worlds across 11 tonal zones.

## THRESHOLD · Donkey Water Sci-Fi (MONOLITH-3 × Abyssal Whale Sanctuary × 11 Tonal Worlds)

[`zones/`](./zones/) stitches the real `MONOLITH-3` USGS Grand Teton (Snake River Overlook, Bluff Trail, Silver Ford, Oxbow, Far-Bank Pueblo), Yosemite Half Dome (East Apron & Cloud Notch), and the subterranean **Abyssal Whale Fluke Sanctuary** (bioluminescent caustic seabed, purple coral pillars, tube sponges, drifting manta rays, jellyfish, and giant Kelp-Film Forest trees hung with live 8×10 contact-print filmstrips) into one continuous fence-free open world. Features level `YXZ` trail-cam riding (`V`), cruiser handling in the **1940s Woody Station Wagon** (`C`) with roof-mounted **Mistletoe**, **Summit Donkey Base-Jumping & Rogallo Paraglider Valley Flight** (`J`), **72 fillable jerrycans across 7 cistern depots** with twin cyan arc pouring (`F`) & Ethiopian *Eskista* victory dance (`K`), **Donkey Hydration survival** (`P` pump / cisterns / river / resonant flow paths), **3D Spatial HRTF Donkey Radio** (`cyan-jerikan.ogg` C60 deck with beat-pulsed WiFi domes & cyan rain), **3D Lidar contour scanner** (`L`), **Song-to-Zone Resonance Flow Conduits** (`T`), and a deployable **8×10 Mahogany Field Tripod Rig** (`B`).

## MONOLITH-3 (Open World + Mistletoe)

`MONOLITH-3.html` is a self-contained single-file field expedition (`~21 MB` Tier-1 lossless build) uniting:
- **Open-world Grand Teton & Yosemite**: walk directly from Snake River Overlook down the Bluff Switchback Trail to the river, upstream Oxbow, and Far-Bank Terrace, and roam Yosemite's Half Dome granite apron alongside the Zone System notch pass.
- **Skinned Pack Donkey (Mistletoe)**: shared procedural 25-bone skinned burro (`donkey/donkey.js`) with fur shells, coat projections, weighted Left/Top/Right cargo balance, lead-rope/tether/mounted driving across 4 gaits, and autonomous drives (trust, hunger, fear, refusal, cliff caution).
- **8×10 Field Camera & Expedition Map**: unpack the 3D tripod and view camera anywhere on foot (`C`) to expose contact prints into the Map & Plates archive (`M`).

Modular sources live in `monolith3/` (`ui.css`, `body.html`, `game.js`) and `donkey/` (`donkey.js`, `coat_*.jpg`), compiled deterministically via:

```sh
python3 scripts/build_monolith3.py
```

## Pack Donkey

`donkey/` is a playable level: lead a pack donkey to a cairn, set up a plate camera by hand, and bring good glass plates home before the light goes. The donkey itself is reusable in other pages. See `donkey/README.md`. Open `donkey/index.html` from a web server, or `/donkey/` on GitHub Pages.
