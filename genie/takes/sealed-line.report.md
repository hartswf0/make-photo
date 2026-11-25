# The Sealed Line, take 001 (Genie 4, one session)

## The run

- **One session:** the seed `train/seeds/run_1_empty.jpg` was sent at 1024×576, under the 48 KB seed limit, with the opening prompt from `train/data/session.json`.
- **Driving:** W was held for the whole session. All 7 door cues and their follow-ups were sent whole and unshortened, each sent 4 times, 150 ms apart.
- **Length:** 117 s and 2,800 frames, using 689,856 tokens (about $11.80). The session ended cleanly with `complete`.
- **Reach:** it got through all seven doors. Nothing reset, and the seed was never sent again.
- **Timing:** Genie 4 caps a session at 120 s, so each carriage had about 15 s.

## Per door

| Door | Cue at | Room change | Lock | Contents seen | Mark on him |
|---|---|---|---|---|---|
| Empty | 0 s | (start) | held: behind, shoulder height | the empty carriage exactly as in the seed; land slides past | – |
| 1 Sealed velocity | 9.5 s | none: same teal carriage | held until about 30 s | two men in dark suits walk up beside him; a pale city skyline in the windows | none: no cart, shoe or welt |
| 2 Honeyland | 24.5 s | none | **broke at about 30 s**: the camera swung round to face him and stayed in front until 55 s | a calf at his side (33 s); flying bees; a gold honeycomb frame held behind him (45 s) | none |
| 3 Beekeepers | 39.5 s | none | still in front of him | the honeycomb frame | none |
| 4 Wings | 54.5 s | **yes, at 55.5 s, as a hard cut, not through a door**: a monochrome sleeper corridor | relocked behind him for about 5 s, then a three-quarter side view to the end | monochrome corridor; library with green lamp; suit of plate armour; graffiti wall in colour outside the window; bombed church tower; the man made of bees walking beside him; a paper coffee cup in his hand | the cup, and gold bees clumped on his cuff, stay to the end |
| 5 Breach | 69.5 s | none | side view | green targeting boxes on his body and in the air, not on screens | the targeting boxes stay to the end |
| 6 Lumière | 84.5 s | none | side view | a violinist (the dining car's), helmeted figures | none new |
| 7 Hive | 99.5 s | none | side view | smoke, a few bees on his shoulder | none |

## What it tells us

- **Doors never open.** In 117 s he never reaches the far door: W walks him about one carriage length in 30 s, and then the people the cues add block the aisle.
- **The world changed once, as a cut.** The cues pile contents into the room he is already in, and Genie 4 accumulates objects instead of replacing the room. Objects persist well: the cup, the cow, the armour, the violinist, the boxes. Rooms do not change.
- **People break the lock.** The camera turned to look at the faces the cues added, about 20 s in.
- **The cues are too long for the time per room.** Each cue is about 2,400 characters and each room gets 15 s, so most of every cue goes unrealised.

## For take 002

- **Two or three doors per session, not seven.** Each room then gets 40 to 60 s. Start a new session from that room's seed, the file `train/seeds/run_N_*.jpg` itself, and say so.
- **Open the door with movement, not text.** Hold W until the far door fills the frame, check it on the frames, and only then send the cue.
- **Shorten each cue** to the door sentence, five or six objects and one thing done to him. Send the lock line again every 10 s.
