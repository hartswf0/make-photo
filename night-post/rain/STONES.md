# Seven stones, each put through two machines

Each stone from the last round is run through (A) the six-principle redesign and (B) VOIDBASTARD-TAO.
Names in `code` are things that already exist in `night-post/rain/surface.js` or the game bridge.

> "I will first construct the way of the surface, then remove obstruction until the operation can proceed without force."
> VOIDBASTARD-TAO ONLINE. SHOW ONLY WHAT IS TRUE NOW.

The two machines disagree in a useful way. The six principles keep adding views; TAO keeps cutting them.
Where they collide I say which one wins and why.

---

## 1. Residue as inventory

**Component:** kept beads (`keeps[]`, `addKeep`, `restoreKeep`).
**Current behaviour:** only a deliberate drag of "Now" or a camera drop leaves a bead. Acts leave nothing. Beads never dry. Max five, oldest silently dropped.

### A. Six principles: one redesign
Every completed act deposits a bead where it happened, automatically, and beads dry unless touched.

- **Surface the invisible:** the bead's fill level is its remaining life; its tint is what kind of state it holds (cool = lens, amber = place, clear = water event).
- **Overcome limits:** you never have to remember "where was I when I filled up": the bead sits on the pump's side of the glass.
- **Multiple modes:** at rest a bead is a picture; held, it shows the delta against now ("+13 L", "−140 m").
- **Direct manipulation:** touch = go back; hold = preview (glass shows that frame, nothing changes) ; carry far = let go.
- **Semantic zoom:** beads older than a minute merge into one "earlier" bead per place; pull it and the string of its moments comes out.
- **Constrained play:** restoring a bead first drops a bead for the state you are leaving, so every return is itself returnable.

### B. TAO
1. **WAY** Actor: traveller. Object: a past state. Operation: return to it. Consequence: position and lens change. Completion: you are there; the bead you left behind is the way back.
2. **OBSTRUCTION** Auto-deposit competes with the scene: twenty acts, twenty beads. The current silent eviction of the sixth bead is a hidden loss.
3. **KEEP / CUT**
   - KEEP bead picture (true: this is what it was). KEEP dryness (true: it will go).
   - CUT the text label on the bead (duplicate of the picture).
   - CUT auto-deposit for trivial acts (Jump, Run). Only deposit when something countable changed: litres, place, plate exposed.
   - CUT the cap of five; replace with drying.
4. **STATE MAP** REST (bead, drying) → READY (finger near: delta shown) → WORKING (hold: preview) → CHANGED (released on it: you moved; a return bead appears where you were) → RECOVERY (touch the return bead).
5. **WIREFRAME**
   ```
   REST     ( ◐ )            a picture, part dry
   READY    ( ◐ ) −140 m     delta only while near
   WORKING  [ whole glass shows then ]  release = go, slide off = cancel
   CHANGED  you are there ·  ( ● ) "back" bead where your thumb was
   ```
6. **VOID CONTRACT** No bead appears unless a number changed. No bead shows words at rest. A bead never vanishes without visibly drying first.
7. **FAILURE** Restoring into a place that is now blocked (riding, mid-pour): bead refuses, says one word ("Busy"), stays wet.
8. **IMPLEMENTATION** `watchGame()` already detects litre and place changes: call `addKeep('moment', x, y)` there with x,y from `S.live` position. Add `born` and `ttl` to each keep; pass `fill: 1 - age/ttl`; drop at 0. Touching resets `born`. Hold-preview: `glass.setTimeOffset` only reaches 12 s, so preview uses the bead's stored thumbnail scaled up, not live history.

**Collision:** semantic zoom wants merged "earlier" beads; TAO says a merged bead is a container, which is a menu. TAO wins for now: let them dry instead of merging.

---

## 2. Mix two moments

**Component:** bead-on-bead collision (`combo`, `mixTick`).
**Current behaviour:** beads cannot mix with each other at all; `combo` returns null for `keep-*` pairs.

### A. Six principles
Carrying bead A into bead B makes a third state: **A's lens at B's place**. The percentage is how far along the line between the two places you will stand.

- **Surface:** while they touch, the chart's route current (`routeCurrent`) draws between the two places and a bead slides along it with the percentage.
- **Limits:** you do not compute "halfway to the archive": you slide.
- **Modes:** same gesture reads as *blend lens* when both beads are lens-only, *travel between* when both hold places.
- **Direct:** hold together = slide; release = be there. Part them = nothing.
- **Zoom:** at 0 % and 100 % it is just bead A or B; in between it is new.
- **Play:** arrival always drops a return bead (rule from stone 1).

### B. TAO
1. **WAY** Object: two kept states. Operation: choose a point between them. Consequence: you stand there with a chosen lens.
2. **OBSTRUCTION** Three possible meanings of "mix" (lens swap, midpoint, replay walk). Offering all three is a menu inside a gesture.
3. **KEEP / CUT** KEEP one meaning per pair type. CUT replay-walk (it is stone 6's job). CUT any label naming the blend; the sliding bead on the route is the label.
4. **STATE MAP** REST (two beads) → READY (touching: route appears) → WORKING (held: slider bead moves, Stop = part them) → CHANGED (released: moved; return bead) → FAULT (path point is not standable: slider bead turns amber and snaps to nearest ground).
5. **WIREFRAME**
   ```
   READY    (A)──────────(B)
   WORKING  (A)────●─────(B)   40 %
   CHANGED  you at ●  ·  (↩)
   ```
6. **VOID CONTRACT** Nothing is shown until two beads touch. Only one number. No blend of more than two.
7. **FAILURE** One bead dries mid-carry: the carry ends, nothing moves.
8. **IMPLEMENTATION** In `combo`: if both ids start `keep-`, return `{ run }` that lerps `pos` by `mix.t` and calls `B.act.warp`; take lens from the carried bead. Change `mixTick` for this pair so `t` follows hold time back and forth (ping-pong) instead of firing at 1. Needs `groundAt` exposed through the bridge to validate the point.

---

## 3. Every drop is a Steer

**Component:** all action drops (`act-*`, `aff-*`, `primary`, `can`).
**Current behaviour:** only `#steer` is continuous. Every other drop is a tap that fires once, all-or-nothing (Draw moves a fixed 20 L).

### A. Six principles
Holding a drop and leaning it is the act; how far you lean is how much; letting go stops.

- **Surface:** a strand from the drop to your finger thickens with rate; the number that is changing (litres, metres) rides the strand.
- **Limits:** no "how much?" dialog, ever. Amount = lean × time.
- **Modes:** tap still works and means "the usual amount" (today's behaviour).
- **Direct:** can leaned toward the donkey pours at that rate; leaned at the ground squirts; `Run` leaned is direction and speed.
- **Zoom:** small lean = fine (0.1 L steps), far lean = coarse.
- **Play:** during a lean the previous value ghosts on the drop; flick back past centre to return what just moved.

### B. TAO
1. **WAY** Object: a quantity. Operation: move some of it. Consequence: two numbers change. Completion: finger lifts.
2. **OBSTRUCTION** The game's water law is all-or-nothing; a partial pour is currently a lie. `Steer` and "lean every drop" compete for the same thumb.
3. **KEEP / CUT** KEEP lean on drops that own a quantity: can (litres), lens (focus), time. CUT lean on binary acts (Ride, Jump, Expose): a tap is the true shape of a binary. CUT the percentage read-out used as a commit meter in `mixTick`; it reports progress toward a threshold that only exists because the law is binary.
4. **STATE MAP** REST → READY (finger on) → WORKING (leaning: live number, lifting = Stop) → CHANGED (before → after shown on both ends) → RECOVERY (flick back, or Undo bead).
5. **WIREFRAME**
   ```
   READY    ( can 7 L )
   WORKING  ( can 5.4 )~~~~~> ( donkey 61 % )    lift to stop
   CHANGED  7 → 5.4 L      52 → 61 %     (↩)
   ```
6. **VOID CONTRACT** A drop leans only if a number moves. No amount is ever typed or picked from a list.
7. **FAILURE** Receiver full or source empty: strand snaps, the stuck end says one word, water stays where it was.
8. **IMPLEMENTATION** Blocked on the game: `runNpAction` takes no amount. Needs `B.act.pour(litres)` and `B.act.draw(litres)` in the bridge backed by a change to the water rules. Until then, do the two that are already continuous: lens (done) and time (done).

**Collision:** direct manipulation says lean everything; TAO says a binary act leaned is a false claim. TAO wins.

---

## 4. The scene answers first

**Component:** touch-to-afford (`touchThing`, `thingsOnScreen`).
**Current behaviour:** a tap is matched against six known things by screen distance; anything else is "sky" or "ground". Answers are word drops.

### A. Six principles
The tap is a ray into the world; whatever it hits answers by how water behaves on it.

- **Surface:** wetting tells material and use: beads up and rolls off = nothing to do here; soaks in and darkens = it takes water; pools and holds = it gives water; runs along an edge = it leads somewhere.
- **Limits:** no vocabulary to learn beyond what water does.
- **Modes:** tap = one drop's worth of answer; hold = keep pouring attention, further affordances well up one at a time.
- **Direct:** the pooled water *is* the control: drag out of the pool to act.
- **Zoom:** far things answer with one behaviour; near things separate into parts (donkey: mouth takes water, back takes a rider).
- **Play:** touching costs nothing and changes nothing.

### B. TAO
1. **WAY** Object: the thing under the finger. Operation: ask what it is for. Consequence: none. Completion: you know, or you act.
2. **OBSTRUCTION** Four wetting behaviours is a code to memorise. Word drops plus wetting is a duplicate claim.
3. **KEEP / CUT** KEEP two behaviours only: **pools** (you can act here) and **runs off** (nothing here). KEEP the one-word verb, but only on a pool, and only while the act is valid. CUT "Closer" as a drop: show it as the pool being too small to grab, and let the guide rain (stone 5) fall between you and it. CUT sky and ground as targets unless an act is valid there.
4. **STATE MAP** REST (scene) → READY (tap: pool or run-off) → WORKING (dragging from the pool) → CHANGED → exit by tapping elsewhere or 7 s.
5. **WIREFRAME**
   ```
   tap pump     ◯ pool forms on spout · "Draw"
   tap wall     ' ' ' runs off, gone in a second
   tap far pump  ·  pool too small to hold; rain marks the ground between
   ```
6. **VOID CONTRACT** A tap on nothing useful leaves nothing on the glass after one second.
7. **FAILURE** Ray hits nothing (sky): no response at all. Empty regions remain inactive.
8. **IMPLEMENTATION** Needs `B.pick(x, y)` in the bridge: a three.js raycast returning `{ kind, id, point, dist }`, with the cast, pump, donkey, wagon tagged via `userData`. Run-off is `splash()` with gravity only and no rings. Pool is a short-lived `sceneWaters()` entry at the hit point so the existing grab-and-carry works on it unchanged.

---

## 5. Rain as the tutor that never speaks

**Component:** guide drops (`guideTick`).
**Current behaviour:** every 3.4 s one drop falls onto a usable thing in view, round-robin, regardless of how much it matters.

### A. Six principles
How hard it rains on a thing is how much it matters now.

- **Surface:** need becomes weather: a collapsed donkey stands in a private downpour; a reached stop is dry.
- **Limits:** the quest order is not held in your head or in a list.
- **Modes:** on the glass it is falling drops; on the chart the same weights are the size of each stop's drop.
- **Direct:** wipe the rain off a thing to snooze it; it returns when the need grows.
- **Zoom:** off-screen need shows as rain slanting in from that edge.
- **Play:** ignoring the rain is always allowed; it only gets heavier, never blocks.

### B. TAO
1. **WAY** Object: the next thing worth doing. Operation: notice it. Consequence: you turn toward it.
2. **OBSTRUCTION** The game already draws its own rain; a second meaningful rain inside it will read as weather, not signal. Steady rain on everything usable says nothing.
3. **KEEP / CUT** KEEP rain only on the single most needed thing. CUT round-robin. CUT guide rain entirely when the needed thing is already under your hand (a pool is showing). CUT wipe-to-snooze: a hidden mode with no visible trace.
4. **STATE MAP** REST (no need: no guide rain) → READY (one need: steady drip on it) → urgent (donkey down: downpour) → COMPLETE (need met: it stops; no reward burst, completion creates no new demand).
5. **WIREFRAME**
   ```
   calm      .                 one drop every few seconds on the pump
   urgent    ||||||            sheet of rain on the donkey, slanting from the left edge if off-screen
   met       (nothing)
   ```
6. **VOID CONTRACT** At most one thing is rained on. If nothing is needed, the guide rain is silent.
7. **FAILURE** Needed thing is behind you: rain slants in from the screen edge nearest it; never a marker or arrow.
8. **IMPLEMENTATION** Score in `guideTick`: donkey down = 10, donkey thirsty with water in the can = 6, empty can near source = 5, next stop = 2. Interval = `3400 / score`. Use `S.things[x].front` and screen x to pick the edge for off-screen targets. Colour the guide drops slightly warm so they separate from the game's cyan rain.

---

## 6. The worm

**Component:** a hanging strand of frames per action (not built; the three trailing beads under menu drops are only a marker).
**Current behaviour:** time is one global scrub on "Now", 12 s deep (`createWeatherMemory`, `glass.setTimeOffset`).

### A. Six principles
Each act that takes time grows a strand; each segment is a frame of that act; pulling the strand is scrubbing that act alone.

- **Surface:** you see the steps of a pour laid out: reach, tilt, stream, done, with the litres at each.
- **Limits:** "how much had I poured when I stopped?" is a segment you can look at.
- **Modes:** the strand hanging = history; the strand still growing at its tip = the act is live.
- **Direct:** pull down = forward, push up = back; pinch the strand at a segment to stop the act there.
- **Zoom:** a short act is three segments; a long walk is three segments too, each a third of it; pull one and it splits into its own three.
- **Play:** stopping at a segment is the Undo for everything after it.

### B. TAO
1. **WAY** Object: one act in progress or just done. Operation: see its steps; stop it at one. Consequence: the act ends there.
2. **OBSTRUCTION** A strand for every act is a second inventory (stone 1 already is one). Scrubbing an act backwards implies it can be undone step by step, and the game cannot do that.
3. **KEEP / CUT** KEEP the strand only while the act is WORKING, on the drop that started it. KEEP pinch-to-stop (Law 7: active work exposes Stop). CUT the strand the moment the act completes: what remains is one bead (stone 1). CUT backward scrubbing of state; looking back along the strand is read-only, same contract as "Now".
4. **STATE MAP** READY (Draw) → WORKING (strand grows from the drop, segment per second, live litres) → Stop (pinch) → CHANGED (strand retracts into a single bead holding before → after).
5. **WIREFRAME**
   ```
   WORKING   (Draw)
               ○ 4 L
               ○ 9 L
               ◉ 13 L …      pinch = stop here
   CHANGED   ( 0 → 13 L )     one bead; strand gone
   ```
6. **VOID CONTRACT** No strand exists unless something is in progress. Never more than one strand.
7. **FAILURE** The act is interrupted by the game (you walked off): strand snaps at the last full segment and becomes the bead with what actually moved.
8. **IMPLEMENTATION** `demo.handoff` is the only timed act today and `S.busy` reports it. Capture a 112 px thumbnail each 0.5 s while `S.busy` into an array; render as chained bodies under `primary` through the membrane (`msTick` sources) and `picTick`. Stop needs `B.act.stopHandoff()` in the bridge, and is only truthful once stone 3's partial amounts exist. Without that, build the strand as read-only progress.

**Collision:** semantic zoom wants recursive strands; TAO allows one strand, three segments deep at most. TAO wins.

---

## 7. The menu dissolves

**Component:** the edge menu (`GROUPS`, `menuList`).
**Current behaviour:** five words (Go, Water, Camera, Talk, More), each opening four to six entries; twenty-odd entries in all, most of which are also reachable by touching things.

### A. Six principles
Move every entry to the thing it changes; what cannot be moved becomes one drop for the surface itself.

- **Surface:** what is left in the menu is exactly the set of things that have no place in the scene: sound, language, motion, rest.
- **Limits:** nothing to recall about which group holds what.
- **Modes:** the edge is no longer a menu but a seam: pull it and the glass itself comes forward (settings *of the glass*).
- **Direct:** sound = lean the seam drop up and down (volume); language = pull it sideways (cycles, the next line you hear proves it).
- **Zoom:** none needed; four things.
- **Play:** every one of the four is a toggle or a dial; nothing here can lose anything.

### B. TAO
1. **WAY** Object: the surface. Operation: change how it speaks and moves. Completion: it has changed; close.
2. **OBSTRUCTION** Duplicates: Jump, Run, Ride, Glide, Wagon, Squirt, Throw, Say, Map, Expose all exist on things already. "Everything" (33 paged controls) is a claim that the design failed.
3. **KEEP / CUT**

   | Entry | Verdict | Where it goes |
   |---|---|---|
   | Jump, Run, Glide | CUT from menu | touch yourself |
   | Ride, Wagon | CUT | touch donkey / wagon |
   | Squirt, Throw, Can, Donkey | CUT | the can drop, the donkey |
   | Map | CUT | the next-stop drop |
   | Expose, Lens, Rig, View | CUT | one camera drop at the eye-point, leaned |
   | Say, People, Voices | CUT | touch a person; their voice drop |
   | Sound, Language, Hold rain, Rest | KEEP | the seam |
   | Words | CUT | conflicts with the ink rule; words come on approach |
   | Weather | CUT | touch the sky |
   | Everything | CUT | a debug query flag, not a surface |

4. **STATE MAP** REST (seam, faint) → READY (pulled: four drops) → CHANGED (the change is audible/visible at once) → exit (touch the world).
5. **WIREFRAME**
   ```
   REST   ⎸                         a wet seam at the right edge
   READY  ⎸ ◯ sound  ◯ tongue  ◯ still  ◯ rest
   ```
6. **VOID CONTRACT** The seam never holds an act that has a place in the scene. If a new act is added to the game, it must name the thing it lives on or it does not ship.
7. **FAILURE** An act's thing is nowhere in view and the player needs it (Wagon when the wagon is 200 m off): the guide rain (stone 5) slants from its edge; the menu is not the fallback.
8. **IMPLEMENTATION** Delete `go`, `water`, `camera`, `talk` from `GROUPS`; rename `more` to the seam and cut it to four. Requires stone 4's pick so every cut act is reachable on its thing, and a persistent camera drop. Keep `?rain=1` and a `?controls=all` flag for the paged list.

---

## What the two machines agree on, across all seven

1. **Quantities lean, binaries tap.** (3)
2. **One of each at a time:** one strand, one rained-on thing, one number on a mix. (2, 5, 6)
3. **Every change leaves exactly one bead, and the bead is the Undo.** (1, 2, 6)
4. **Nothing lives in a list if it has a place in the scene.** (4, 7)

## Order that the dependencies force

| Step | Stone | Why here | Blocked on |
|---|---|---|---|
| 1 | 5 rain weights | small, self-contained, makes the rest discoverable | nothing |
| 2 | 1 auto-beads that dry | gives 2 and 6 their output object | nothing |
| 3 | 4 ray pick + pools | lets 7 cut the menu | bridge: `B.pick` |
| 4 | 7 seam | pure deletion once 4 lands | step 3 |
| 5 | 2 bead mixing | needs beads to be common | step 2, bridge: `groundAt` |
| 6 | 3 partial amounts | changes the game's water law | game rules, not the surface |
| 7 | 6 strand with Stop | only truthful after 3 | step 6 |

Steps 1 and 2 need no game changes and can be built now.
