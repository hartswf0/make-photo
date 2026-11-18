# make-photo
After Ansel Adams ("You don’t take a photograph, you make it"): haul 8×10 plates by burro or woody roof-deck and sculpt living worlds across 11 tonal zones.

Live GitHub Pages `.html` test URLs (`https://hartswf0.github.io/make-photo/...`):
- [`index.html`](https://hartswf0.github.io/make-photo/index.html) — Expedition hub & inline Music Video embed
- [`night-post/index.html`](https://hartswf0.github.io/make-photo/night-post/index.html) — **DONKEY WATER, 2086 · Night Post** (Western Basin)
- [`night-post/index.html?circuit=ahiya`](https://hartswf0.github.io/make-photo/night-post/index.html?circuit=ahiya) — **Ahiya Highlands** by night (Rahel)
- [`night-post/companion.html`](https://hartswf0.github.io/make-photo/night-post/companion.html) — Turn-based Dispatch Ledger companion (syncs with 3D game via `localStorage`)
- [`music-video.html`](https://hartswf0.github.io/make-photo/music-video.html) — **DONKEY WATER SCIFI** Music Video Screening Room, C60 OGG deck, lyrics & HLS/local `.mp4` loader
- [`zones/index.html`](https://hartswf0.github.io/make-photo/zones/index.html) — **THRESHOLD · Donkey Water Sci-Fi** (`Zones 0–X` / Blue Jerikan #47B)
- [`MONOLITH-3.html`](https://hartswf0.github.io/make-photo/MONOLITH-3.html) — Single-file Grand Teton & Yosemite open world (`21.1 MB`)
- [`field-plates/index.html`](https://hartswf0.github.io/make-photo/field-plates/index.html) & [`donkey/index.html`](https://hartswf0.github.io/make-photo/donkey/index.html) — Field Plates & Pack Donkey levels

### Getting Past File-Size Limits (Video & Single-File HTML)
- **Large video (GitHub 25 MB web / 100 MB Git limit)**: run [`scripts/slice_hls_video.sh`](./scripts/slice_hls_video.sh) to segment any large `.mp4`/`.mov` into `< 4 MB` 4-second HLS `.ts` chunks + `playlist.m3u8` and play via `music-video.html?hls=./video/cut/playlist.m3u8`, upload a full `.mp4` (`<= 2 GB`) to a GitHub Release (`?mp4=<release-asset-url>`), or load directly from disk inside `music-video.html` with zero upload.
- **Large HTML bundles**: keep external textures, audio, and Three.js modular (`night-post/`, `zones/`) instead of base64-inlining everything into one file.

## DONKEY WATER, 2086 · Night Post (Ahiya Area Network)

[`night-post/`](./night-post/) builds the 2086 film and production-design edition atop the `MONOLITH-3` / `zones/` 3D engine and syncs two-way over `localStorage` (`donkey-water/night-post/1`) with the turn-based [`companion.html`](./night-post/companion.html) ledger and [`world-bible.pdf`](./night-post/world-bible.pdf):
- **Dual Circuits (`Tab` / `Switch Carrier`)**: **Imani & Mistletoe** across the **Western Basin** (`Overlook Wellhead`, `Moraine Switchback`, `Silver Ford` ferry rope, `Cottonwood Oxbow` billowing double linen sheets, `Highland Pueblo` fenced Cooling Office & wire-glass Registry window, `Whale Fluke Wreck Cinema`, `Half Dome East Apron` seep pump, `Teton Cairn`) and **Rahel** across the **Ahiya Highlands** (`Basalt Pump` with glowing mobile screens, `Cross-Beacon Watch` congregation wall & white sky beam, `Hill Archive REC PPC` staffed window & fans, `Daylight Compound` pegged screening courtyard).
- **20 L Chalk-Reserve Water Law & 24fps Moving-Picture Projector**: Track living wet copies (`WF–08` public cut & 8-second tail, `AR–03` three rehearsal takes), protect the white `4 L` chalk reserve on Mistletoe's saddle cans, screen 24fps film sequences directly onto 3D linen sheets, hear June's synthesized 8-second earphone tail (`playEightSecondTail()`) and Ahiya *Tizita* harmony (`playHarmonyRehearsal()`), inspect all 7 illustrated 2086 plates inside the **Carrier's Dispatch Book** (`M`), and expose 8×10 Zone plates across the 18-watch Dusk → Indigo Night → Dawn sky.

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
