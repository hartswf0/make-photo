# Mix Discs — theory of the program

Written before the program text. The code in `index.html` is traceable to the names here.

## 1 · Way (VOIDBASTARD-TAO)

- **Actor:** one person, a phone held sideways (a laptop works too).
- **Object:** two decks, A and B, each holding one disc; and the mix.
- **Operation:** play and scrub a deck → route its picture, sound or words → blend the two with the crossfader → **send** a cut (IN→OUT) or **record** a performance into the mix → adjust clips → watch the mix.
- **Consequence:** the preview always shows the real output: the live blend while decks play, the mix while the mix plays.
- **Completion:** an edit list, a project file or a recorded film, or nothing. Playing is allowed to end with no file.

## 2 · Obstruction (what the previous Mix Discs did)

- One source disc only: no second deck, so nothing could be blended live.
- Portrait-only stacking: on a phone everything was small and the shelf, lanes and controls competed.
- Scrubbing only by a thin strip or a coarse spin of the disc.
- Shelf, send lens, lanes and inspector all on one screen at once.

## 3 · Keep / cut ledger

| Element | Claim | Verdict |
|---|---|---|
| Disc A, disc B | "this is what each deck plays; touch to scrub" | keep, the largest things on DECKS |
| Ring of a disc | "where you are in the whole disc; drag along it to jump" | keep |
| Inside of a disc | "drag to nudge, finely" | keep |
| T · V · A under a disc | "this deck's words / picture / sound reach the output" | keep, beside the deck it routes |
| `[` `]` and SEND | "cut this deck from IN to OUT and lay its routed channels into the mix at the playhead" | keep, beside the deck |
| ◀ ▶ line jumps | "previous / next spoken line" | keep (poems are made of lines) |
| Preview | "this is the output now" | keep, centre |
| Crossfader | "the output is here between A and B" | keep, under the preview |
| ● REC | "lay the live output down as clips while decks play" | keep, beside the crossfader; shows elapsed time and STOP while on |
| Poem dots 01–14 | "load this poem: its reading on A, its world or rooms on B" | keep, one row |
| Disc shelf | true, occasional | cut to a sheet opened from a deck's title |
| Lanes, inspector, export | true, but editing, not playing | cut to the MIX view |
| Per-band EQ, filters, pitch | true for DJs, not for this job | cut |

## 4 · Entities, operations, states

```
<disc>     := {key, kind ∈ reading|world|sounds|layers, title, dur, files[1..5], pic, snd, txt}
<deck>     := {id ∈ A|B, disc?, t, playing, in, out, route{pic,snd,txt}}
<clip>     := {id, lane ∈ pic|snd|txt, key, in, out, at, row ∈ 0..3, lvl ∈ 0..1}
<mix>      := {clips[0..200], PT, playing}
<program>  := live(decks, xf, mode) when mix not playing, else mix(PT)
<view>     := decks | mix
```

Operations: [load] disc→deck · [scrub] ring (absolute) / inside (relative, 1 turn = 8 s) · [mark] IN/OUT · [route] T/V/A · [send] deck→clips · [crossfade] · [rec] live→clips · [play-mix] · [edit] clip (level, move, trim, delete) · [undo] · [export].

States: REST (no disc) → READY (disc loaded, paused) → WORKING (deck playing | scrubbing | recording | mix playing) → CHANGED (clip added/removed; toast with UNDO) → COMPLETE (export done) · FAULT (media failed: deck says so, mix keeps its clips).

## 5 · Invariants (asserted in code by `validClip`, `clampDeck`)

1. `0 ≤ in < out ≤ disc.dur` for every clip and every deck cut.
2. `at ≥ 0`, `row ∈ 0..3`, `lvl ∈ [0,1]`, `lane` is a channel the disc carries.
3. At most 200 clips; undo history at most 100; at most 24 live clip players (players far from the playhead are released).
4. Decks and mix never play at once: starting one pauses the other.
5. The preview draws only what is routed (live) or on the lanes (mix) — never a deck that is routed off.

## 6 · Assumptions

- Phones are held sideways for this work (safe; portrait still works, smaller).
- Media files are on the same origin under `../decks/` or alongside the page (safe).
- `MediaRecorder` and canvas capture may be missing (uncertain → RECORD FILM says so and does nothing).
- A clip's level is constant; there is no level automation inside a clip (decision: REC starts a new clip when the crossfade level moves by more than 0.15, which approximates a fade with steps).

## 7 · Failure modes → response

| Failure | Response |
|---|---|
| Media file fails to load | deck shows "COULD NOT LOAD"; nothing else changes |
| Mix full (200 clips) | SEND/REC refuse with a message; nothing is lost |
| Recording with no deck playing | nothing is laid down; REC shows 0:00 and keeps waiting |
| Saved project names a disc that no longer exists | that clip is dropped on load; the rest load |
| Audio context blocked until a tap | first play/scrub creates it |
| Page hidden | the frame loop does no work until visible again |

## 8 · Power-of-10 review (JavaScript adaptation)

- **Control flow:** no recursion; one `frame()` loop calls small named steps in fixed order.
- **Bounded loops:** every `for` runs over a capped array (clips ≤ 200, lines ≤ ~40, files ≤ 5). The animation loop is the only open loop; it does nothing while `document.hidden`.
- **Memory:** caps above; players beyond 24 or 6 s from the playhead are released; undo is a bounded ring.
- **Small functions:** one job each (draw a disc, scrub, send, record tick, draw lanes…).
- **Scope:** state lives in four objects (`DECK`, `MIX`, `G`, `REC`); no other mutable globals.
- **Checked results:** every `play()` promise is caught; every fetch checks `ok`; saved data is validated by `validClip`.
- **No metaprogramming:** no eval, no dynamic import.
- **References:** each clip owns at most one player; players are created and released in one place (`playerFor`, `releaseFar`).
- **Tests/assertions:** `validClip` guards every clip that enters the mix; `selfTest()` runs once at load and logs any failure.

## 9 · Change scenarios

1. *Add a third deck.* `DECK` is an array; routing, crossfade and REC loop over it. The crossfader would become per-deck faders; the theory (route → blend → lay down) survives.
2. *Level automation inside clips.* `<clip>.lvl` becomes a list of (time, level) points; REC would write points instead of splitting clips; export would note the points. Lanes and send survive unchanged.
3. *Export a rendered file on a server.* The project JSON already names every source, timecode and level; a renderer can read it without the UI.

## 10 · Residual human theory

- Which disc "partners" a poem on deck B (world reel first, else its rooms) is a taste call, not a rule.
- Line jumps assume the reading's aligned line times are right; poem 06 has two refrain lines whose times are interpolated.
- The rough cut's timecode is the reference; world reels and sound reels start at 00:00:00:00 in their own files.

---

## Revision 3 · the instrument

*Obstruction found in revision 2:* it was still an operator panel. Titles, tabs, IN/OUT, SEND, lanes, a crossfader and LINK lost along the way all competed with the picture. You read it instead of playing it.

*New way:* the output fills the screen. Discs are gears floating on it.

| Gesture | Operation | Consequence |
|---|---|---|
| tap a disc's centre | [play/pause] | the disc and every disc meshed with it start or stop |
| double-tap the centre | [loop] the current line | gold arc on the rim; the line repeats |
| turn the ring | [scrub] (one turn = 8 s) | each tooth clicks (sound + haptic); meshed discs turn with it |
| drag the centre | [move] | the nearer the middle of the screen, the stronger in picture and sound (`levelOf`) |
| push two discs rim to rim | [mesh] = LINK | teeth interlock, buzz; they turn and play as one, opposite directions like gears; pull apart to let go |
| tap a dot above a disc | [route] words / picture / sound | that channel joins or leaves the output |
| hold the centre | [swap/remove] | thumbnail grid, trash with UNDO |
| + | [add] | up to four discs (`MAXD`) |
| ● | [rec] | the output and its sound are recorded; stop → watch, save the film, save or copy the edit list built from the 4 Hz log |
| 01–14 | [load poem] | its reading meshed to its world reel (or rooms) |

*Invariants added:* at most 4 discs; mesh is symmetric and recomputed from positions only (`computeMesh`); group direction alternates by depth (`groups`, bounded by `MAXD*4` steps); the anchor of a group is the last disc touched and the others keep the clock offset they had then (`anchor`, `follow`); the record log is capped at 14 400 samples (one hour), the recorder at 6 000 chunks.

*Cut:* the MIX lanes and clip editing (the edit now comes from the performance), IN/OUT, the crossfader (position is the fader), every title and label except poem numbers.

## Revision 4 · body, not text

*Obstruction in revision 3:* position set the level, so a disc always covered the middle of the picture; scrubbing was silent and weightless; there was no way to shape colour or sound; long press only swapped.

| Gesture | Operation | Feel |
|---|---|---|
| pinch a disc (or scroll on it) | [size] = level, 0.35–1.6 × | a click every 10 % |
| turn the ring forward | [scrub], heard at hand speed (playback rate = hand speed, up to 3.5×) | tooth clicks scale with speed; a heavier thunk on every spoken line |
| flick the ring and let go | [coast] | slows like a heavy platter (decay 3.2/s) |
| hold the centre | petals: blend · colour · tone · swap · remove; slide and release, or tap | petals fan toward the middle of the screen; each petal ticks as you cross it |
| colour / tone petal | the ring becomes a dial: hue wheel, or low-pass ↔ high-pass with a detent at off | tap the centre to leave; the dial closes itself after 3.5 s idle |
| tap empty space | [clear] the gears tuck into the corner as small orbs, still turning | tap an orb or the space to bring them back |
| mesh discs of different sizes | gear law: follower speed = r_anchor / r_follower, 0.5–2 × | a smaller gear runs faster |

*Blend modes:* normal, screen, multiply, difference, add, shown as the hub's outline (glow, dark core, dash).
*Colour:* a per-disc tint drawn through an off-screen layer with the `color` composite, so it works where `ctx.filter` does not.
*Tone:* one biquad per disc, before its gain.

*Bounds:* the petals have 5 entries; the dial has one value; momentum is cleared below 0.25 s/s or at either end; vibration is throttled to one pulse per 28 ms, except mesh, line and menu events.

## Revision 5 · a rack of dials beside the picture

*Obstruction in revision 4:* gears floated on the output and covered it; petals and discs overlapped; a poem opened only two discs; the controls hid behind a long press.

*New way:* the output owns a 16:9 rectangle that nothing is drawn over. Everything else is the **side**, where nodes sit on a computed grid (`layout`, `gridItems`, `stripItems`). Overlap is impossible by construction and is asserted every layout (`checkLayout`: no two items share a pixel, and none touches the output). Sheets open over the side, not over the picture.

| Part of a node | Gesture | Operation |
|---|---|---|
| centre (hub, < 0.34 r) | tap · double tap · hold | play/pause (the node becomes the anchor) · loop the line · swap or remove |
| middle band (0.34–0.64 r) | turn | time; forward heard at hand speed; a flick coasts; teeth and line haptics |
| outer collar (0.64–1.1 r), four 80° arcs | slide around the edge (relative, clockwise raises) · double tap resets | top **level** · right **tone** (low-pass ↔ high-pass, detent at 0) · bottom **colour** (off → full hue turn) · left **blend** (5 detents) |
| button row | tap | power · words · picture · sound · link (fixed slots; missing channels are shown dim and inert) |
| two fingers | pinch | level |

The collar arcs are wide curved targets you can grab anywhere, and you keep control after the finger leaves the arc (pointer capture), which is what Fitts's law asks of a small screen.

*Poems open every node:* reading, each world reel of that poem, line sounds, rooms (at most 8, `MAXN`). All start on and linked. Defaults: reading 0.9, first world 0.75, other worlds 0.35 in screen blend, sounds and rooms 0.5.

*LINK, simplified:* every node that is on and linked runs on one poem clock (`toClock`/`fromClock`), anchored to the last node touched. There are no offsets and no gear ratios. A world reel is stretched over the spoken span, as before.

*Views (top left):* **split** (output beside the dials) · **rack** (small output, big dials) · **focus** (one big dial plus a strip of all nodes; tap a node in the strip to bring it up) · **out** (big output plus a strip; tap = power, slide up or down = level). Keys 1–4 switch views; [ and ] step through the poems; space plays.

*Cut:* free positioning, meshing by touch, petals, the clear-view tuck.

## Revision 6 · the field

*Obstruction in revision 5:* the rack was tidy but dead. Mixing meant reading dials, not moving things. Each dial crowded four sliders, a waveform and a hub into one circle. Starts, stops and scrubs were cuts, not transitions.

*New way:* **the picture is the mixer.** Each source is a small mass placed on the output. Every pixel takes a share from each source by distance:

```
f_i(p) = m_i / (1 + d(p, x_i)² / σ_i²)²      σ_i = 0.08 + 0.55 · reach_i      (d with 16:9 aspect)
w_i(p) = f_i^γ / (VOID^γ + Σ_j f_j^γ)        computed on an 80 × 45 grid, upscaled as soft masks
```

The `VOID` term stands for black and silence, so a light or distant mass fades instead of being stretched to fill the frame. The **ear** is a second point on the field. The sound mix is the same field read at the ear (`earW`, equal-power gains). Touching empty space sends the ear there.

| Field | γ (picture / sound) | Character |
|---|---|---|
| gravity | 1.6 / 1.6 | soft pools that melt into each other |
| cells | 12 / 5 | sharp territories (near-Voronoi); edges traced by marching squares |
| veil | 1.6 / 1.6 | the whole frame mixes by the ear (a 2-D crossfader) |
| tangle | unnormalised | territories overlap and interfere (alternate screen / difference) |

*Feel:*
- **Bodies.** Nodes and the ear follow the finger on a stiff spring. A flick makes them glide; a finger that stops before release leaves no fling. They bounce at the edges and keep a minimum distance from each other, so they never overlap.
- **Smoothing.** Mass, reach and the dial pointers are smoothed toward their targets, so every change is a transition.
- **Motor.** Play and stop are tape-like: speed eases 0 → 1 (about 0.3 s) and back, with pitch free during the ramp. Linked sources share the motor's speed.
- **Platter.** The hand sets a target time and the platter follows on a spring (`scrubTick`). Gearing depends on radius: at the rim one turn is 8 s, near the centre down to 2 s. Forward motion is heard at hand speed. On release a playing platter spins back to 1×; a stopped one coasts and slows.
- **Dials.** Each dial is one clean knob with 270° of travel. Turn around it; the farther out the finger, the finer the turn (leverage). Or slide up and down from its centre. A tick every 5 %, a detent at tone 0, double tap to reset. Dials: mass, reach, tone, colour.

*Invariants:* nothing in the deck covers the output (`checkLayout`). The overlay (dots, ear, territory edges) is a separate canvas and is never recorded; it fades to 28 % after 2.5 s idle, and the eye hides it entirely. At most 8 nodes, a fixed grid, and bounded loops over nodes × cells (≤ 8 × 3600).

*Edit list:* picture events give each source's share of the frame; sound events give its share at the ear; the field mode is noted.

*Cut:* the rack of dials, collar sliders, blend modes per node (replaced by the field modes), views split/rack/focus (replaced by deck / big picture).

## Revision 7 · the field on the GPU, and a performance

*Obstruction in revision 6:* on a large screen the picture was small and the 2-D compositor redrew five full layers and masks every frame (about 38 ms in a software browser). The field modes were four separate settings, so switching between them was a cut.

*New way:*
- **One shader pass** computes every pixel's share from every source, exactly rather than on a grid, and applies tint, veil and tangle. Shares are worked out in log space so a sharp gamma never underflows. It took about 6 ms per frame in the same software browser. The 80 × 45 grid remains for the territory edges, the frame shares and a 2-D fallback when WebGL is missing.
- **The field is a continuous space** (`FMP = {G, veil, tang}`). The four buttons are targets, and the field glides between them in about 0.3 s: gravity morphs into cells by sharpening gamma, cells dissolve into tangle.
- **Bigger desktop picture:** 74 % of the width above 1100 px (60 % below). Words get their own layer; the recording composites picture + words (`compose`).
- **A performance (✦).** One 64-second choreography on poem 10, written as a pure function of time (`demoState(t)`, `demoClock(t)`), in six scenes with 1.6 s morphs between them:
  1. **veil**: the ear crossfades portrait → world → world.
  2. **gravity**: four worlds orbit the reader while their reach breathes. A tape stop.
  3. **cells**: a rotating mosaic of territories with tinted worlds. The ear tours each cell, so you hear each source in turn. A two-second scratch.
  4. **tangle**: the worlds spin in a tight interfering ring, hues drifting. A four-times stutter on one phrase.
  5. **bands**: all seven sources in a row that waves, while the ear sweeps across them. A half-speed dip.
  6. **veil**: the worlds fade into the void, the reader alone, a final tape stop.

  Live, ghost hands drive the tool; touching anything hands control back. Offline, `DEMO.renderAt(t)` puts every source at exactly that frame's time, waits for the pictures, and renders through the same shader. The sound is rebuilt from the same clock at 48 kHz with the gains the field computed at the ear for each frame (`demo_audio.py`), so the film is the tool's own output, frame for frame.

## Revision 8 · his voice first, and a score instead of a pattern

*Obstruction in revision 7:*
- Every world reel carries his voice from another take, and the reels were stretched over the poem. So the mix held several out-of-sync copies of him, and you could not make out the words.
- The performance moved things by geometry (orbits, rows, sweeps), not by meaning.

*Voice:*
- The reading is the spoken word. It plays dry at full level, never mixed by the ear; it fades only when the reader's mass is near zero.
- World reels are **silent by default**. Opening a reel's sound brings in his voice from that take as a **distant echo**: 0.32 s late, 250–1800 Hz, in a 2.4 s room (`makeDistance`). The ear sets how much.
- The two Foley beds (line sounds, rooms) are mixed by the ear and **duck under every spoken word**: −60 % with an 80 ms attack and 350 ms release. `duckAt` is a pure function of the reading's clock and its word timings.
- His words sit in a steady reading line at the bottom. No other node's words are shown unless you open them.

*Sync by meaning:*
- Each reel was transcribed and aligned word by word to the reading (`tools/reelsync.py`, `data/world-sync.json`). `fromClock` and `toClock` now interpolate those anchors, so a reel shows the moment he is speaking about.
- Matched words: grey 85 %, cel and magic-ride 47 % (their takes end at about 53 s), greyfig 28 % (ends at about 33 s).
- A reel **fades out where its take ends** (`inTake`) instead of freezing.

*The performance is a score* (`SCORE`): cues keyed to the times of his words. Each cue glides one value — position, mass, reach, hue, tint, echo, ear, or the field's gamma / veil / tangle — over a phrase, the way a bow moves. The reading plays untouched at 1×; the score follows its clock, live and when rendered.

| Words | Gesture |
|---|---|
| I wasn't looking for a *ride*, but *here you are* | he alone; the bike under the lamp blooms in from the right |
| both the *dark* and the *light* worlds | two takes split the frame, one cooled, one warmed; he narrows to the seam |
| I *rub* my aggressions into your *steel* coverings and *hop on* | tangle friction with the LiDAR street; released as the ride begins |
| *Loneliness* … with *no one to tell* | he shrinks to a corner of a vast empty road; the beds thin; "no one to tell" answers from far away |
| being *everywhere* | every take at once as sharp cells, him small among them |
| *wide-eyed* and *stone* … *wandering with no clear end* | he opens; the edges harden; then fog and no edge at all |
| the *noise* block the *noise* … *swag* … *eyes turn, heads twist* | interference and street roar; the lantern street slides in; the worlds turn around him |
| that *magic* still exists | everything melts warm; the far voice repeats it |
| *darkness* I no longer desire | the worlds sink into the dark |
| the *moon* settles … distant *stars* | night water and stars, cool |
| I can see a *morning ahead* | the colour turns to dawn; he steps aside for the road ahead |
| *loss* and *life* … *deceptively warm* | a breath out and in; warmth, a cold flicker, warmth |
| *spring out of the night* | birds in the beds; he springs out of the night |
| blissful and oddly *innocent* | the opening composition again, in rhyme |
| *double-click* | the field snaps twice |
| the *magic* still *exists* | the far voice answers; the world goes; he is last |

## Revision 9 · scores for the next poems

*Need:* poems 13 and 14 have no reels, 11 has one wordless 20 s walk, and 12 has two reels that carry his voice. A score has to find its material in the meaning.

*Two new kinds of cast member:*
- **A time-shifted copy of his reading** (`far: true`, `map`). It is the same clip at another moment: his younger self, the room listening, the end of the reading seen early through a far window, or his first saying of a line that he repeats. Its voice is never dry; it goes only to the distance bus, and only when the score asks.
- **A borrowed reel** (`map`), taken from another poem where his words point to it: Atlantis for a temple and a flame, the 06 walk's gate and its waterfall of letters, the LiDAR street for "machine learning", a sunlit city for dawn.

`map` is a list of `[clock, source time]` anchors (slope 1 outside them; a jump is two anchors close together). It overrides a reel's own sync. `nodeTime` and `nodeRate` replace `fromClock` and `stretchOf` wherever a node's time is needed.

*Burned-in text:* street walks lose their bottom band (crop 0.93), the 06 walks and probes are cropped from the centre (0.88), magic-ride loses its subtitles (0.84).

*Scores* (`SCORES` in `index.html`; frames in `scores/`):

| Poem | Idea | A few cues |
|---|---|---|
| 11 New Day | a liturgy of light | wings rise on "higher power"; a flame shrinks on "diminishing"; the memorial walk on "remnants of the destruction"; blocks on "rebuild this temple"; three refrains raise the dawn in three steps; everything gathers on "this sacred place" |
| 12 Reunion | the brothers | other takes' voices only on "loud voices so our hearts can be overheard"; one cold room on "afterlives"; four cells on "we're all here"; stillness on "brotherhood"; the ear moves brother to brother on "the next brother's soul" |
| 13 How to Win My Heart | being seen | he is shown through a window that opens and closes with being noticed; the end of the reading, slowed, creeps forward from a far corner and meets him on "smile" |
| 14 Hot Minute | a door and a dance | a gate closes on "I escaped here for a reason"; on the second saying, the first returns far away with its words; two moments of him trade places on "our dance" |

Poem numbers with a score wear a gold ring; ✦ plays the score for the poem on screen.

## Revision 10 · his figure, tracked; the LiDAR places

*Obstruction in revision 9:*
- His territory was a soft circle placed by hand. It did not follow him, and it framed whatever sat near it.
- The scores reused the same few reels.
- The LiDAR scans of the ride were never used as shots of their own.

*Segmentation and tracking* (`tools/track_performer.py` → `clips/NN-matte.mp4`, `tracks/NN.json`), per reading clip at 12 fps:
1. **Detect:** pose landmarks for up to four people, each with an instance mask; faces with jaw-open; a person and clothing segmentation; an appearance embedding of each person's head and shoulders. Dark takes (01–04) are lifted with a gamma curve before detection.
2. **Cut into shots** where the colour histogram jumps.
3. **Learn him:** take frames where one person is large and in a very dark top, and average their embeddings.
4. **Choose him in every frame:** the person most like that reference (similarity > 0.62, or > 0.5 in a dark top), or the one standing figure in a wide shot. Runs shorter than five frames are dropped.
5. **Label each shot:** close, room or audience.
6. **Write outputs:** his matte (his pose mask, kept to where the segmenter sees a person, eased in time), and per frame his face centre and size, body box, shoulders, wrists and jaw.

Coverage of frames, by poem: 01 52 %, 02 52 %, 03 39 %, 04 53 %, 05 57 %, 06 57 %, 07 52 %, 08 71 %, 09 64 %, 10 75 %, 11 39 %, 12 57 %, 13 50 %, 14 55 %.
- Audience cutaways and wide room shots are correctly left empty.
- What is missed: some bright wide shots, the dark stage close-ups in 01–04, and his tiny figure in crowded room shots.
- Where he is not found, his territory falls back to the soft field. It never takes an audience member.

*In the tool:*
- **Figure** (button `fig`; score value `fg`): his matte is his territory, so he is cut out cleanly against any world.
- **Follow** (default for the reading; score value `tf`): his node follows his face.
- **Zoom** (new dial; score value `z`): reframes any source. For a tracked figure the source is mapped so that his face sits at the node, at that scale (`uv = face + (v − node)/z`). That makes a copy of him from another moment a cut-out you can place, scale and move. Outside the frame is black.
- The shader reads up to three mattes (texture units 8–10; checked against `MAX_TEXTURE_IMAGE_UNITS`).

*LiDAR shots* (`tools/lidar_shots.py`): the Atlas point clouds of kerb, neon, tunnel, fog, lanterns and the arcade, each flown three ways (**path** along its cameras, **push** a dolly in with white scan points, **rise** a crane up and over). Clean, with no words.
- `world/lidar10.mp4` holds the five ride places, 15 shots of 12 s, synced by default so each place arrives on its line.
- `world/lidar09.mp4` holds the arcade.

*Score for poem 10, rewritten:*
- He stands in the scanned kerb on "ride".
- The neon road comes in with a push on his face on "rub my aggressions".
- He is a small figure in the mouth of the tunnel on "Loneliness", and three of him are spread across the tunnel from above on "being everywhere".
- He is close on "wide-eyed", and drifting small through the fog on "wandering".
- The lantern street interferes on "the noise", and is seen from above on "eyes turn".
- On "darkness" only his figure remains, in black.
- He steps aside for the road on "a morning ahead", and springs back into his frame on "spring out of the night".
- The tunnel pushes toward its light on "a chance at an end", and the double-click punches in on his face.
- In the scores for 11–14 he is cut out and followed by default.
