# Genie → game: what the takes we have can teach the levels

Three paid Genie 4 takes exist:

| Take | Length | Seed | What we sent |
|---|---|---|---|
| `sealed-001` | 117 s | the train's empty-carriage seed, a game capture "dressed" to look like a film still | W held throughout, 31 text lines |
| `bottle-001` | 39 s | the lakeside hero frame | keys and 7 lines |
| `tex` (`mars/v2g/genie_tex.mp4`) | 38 s | the Tex Lexington seed | |

This folder measures them from the pixels alone, with no model in the loop, and records what each one says about Genie and about our own worlds.

```
python3 genie/v2g/measure.py <take.mp4> --seed <seed.jpg> [--log log.jsonl] --out <dir> --name <name>
```

For each take it writes `<name>.measure.json` (8 samples a second) and `<name>.png`, a strip of frames over these curves:
- **drift:** the colour distance (ΔE) from the seed;
- **look:** contrast and chroma (colourfulness);
- **camera:** push, i.e. forward motion from optical flow, and yaw (turning);
- **state:** walk, creep, turn or still;
- the text cues we sent, and any cuts.

`sealed-001.ledger.json` is what Genie put on screen, labelled by eye. For each thing it gives when it appeared, which cue asked for it, how late it came, how faithful it was, and how long it lasted.

## What the measurements say

### 1. Genie pulls every seed toward one house look.

| | L (brightness) | chroma | vignette (corner ÷ centre) |
|---|---|---|---|
| sealed seed → last 2 s | 20.6 → 38.9 | 13.4 → 7.3 | 0.06 → 0.78 |
| bottle seed → end | 37.1 → 42.9 | 13.2 → 6.6 | 1.02 → 1.44 |
| tex seed → end | 51.0 → 54.6 | 29.0 → 20.3 | 0.94 → 1.51 |

Every take loses 30 to 50 % of its chroma and gets brighter. A heavy vignette is opened up. The train's graded, dark seed drifted fastest: ΔE 0.96 at 1 s, 10.6 at 8 s, 21.8 at most. The Tex seed was already close to Genie's default and drifted least.

**Limit:** Genie will not hold a strong grade.

**What to do:** grade *after* Genie, in our own pass (the overworld's grade shader, `look@1`). Don't ask Genie for one. If the seed is dark and graded, Genie spends its first seconds undoing it, and it takes the people with it.

### 2. W walks. A long cue stops the walk.

In sealed-001, W was down from 0.5 s to 117.5 s.
- **0–11.4 s:** a real walk; the forward flow is 2 to 3.5.
- **9.3 s:** the 2,383-character door cue goes in. About 2 s later the walk becomes a creep, a slow push of 0.3 to 0.7, and it never returns, apart from 5 s after the cut.

The short lines before it (42 and 80 characters) did not stop it.

In bottle-001, he walked only while a camera line and W agreed, at 21.7 s.

**Limit:** text outweighs keys.

**What to do:** while he must walk, send nothing, or one short line.

### 3. Cues never expire, and nothing is removed.

From `sealed-001.ledger.json`:
- **Late arrivals:** the violinist asked for at 9 s appeared at 42 s, crossed the cut and stayed. The night-vision guard from the same cue appeared at 87 s, 78 s late.
- **Nothing left:** everything that arrived stayed until the end or until the cut.
- **One room change:** the room changed exactly once, as a hard cut 1.8 s after door 4's cue.

**Limit:** a session is one growing pool, not a sequence of scenes.

**What to do:** treat each room as its own session, from its own seed. The seeds exist: `train/seeds/run_N_*.jpg`, with camera poses.

### 4. What persists best: small things in his hand, then people.

**Best kept:**
- the paper cup, 0.7 s after its line and held for 57 s, exactly;
- the gold bees at his cuff, 56 s;
- the targeting boxes, 44 s;
- the calf, 30 s;
- the suits, 41 s.

**Worst kept:**
- windows (the iced city lasted 4 s);
- rooms;
- the man made of bees (4 s).

**What to do:** Genie is good at the props and people layer, so the game should take its props from there. Rooms and geometry come from our engine.

### 5. An action "done to him" lands on whoever is in frame.

The handcuffs went on the other man.

**What to do:** name the target by something visible ("the man in the brown hat"), or don't direct actions at the protagonist at all.

### 6. Identity comes from the seed's face, or from Genie's default.

The seed's faceless figure became a white Hollywood man in 8 s. Nothing in the prompt or the seed said otherwise.

**What to do:** the seed must show the person, and the prompt's first sentence must say who he is. This is fixed in the seed-edit prompt (`genie/takes/sealed-seed-edit.md`). It waits on billing.

## What this gives the game, concretely

| From the takes | Goes to |
|---|---|
| Genie's colour pull, measured per take | the post-grade the game applies to Genie footage, and the reverse correction when a take is graded back toward the level's `look.json` |
| Walking speed and creep from flow | how long a corridor a single take can cross. In sealed-001 a real walk lasted 11 s, so a seed should start him one door away |
| The ledger's persistent props (cup, cuff, boxes, calf, suits, armour) | candidate props for the level's `legos.json`, each with its take and timestamp as a `video@1` source |
| The ledger's failures (rooms, windows, door openings) | stay with the engine: `train/js/train.js` builds every carriage and the door seam itself |
| Latency of short concrete lines (0.7 to 2.7 s) vs long cues (30 to 78 s) | the score rules in `genie/TRIAGE.md`, and `genie/take.py`'s gap check |

## What this pass cannot do

- **No metric camera:** push and yaw are flow, not metres. The train seed has a camera pose (`train/seeds/run_1_empty.cam.json`) and a game depth map, so the next step is to match Genie's first frames to the game's own render and measure the walk in metres.
- **No labels:** the ledger is by eye. A segmenter (SAM 2 is in the scratchpad) can turn it into masks and tracks, but it cannot name things without a vision model, and those are behind the billing cap.
- **Three takes are not a study.** The rules above are what these three takes show, not Genie's specification. Google's docs pages were not reachable from this container.
