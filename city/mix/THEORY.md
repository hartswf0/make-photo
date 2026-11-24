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
