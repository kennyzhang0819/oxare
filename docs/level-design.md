# Level design

What the classic levels (`01`–`17`, rebuilt from the original game) and Advanced tubes (`n01`), all in Archive, do, measured from their files and from headless runs of the physics, so new levels can follow the same vibe. Update this as more classics are rebuilt: the classics are the reference for the props, the numbers and the placement, but not for the shape of a level (below).

## The shape of a level

New levels (Basics onward) are not the classics' long lanes. A level is a small environment, a patch of overgrown ruin the player can take in from the start, built up rather than out, and played for finding its apples and bringing them home.

- **Small footprint.** The whole level fits in about 40×40 of grid (B2 is about 40 by 48). There is no long run from start to finish.
- **Stacked, not spread.** Height is the main axis. Decks sit 4 or 5 up on supports and columns over the ground floor, reached by kickers, jump pads, ramps, rails and tubes, and left by a drop, a hole or a tube. One footprint holds two to four floors, and the same spot seen from above and from below is two different places.
- **Apples hidden in the space.** Each apple is where finding it is the puzzle: on a deck above the start, under an overhang, past a hole on an upper floor, behind a wall. Getting there is half of it; every apple needs a way back down to the origin.
- **A golden apple for the bold.** Optional, so it can ask more than the level does: a hard jump, a narrow ledge, the long way round. It still needs a way home, since it only counts once it comes back.
- **Short loops from the origin.** The origin sits near the middle where the routes cross, and each apple is a short excursion out and back rather than a stop on one long route.
- **The classics' numbers still hold.** Kicker and jump pad ranges, gaps, run-ups and placement below are what a stack is built from; the classics' lane lengths and rhythm are not.

## Units and speeds to design against

- A lane is 8 wide; a balance beam is 4. The ball is 1.0 across, 0.5 radius.
- Full speed is about 6.85 (`maxSpeed`, 6.9; damping holds the ball just under it). From rest the ball reaches it in about 2 s and 8 units of straight lane, so a prop that needs full speed wants 9 or more units of run-up after a curve or a landing.
- Forward is assumed held through the air. The player's push keeps working off the ground, so a ball that keeps pushing holds full speed in flight; one that lets go is slowed by damping and falls short. Every classic gap is sized for forward held, and this table is too.

| off a kicker, forward held | 1-high (standard) | 1.5-high (the long kicker's slope) |
|---|---|---|
| ball centre above the floor for the first 3 units past the top edge | ~1.7 | ~2.3 |
| lands past the top edge at full speed | 7.7 | 9.6 |
| lands past the top edge at speed 5 | 5.1 | 6.4 |
| lands past the top edge with forward released once airborne | at most 4.1 | at most 4.3 |

A kicker's top edge sits 0.5 in from the platform edge when the kicker is placed the classic way (below), so "past the top edge" is 0.5 more than the gap it crosses. A 1-high kicker therefore carries a 4 gap at speed 5 and up, and only just at full speed with forward released; a 6 gap needs speed 5.5 and forward held; an 8 gap is full speed only.

| jump pad, forward held, lands past the pad's centre | speed 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|
| rise 6 (the default) | 9 | 13 | 16 | 19 | 22 | 25 |
| rise 8 | 11 | 15 | 19 | 23 | 26 | 30 |

Released once airborne, a jump pad lands the ball only 3 to 6 past its centre whatever the rise. A pad fires for anything that crosses its launch square, a ball landing from a kicker shot included: a 1.5-high kicker with a hurdle in front of a pad 9.5 past its top edge fires the pad at any hurdle-clearing speed, as long as the ball is within 0.5 of the pad's centre line, and the relaunch lands 14 to 18 past the pad on a platform 4 up. The pad launches straight up and keeps the ball's level speed, so the landing distance is all speed control: the classics use this for a 4 gap and 4 up (speed around 4 to 5), an 8 gap level (full speed, rise 8), and a 20 gap dropping 4 (full speed).

What stops a rolling ball and what does not:

- A fence rail (0.6 up) turns a rolling ball back, but a ball hugging the lane edge can slip past a fence laid across a lane where the rail runs over the rounded lip. Use fences along edges, not as a gate across a lane.
- Barriers (1.4 tall pods) placed 2.75 apart seal an 8 lane end to end. A 1.5-high kicker clears a row 2.5 past its top edge at any speed (even with forward released above 4); a 1-high kicker cannot clear one at all. A hurdle whose slab ends 3 past the kicker's top with a 4 gap needs speed 5.5 with forward held, and an 8 gap off a 1.5-high kicker needs 6.5. Blockades (1.5) and rolled crates (2 tall on their side) are too tall to clear off a 1-high kicker, which only lifts the ball's bottom about 1.2 above the floor.
- A wall (a slab rolled 90) with a window (a hole given `tilt` 90 on the wall's face, the `n01` recipe: the wall's face is at its own z and the hole sits at that same z) holds a rolling ball as long as the window's sill is at least 1 above the floor. A 1.5-high kicker 4 before the wall with a 2×2 window centred 2.75 up makes a window shot that needs speed 5 with the ball within 1 of the kicker's centre line; a 1.5 window needs 5.5 and within 0.75. Forward released in the air hits the wall every time.

## Anatomy of a classic level

- **Opener.** The start pad at the origin on an 8×16 slab with 12 units of lane ahead (13 of 17 classics use exactly `slab x0 y0 z-4 w8 d16`). The first prop comes after that first slab, never on it, except a jump pad at its far end.
- **One idea per 16-slab.** The default slab is 8×16 and a section is one slab holding one prop, with the rest of the slab as run-up or landing. Two ideas in a row get a 24 or 32 slab. Big arenas (24×24, 24×16, 60×60 floors with columns) are for a single set piece.
- **Curves are the rest beats.** Every 90° curve is 8/16 (inner/outer) and about 20 units of pure rolling. A C curve (sweep 180) is a hairpin; a 3/4 curve (sweep 270) brings the run back across its own entry line, heading the way the entry's right-hand side pointed, so it loops round a set piece. Levels turn after nearly every obstacle section, so a run is obstacle, turn, obstacle, turn.
- **Height.** Ramps rise 4 over 24 or 32 (one or two per level), and jump pads or knocked planks climb 4 at a time. Supports stand under a raised slab's near edge wherever a lower platform is next to it; raised slabs with nothing below just float, which is normal.
- **Apples and the way home.** A level is played for its apples (usually 3) and ends back at the origin. In a classic, rebuilt as a long lane, the apples go where reaching one is the point of a section, the old goal spot being a natural place for the last, and the way home is the lane run backwards. A new level keeps its apples close and stacked instead (see "The shape of a level").

## Rhythm and length

The classics alternate obstacle sections with calm rolling. Level 01: opener (calm), pillars, blockades, barrier gates, calm, goal (now the last apple). Level 06: jump, jump, plank, calm, arena, jump, jump, calm, curve, crates, beam, jump, kicker, beam, plank, goal. The pattern is one obstacle per slab with the curves and a plain slab or two as breath. A classic lane is 200 to 350 units long, 35 to 90 seconds for a clean adventure run; the opener and the goal stretch are always calm. A new level is far smaller: its rhythm is a few short loops out from the origin and back, each with one or two ideas on it, and the calm beats are the origin and the decks between climbs.

Levels sit on a spectrum from adventure to puzzle. An adventure level is flow: kickers, jumps, curves, banked slabs, a few fixed obstacles, nothing to push. A puzzle level makes the ball push things (crates, stools, sliding kickers, knock-down planks, barrels), and every push multiplies the time: lining up behind a prop, pushing it a few units, backing off and going round. Pushable sections take several times longer than the same lane length of flow, so a level with two or three pushes is already much longer than its lane suggests. Most levels sit in the middle or toward the adventure end with few pushables; the extreme puzzle levels (the originals' 18 and 28, not rebuilt yet) have the ball push blocks from far back along the level to open a gate, and run many times longer than an adventure level. Place a level on this spectrum on purpose and size its length to match.

## Which props a level brings in

Each classic is named for one headline prop and adds three to five supporting ones; nothing uses everything. Supporting props are the connective tissue: kickers and jump pads cross gaps and steps in nearly every level after 06, curves turn, crates and barriers make gates.

| level | headline | prop types used | supporting |
|---|---|---|---|
| 01 Blockades | blockade | 4 | pillar, barrier, crate |
| 02 Planks | knock-down plank | 5 | bridge, barrier, pillar, blockade |
| 03 Ramps | ramp | 4 | hole, kicker, plank, support |
| 04 Tubes | tube | 5 | ramp, seesaw, kicker, mover |
| 05 Rails | rails | 7 | barrier, side plank, stool, kicker, ramp, mover |
| 06 Jumps | jump pad | 6 | support, plank, stool, long kicker, crate |
| 07 Flipped | rolled slabs | 7 | plank, rails, ramp, jump, twist, barrier |
| 08 Rings | hoop | 8 | ramp, long kicker, stool, jump, column, hole, rails |
| 09 Puffers | puffer | 10 | ramp, barrel, side plank, blockade, jump, pillar, kicker, mover, sliding kicker |
| 10 Basics combined | mix | 8 | twist, roll, jump, kicker, mover, bridge, rails, plank |
| 11 Wrecking cube | (its gate is removed) | 9 | side plank, puffer, jump, rails, hole, roll, kicker, crate |
| 12 Tubes 2 | tube | 7 | mover, hole, ramp, rolled puffer, treadmill, kicker |
| 13 Wall jumps | wall and side kicker | 10 | jump, roll, barrier, crate, seesaw, rails, puffer, support |
| 14 Magnets | magnet | 12 | mover, fence, kicker, plank, side kicker, shaped slab, support, crate, rails, jump, wall |
| 15 Beans | bean | 10 | ramp, jump, barrier, kicker, rolled crate, plank, roll, puffer, column |
| 16 Jumps 2 | jump pad | 11 | ramp, stool, column, mover, sliding kicker, barrier, rails, kicker, twist, roll |
| 17 Big C | rolled C curve | 10 | wall, side kicker, twist, support, roll, jump, kicker, glass, hole |
| n01 Advanced tubes | tube | 11 | ramp, jump, wall, hole, support, twist, rolled C, roll, mover, kicker |

Early levels use 4 to 6 types, later ones 8 to 12, but the extra types are mostly the same connective props again. A new level: pick the headline, pick two or three ways to play with it, and connect with kickers, jumps and curves.

## Placement rules, as the classics do them

Structures snap to a 2 grid, so most of these are "one grid step from the edge".

- **Kicker:** centred on the lane, its centre 2 units in from the edge it fires over, so its top edge is 0.5 from the lip (03, 06, 10, 11, 12, 14). It fires across a 4 gap, onto a 4-wide beam, or up one layer over a 4 gap (10). A plain kicker at one height (no roll, tilt or height change) crosses an 8 gap at most, at full speed; 4 is the everyday gap. A long kicker (`flat` 6, h 1.5) sits mid-arena and the ball rolls off its deck level.
- **Sliding kicker and stool:** the track runs from where the piece starts to where it has to end up: one end of the track is the start and the other end is the finish, almost always, and `offset` puts the piece at the start end. The track is never centred on the finish with the piece pushed to the middle; its length is the distance between the two spots plus the piece's width (09, 16).
- **Jump pad:** 4×4, centred on the lane with its edge 2 from the platform edge (centre 4 in) (06, 08, 13, 15, n01), or dead centre of a 6×6 island (16). Rise 6 by default, 8 for the one 8 gap, 4 for island hops. Barriers right behind a pad wall the lane off so the jump is the only way (15).
- **Blockades (2×2):** in an 8 lane, staggered pairs at ±2 from the centre leave a 2 gap between them, a single one at the centre leaves 3 each side; 12 apart along the lane (01).
- **Pillars (r 0.6):** pairs 2 off centre leave a 2.8 gap in the middle, a single one at the centre leaves 3.4 each side; 8 apart (01).
- **Barriers (2.5 wide):** rows across a lane at a 3 pitch, with a crate in one slot as the pushable door (01, 13); pairs at ±1.5 to wall off a jump (15).
- **Puffers (r 0.95, rings out to 5):** a slalom pair in an 8 lane, one 1 off centre each way, 6 apart (13); a triangle on a 12×12 arena (09). These were bumpers: they now blow the ball away every 3 seconds instead of bouncing it, so a pair across a lane blows a passing ball toward the edges.
- **Holes:** 3×3 staggered ±2 on an 8×8 (03), 2.5 in a triangle (08), 4×4 zig-zag on 8×18 (12).
- **Beans:** a straight bean sweeping across an 8 lane (path 5 long across it), two of them 8 apart running opposite ways (15); loops round columns.
- **Side kicker and wall:** the wall is a slab rolled 90 standing 1 outside the lane edge (its face 0.5 off), the side kicker's wall side on the lane edge (13, 17).
- **Rails:** side end on a higher platform down to a top end on a lower one, 13 to 16 long, or side to side between slabs at one height (05, 10, 11).
- **Twist and roll:** a slab twisted 30 feeds a slab rolled 30, with a rolled jump pad on it to throw the ball sideways (10, 16, 17).
- **Moving platforms:** 4×4 pingpong over 4 at speed 1 to 3, in pairs or threes as stepping stones (04, 05, 09, 10, 12); a 6×6 over 10 or 16 as a ferry (12, 16, n01).
- **Pangolin:** 8 long over a 4 gap with its snout 3.5 in from the near edge, so its coil sits on the platform and its tail tip lands 0.5 onto the far one. The ball touching it stops dead, then follows it across; at the default speed it is down in about 1.6 seconds. Laid out, a ball at full speed rolls over it with under 0.05 of lift. Its path can turn and climb: give the corner a bend and keep the climb over the gap, so the laid body never cuts into a platform's top; a ball held to about 3 a second follows it round a 90° corner that rises a layer.
- **Knock-down plank as a ramp up:** an 8-tall plank standing on a low ledge 6 from a slab 4 higher leans on it at 30° when knocked (14).

## Harder twists (what `n01` changes)

Harder levels raise the aim and timing demands on classic parts rather than adding parts: a tube mouth turned up so the jump pad shot must drop into it; a kicker onto a moving platform and a jump pad riding it, so the launch has to be timed; a window in a wall the ball drops through from a tube; a slab twisted 90 from wall to floor. The connective parts stay classic.

## Mechanisms the pieces allow

Structures that only appear when pieces are combined, each measured headlessly. Damping (0.8) caps a free-falling ball near 6.3, so nothing built on stored energy returns the ball to the height it started from; design these for the speeds below, not for textbook physics.

- **Quarter-pipe launch.** A slab 5 deep curled 90 (radius 3.2) ridden at speed 6 or more throws the ball 0.8 to 1.3 above its lip; with forward held it flies over the lip and lands on a slab whose top is at the lip's height (y 3) starting half a unit to one unit behind the pipe's vertical face. Below speed 6 the ball rolls back down. A pipe 8 deep (radius 5.1) ridden at full speed with forward held also throws the ball over its lip, about 0.6 above it.
- **Tube cannon.** A tube that drops 8 straight down from a platform edge, bends through a U and climbs 2 over 2 before its mouth fires the ball out of the upturned mouth at about 5.4 and 37°, whatever speed it rolled in with. It lands about 15 past the mouth on a floor 4 lower, so the catch is a 16-slab from 10 to 26 past the mouth, 4 down.
- **Domino planks.** Frozen 8-tall planks at a 6 pitch knock each other over: nudge the first, and each tip wakes the next, a plank falling every 2 to 3 seconds under the props' gravity. The last one, 0.5 from the edge, bridges a 6 gap (3 planks bridge 7). The ball then rolls the flat planks as a crossing. Budget about 10 seconds of watching.
- **Bean kick.** A bean running along a lane toward a platform edge, its last node 1 before the edge, kicks a ball parked at the edge (centre 0.5 to 1 in from the lip) across a gap: at bean speed 6 about 6 past the edge onto a slab 2 lower, at speed 8 about 9, at 10 about 11; at the same height only 4. The ball must be parked still, right at the lip, and the lane must be wide enough to pass the bean on the way there.
- **River.** A treadmill laid across the lane (rot 90, 16 deep, 24 wide) drifts a ball crossing at full speed only about 2 downstream, 3 if 24 deep, because the push dominates the belt. Steering through it is easy; it reads as a current and sets up an exit beam placed a little upstream.
- **Lift.** A 4×4 mover with a stop 8 straight up carries a parked ball (speed 2, about 4 seconds up). It only works if the ball is on it when it leaves, so give it a wait of 4 or more at the bottom and 3 at the top, and expect the player to wait for it.
- **Helix slide: does not work.** A tube wound round a column at 16° to 28° pitch stalls the ball within half a turn, smooth or with rounded corners. Keep tube descents to straight drops and single bends.

## Checklist for a new level

- A compact footprint (about 40×40) built up in layers, the origin near the middle with clear floor round it, apples placed (usually 3) in its nooks and on its upper decks, each with a way back down to the origin.
- One headline prop, two or three things to do with it, kickers, jumps and curves to connect.
- Kickers 2 in from the edge, jump pads 2 off the edge, barriers at a 3 pitch, structures on the 2 grid, platforms on the 0.5 grid so the floor welds.
- 10 or more of straight run-up before any shot that needs speed; a landing 2 or more before the next foot.
- Every gate sealed: roll a ball at it along the centre and both edges. Every shot checked at the lowest speed a player will plausibly have.
- `npm run check`, then play it: the sim finds broken floors and unreachable gaps, only play finds whether it feels right.
