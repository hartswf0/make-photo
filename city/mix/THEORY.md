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
