# Poem Decks

A two-deck video and sound editor for *Where You Go When You Leave* (WYGWYL).
Open `index.html` (served, not from `file://`, because it fetches its JSON).
On GitHub Pages: `city/decks/`.

## What a deck can hold

| Kind | Files | What it is |
|---|---|---|
| READING | `clips/NN.mp4` | The 14 poems cut from the Frame.io rough cut `261114_WYGWYL_Poetry Reading_ROUGH.mp4` (22:57, 1080p, 23.976 fps), 640×360. |
| WORLD | `world/*.mp4` | 18 reels from butterfly-halfworld `wygwyl/world/tide` (Magic Ride, Atlantis take, Reunion, walks, probes), 640 px. |
| SOUNDS | `reels/fx-NN.mp3` | One Freesound recording per spoken line (Sonic Foraging Atlas, 222 cues), each placed at its line's time in the reading. |
| LAYERS | `stems/NN-p0…p5.mp3` | The 7-layer multiplane X-sheet as five synced stems per poem: P0 mask, P1–2 action, P3 prop, P4 room, P5–6 horizon. Room and horizon beds hold until the line's space changes. |

LINK makes one deck follow the other. Sounds and layers lock to the reading of the same poem;
a world reel is stretched to the length of that reading.

## Data

- `suite.json`: poems, clip in/out in the source, aligned lines, Whisper words, camera cuts, Frame.io comments, waveforms.
- `decks.json`: world reels and sound reels with cue lists and waveforms.
- `layers.json`: X-sheet lines, the five stems per poem, plane names, sound credits.
- `data/`: the Whisper transcript, line alignment, both atlases parsed to JSON, Frame.io comments, camera cuts, `sound-credits.csv`.
- `sounds/`: the 266 Freesound previews used, trimmed to 24 s, mono.
- `tools/`: the scripts that made all of the above (transcribe, align, fetch, render reels and stems, waveforms). Paths inside them point at the working folder they ran in.

## Sound licences

All sounds are Freesound previews under their own Creative Commons licence; see `data/sound-credits.csv`.
154 are CC0, 88 need attribution (CC BY 3.0/4.0), and 24 are non-commercial only (CC BY-NC). Check the NC ones before any paid use.
