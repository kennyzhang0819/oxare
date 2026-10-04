// Units: 1 on x/z is one placement-grid cell; 1 on y is one platform thickness, which is
// also one height layer, so platforms stack at whole-number y. The ball stands a little
// taller than a platform.
export const PLATFORM_THICKNESS = 1;
// The rounded lip on every platform edge, in the visuals and the physics floor alike:
// a wide, shallow quarter-ellipse, `INSET` in from the edge and `DROP` down to the wall.
export const PLATFORM_EDGE_INSET = 0.45;
export const PLATFORM_EDGE_DROP = 0.28;
// Where two platforms meet, the physics floor's lip only dips this far, so the seam is a
// shallow groove the ball rolls through instead of a ledge it strikes; the visuals keep the
// full lip. Open edges keep PLATFORM_EDGE_DROP so they still round away.
export const PLATFORM_SEAM_DROP = 0.015;
// The drawn lip, as platform.ts takes it; `border` is the light strip's width on the lip.
export const PLATFORM_LIP = { inset: PLATFORM_EDGE_INSET, drop: PLATFORM_EDGE_DROP, border: 0.04 };
export const BALL_RADIUS = 0.5;
export const SPINNER_HEIGHT = 0.6;
export const SPINNER_WIDTH = 0.4;
export const BLOCKADE_W = 2, BLOCKADE_H = 1.5, BLOCKADE_D = 2;
export const PILLAR_R = 0.6, PILLAR_H = 2.6;
export const BARRIER_W = 2.5, BARRIER_H = 1.4, BARRIER_D = 0.5;
// A barrier is a rounded pod BARRIER_LEG off the surface on two legs, the pod's top at BARRIER_H.
export const BARRIER_LEG = 0.16, BARRIER_R = 0.2, BARRIER_LEG_R = 0.12, BARRIER_LEG_X = BARRIER_W / 2 - 0.85;
// Corner rounding of a block and a blockade, drawn and solid alike.
export const BLOCK_R = 0.3, BLOCKADE_R = 0.18;
// The soft look's props are animals (scene.ts), and what stands out of the lab prop's solid is laid
// out here so the physics builds it too. The blockade is a bunny, rounded BUNNY.r with a tall
// rounded-box ear on each top corner. The barrier is a fish on one stick. The pillar is a giraffe: a neck GIRAFFE.neck tall carrying a ball head with a
// muzzle, two round ears and two knob horns, in place of the lab pillar's collar and dome (pieceBalls).
// A fence is a snake with its head on the surface at its first end (snakeHead).
export const softProps = (): boolean => ENV.props === "soft";
export const BUNNY = { r: 0.3, ear: { w: 0.42, h: 0.9, d: 0.32, x: 0.55, r: 0.14 } };
// The kicker is a turtle: a head out of its high wall (local -z), TURTLE.head.y of its height up, and
// a foot at each side corner. The bumper a ladybug: a head at +z. The magnet an octopus: OCTOPUS.arm.n
// arm stubs round its foot. All balls, in pieceBalls. The jump pad is a frog, but the ball crosses a
// pad anywhere, so its eyes are flat on its top, FROG.eye.r round and FROG.eye.in from its +z corners.
export const TURTLE = { head: { r: 0.26, out: 0.12, y: 0.45 }, foot: { r: 0.14, y: 0.12 } };
export const FROG = { eye: { r: 0.2, in: 0.4 } };
export const LADYBUG = { head: { r: 0.3, y: 0.3, z: 0.95 } };
export const OCTOPUS = { arm: { r: 0.2, at: 0.95, y: 0.15, n: 8 } };
// The movables' parts that stand out of their bodies, relative to the body's centre and carried with
// it: the pig's (stool's) ears on top, the cow's (crate's) ears out of its sides and horns on top, the
// owl's (barrel's) tufts sunk into its cap. The
// penguin's (column's) beak stands out of its front near the top.
export const PIG = { ear: { r: 0.14, in: 0.3, up: 0.06 } };
export const COW = { ear: { r: 0.15, out: 0.02, down: 0.18, back: 0.35 }, horn: { r: 0.09, x: 0.3, up: 0.1, back: 0.45 } };
export const OWL = { tuft: { r: 0.1, x: 0.24, up: -0.08 } };
export const PENGUIN = { beak: { r: 0.12, down: 0.45 } };
export const GIRAFFE = { head: 0.6, headY: PILLAR_H - 0.6, neck: PILLAR_H - 0.6, muzzle: { r: 0.3, y: -0.22, z: 0.42 }, ear: { r: 0.14, x: 0.6, y: 0.22, z: -0.05 }, horn: { r: 0.1, x: 0.24, y: 0.58, z: -0.05 } };
export const CRATE_W = 2, CRATE_H = 1.2, CRATE_D = 2;
// Cube: the gate's cube as a pushable prop of its own, the ball's size on a side, rounded by propRound.
export const CUBE_S = 2 * BALL_RADIUS;
// Barrel: a crate that is an upright cylinder, radius r and h tall, its rims rounded by propRound.
export const BARREL_R = 0.4, BARREL_H = 1.4;
// The barrel's outline as [radius, y] about its centre, bottom centre round to top centre: the same
// rounded cylinder the physics uses (a cylinder grown by the rounding radius).
export function barrelProfile(r: number, h: number): [number, number][] {
  const rr = propRound(2 * r, h, 2 * r), n = 6, out: [number, number][] = [[0, -h / 2]];
  for (let k = 0; k <= n; k++) { const a = -Math.PI / 2 + (k / n) * (Math.PI / 2); out.push([r - rr + rr * Math.cos(a), -h / 2 + rr + rr * Math.sin(a)]); }
  for (let k = 0; k <= n; k++) { const a = (k / n) * (Math.PI / 2); out.push([r - rr + rr * Math.cos(a), h / 2 - rr + rr * Math.sin(a)]); }
  out.push([0, h / 2]);
  return out;
}
// Corner rounding of a crate or stool of the given size, drawn and solid alike.
export const propRound = (w: number, h: number, d: number): number => Math.min(0.08, w / 2, h / 2, d / 2) * 0.99;
// A crate is rounded much more than other props, drawn and solid alike.
export const crateRound = (w: number, h: number, d: number): number => Math.min(0.22, w / 2, h / 2, d / 2) * 0.99;
// The spinner's fixed hub, the goal's disc and the glow ring round it, and the bridge's hinge
// barrels and wall lugs: all drawn and solid alike.
export const SPINNER_HUB_R = 0.35;
export const GOAL_DISC_H = 0.1, GOAL_RING = { gap: 0.06, tube: 0.07, y: 0.08 };
export const BRIDGE_BARREL = { r: 0.06, inset: 0.25 }, BRIDGE_LUG = { w: 0.22, h: 0.26, d: 0.4, r: 0.04, x: 0.45, z: 0.12 };
// A pillar: its body up to the cap, a collar and a squashed dome on top, and a glow ring round its foot.
export const PILLAR_CAP = 0.3, PILLAR_COLLAR = { r: 0.05, h: 0.12 }, PILLAR_RING = { r: 0.04, h: 0.12 };
// Stool: a block that slides on a track along its local x only, `track` long and centred on its
// (x, z); it starts `offset` along the track from the centre. Two wide, one thick, by default.
export const STOOL_W = 2, STOOL_H = 1.2, STOOL_D = 1, STOOL_TRACK = 8;
// Jump pad: a low `w` by `d` platform JUMP_H tall, a JUMP_RUN ramp up to its flat top on every
// side, with a square launch pad in the middle of the top, a JUMP_PAD share of the pad's smaller
// side across. Only the launch pad throws the ball `rise` layers up; its speed over the ground
// is kept.
export const JUMP_W = 4, JUMP_D = 4, JUMP_RISE = 6, JUMP_PAD = 0.3, JUMP_H = 0.35, JUMP_RUN = 1;
export const jumpPadSize = (p: Piece & { type: "jump" }): number => JUMP_PAD * Math.min(p.w, p.d);
// The launch zone is the column over the launch square up to its top hovering square, this high
// above the pad's top, so a ball cresting the short ramp and skimming over the square still counts.
export const JUMP_REACH = 0.5;
// The jump pad's solid, drawn and in the physics alike, a kicker's way (kickerHull): two plan
// outlines with rounded corners, the base's corner radius JUMP_CORNER of the smaller side and the
// top the base brought in by JUMP_RUN, pulled in by `r` and rounded back out by `r`. The ramp
// carries on KICKER_SINK below the surface so it meets the floor in a sharp crease. The base's corner
// radius stays past JUMP_RUN so the top keeps round corners and each ramp corner is a true cone.
export const JUMP_CORNER = 0.28;
export const jumpCorner = (p: Piece & { type: "jump" }): number => Math.max(Math.min(p.w, p.d) * JUMP_CORNER, JUMP_RUN + 0.12);
export function jumpHull(p: Piece & { type: "jump" }, round?: number): { corners: [number, number, number][]; r: number } {
  const r = round ?? propRound(p.w, JUMP_H, p.d), rb = jumpCorner(p), len = Math.hypot(JUMP_H, JUMP_RUN), n = 12;
  // The top outline moved out by u, at height y.
  const ring = (u: number, y: number): [number, number, number][] => {
    const w = p.w - 2 * JUMP_RUN + 2 * u, d = p.d - 2 * JUMP_RUN + 2 * u, rr = Math.max(0, rb - JUMP_RUN + u), out: [number, number, number][] = [];
    for (const [sx, sz, a0] of [[1, 1, 0], [-1, 1, 90], [-1, -1, 180], [1, -1, 270]] as const) {
      const cx = sx * (w / 2 - rr), cz = sz * (d / 2 - rr);
      for (let k = 0; k <= (rr > 0 ? n : 0); k++) { const a = ((a0 + (90 * k) / n) * Math.PI) / 180; out.push([cx + rr * Math.cos(a), y, cz + rr * Math.sin(a)]); }
    }
    return out;
  };
  // Where the pulled-in top meets the pulled-in ramp, and the pulled-in ramp meets the pulled-in bottom.
  const top = (r * (JUMP_RUN - len)) / JUMP_H, toe = (JUMP_RUN * (JUMP_H + KICKER_SINK) - r * (len + JUMP_RUN)) / JUMP_H;
  return { corners: [...ring(toe, r - KICKER_SINK), ...ring(top, JUMP_H - r)], r };
}
// The goal portal takes the ball once its centre is within GOAL_PULL of the disc's centre and no
// more than GOAL_REACH above the disc's top, so a ball hopping over the rim still counts.
export const GOAL_PULL = 0.75, GOAL_REACH = 1;
// Every goal pad is this radius; a level's own `r` is ignored.
export const GOAL_R = 1;
// The start pad: a low disc like a nest, its centre carved into a shallow bowl the ball spawns in.
// START_PAD_H is the rim's height; the bowl is START_PAD_BOWL across in radius and START_PAD_DIP
// deep, so the ball rests with its centre START_PAD_REST above the pad's base.
export const START_PAD_R = 1.03, START_PAD_H = 0.22, START_PAD_BOWL = 0.75, START_PAD_DIP = 0.16;
export const START_PAD_REST = START_PAD_H - START_PAD_DIP + BALL_RADIUS;
// The pad's outer top edge is rounded by START_PAD_EDGE, in START_PAD_EDGE_N steps.
export const START_PAD_EDGE = 0.12, START_PAD_EDGE_N = 6;
// The pad's outline as [radius, y], outside in: the upright side rounding over onto the flat rim,
// then the bowl, a spherical dish down to the centre. Revolved about the pad's axis; drawn and solid
// alike. The side runs to index START_PAD_EDGE_N + 1, the rim on to the next.
export function startPadProfile(): [number, number][] {
  const a = START_PAD_BOWL, s = START_PAD_DIP, rho = (a * a + s * s) / (2 * s), n = 10;
  const bowl = Array.from({ length: n }, (_, k): [number, number] => {
    const r = a * (1 - (k + 1) / n);
    return [r, START_PAD_H - s + (rho - Math.sqrt(rho * rho - r * r))];
  });
  const e = START_PAD_EDGE, edge = Array.from({ length: START_PAD_EDGE_N + 1 }, (_, k): [number, number] => {
    const t = (k / START_PAD_EDGE_N) * (Math.PI / 2);
    return [START_PAD_R - e + e * Math.cos(t), START_PAD_H - e + e * Math.sin(t)];
  });
  return [[START_PAD_R, 0], ...edge, [a, START_PAD_H], ...bowl];
}
// Structures snap their centre to this grid and sit on the platform beneath them.
export const STRUCT_GRID = 1;
// Platform heights come in layers of one platform thickness; a ramp climbs or drops a
// whole number of them, four by default.
export const LAYER_H = PLATFORM_THICKNESS;
// Heights snap to half a layer, so a platform can sit at 5.5.
export const HEIGHT_STEP = LAYER_H / 2;
export const RAMP_RISE = 4;
// Hanging bridge: a chain of hinged planks slung between two platform edges, one hinge per
// grid cell. The hinge line sits at the platform's upper light line, so a plank's top meets
// the bottom of the platform lip; the chain is a little longer than the gap so it sags about
// a tenth of its span at rest and visibly more under the ball.
export const BRIDGE_PITCH = 1;
export const BRIDGE_PLANK_T = 0.16;
export const BRIDGE_PLANK_GAP = 0.14;
export const BRIDGE_HINGE_DROP = PLATFORM_EDGE_DROP + BRIDGE_PLANK_T / 2;
export const BRIDGE_SLACK = 0.025;
// Fence rails and the rails piece share one tube radius.
export const RAIL_R = 0.11;
// Rails piece: an open tube, one rail or two RAILS_GAUGE apart, following a node path exactly like
// a tube's (see TubeNode). An end node's y is the top of the platform it attaches to (the editor
// snaps it there); an in-between node's y is the height the ball rolls at. Each end attaches square
// (see railsRings) at an offset added here (railEndAxis): `top` stands at fence-rail height over the
// top and turns straight down into it like a fence rail's end; `side` goes level into the middle of
// a side wall; `end` attaches to nothing and closes the rails (railsLines).
export const RAILS_GAUGE = 0.92;
export const RAILS_EMBED = 0.4, RAILS_WALL_REACH = 1.5;
// The level, square stub at each end, and the radius the sloping middle bends into it on.
export const RAILS_STUB = 0.9, RAILS_STUB_BEND = 1;
// The ball riding the rails sits this much below its height on a platform: level with it, the
// rail ends would meet a fast ball head-on and kick it; this low, the ball settles onto them.
export const RAILS_SINK = 0.005;
export type RailEnd = "top" | "side" | "end";
// Rail axis height above the ball's rolling level, and the angle from straight up at which the
// ball touches a rail (the physics turns a flat facet to face it: a vertex there bumps the ball).
export const railsAxisY = (lines: 1 | 2): number =>
  lines === 1 ? -RAIL_R : BALL_RADIUS - Math.sqrt((BALL_RADIUS + RAIL_R) ** 2 - (RAILS_GAUGE / 2) ** 2);
export const railsContact = (lines: 1 | 2): number => (lines === 1 ? 0 : Math.atan2(RAILS_GAUGE / 2, BALL_RADIUS - railsAxisY(2)));
// Knock-down plank: a tall panel standing on a platform edge, hinged along its bottom edge. It is
// live under physics from the start, or with `freeze` holds still until anything touches it, then
// topples and lies across the gap.
// Place every plank 0.5 tiles back from the border of the platform it stands on (docs/levels.md),
// unless it is a side plank, hinged to the platform's side wall instead.
export const PLANK_T = 0.12;
// The hinge runs through the middle of the panel's base, held this high above the surface in a
// yoke at each end: just over half the panel's thickness, so whichever way it topples the base
// corners swing past the floor instead of into it, and it lies flat either way.
export const PLANK_HINGE_H = PLANK_T / 2 + 0.01;
// A side plank's hinge sits just outside the wall at the bridge hinge height, so lying flat its
// top meets the bottom of the platform lip, like a bridge plank. Nothing holds it level: it
// swings freely either way and comes to rest on whatever it hits.
export const SIDE_PLANK_HINGE_Z = -(PLANK_T / 2 + 0.04);
// Seesaw: a board `w` wide and `d` long (along local z) pinned at its middle on an axle between
// two posts, live under physics from the start (or with `freeze`, from the first touch), so the
// ball's weight tips it. Thinner than a
// knock-down plank so the ball rolls onto its low end without a big step.
export const SEESAW_T = 0.1, SEESAW_PIVOT_H = 1.2, SEESAW_POST_W = 0.36, SEESAW_POST_D = 0.8;
// The axle's height above the surface is the piece's `h` (SEESAW_PIVOT_H for a new one). Its posts
// are rounded boxes of SEESAW_POST_R, SEESAW_POST_ABOVE taller than that, and an axle stub runs from
// each post into the board's edge, all solid. Nothing hangs under the board, so the ball can roll under it.
export const seesawPivot = (p: Piece & { type: "seesaw" }): number => p.h;
export const SEESAW_POST_R = 0.16, SEESAW_POST_ABOVE = 0.3;
export const seesawPostH = (p: Piece & { type: "seesaw" }): number => seesawPivot(p) + SEESAW_POST_ABOVE;
export const SEESAW_STUB = { r: 0.09, l: SEESAW_POST_W + 0.2, into: 0.03 };
// A rim lies this far proud of the face it is painted on: a line, not a ledge.
export const PAINT = 0.005;

// A knock-down plank's hinge relative to the piece origin before yaw. `base` raises it that much more,
// the yokes standing taller to hold it; a side plank has none.
export const plankHinge = (p: Piece & { type: "plank" }): { y: number; z: number } =>
  p.side ? { y: -(PLATFORM_EDGE_DROP + PLANK_T / 2), z: SIDE_PLANK_HINGE_Z } : { y: PLANK_HINGE_H + (p.base ?? 0), z: 0 };
// The fixed mounts a knock-down plank's hinge barrel turns in, local to the piece before yaw: a
// yoke standing at each end of a top plank, a bracket on the wall at each end of a side plank.
// Rounded boxes of PLANK_MOUNT_R, drawn and solid alike. The barrel runs PLANK_BARREL past each
// end of the panel into them.
export const PLANK_MOUNT_R = 0.05, PLANK_BARREL = 0.35;
// Each mount lies with its long side along the hinge, 0.05 clear of the panel's end.
export function plankMounts(p: Piece & { type: "plank" }): { x: number; y: number; z: number; w: number; h: number; d: number }[] {
  if (p.side) {
    const hinge = plankHinge(p), w = 0.6, d = 0.34, back = 0.08;
    return [1, -1].map((s) => ({ x: s * (p.w / 2 + 0.05 + w / 2), y: hinge.y - 0.06, z: back - d / 2, w, h: 0.42, d }));
  }
  const h = plankHinge(p).y + 0.12, w = 0.5;
  return [1, -1].map((s) => ({ x: s * (p.w / 2 + 0.05 + w / 2), y: h / 2, z: 0, w, h, d: 0.34 }));
}
// Pose of a knock-down plank's centre relative to the piece origin before yaw, for its start
// angle: `tilt` degrees about the hinge, 0 standing up, positive leaning toward local -z (the
// way a push from +z knocks it), 90 lying flat. Clamped to lying flat either way on a top plank;
// a side plank starts anywhere from upright to hanging straight down (180), never leaning in,
// which would put it inside its platform.
export function plankPose(p: Piece & { type: "plank" }): { y: number; z: number; tilt: number } {
  const tilt = p.side ? Math.max(0, Math.min(180, p.tilt)) : Math.max(-90, Math.min(90, p.tilt)), a = (tilt * Math.PI) / 180, hinge = plankHinge(p);
  return { y: hinge.y + (p.h / 2) * Math.cos(a), z: hinge.z - (p.h / 2) * Math.sin(a), tilt };
}

// Steepest a seesaw can sit before an end meets the surface, in degrees.
export function seesawMaxTilt(p: Piece & { type: "seesaw" }): number {
  let lo = 0, hi = Math.PI / 2;
  const clear = (a: number) => seesawPivot(p) - (p.d / 2) * Math.sin(a) - (SEESAW_T / 2) * Math.cos(a);
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (clear(m) > 0) lo = m; else hi = m; }
  return (lo * 180) / Math.PI;
}
// The angles a seesaw can turn through, in degrees (positive raises its local -z end): down to resting on
// an end, or with `dips` only toward that end going down, never past level the other way.
export function seesawRange(p: Piece & { type: "seesaw" }): [number, number] {
  const m = seesawMaxTilt(p);
  return p.dips === "+z" ? [0, m] : p.dips === "-z" ? [-m, 0] : [-m, m];
}
// Board: a loose plank (the knock-down plank's panel, PLANK_T thick) lying `w` across and `d` along, rolled
// `roll` about its own z, then turned `tilt` about its own x like a seesaw (positive raises its -z end), as a
// slab turns. Its centre is this far above its y, so its lowest corner rests on y.
export function boardLift(p: Piece & { type: "board" }): number {
  const r = ((p.roll ?? 0) * Math.PI) / 180, t = (p.tilt * Math.PI) / 180;
  // The world up's components along the board's own x, y and z.
  const ux = Math.abs(Math.cos(t) * Math.sin(r)), uy = Math.abs(Math.cos(t) * Math.cos(r)), uz = Math.abs(Math.sin(t));
  return (p.w / 2) * ux + (PLANK_T / 2) * uy + (p.d / 2) * uz;
}
// A seesaw's start angle, held inside its range.
export const seesawTilt = (p: Piece & { type: "seesaw" }): number => { const [lo, hi] = seesawRange(p); return Math.max(lo, Math.min(hi, p.tilt)); };
// Pangolin: a body `w` wide and `d` long. It waits with its head lying flat at local +z and the rest
// curled up behind it, until something touches it; then it unrolls toward local -z like a carpet and
// stays down, a bridge across the gap. Laid out, its belly is on y, its snout at z = d/2 and its tail
// tip at -d/2; both ends thin to a ramp. The body's line is its belly, s along it from the snout; the
// coil is a spiral with the back inside, PANGOLIN_COIL between wraps and PANGOLIN_CORE across its
// innermost one, so the head's top just clears the wrap above it (docs/animals.md).
export type Pangolin = Piece & { type: "pangolin" };
export const PANGOLIN_T = 0.25, PANGOLIN_COIL = 0.28, PANGOLIN_CORE = 0.3, PANGOLIN_SEG = 0.25, PANGOLIN_MIN_D = 4;
// Each end's ramp is long enough that a ball at full speed stays on it over the crest (speed squared
// times the crest's bend under gravity), rather than being thrown, and thins almost to an edge, since
// even a small step at the tip kicks a fast ball up.
export const pangolinEnds = (p: Pangolin) => ({ head: Math.min(2.4, p.d * 0.3), tail: Math.min(2.4, p.d * 0.3) });
// How much lies flat while it waits: the head, out from under the coil.
export const pangolinRest = (p: Pangolin): number => Math.min(2.3, p.d * 0.3);
// Width and thickness at s: full in the middle, easing down to a thin point at the snout and tail tip.
// Both are concave in s, so the laid-out body is convex.
export function pangolinSize(p: Pangolin, s: number): { w: number; t: number } {
  const e = pangolinEnds(p), ease = (u: number) => (u >= 1 ? 1 : u <= 0 ? 0 : 1 - (1 - u) ** 2);
  const f = Math.min(ease(s / e.head), ease((p.d - s) / e.tail));
  return { w: p.w * (0.3 + 0.7 * f), t: PANGOLIN_T * (0.03 + 0.97 * f) };
}
// Thickness's rate of change along s, for laying paint on the sloping ends.
export const pangolinSlope = (p: Pangolin, s: number): number => (pangolinSize(p, s + 1e-3).t - pangolinSize(p, s - 1e-3).t) / 2e-3;
// Cross-section at s: a rounded rectangle across x and up its thickness t, as [x, t, nx, nt] round it.
export function pangolinRing(p: Pangolin, s: number): [number, number, number, number][] {
  const { w, t } = pangolinSize(p, s), r = Math.min(0.1, 0.45 * t), K = 3, out: [number, number, number, number][] = [];
  const corners: [number, number, number][] = [[w / 2 - r, r, -Math.PI / 2], [w / 2 - r, t - r, 0], [-(w / 2 - r), t - r, Math.PI / 2], [-(w / 2 - r), r, Math.PI]];
  for (const [cx, ct, a0] of corners) for (let k = 0; k <= K; k++) {
    const a = a0 + (k / K) * (Math.PI / 2);
    out.push([cx + r * Math.cos(a), ct + r * Math.sin(a), Math.cos(a), Math.sin(a)]);
  }
  return out;
}
// Where the physics cuts the body into slices: PANGOLIN_SEG apart or a little less, tail tip to snout.
export function pangolinCuts(p: Pangolin): number[] {
  const n = Math.max(1, Math.ceil(p.d / PANGOLIN_SEG - 1e-9));
  return Array.from({ length: n + 1 }, (_, k) => (k * p.d) / n);
}
// How far a giraffe's neck is stretched `elapsed` seconds after the ball bumped it: up fast, held, then
// eased back down, back to rest after `time`. `grow` must stay under GIRAFFE.neck (the sim's two necks overlap).
export function giraffeStretch(elapsed: number, grow: number, time: number): number {
  const u = elapsed / time;
  if (!(u > 0 && u < 1)) return 0;
  if (u < 0.2) return grow * Math.sin((Math.PI / 2) * (u / 0.2));
  if (u < 0.5) return grow;
  return (grow * (1 + Math.cos(Math.PI * ((u - 0.5) / 0.5)))) / 2;
}
// How much of it lies unrolled `elapsed` seconds after it was touched, at `speed` on average: eased in
// and out, so it sets off and lands without a jolt.
export function pangolinUnrolled(p: Pangolin, elapsed: number, speed: number): number {
  const a0 = pangolinRest(p), u = Math.max(0, Math.min(1, (elapsed * speed) / (p.d - a0)));
  return a0 + ((p.d - a0) * (1 - Math.cos(Math.PI * u))) / 2;
}
// The belly line with `a` unrolled, at each s in `ss` (ascending): its point (z, y) and the angle `phi`
// it has turned up through. Laid out up to a, then the coil: its bend at s depends only on how far s is
// from the snout, so the coil rolls along as one shape, shedding its outer wrap.
export function pangolinLine(p: Pangolin, a: number, ss: readonly number[]): { z: number; y: number; phi: number }[] {
  const L = p.d, C = PANGOLIN_COIL, rad = (s: number) => Math.sqrt(PANGOLIN_CORE ** 2 + (C * Math.max(0, L - s)) / Math.PI);
  const turn = (s: number) => ((2 * Math.PI) / C) * (rad(0) - rad(s)), ta = turn(a);
  let z = L / 2 - a, y = 0, at = a;
  return ss.map((s) => {
    if (s <= a) return { z: L / 2 - s, y: 0, phi: 0 };
    const n = Math.max(1, Math.ceil((s - at) / 0.01)), h = (s - at) / n;
    for (let k = 0; k < n; k++) { const f = turn(at + (k + 0.5) * h) - ta; z -= Math.cos(f) * h; y += Math.sin(f) * h; }
    at = s;
    return { z, y, phi: turn(s) - ta };
  });
}
// Support: three pillars standing against a platform's side wall, carrying a platform `h` layers
// above. The piece origin is on the lower platform's edge at its top surface; the pillars stand
// just outside that edge on local +z, from the lower platform's side wall up to the upper one's
// underside.
// Kicker: a small solid wedge sitting on a platform, rising `h` toward local -z over its depth
// `d`. The default 1 over 3 is an 18 degree slope. `flat` adds a level deck that long past the
// high edge, at the top's height; the piece is centred on slope and deck together.
export const KICKER_W = 2.5, KICKER_D = 3, KICKER_H = 1;
// A kicker's solid, drawn and in the physics alike: its corners pulled in by `r` and rounded back
// out by `r`, so the edges are rounded like a stool's and the outside is the full shape. Seen
// from the side it is the polygon low front edge (local +z), slope top, back top, back bottom;
// every edge line moves in by `r` and the new corners are where they meet. The slope carries on
// KICKER_SINK below the surface, burying the front edge's rounding: where it meets the surface it
// is a sharp crease, so the ball rolls straight up rather than bouncing off a rounded lip.
export const KICKER_SINK = 0.2;
// A side kicker (`top` given) hugs a wall: its wall side (local +x, or -x when mirrored) stays
// straight while its other side narrows evenly with height, from the full `w` at the foot to `top`
// at the top edge. kickerSpan is the solid's [left, right] x at height fraction s (0 foot, 1 top).
export function kickerSpan(p: Piece & { type: "kicker" }, s: number): [number, number] {
  const width = p.w + ((p.top ?? p.w) - p.w) * Math.max(0, Math.min(1, s));
  return p.mirror ? [-p.w / 2, -p.w / 2 + width] : [p.w / 2 - width, p.w / 2];
}
// `round` draws the same wedge with fatter rounding, inset so it stays inside the solid (scene.ts).
export function kickerHull(p: Piece & { type: "kicker" }, round?: number): { corners: [number, number, number][]; r: number } {
  const r = round ?? propRound(p.w, p.h, p.d), f = p.flat ?? 0, front = (p.d + f) / 2, back = -front, toe = front + (KICKER_SINK * p.d) / p.h;
  const prof: [number, number][] = f > 0 ? [[toe, -KICKER_SINK], [front - p.d, p.h], [back, p.h], [back, -KICKER_SINK]] : [[toe, -KICKER_SINK], [back, p.h], [back, -KICKER_SINK]];
  let area = 0;
  prof.forEach(([z, y], i) => { const [z2, y2] = prof[(i + 1) % prof.length]!; area += z * y2 - z2 * y; });
  // Each edge as a point moved inward by r and its direction.
  const lines = prof.map(([z, y], i) => {
    const [z2, y2] = prof[(i + 1) % prof.length]!, l = Math.hypot(z2 - z, y2 - y), dz = (z2 - z) / l, dy = (y2 - y) / l;
    const nz = area > 0 ? -dy : dy, ny = area > 0 ? dz : -dz;
    return { z: z + nz * r, y: y + ny * r, dz, dy };
  });
  const inner = lines.map((b, i) => {
    const a = lines[(i + prof.length - 1) % prof.length]!, den = a.dz * b.dy - a.dy * b.dz;
    const t = ((b.z - a.z) * b.dy - (b.y - a.y) * b.dz) / den;
    return [a.z + a.dz * t, a.y + a.dy * t] as [number, number];
  });
  return { corners: inner.flatMap(([z, y]): [number, number, number][] => {
    const [a, b] = kickerSpan(p, y / p.h), m = (a + b) / 2;
    return [[Math.min(m - 0.01, a + r), y, z], [Math.max(m + 0.01, b - r), y, z]];
  }), r };
}
// A kicker with a `track` can be pushed sideways: it slides along its local x on an invisible track
// that long, centred on (x, z), starting `offset` along it. It can't roll. Like stoolSlide.
export const KICKER_TRACK = 8;
export const isSliding = (p: Piece & { type: "kicker" }): boolean => !!p.track;
export function kickerSlide(p: Piece & { type: "kicker" }): { lo: number; hi: number; at: number } {
  const half = Math.max(0, ((p.track ?? 0) - p.w) / 2);
  return { lo: -half, hi: half, at: Math.max(-half, Math.min(half, p.offset ?? 0)) };
}
export const SUPPORT_W = 0.8, SUPPORT_D = 0.7, SUPPORT_RISE = 4;
// Column: a mostly decorative round pillar `h` tall standing at y, twice as thick as a support's
// pillar (radius 0.8 against its half-width 0.4). Solid as drawn; it keeps the y it is given.
export const COLUMN_R = SUPPORT_W, COLUMN_H = 4;
// Bumper: a round puck BUMPER_H tall whose rubber band bulges out to BUMPER_R round its middle.
// Hitting its side throws the ball straight back out (sim.ts).
export const BUMPER_R = 1, BUMPER_H = 1;
// The bumper's outline as [radius, y], outside in over the top, in its four drawn bands: the
// base, the rubber band, the rim rounding up onto the top, and the flat top. Revolved; drawn and solid alike.
export function bumperProfile(): [number, number][][] {
  const R = BUMPER_R, H = BUMPER_H, inner = R - 0.08;
  const arc = (cr: number, cy: number, rr: number, ry: number, a0: number, a1: number, n: number) =>
    Array.from({ length: n + 1 }, (_, k): [number, number] => { const a = a0 + ((a1 - a0) * k) / n; return [cr + rr * Math.cos(a), cy + ry * Math.sin(a)]; });
  const base: [number, number][] = [[inner - 0.02, 0], [inner, 0.24]];
  const band = arc(inner, 0.43, R - inner, 0.19, -Math.PI / 2, Math.PI / 2, 10);
  const rim = arc(inner - 0.16, 0.62, 0.16, H - 0.62, 0, Math.PI / 2, 8);
  const edge = rim[rim.length - 1]!;
  return [base, band, rim, [edge, [0, H]]];
}
// Magnet: a puck MAGNET_R round and MAGNET_H tall, two discs stacked with a groove between, that
// pulls the ball toward its axis while the ball's centre is within MAGNET_REACH of it (the red aura
// drawn round its foot); see magnetForce and magnetHold in tuning.ts.
export const MAGNET_R = 1, MAGNET_H = 1, MAGNET_REACH = 5;
// The magnet's outline as [radius, y], bottom up and outside in, in its drawn bands: the glowing
// foot, the lower disc, the groove, the upper disc, the glowing stripe, the white rim rounding onto
// the top, and the sunk top. Revolved; drawn and solid alike.
export function magnetProfile(): [number, number][][] {
  const R = MAGNET_R, H = MAGNET_H, b = 0.03, g = R - 0.1, rim = 0.18, top = R - 0.26;
  const arc = Array.from({ length: 9 }, (_, k): [number, number] => { const a = (k / 8) * (Math.PI / 2); return [R - rim + rim * Math.cos(a), 0.76 + (H - 0.76) * Math.sin(a)]; });
  return [
    [[R - b, 0], [R, b], [R, 0.1]],
    [[R, 0.1], [R, 0.4], [R - b, 0.43]],
    [[R - b, 0.43], [g, 0.45], [g, 0.49], [R - b, 0.51]],
    [[R - b, 0.51], [R, 0.54], [R, 0.68]],
    [[R, 0.68], [R, 0.76]],
    [...arc, [top, H]],
    [[top, H], [top - b, H - b], [0, H - b]],
  ];
}
// Each pillar's stem is centred `reach` out from the lower platform's side wall (by default half a unit,
// the middle of the grid cell beside the edge), as its foot enters that wall half a unit down, at mid-thickness. The foot leaves
// the wall level, runs a short straight and bends up into the stem: a longer reach widens the bend (the
// straight stays SUPPORT_FOOT), a shorter one tightens it to 0.05 and then shortens the straight, down to
// nothing at the least reach. supportBend is the bend's inner radius.
// `roll` 180 turns the whole support over about its own z axis through the platform's mid-thickness,
// a J upside down: put it on the upper platform's edge at its top, its feet bend into that wall and it
// stands on the platform h layers below. 0 and 180 are its only rolls.
export const SUPPORT_REACH = 0.5, SUPPORT_GAP = SUPPORT_REACH - SUPPORT_D / 2, SUPPORT_FOOT = 0.05, SUPPORT_MIN_REACH = SUPPORT_D / 2 + 0.05;
export const supportReach = (p: Piece & { type: "support" }): number => p.reach ?? SUPPORT_REACH;
export const supportBend = (p: Piece & { type: "support" }): number => Math.max(0.05, supportReach(p) - SUPPORT_D / 2 - SUPPORT_FOOT);
export const supportOver = (p: Piece & { type: "support" }): boolean => (((p.roll ?? 0) % 360) + 360) % 360 === 180;
export function supportPillars(p: Piece & { type: "support" }): { x: number; z: number; y0: number; y1: number }[] {
  const e = p.w / 2 - SUPPORT_W / 2;
  // y0 is where the stem's straight starts, at the top of the bend; below it supportHulls collide.
  return [-e, 0, e].map((x) => ({ x, z: supportReach(p), y0: -PLATFORM_THICKNESS / 2 + SUPPORT_D / 2 + supportBend(p), y1: p.h * LAYER_H - PLATFORM_THICKNESS }));
}
// Each pillar's foot and bend as convex hulls in local space (turned over with the support), one per
// step round the bend and one for the straight into the wall, so the curve collides as drawn.
export function supportHulls(p: Piece & { type: "support" }): V3[][] {
  const D = SUPPORT_D, T = PLATFORM_THICKNESS, ri = supportBend(p), reach = supportReach(p), yc = -T / 2 + D / 2 + ri, zc = reach - D / 2 - ri;
  const over = supportOver(p), n = 8, out: V3[][] = [];
  const sec = (a: number): [number, number][] => [[zc + ri * Math.cos(a), yc + ri * Math.sin(a)], [zc + (ri + D) * Math.cos(a), yc + (ri + D) * Math.sin(a)]];
  const secs = [[[0, -T / 2 + D / 2], [0, -T / 2 - D / 2]] as [number, number][], ...Array.from({ length: n + 1 }, (_, k) => sec(-Math.PI / 2 + (Math.PI / 2) * (k / n)))];
  for (const c of supportPillars(p)) for (let k = 0; k + 1 < secs.length; k++) {
    out.push([...secs[k]!, ...secs[k + 1]!].flatMap(([z, y]) => [-1, 1].map((sx): V3 => {
      const x = c.x + (sx * SUPPORT_W) / 2;
      return over ? [-x, -T - y, z] : [x, y, z];
    })));
  }
  return out;
}
// A pillar's trim, a support's or a gate leg's alike, in its column's frame (x across, local -z
// toward the wall): the straight stem from `yb` up to `top` splits into stretches about 2.6 long
// between its end collars, each with a panel `ph` tall round `ym` and an ear out each side. An ear
// is a prism PILLAR_EAR.d deep, its outline running from inside the stem out PILLAR_EAR.out past
// its side and narrowing toward the tip, every edge rounded by PILLAR_EAR.r; drawn and solid alike.
export const PILLAR_EAR = { out: 0.22, d: 0.48, r: 0.05 };
export function pillarStretches(yb: number, top: number): { ym: number; ph: number }[] {
  const z0 = yb + 0.45, z1 = top - 0.6, n = Math.max(1, Math.round((z1 - z0) / 2.6)), seg = (z1 - z0) / n;
  return Array.from({ length: n }, (_, k) => ({ ym: z0 + (k + 0.5) * seg, ph: Math.min(seg * 0.72, 2) })).filter((s) => s.ph >= 0.4);
}
// One ear's hull points (to be rounded by PILLAR_EAR.r) on the `side` (±1) of x.
export function pillarEar(s: { ym: number; ph: number }, side: number): V3[] {
  const { out, d, r } = PILLAR_EAR, eh = s.ph * 0.34, xi = SUPPORT_W / 2 - 0.15, xo = SUPPORT_W / 2 + out - r, z = d / 2 - r;
  const outline: [number, number][] = [[xi, -eh - 0.11 + r], [xo, -eh + 0.03 + r], [xo, eh - 0.03 - r], [xi, eh + 0.11 - r]];
  return outline.flatMap(([x, y]): V3[] => [[side * x, s.ym + y, z], [side * x, s.ym + y, -z]]);
}
// The soft support is a whale in place of the three pillars: its body (a rounded box, head toward
// local +x, flukes past its tail) floats beside the lower platform's edge with its wall side against
// the wall and its back WHALE.back above the platform top (high enough that a ball at the edge meets
// its side square on, not its rounded top edge), and its spout, a column of water, rises
// from its back to a splash pressed under the upper platform, droplets round it. Laid out unturned;
// pieceBoxes, pieceCylinders and pieceBalls turn it over for `roll` 180.
export const WHALE = { back: 0.9, h: 1.5, d: 1.5, r: 0.4, spout: 0.32, splash: { r: 0.65, h: 0.25 }, drop: { r: 0.11, at: 0.8, n: 5 } };
export function whaleParts(p: Piece & { type: "support" }): { boxes: Box[]; cylinders: Cylinder[]; balls: Ball[] } {
  const T = PLATFORM_THICKNESS, y1 = p.h * LAYER_H - T, W = WHALE, z = W.d / 2, bw = Math.max(2.4, Math.min(4, p.w - 1));
  const boxes: Box[] = [
    { kind: "block", x: 0, y: W.back - W.h / 2, z, w: bw, h: W.h, d: W.d, r: W.r },
    { kind: "block", x: -(bw / 2 + 0.2), y: W.back - W.h / 2 + 0.15, z, w: 0.6, h: 0.14, d: W.d - 0.1, r: 0.07 },
  ];
  const top = Math.max(W.back + 0.2, y1 - W.splash.h), cylinders: Cylinder[] = [
    { r: W.spout, h: Math.max(0.05, top - (W.back - 0.1)), x: 0, z, y0: W.back - 0.1 },
    { r: W.splash.r, h: W.splash.h, x: 0, z, y0: top },
  ];
  const balls = Array.from({ length: W.drop.n }, (_, k): Ball => { const a = ((k + 0.5) / W.drop.n) * Math.PI * 2; return { r: W.drop.r, x: Math.sin(a) * W.drop.at, y: top - 0.1, z: z + Math.cos(a) * W.drop.at }; });
  // Droplets rising beside a tall spout.
  const spout = cylinders[0]!;
  if (spout.h > 1.2) for (let k = 0; k < 3; k++) balls.push({ r: 0.08, x: (k % 2 ? -1 : 1) * (W.spout + 0.1), y: (spout.y0 ?? 0) + spout.h * (0.25 + 0.25 * k), z: z + 0.12 * (k - 1) });
  return { boxes, cylinders, balls };
}
export function supportEarHulls(p: Piece & { type: "support" }): V3[][] {
  const T = PLATFORM_THICKNESS, over = supportOver(p);
  return supportPillars(p).flatMap((c) => pillarStretches(c.y0, c.y1).flatMap((s) => [-1, 1].map((side) => pillarEar(s, side).map(([x, y, z]): V3 => over ? [-(x + c.x), -T - y, z + c.z] : [x + c.x, y, z + c.z]))));
}

// Gate: two arches `d` apart over a platform `w` wide, the tops of their beams `h` above the
// surface. The origin is on the platform's top in the middle, local x across it, the arches at
// z = ±d/2. Each leg is a support pillar (its section, its gap off the side wall, its foot bending
// into the wall at mid-thickness), carried up round a corner into one beam across. A rail-thick
// bar joins the two beams' middles, and from its middle a chain of big links hangs one cube just
// off the surface, free to swing.
export const GATE_H = 5, GATE_D = 6, GATE_CORNER = 0.6, GATE_ROUND = 0.07;
// A gate's legs stand off its platform's walls and bend into them on these, a support's older measures.
export const GATE_GAP = 0.5, GATE_BEND_R = 0.3;
export const GATE_CUBE = CUBE_S, GATE_CUBE_LIFT = 0.25;
// A link: a "0" of round wire t thick, its middle line two half-rounds of radius r joined by
// straight sides `straight` long each way from its centre.
export const GATE_LINK = { r: 0.19, t: 0.06, straight: 0.16 };
export const GATE_CHAIN_R = GATE_LINK.r + GATE_LINK.t;
export type Gate = Piece & { type: "gate" };
type XY = [number, number];
// The frame as cross-sections from the right leg's foot in the wall, over the beam, to the left
// one's: each is [outer, inner] (x, y) in the gate's x-y plane, `inset` in from both edges. Between
// two neighbours the frame is convex, so the physics builds it a hull per pair.
export function gateStrip(p: Gate, inset = 0): [XY, XY][] {
  const T = PLATFORM_THICKNESS, D = SUPPORT_D, ri = GATE_BEND_R, rc = GATE_CORNER;
  const xi = p.w / 2 + GATE_GAP, xw = p.w / 2 - 0.05, yl0 = -T / 2 - D / 2, yl1 = -T / 2 + D / 2;
  const sec = (ox: number, oy: number, ix: number, iy: number): [XY, XY] => {
    const l = Math.hypot(ix - ox, iy - oy), ux = ((ix - ox) / l) * inset, uy = ((iy - oy) / l) * inset;
    return [[ox + ux, oy + uy], [ix - ux, iy - uy]];
  };
  const arc = (cx: number, cy: number, ro: number, rin: number, a0: number, a1: number, n: number) =>
    Array.from({ length: n + 1 }, (_, k) => { const a = a0 + ((a1 - a0) * k) / n, c = Math.cos(a), s = Math.sin(a); return sec(cx + ro * c, cy + ro * s, cx + rin * c, cy + rin * s); });
  const right = [
    sec(xw, yl0, xw, yl1),
    ...arc(xi - ri, yl1 + ri, ri + D, ri, -Math.PI / 2, 0, 8),
    ...arc(xi - rc, p.h - D - rc, rc + D, rc, 0, Math.PI / 2, 10),
  ];
  return [...right, ...[...right].reverse().map(([o, i]): [XY, XY] => [[-o[0], o[1]], [-i[0], i[1]]])];
}
// The frames' solid parts in local space, each a hull's points to be rounded by GATE_ROUND: a pair
// of neighbouring sections run through an arch's depth.
export function gateHulls(p: Gate): V3[][] {
  const r = GATE_ROUND, z = SUPPORT_W / 2 - r, s = gateStrip(p, r), out: V3[][] = [];
  for (const at of [p.d / 2, -p.d / 2]) {
    for (let k = 0; k + 1 < s.length; k++) out.push([...s[k]!, ...s[k + 1]!].flatMap(([x, y]): V3[] => [[x, y, at + z], [x, y, at - z]]));
  }
  return out;
}
// A leg's trim runs up to here (see pillarStretches); its column stands at x = ±(w/2 + GATE_GAP +
// SUPPORT_D/2), turned so its local -z faces the platform.
export const gateLegTop = (p: Gate): number => p.h - SUPPORT_D - GATE_CORNER + 0.4;
export function gateEarHulls(p: Gate): V3[][] {
  const yb = -PLATFORM_THICKNESS / 2 + SUPPORT_D / 2 + GATE_BEND_R, cx = p.w / 2 + GATE_GAP + SUPPORT_D / 2, out: V3[][] = [];
  for (const at of [p.d / 2, -p.d / 2]) for (const leg of [1, -1]) for (const s of pillarStretches(yb, gateLegTop(p))) for (const side of [1, -1]) {
    out.push(pillarEar(s, side).map(([x, y, z]): V3 => [leg * (z + cx), y, at - leg * x]));
  }
  return out;
}
// Where the hanging part is, as heights above the surface: the pivot on the bar's axis, the cube's
// centre, and the chain's length from the pivot down to the cube's top.
export function gateHang(p: Gate): { pivot: number; cube: number; chain: number } {
  const pivot = p.h - SUPPORT_D / 2, cube = GATE_CUBE_LIFT + GATE_CUBE / 2;
  return { pivot, cube, chain: pivot - (cube + GATE_CUBE / 2) };
}
// The links' centres as heights from the pivot, top first: the top link's eye rests on the bar, the
// bottom one's end on the cube, the rest spread evenly between, near the pitch at which each hangs
// in the next with their wires touching. Every other link is turned a quarter about the chain.
export function gateLinks(p: Gate): number[] {
  const L = GATE_LINK, outer = L.straight + L.r + L.t, inner = L.straight + L.r - L.t, pitch = 2 * (L.straight + L.r) - 2 * L.t;
  const top = RAIL_R - inner, bottom = -gateHang(p).chain + outer, n = Math.max(2, Math.round((top - bottom) / pitch) + 1);
  return Array.from({ length: n }, (_, k) => top + ((bottom - top) * k) / (n - 1));
}

// Tube: a glass pipe just wide enough for the ball, routed through a list of nodes. The piece
// origin is the first mouth; `path` holds the remaining nodes relative to it (before `rot`), the
// last being the other mouth. Node y is the tube's inner floor, so a mouth sitting on a platform
// top is flush with it. A node's `bend` is the radius of the arc through it, 0 for a sharp mitred
// elbow. Nothing is checked: the designer places mouths and turns freely. Nothing pushes the
// ball either; it runs either way under the player's own push, so the two mouths are alike.
// A single glass skin with no wall thickness.
export const TUBE_R = 0.51;
// The glass is drawn as one thin skin, but in the physics it is a solid wall this thick outside the
// skin, so nothing can slip through it from outside however it arrives.
export const TUBE_SOLID_WALL = 0.08;
// Facets round the bore skin and the glass wall's outside, shared by drawing and physics.
export const TUBE_SKIN_SIDES = 20, TUBE_WALL_SIDES = 20;
// The mouth ring: a ring of rail RING_T thick (a little thinner than the fences' and rails' RAIL_R),
// round each tube mouth; a hoop is one standing alone. Its opening is exactly the bore, so it lines up
// with the tube's inside and never narrows it, and it is centred on the mouth, so the tube's end sits
// inside it and it coats the end. RING_R is the radius to the ring's axis; RING_SIDES facets round the
// rail and RING_SEGMENTS round the ring, drawn and solid alike.
export const RING_T = 0.08, RING_R = TUBE_R + RING_T, RING_SIDES = 16, RING_SEGMENTS = 48;
// A soft ring is a snake biting its tail: its head, SNAKE_HEAD.r round, sits on the ring's top (the way
// round the ring nearest straight up, or local +x for a ring lying flat), out past the ring's centre
// line by just enough that its inner edge is the ring's, so it never narrows the opening, looking
// along the ring.
export function ringHead(m: { c: V3; d: V3 }): { c: V3; d: V3 } {
  const d = unit(m.d), u = ringUp(d);
  return { c: add(m.c, u, RING_R - RING_T + SNAKE_HEAD.r), d: [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]] };
}
// The way round a ring of axis d (unit) nearest straight up, or +x for a ring lying flat.
export function ringUp(d: V3): V3 {
  const want: V3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], k = dot(want, d);
  return unit(sub(want, [d[0] * k, d[1] * k, d[2] * k]));
}
// A soft tube is a glass eel (docs/animals.md): its first mouth the head, its last the tail, which
// wears two fins splayed EEL.fin.splay either side of straight up, a V seen from behind. Each is half a
// squashed ball EEL.fin.len long and EEL.fin.h tall, its flat base EEL.fin.base out from the axis so it
// never reaches into the bore, centred EEL.fin.back in from the mouth so it stands over the ring and the
// body, never over the way out. Solid as drawn.
export const EEL = { fin: { base: TUBE_R + 0.05, back: 0.36, len: 0.44, h: 0.5, t: 0.05, splay: 0.5 }, eye: { r: 0.1, back: 0.45, a: 0.55 }, spot: { r: 0.11, every: 0.8 } };
// Each fin's base centre and axes (x along the tube out of the mouth, y up off it, z across), from the
// tail's mouth ring.
export function eelFins(m: { c: V3; d: V3 }): { c: V3; x: V3; y: V3; z: V3 }[] {
  const x = unit(m.d), up = ringUp(x), side = cross(x, up), F = EEL.fin;
  return [-1, 1].map((s) => {
    const y = add(up.map((v) => v * Math.cos(F.splay)) as V3, side, s * Math.sin(F.splay));
    return { c: add(add(m.c, y, F.base), x, -F.back), x, y, z: cross(x, y) };
  });
}
// Each fin's outline points for its solid: the half ball sampled as the drawing's.
export function eelFinPoints(m: { c: V3; d: V3 }): V3[][] {
  const F = EEL.fin;
  return eelFins(m).map((f) => {
    const out: V3[] = [];
    for (let i = 0; i <= 6; i++) for (let j = 0; j < 16; j++) {
      const lat = (i / 6) * (Math.PI / 2), az = (j / 16) * Math.PI * 2, r = Math.cos(lat);
      out.push(add(add(add(f.c, f.x, F.len * r * Math.cos(az)), f.z, F.t * r * Math.sin(az)), f.y, F.h * Math.sin(lat)));
    }
    return out;
  });
}
// Each mouth ring's centre and axis (the tube's direction there), from the tube's end rings.
export function mouthRings(rings: TubeRing[]): { c: V3; d: V3 }[] {
  if (rings.length < 2) return [];
  const ends: [TubeRing, number][] = [[rings[0]!, -1], [rings[rings.length - 1]!, 1]];
  return ends.map(([q]) => ({ c: q.c, d: q.d }));
}
// A hoop's ring: TUBE_R up, where a tube mouth on that surface would be, facing along local z.
export function hoopRing(p: Piece & { type: "hoop" }): { c: V3; d: V3 } {
  const o = rotXZ(0, 1, p.rot);
  // A hair higher than a mouth's: its opening's bottom clears the floor, where the ball would catch.
  return { c: [p.x, p.y + TUBE_R + 0.01, p.z], d: [o.x, 0, o.z] };
}
export const TUBE_BEND = 1.5;
// `mid`, when set, is a point the segment arriving at this node passes through halfway, which
// bends that segment into a smooth curve (see tubeSegments); without it the segment is straight.
export interface TubeNode { x: number; y: number; z: number; bend: number; mid?: { x: number; y: number; z: number } }
export type Tube = Piece & { type: "tube" };
// Anything laid along a node path: tubes and rails.
export type PathPiece = Piece & { type: "tube" | "rails" | "fence" | "bean" };
type PathLike = { path: TubeNode[]; smooth?: true };

type V3 = [number, number, number];
// A ring of the tube: centre `c`, its circle square to `d`, projected along `d` onto the plane
// through `c` with normal `m` (equal to `d` except at a sharp elbow, where `m` is the mitre).
export interface TubeRing { c: V3; d: V3; m: V3 }

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const angle = (a: V3, b: V3) => (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180) / Math.PI;

// Centreline nodes in the piece's local space (unrotated), first mouth first, `lift` above the
// node points (a tube's centre is its radius above its floor).
export function tubeNodes(p: PathLike, lift = TUBE_R): V3[] {
  return [[0, lift, 0], ...p.path.map((n): V3 => [n.x, n.y + lift, n.z])];
}

// Each segment's centreline from its start node to its end node. A straight segment is just its
// two ends. A curved one follows the circle through its start, `mid` and end as seen from above,
// with the height changing smoothly along it (a quadratic through the three heights), so a curve
// that climbs climbs all the way round rather than at the nodes. If seen from above the three
// points are in a line (or two coincide), it is the smooth curve through them in 3D instead.
export function tubeSegments(p: PathLike, lift = TUBE_R): V3[][] {
  const c = tubeNodes(p, lift);
  return p.path.map((n, i) => {
    const a = c[i]!, b = c[i + 1]!;
    if (!n.mid) return [a, b];
    const m: V3 = [n.mid.x, n.mid.y + lift, n.mid.z];
    const ax = a[0], az = a[2], bx = b[0], bz = b[2], mx = m[0], mz = m[2];
    const D = 2 * (ax * (mz - bz) + mx * (bz - az) + bx * (az - mz));
    const span = Math.hypot(bx - ax, bz - az) + Math.hypot(mx - ax, mz - az);
    const out: V3[] = [];
    if (Math.abs(D) > 1e-3 * Math.max(1, span * span)) {
      const s2 = (x: number, z: number) => x * x + z * z;
      const ux = (s2(ax, az) * (mz - bz) + s2(mx, mz) * (bz - az) + s2(bx, bz) * (az - mz)) / D;
      const uz = (s2(ax, az) * (bx - mx) + s2(mx, mz) * (ax - bx) + s2(bx, bz) * (mx - ax)) / D;
      const r = Math.hypot(ax - ux, az - uz);
      const ang = (x: number, z: number) => Math.atan2(z - uz, x - ux);
      const t0 = ang(ax, az), tm = ang(mx, mz), t1 = ang(bx, bz);
      // Sweep from a to b the way round that passes through m.
      const wrap = (t: number) => ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const ccw = wrap(tm - t0) < wrap(t1 - t0);
      const total = ccw ? wrap(t1 - t0) : -wrap(t0 - t1);
      const fm = (ccw ? wrap(tm - t0) : wrap(t0 - tm)) / Math.abs(total);
      // Height: the quadratic through (0, a.y), (fm, m.y), (1, b.y).
      const yAt = (f: number) => (a[1] * (f - fm) * (f - 1)) / fm + (m[1] * f * (f - 1)) / (fm * (fm - 1)) + (b[1] * f * (f - fm)) / (1 - fm);
      const steps = Math.max(8, Math.ceil(Math.abs(total) / (Math.PI / 24)), Math.ceil((Math.abs(total) * r) / 0.5));
      for (let k = 0; k <= steps; k++) {
        const f = k / steps, t = t0 + total * f;
        out.push(k === 0 ? a : k === steps ? b : [ux + r * Math.cos(t), yAt(f), uz + r * Math.sin(t)]);
      }
      return out;
    }
    const q = add(add(m, m), add(a, b), -0.5);
    const len = Math.hypot(...sub(m, a)) + Math.hypot(...sub(b, m));
    const steps = Math.max(8, Math.ceil(len / 0.5));
    for (let k = 0; k <= steps; k++) {
      const f = k / steps, g = 1 - f;
      out.push(k === 0 ? a : k === steps ? b : [g * g * a[0] + 2 * g * f * q[0] + f * f * b[0], g * g * a[1] + 2 * g * f * q[1] + f * f * b[1], g * g * a[2] + 2 * g * f * q[2] + f * f * b[2]]);
    }
    return out;
  });
}
// The box segment `k` (path[k], from node k to node k + 1) and its curve keep to: between its two
// nodes on every axis, in the piece's own frame like the nodes.
export function midBounds(p: PathLike, k: number): { lo: V3; hi: V3 } {
  const c = tubeNodes(p, 0), a = c[k]!, b = c[k + 1]!;
  return { lo: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], hi: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])] };
}

// A curve point for segment `k` as close to `want` as keeps the whole curve inside midBounds:
// clamped into the box, then its x z pulled back toward the straight segment's middle until the
// curve fits seen from above, then its y the same way until the climb fits too.
export function fitMid(p: PathLike, k: number, want: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const { lo, hi } = midBounds(p, k), r = (v: number) => Math.round(v * 1000) / 1000;
  const clamp = (v: number, i: number) => r(Math.max(lo[i]!, Math.min(hi[i]!, v)));
  const box = { x: clamp(want.x, 0), y: clamp(want.y, 1), z: clamp(want.z, 2) };
  const c = tubeNodes(p, 0), centre = { x: (c[k]![0] + c[k + 1]![0]) / 2, y: (c[k]![1] + c[k + 1]![1]) / 2, z: (c[k]![2] + c[k + 1]![2]) / 2 };
  const fits = (m: { x: number; y: number; z: number }, axes: number[]) => {
    const path = p.path.map((n, i) => (i === k ? { ...n, mid: m } : n));
    return tubeSegments({ path }, 0)[k]!.every((q) => axes.every((i) => q[i]! >= lo[i]! - 1e-3 && q[i]! <= hi[i]! + 1e-3));
  };
  // The furthest of `at(t)`, t from 0 to 1, that still fits on `axes`.
  const furthest = (at: (t: number) => { x: number; y: number; z: number }, axes: number[]) => {
    if (fits(at(1), axes)) return at(1);
    let ok = 0, bad = 1;
    for (let i = 0; i < 24; i++) { const t = (ok + bad) / 2; if (fits(at(t), axes)) ok = t; else bad = t; }
    return at(ok);
  };
  const flat = furthest((t) => ({ x: r(centre.x + (box.x - centre.x) * t), y: box.y, z: r(centre.z + (box.z - centre.z) * t) }), [0, 2]);
  return furthest((t) => ({ ...flat, y: r(centre.y + (box.y - centre.y) * t) }), [1]);
}

// A smooth path (`smooth` on a tube or rails) is one curve through every node with no corner
// anywhere: each span between two nodes is a cubic, and its direction at a node is the line from
// the node before to the node after, or at an end `d0` / `d1` if given (a rails end's stub), else
// toward the next node. `bend` and `mid` are not used. Sampled every SMOOTH_STEP or so.
const SMOOTH_STEP = 0.25;
export function smoothCurve(pts: V3[], d0?: V3, d1?: V3): V3[] {
  const q = pts.filter((v, i) => i === 0 || Math.hypot(...sub(v, pts[i - 1]!)) > 1e-6);
  if (q.length < 2) return q;
  const n = q.length - 1, t = [0];
  for (let i = 1; i <= n; i++) t.push(t[i - 1]! + Math.hypot(...sub(q[i]!, q[i - 1]!)));
  const tan = q.map((v, i): V3 => {
    if (i === 0) return d0 ? unit(d0) : unit(sub(q[1]!, v));
    if (i === n) return d1 ? unit(d1) : unit(sub(v, q[n - 1]!));
    return unit(sub(q[i + 1]!, q[i - 1]!));
  });
  const out: V3[] = [q[0]!];
  for (let i = 0; i < n; i++) {
    const h = t[i + 1]! - t[i]!, steps = Math.max(2, Math.ceil(h / SMOOTH_STEP)), a = q[i]!, b = q[i + 1]!, ta = tan[i]!, tb = tan[i + 1]!;
    for (let k = 1; k <= steps; k++) {
      const s = k / steps, s2 = s * s, s3 = s2 * s;
      const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
      out.push(k === steps ? b : [0, 1, 2].map((j) => h00 * a[j]! + h10 * h * ta[j]! + h01 * b[j]! + h11 * h * tb[j]!) as V3);
    }
  }
  return out;
}
// A smooth path written out as the plain straight path through its samples.
const denseNodes = (pts: V3[], lift: number): TubeNode[] => pts.slice(1).map((v) => ({ x: v[0] - pts[0]![0], y: v[1] - lift, z: v[2] - pts[0]![2], bend: 0 }));

const tangentIn = (s: V3[]) => unit(sub(s[s.length - 1]!, s[s.length - 2]!));
const tangentOut = (s: V3[]) => unit(sub(s[1]!, s[0]!));

// Turn in degrees at each node (0 at the two mouths), between the tangents meeting there.
export function tubeTurns(p: PathLike): number[] {
  const segs = tubeSegments(p);
  return tubeNodes(p).map((_, k) => (k === 0 || k === segs.length ? 0 : angle(tangentIn(segs[k - 1]!), tangentOut(segs[k]!))));
}

// How far each node's arc reaches back and forward along its segments, shrunk where two arcs
// would overlap on one segment. Only a corner between two straight segments is rounded.
function tubeReach(p: PathLike): number[] {
  const c = tubeNodes(p), turns = tubeTurns(p);
  const a = c.map((_, k) => {
    const n = p.path[k - 1];
    if (!n || k === c.length - 1 || n.bend <= 0 || turns[k]! < 1e-3 || turns[k]! > 179 || n.mid || p.path[k]!.mid) return 0;
    return n.bend * Math.tan((turns[k]! * Math.PI) / 360);
  });
  for (let k = 0; k + 1 < c.length; k++) {
    const L = Math.hypot(...sub(c[k + 1]!, c[k]!)), need = a[k]! + a[k + 1]!;
    if (need > L) { a[k] = (a[k]! * L) / need; a[k + 1] = (a[k + 1]! * L) / need; }
  }
  return a;
}

// The tube's rings in local space from one mouth to the other: straight runs need only their
// ends, rounded corners are sampled every ~11 degrees, curved segments along their length, and
// any other corner is one mitred ring.
// Tubes are not validated, so a path the sweep cannot follow (no second mouth, or two nodes on
// one spot) yields no rings and the tube is simply left out; a full U-turn becomes an elbow.
export function tubeRings(p: PathLike, lift = TUBE_R): TubeRing[] {
  if (p.smooth) return tubeRings({ path: denseNodes(smoothCurve(tubeNodes(p, lift)), lift) }, lift);
  const c = tubeNodes(p, lift);
  if (c.length < 2 || c.some((q, k) => k > 0 && Math.hypot(...sub(q, c[k - 1]!)) < 1e-6)) return [];
  const segs = tubeSegments(p, lift), reach = tubeReach(p), turns = tubeTurns(p);
  const out: TubeRing[] = [{ c: c[0]!, d: tangentOut(segs[0]!), m: tangentOut(segs[0]!) }];
  for (let k = 1; k < c.length; k++) {
    const seg = segs[k - 1]!, next = segs[k];
    for (let i = 1; i + 1 < seg.length; i++) { const d = unit(sub(seg[i + 1]!, seg[i - 1]!)); out.push({ c: seg[i]!, d, m: d }); }
    const din = tangentIn(seg);
    if (!next) { out.push({ c: c[k]!, d: din, m: din }); break; }
    const dout = tangentOut(next), curvedHere = seg.length > 2 || next.length > 2;
    if (turns[k]! < 1e-3) { if (curvedHere) out.push({ c: c[k]!, d: din, m: din }); continue; }
    if (turns[k]! > 179) { out.push({ c: c[k]!, d: din, m: din }, { c: c[k]!, d: dout, m: dout }); continue; }
    const a = reach[k]!;
    if (a <= 0) { out.push({ c: c[k]!, d: din, m: unit(add(din, dout)) }); continue; }
    const end = add(c[k]!, din, -a);
    out.push({ c: end, d: din, m: din });
    const th = (turns[k]! * Math.PI) / 180, rho = a / Math.tan(th / 2);
    const u = unit(add(dout, din, -dot(din, dout)));
    const centre = add(end, u, rho);
    const n = Math.max(2, Math.ceil(th / (Math.PI / 16)));
    for (let i = 1; i <= n; i++) {
      const f = (th * i) / n;
      const d = unit(add(add([0, 0, 0], din, Math.cos(f)), u, Math.sin(f)));
      out.push({ c: add(add(centre, u, -rho * Math.cos(f)), din, rho * Math.sin(f)), d, m: d });
    }
  }
  return out;
}

// Moving platform: a slab `w` by `d` (top at y) that travels a schedule. Its start (x, y, z) is the
// first stop and `stops` are the rest, relative to it before `rot`; it pauses `wait` seconds at the
// start and each stop's own `wait` at that stop, and travels between them at `speed`, easing in and
// out of every stop. `pingpong` runs out to the last stop and back the same way; `loop` goes from
// the last stop straight back to the start and round again. `offset` starts it that many seconds
// into its schedule, to stagger several. Its place is a pure function of time, so the physics, the
// picture and the editor preview always agree.
export type MoverLoop = "pingpong" | "loop";
export interface MoverStop { x: number; y: number; z: number; wait: number }
// A moving platform is a slab with a `move` schedule; the rest of the slab is unchanged.
export interface Move { speed: number; wait: number; offset: number; loop: MoverLoop; stops: MoverStop[] }
export type Mover = Piece & { type: "slab"; move: Move };
export const isMoving = (p: Piece): p is Mover => p.type === "slab" && !!p.move;
export const MOVER_SPEED = 3;
export const newMove = (): Move => ({ speed: MOVER_SPEED, wait: 0, offset: 0, loop: "pingpong", stops: [{ x: 0, y: 0, z: -12, wait: 0 }] });

interface MoverLeg { a: MoverStop; b: MoverStop; travel: number; wait: number }
function moverLegs(m: Move): MoverLeg[] {
  const start: MoverStop = { x: 0, y: 0, z: 0, wait: m.wait };
  const route = [start, ...m.stops];
  const order = m.loop === "loop" ? [...route, start] : [...route, ...route.slice(0, -1).reverse()];
  const speed = Math.max(1e-3, m.speed);
  const legs: MoverLeg[] = [];
  for (let k = 0; k + 1 < order.length; k++) {
    const a = order[k]!, b = order[k + 1]!;
    // Easing in and out of each stop: the cosine ease peaks at pi/2 times the mean speed, so the
    // leg takes that much longer to keep `speed` as the top speed.
    legs.push({ a, b, travel: (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / speed) * (Math.PI / 2), wait: b.wait });
  }
  // The cycle opens with the wait at the start, so arriving back there adds none.
  if (legs.length) legs[legs.length - 1]!.wait = 0;
  return legs;
}

// The platform's offset from its start at time t (seconds), before `rot`.
export function moverOffset(p: Mover, t: number): { x: number; y: number; z: number } {
  const m = p.move, legs = moverLegs(m);
  const period = m.wait + legs.reduce((s, l) => s + l.travel + l.wait, 0);
  if (!legs.length || period <= 1e-9) return { x: 0, y: 0, z: 0 };
  let u = (((t + m.offset) % period) + period) % period;
  if (u < m.wait) return { x: 0, y: 0, z: 0 };
  u -= m.wait;
  for (const l of legs) {
    if (u < l.travel) {
      const f = (1 - Math.cos((Math.PI * u) / l.travel)) / 2;
      return { x: l.a.x + (l.b.x - l.a.x) * f, y: l.a.y + (l.b.y - l.a.y) * f, z: l.a.z + (l.b.z - l.a.z) * f };
    }
    u -= l.travel;
    if (u < l.wait) return { x: l.b.x, y: l.b.y, z: l.b.z };
    u -= l.wait;
  }
  return { x: 0, y: 0, z: 0 };
}

// The platform's top-centre in world space at time t.
export function moverAt(p: Mover, t: number): { x: number; y: number; z: number } {
  const o = moverOffset(p, t), r = rotXZ(o.x, o.z, p.rot);
  return { x: p.x + r.x, y: p.y + o.y, z: p.z + r.z };
}

// What a moving platform carries: every piece standing on its top where the level places it
// (structures, planks, seesaws and crates; not other platforms, paths, the start or the goal),
// by index, to the index of the platform. A tilted moving platform carries nothing.
const RIDES: PieceType[] = ["fence", "block", "blockade", "pillar", "bumper", "magnet", "barrier", "crate", "barrel", "cube", "stool", "kicker", "jump", "hoop", "plank", "seesaw"];
export function riders(level: Level): Map<number, number> {
  const out = new Map<number, number>();
  level.pieces.forEach((s, si) => {
    if (!isMoving(s) || isTilted(s)) return;
    level.pieces.forEach((p, pi) => {
      if (!RIDES.includes(p.type) || Math.abs(p.y - s.y) > 1e-3) return;
      const l = rotXZ(p.x - s.x, p.z - s.z, -s.rot);
      if (Math.abs(l.x) <= s.w / 2 + 1e-3 && Math.abs(l.z) <= s.d / 2 + 1e-3) out.set(pi, si);
    });
  });
  return out;
}
// How far a moving platform has carried what rides it at time t, from where the level places it.
export function moverShift(p: Mover, t: number): { x: number; y: number; z: number } {
  const a = moverAt(p, t);
  return { x: a.x - p.x, y: a.y - p.y, z: a.z - p.z };
}

// Bean: a striped capsule prop that glides along a node path laid out like a tube's and shoves
// whatever it meets out of its way. (x, y, z) is its first node and `path` the rest, relative to it
// before `rot`; a node's y is the surface the bean rolls on there, its centre `r` (the ball's radius) above it. `bend`
// rounds a corner, `mid` curves a segment and `smooth` makes the path one curve, as on a tube. It
// lies along the way it sets off (turned `turn` degrees from that about the vertical: 90 lies it
// across it) and keeps that one orientation for the whole run, or with `face` "follow" turns to
// keep lying along the way it is going (turned `turn`), its tip leading, round every bend and
// back on the return. It never rolls, is `len` from tip to tip, and glides BEAN_LIFT above the
// surface at `speed`: `pingpong`
// runs the path out and back, easing out of and into a stop at each end and waiting `wait` seconds
// there; `loop` closes the path with a straight run from the last node back to the first (that
// corner rounded like the last node's; a last node placed on the first closes it itself, with that
// segment's curve) and goes round without a pause. `offset` starts it that many seconds into its
// schedule. Its place is a pure function of time, so the physics, the picture and the editor agree.
export type Bean = Piece & { type: "bean" };
// A bean is as fat as the ball; its `r` is always BEAN_R, never set per bean.
export const BEAN_R = BALL_RADIUS, BEAN_LEN = 2, BEAN_SPEED = 6;
// A bean floats this far above the surface it follows.
export const BEAN_LIFT = 0.05;
// Over this distance a ping-pong bean rolls up to speed from a stop and back down into one.
export const BEAN_EASE = 1.5;
export interface Quat { x: number; y: number; z: number; w: number }
export const quatMul = (a: Quat, b: Quat): Quat => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});
// The rotation taking +y onto the unit vector (x, y, z).
export const quatYTo = (x: number, y: number, z: number): Quat => {
  if (y < -0.999999) return { x: 1, y: 0, z: 0, w: 0 };
  const w = 1 + y, l = Math.hypot(z, x, w);
  return { x: z / l, y: 0, z: -x / l, w: w / l };
};
export const quatAboutY = (rad: number): Quat => ({ x: 0, y: Math.sin(rad / 2), z: 0, w: Math.cos(rad / 2) });

// A bean's centre line in world space, from its first node: the points, how far along each is, and the whole length.
export interface BeanTrack { pts: V3[]; s: number[]; len: number }
export function beanTrack(p: Bean): BeanTrack {
  const pts = beanLine(p).map((v): V3 => { const o = rotXZ(v[0], v[2], p.rot); return [p.x + o.x, p.y + v[1], p.z + o.z]; });
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1]! + Math.hypot(...sub(pts[i]!, pts[i - 1]!)));
  return { pts, s, len: s[s.length - 1] ?? 0 };
}
// The centre line in local space. An open run is the path's rings. A loop is the path wrapped round
// on itself (the last two nodes, the whole round, the first two again) so every corner, the two of
// the closing run included, rounds as an inside corner does, then cut where the round repeats: at
// the middle of the closing run, or at the first node where that run is curved or the path smooth.
function beanLine(p: Bean): V3[] {
  const lift = p.r + BEAN_LIFT, c = tubeNodes(p, lift);
  if (c.length < 2) return [c[0]!];
  if (p.loop !== "loop") { const rings = tubeRings(p, lift); return rings.length ? rings.map((q) => q.c) : [c[0]!]; }
  const closed = Math.hypot(...sub(c[c.length - 1]!, c[0]!)) < 1e-6;
  const liftMid = (m?: { x: number; y: number; z: number }) => (m ? { mid: { x: m.x, y: m.y + lift, z: m.z } } : {});
  const N: TubeNode[] = [{ x: 0, y: lift, z: 0, bend: 0 }, ...p.path.map((n) => ({ x: n.x, y: n.y + lift, z: n.z, bend: n.bend, ...liftMid(n.mid) }))];
  const last = closed ? N.pop()! : N[N.length - 1]!;
  if (N.length < 2) return [c[0]!];
  const k = N.length - 1, first: TubeNode = { ...N[0]!, bend: last.bend, ...(closed && last.mid ? { mid: last.mid } : {}) };
  const at = (n: TubeNode): V3 => [n.x, n.y, n.z];
  let line: V3[], cut: V3;
  if (p.smooth) {
    cut = at(first);
    line = smoothCurve([at(N[k - 1]!), at(N[k]!), cut, ...N.slice(1).map(at), cut, at(N[1]!)]);
  } else {
    const M: TubeNode = { x: (N[k]!.x + first.x) / 2, y: (N[k]!.y + first.y) / 2, z: (N[k]!.z + first.z) / 2, bend: 0 };
    const round = first.mid ? [first] : [M, first];
    const seq = [N[k - 1]!, N[k]!, ...round, ...N.slice(1), ...round, N[1]!];
    cut = at(first.mid ? first : M);
    const o = at(seq[0]!), rel = (n: TubeNode): TubeNode => ({ ...n, x: n.x - o[0], y: n.y - o[1], z: n.z - o[2], ...(n.mid ? { mid: { x: n.mid.x - o[0], y: n.mid.y - o[1], z: n.mid.z - o[2] } } : {}) });
    line = tubeRings({ path: seq.slice(1).map(rel) }, 0).map((q) => add(q.c, o));
  }
  // The segments of the line through the cut point: the round runs from the first to the last.
  const through = (i: number) => {
    const a = line[i]!, b = line[i + 1]!, d = sub(b, a), L2 = dot(d, d);
    const u = L2 < 1e-12 ? 0 : Math.max(0, Math.min(1, dot(sub(cut, a), d) / L2));
    return Math.hypot(...sub(add(a, d, u), cut)) < 1e-6;
  };
  let i1 = -1, i2 = -1;
  for (let i = 0; i + 1 < line.length; i++) if (through(i)) { if (i1 < 0) i1 = i; i2 = i; }
  if (i1 < 0 || i2 <= i1) return [c[0]!];
  const out = [cut, ...line.slice(i1 + 1, i2 + 1), cut];
  return out.filter((v, i) => i === 0 || Math.hypot(...sub(v, out[i - 1]!)) > 1e-9);
}

// How far along its track (from the first node) a bean is at time t: round and round at its speed
// on a loop; out and back on a ping-pong, from rest to full speed over BEAN_EASE and back to rest
// over the same at the far end, waiting `wait` at each end.
export function beanDist(p: Bean, len: number, t: number): number {
  const v = Math.max(1e-3, p.speed), tt = t + p.offset;
  if (len < 1e-9) return 0;
  if (p.loop === "loop") { const period = len / v; return (((tt % period) + period) % period) * v; }
  const E = Math.min(len / 2, BEAN_EASE), tE = (2 * E) / v, T = (len + 2 * E) / v, wait = Math.max(0, p.wait);
  const run = (u: number) => (u < tE ? (v * u * u) / (2 * tE) : u < T - tE ? E + v * (u - tE) : len - (v * (T - u) * (T - u)) / (2 * tE));
  const cycle = 2 * (wait + T);
  let u = ((tt % cycle) + cycle) % cycle;
  if (u < wait) return 0;
  u -= wait;
  if (u < T) return run(u);
  u -= T;
  return u < wait ? len : len - run(u - wait);
}

// The bean's centre and turn in world space at time t: lying along the track's first segment
// turned `turn` degrees about the vertical, however the track winds on, or, following, along its
// way there with its tip leading, flipped on the return. `d` is the level heading along the track.
export interface BeanPose { x: number; y: number; z: number; q: Quat; d: V3 }
export function beanAt(p: Bean, track: BeanTrack, t: number): BeanPose {
  const s = beanDist(p, track.len, t), pts = track.pts, n = pts.length;
  let i = 0;
  for (let lo = 0, hi = n - 2; lo <= hi; ) { const m = (lo + hi) >> 1; if (track.s[m + 1]! < s) lo = m + 1; else { i = m; hi = m - 1; } }
  const a = pts[Math.min(i, n - 1)]!, b = pts[Math.min(i + 1, n - 1)]!, L = track.s[i + 1] !== undefined ? track.s[i + 1]! - track.s[i]! : 0;
  const f = L > 1e-9 ? (s - track.s[i]!) / L : 0, c = add(a, sub(b, a), f);
  const fwd = rotXZ(0, -1, p.rot), m = n - 1;
  // The level heading of segment k, or the piece's own where a segment has no run.
  const seg = (k: number): V3 => {
    const u = pts[k]!, v = pts[k + 1]!, h = Math.hypot(v[0] - u[0], v[2] - u[2]);
    return h > 1e-6 ? [(v[0] - u[0]) / h, 0, (v[2] - u[2]) / h] : [fwd.x, 0, fwd.z];
  };
  // The track turns at each point of its line, so blend each segment's heading with its neighbour's
  // across the halves either side of that point; a loop's line closes, so its ends neighbour each other.
  const closed = m > 1 && Math.hypot(...sub(pts[0]!, pts[m]!)) < 1e-6;
  const near = (k: number) => (closed ? (k + m) % m : Math.max(0, Math.min(m - 1, k)));
  let d: V3 = [fwd.x, 0, fwd.z];
  if (m > 0) {
    const here = seg(i), other = seg(near(f < 0.5 ? i - 1 : i + 1)), w = Math.abs(f - 0.5);
    const bx = here[0] * (1 - w) + other[0] * w, bz = here[2] * (1 - w) + other[2] * w, bh = Math.hypot(bx, bz);
    d = bh > 1e-6 ? [bx / bh, 0, bz / bh] : here;
  }
  const d0: V3 = m > 0 ? seg(0) : [fwd.x, 0, fwd.z];
  let along = d0;
  if (p.face === "follow") {
    // Which way it is travelling: forward unless the next instant is behind this one, or, held
    // at a stop, unless it came in backwards.
    let dir = Math.sign(beanDist(p, track.len, t + 1e-3) - s);
    if (dir === 0) dir = Math.sign(s - beanDist(p, track.len, t - 1e-3)) || 1;
    along = [d[0] * dir, 0, d[2] * dir];
  }
  const axis = rotXZ(along[0], along[2], p.turn ?? 0);
  // Laid flat along +x, then yawed to the axis: a shortest-arc turn would roll its pattern as the heading sweeps.
  const q = quatMul(quatAboutY(Math.atan2(-axis.z, axis.x)), quatYTo(1, 0, 0));
  return { x: c[0], y: c[1], z: c[2], q, d };
}

// Older levels fence a platform's sides on the platform itself: per side true along its whole
// length, false for none, or [from, to] spans along it (units, or degrees on a curve's arcs),
// measured clockwise round the platform seen from above. Loading turns them into fence pieces.
type Fence = boolean | [number, number][];
// `mirror` flips any piece left for right across its own length (local x to -x). Only pieces that are
// not already symmetric take it (MIRRORED); on the rest it changes nothing and is refused.
interface At { x: number; y: number; z: number; mirror?: true }

export type Piece =
  | (At & { type: "start" })
  | (At & { type: "slab"; w: number; d: number; rot: number; tilt: number; roll?: number; twist?: number; curl?: number; move?: Move; belt?: true; glass?: true; shape?: SlabShape })
  | (At & { type: "curve"; inner: number; outer: number; rot: number; sweep?: number; roll?: number; rollAt?: "b" })
  | (At & { type: "ramp"; w: number; d: number; rot: number; rise: number })
  | (At & { type: "bridge"; w: number; d: number; rot: number })
  | (At & { type: "rails"; rot: number; path: TubeNode[]; smooth?: true; lines: 1 | 2; a: RailEnd; b: RailEnd; aYaw?: number; bYaw?: number })
  | (At & { type: "plank"; w: number; h: number; rot: number; tilt: number; side?: boolean; freeze?: boolean; base?: number })
  | (At & { type: "seesaw"; w: number; d: number; h: number; rot: number; tilt: number; freeze?: boolean; dips?: "+z" | "-z" })
  | (At & { type: "board"; w: number; d: number; rot: number; tilt: number; roll?: number; freeze?: boolean })
  | (At & { type: "pangolin"; w: number; d: number; rot: number })
  | (At & { type: "support"; w: number; h: number; rot: number; roll?: number; reach?: number })
  | (At & { type: "gate"; w: number; d: number; h: number; rot: number })
  | (At & { type: "kicker"; w: number; d: number; h: number; rot: number; flat?: number; roll?: number; tilt?: number; track?: number; offset?: number; top?: number })
  | (At & { type: "block"; w: number; h: number; d: number; rot: number })
  | (At & { type: "blockade"; rot: number; roll?: number; tilt?: number })
  | (At & { type: "pillar"; rot?: number; roll?: number; tilt?: number })
  | (At & { type: "barrier"; rot: number; roll?: number; tilt?: number })
  | (At & { type: "crate"; w: number; h: number; d: number; rot: number; roll?: number; tilt?: number })
  | (At & { type: "cube"; rot: number; roll?: number; tilt?: number })
  | (At & { type: "barrel"; r: number; h: number; rot: number; roll?: number; tilt?: number })
  | (At & { type: "stool"; w: number; h: number; d: number; rot: number; track: number; offset: number; slide?: "z" })
  | (At & { type: "bean"; rot: number; r: number; len: number; speed: number; wait: number; offset: number; loop: MoverLoop; turn?: number; face?: "follow"; path: TubeNode[]; smooth?: true })
  | (At & { type: "jump"; w: number; d: number; rot: number; rise: number; roll?: number; tilt?: number })
  | (At & { type: "hole"; w: number; d: number; rot: number; tilt?: number; roll?: number })
  | (At & { type: "spinner"; length: number; speed: number })
  | (At & { type: "goal"; r: number })
  | (At & { type: "tube"; rot: number; path: TubeNode[]; smooth?: true })
  | (At & { type: "fence"; rot: number; path: TubeNode[]; smooth?: true })
  | (At & { type: "hoop"; rot: number; roll?: number; tilt?: number })
  | (At & { type: "column"; h: number; rot?: number; roll?: number; tilt?: number })
  | (At & { type: "bumper"; rot?: number; roll?: number; tilt?: number })
  | (At & { type: "magnet"; rot?: number; roll?: number; tilt?: number })
;

export type PieceType = Piece["type"];
export const PIECE_TYPES: PieceType[] = ["slab", "curve", "ramp", "bridge", "rails", "fence", "plank", "seesaw", "board", "pangolin", "support", "gate", "kicker", "jump", "hole", "blockade", "barrier", "pillar", "column", "bumper", "magnet", "crate", "barrel", "cube", "stool", "bean", "block", "spinner", "tube", "hoop", "goal", "start"];
// Extra add buttons in the editor: a named preset of an existing type, listed after that type.
export const PIECE_VARIANTS: { name: string; base: PieceType; make: (x: number, y: number, z: number) => Piece }[] = [
  { name: "long kicker", base: "kicker", make: (x, y, z) => ({ type: "kicker", x, y, z, w: KICKER_W, d: KICKER_D, h: 1.5, flat: 6, rot: 0 }) },
  { name: "side kicker", base: "kicker", make: (x, y, z) => ({ type: "kicker", x, y, z, w: 1, d: KICKER_D, h: KICKER_H, rot: 0, top: 0.4 }) },
  { name: "sliding kicker", base: "kicker", make: (x, y, z) => ({ type: "kicker", x, y, z, w: KICKER_W, d: KICKER_D, h: KICKER_H, rot: 0, track: KICKER_TRACK, offset: 0 }) },
  { name: "treadmill", base: "slab", make: (x, y, z) => ({ type: "slab", x, y, z, w: LANE_WIDTH, d: 8, rot: 0, tilt: 0, belt: true }) },
  { name: "glass", base: "slab", make: (x, y, z) => ({ type: "slab", x, y, z, w: LANE_WIDTH, d: 16, rot: 0, tilt: 0, glass: true }) },
  { name: "curl", base: "slab", make: (x, y, z) => ({ type: "slab", x, y, z, w: LANE_WIDTH, d: 16, rot: 0, tilt: 0, curl: CURL_DEFAULT }) },
  { name: "C curve", base: "curve", make: (x, y, z) => ({ type: "curve", x, y, z, inner: 8, outer: 8 + LANE_WIDTH, rot: 0, sweep: 180 }) },
  { name: "3/4 curve", base: "curve", make: (x, y, z) => ({ type: "curve", x, y, z, inner: 8, outer: 8 + LANE_WIDTH, rot: 0, sweep: 270 }) },
];
// Pieces that sit on a platform: grid-snapped, with y taken from the surface beneath.
export const isStructure = (p: Piece): boolean =>
  p.type === "block" || p.type === "blockade" || p.type === "pillar" || p.type === "hole" || p.type === "barrier" || p.type === "crate" || p.type === "barrel" || p.type === "cube" || p.type === "stool" || p.type === "kicker" || p.type === "jump" || p.type === "hoop" || p.type === "column" || p.type === "bumper" || p.type === "magnet";
export type Platform = Piece & { type: "slab" | "curve" | "ramp" };
export const isPlatform = (p: Piece): p is Platform => p.type === "slab" || p.type === "curve" || p.type === "ramp";
export type Ramp = Piece & { type: "ramp" };
// A slab tilted about its local x axis (`tilt`, degrees; 90 stands it up as a wall) and/or its
// local z axis (`roll`), pivoting on its centre: rolled first, then tilted, then turned by `rot`.
// Tilted slabs leave the welded floor and become solid rotated boxes instead.
// A tilted or rolled slab, or a rolled curve: solid all round but out of the welded floor.
export const isTilted = (p: Piece): boolean => (p.type === "slab" && (p.tilt !== 0 || !!p.roll)) || (p.type === "curve" && !!p.roll);
// A twisted slab rolls along its length: flat at its near end (local +z), `twist` degrees at its far
// end (local -z), turning evenly between about the centre line of its top. twistAt is the roll at
// local z in radians; twistPoint turns a local point with the cross-section it is in.
export type Slab = Piece & { type: "slab" };
// A shaped slab: each side's two ends pushed out (positive) or pulled in by these, and its middle
// bowed out (positive) or in from the straight line between its ends, all in units. Sides are
// named as fences' are (n is the far side, local -z; e is local +x) and a side's ends by the corners
// they are at, so `e: { n: -1, s: 1 }` pulls the east side in at its north end and out at its south.
export interface SideShape { n?: number; s?: number; e?: number; w?: number; bow?: number }
export type SlabShape = Partial<Record<"n" | "e" | "s" | "w", SideShape>>;
export const isShaped = (p: Piece): p is Slab & { shape: SlabShape } => p.type === "slab" && !!p.shape && Object.values(p.shape).some((s) => Object.values(s).some((v) => v));
// A bowed side is sampled about this far apart.
export const SHAPE_STEP = 1;
// A slab's four sides in local space as point lists, clockwise seen from above (n, e, s, w), each
// from its first corner to its last; a bowed side is a quadratic curve through its ends, sampled.
export function slabSides(p: Slab): Record<"n" | "e" | "s" | "w", XZ[]> {
  const hx = p.w / 2, hz = p.d / 2, sh = p.shape ?? {}, g = (v?: number) => v ?? 0;
  const NW: XZ = [-(hx + g(sh.w?.n)), -(hz + g(sh.n?.w))], NE: XZ = [hx + g(sh.e?.n), -(hz + g(sh.n?.e))];
  const SE: XZ = [hx + g(sh.e?.s), hz + g(sh.s?.e)], SW: XZ = [-(hx + g(sh.w?.s)), hz + g(sh.s?.w)];
  const side = (a: XZ, b: XZ, bow: number, ox: number, oz: number): XZ[] => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!bow || len < 1e-6) return [a, b];
    // The chord's normal that points the side's own way out, and the control point that bows the curve's middle by `bow`.
    let nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len;
    if (nx * ox + nz * oz < 0) { nx = -nx; nz = -nz; }
    const cx = (a[0] + b[0]) / 2 + 2 * bow * nx, cz = (a[1] + b[1]) / 2 + 2 * bow * nz;
    const n = Math.min(32, Math.max(2, Math.ceil(len / SHAPE_STEP)));
    return Array.from({ length: n + 1 }, (_, k): XZ => {
      const t = k / n, u = 1 - t;
      return [u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cz + t * t * b[1]];
    });
  };
  return { n: side(NW, NE, g(sh.n?.bow), 0, -1), e: side(NE, SE, g(sh.e?.bow), 1, 0), s: side(SE, SW, g(sh.s?.bow), 0, 1), w: side(SW, NW, g(sh.w?.bow), -1, 0) };
}
// A slab's outline in local space, clockwise seen from above from its north-west corner.
export function slabOutline(p: Slab): XZ[] {
  const s = slabSides(p);
  return [...s.n.slice(0, -1), ...s.e.slice(0, -1), ...s.s.slice(0, -1), ...s.w.slice(0, -1)];
}
// A kicker or jump pad can roll too: `roll` degrees about its own z axis (the way the ball runs over
// it) through the middle of its base, before `rot`, so it stays standing on the surface.
export function rollPoint(deg: number, v: [number, number, number]): [number, number, number] {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}
// Treadmill: a slab with `belt`, its tiled top and underside (everything inside BELT_FRAME of the
// edge, where platformMesh starts its tiles) opened right through and filled with fat rods across
// it (along local x), shared by both faces: as thick as the platform less BELT_GAP, centred in it.
// They turn so their tops run toward local -z and their bottoms back (docs/levels.md).
export const BELT_FRAME = PLATFORM_EDGE_INSET * 1.5, BELT_PITCH = 0.95, BELT_GAP = 0.04, BELT_MIN = 2;
// The opening's half sizes, each rod's centre z (local; its axis is half the thickness down), radius and half length.
export function beltRods(p: Slab): { ox: number; oz: number; z: number[]; r: number; half: number } {
  const ox = p.w / 2 - BELT_FRAME, oz = p.d / 2 - BELT_FRAME, n = Math.max(1, Math.round((2 * oz) / BELT_PITCH)), pitch = (2 * oz) / n;
  const r = Math.min(PLATFORM_THICKNESS - BELT_GAP, pitch - BELT_GAP) / 2;
  return { ox, oz, z: Array.from({ length: n }, (_, i) => -oz + pitch * (i + 0.5)), r, half: ox - 0.02 };
}
export const isBelt = (p: Piece): p is Slab => p.type === "slab" && !!p.belt;
export const twistAt = (p: Slab, z: number): number => (((p.twist ?? 0) * Math.PI) / 180) * Math.max(0, Math.min(1, (p.d / 2 - z) / p.d));
export function twistPoint(p: Slab, v: [number, number, number]): [number, number, number] {
  const a = twistAt(p, v[2]), c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}
// A glass slab: a plain slab whose tiled top and underside are a see-through pane; its rim, walls,
// seams and holes are a slab's. Drawn only; the physics is a slab's.
export const isGlass = (p: Piece): p is Slab & { glass: true } => p.type === "slab" && !!p.glass;
// A curled slab bends along its length in its own upright plane, like a quarter pipe or a loop:
// flat at its near end (local +z), where it joins the platform before it, and turned `curl` degrees
// (positive up, negative down) at its far end, bending evenly, so its top runs round a circle of
// curlRadius (signed, in units). curlPoint carries a local point (y below the top) round with the
// cross-section it is in. It stays in the welded floor, laid as half-unit strips (docs/platforms.md).
export const isCurled = (p: Piece): p is Slab & { curl: number } => p.type === "slab" && !!p.curl;
export const CURL_DEFAULT = 180, CURL_MAX = 360;
// The ball needs room to roll round inside: a curl's radius is at least this.
export const CURL_MIN_R = 2;
export const curlRadius = (p: Slab): number => p.d / (((p.curl ?? 0) * Math.PI) / 180);
export function curlPoint(p: Slab, v: [number, number, number]): [number, number, number] {
  if (!p.curl) return v;
  const R = curlRadius(p), a = (p.d / 2 - v[2]) / R, c = Math.cos(a), s = Math.sin(a);
  return [v[0], R * (1 - c) + v[1] * c, p.d / 2 - R * s + v[1] * s];
}
// How far along local -z a curled slab's top reaches from its near end, in its XZ footprint: up to
// where it turns vertical.
export const curlReach = (p: Slab & { curl: number }): number => Math.abs(curlRadius(p)) * Math.sin(Math.min((Math.abs(p.curl) * Math.PI) / 180, Math.PI / 2));
// A local point carried onto a slab's top as drawn: twisted or curled with its cross-section.
export const slabPoint = (p: Slab, v: [number, number, number]): [number, number, number] => curlPoint(p, twistPoint(p, v));

// Fraction of a ramp's length that stays level at each end before the incline begins.
export const RAMP_FLAT = 0.25;

// Height of a ramp above its base y at fraction t along its length (0 at local +z, 1 at
// local -z): level landings at both ends with an S-curve climb between them.
export function rampHeight(p: Ramp, t: number): number {
  const s = Math.max(0, Math.min(1, (t - RAMP_FLAT) / (1 - 2 * RAMP_FLAT)));
  return p.rise * LAYER_H * s * s * (3 - 2 * s);
}

// Fence rails run this far in from the platform edge, this high above the surface, and where a run
// ends turn straight down on this radius into the platform, to this far below its top. The rail's
// centre is above a resting ball's centre (BALL_RADIUS), so it meets the ball above its middle and
// pushes it down and back: rolling into a fence never rides over it.
export const FENCE_RAIL_INSET = 0.32, FENCE_RAIL_Y = 0.6, FENCE_RAIL_CORNER = 0.2, FENCE_RAIL_FOOT = 0.1;

// One fenceable side of a platform, in clockwise order round it seen from above. `at(s, inset)`
// is the local point `s` along it, `inset` in from the edge and kept that far off the corners,
// with y the surface height there; `param` maps a local (x, z) back to `s`. `arc` marks a curve's
// arc sides, whose `s` runs 0 to 90 along them; `knots` are where their straight ends meet the arc.
export interface FenceSide { key: string; len: number; arc?: boolean; knots?: number[]; at(s: number, inset: number): { x: number; y: number; z: number }; param(x: number, z: number): number }

export function fenceSides(p: Platform): FenceSide[] {
  const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  if (p.type === "curve") {
    const ri = p.inner, ro = p.outer, c = curveStrip(p), knot = (90 * c.s) / c.len;
    // `q` in 0..90 is the fraction of the way along the centre line, so it means the same at any inset.
    const edge = (q: number, r: number, k: number) => {
      const e = Math.min(k, c.s), [x, z] = c.at(cl((cl(q, 0, 90) / 90) * c.len, e, c.len - e), r);
      return { x, y: 0, z };
    };
    const ang = (x: number, z: number) => (90 * c.param(x, z)) / c.len;
    return [
      { key: "a", len: ro - ri, at: (s, k) => ({ x: cl(ri + s, ri + k, ro - k), y: 0, z: -k }), param: (x) => x - ri },
      { key: "outer", len: 90, arc: true, knots: [knot, 90 - knot], at: (s, k) => edge(s, ro - k, k), param: ang },
      { key: "b", len: ro - ri, at: (s, k) => { const [x, z] = c.at(c.len - k, cl(ro - s, ri + k, ro - k)); return { x, y: 0, z }; }, param: (x, z) => {
        // The point's radius, measured along end b from its inner corner to its outer.
        const [x0, z0] = c.at(c.len, ri), [x1, z1] = c.at(c.len, ro), dx = x1 - x0, dz = z1 - z0;
        return ro - (ri + (((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1)) * (ro - ri));
      } },
      { key: "inner", len: 90, arc: true, knots: [knot, 90 - knot], at: (s, k) => edge(90 - s, ri + k, k), param: (x, z) => 90 - ang(x, z) },
    ];
  }
  if (isShaped(p)) {
    // Each side as its point list: `s` runs along it, the rail `inset` in along the side's inward normal,
    // with a knot at every sample so a fence bends with the curve.
    const polySide = (key: string, pts: XZ[]): FenceSide => {
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
      const len = cum[cum.length - 1]!;
      const seg = (t: number) => { let i = 0; while (i < pts.length - 2 && cum[i + 1]! < t) i++; return i; };
      return {
        key, len, knots: cum.slice(1, -1),
        at: (s, k) => {
          const t = cl(s, k, len - k), i = seg(t), a = pts[i]!, b = pts[i + 1]!, l = cum[i + 1]! - cum[i]! || 1, f = (t - cum[i]!) / l;
          const dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l;
          return { x: a[0] + (b[0] - a[0]) * f - dz * k, y: 0, z: a[1] + (b[1] - a[1]) * f + dx * k };
        },
        param: (x, z) => {
          let best = 0, bd = Infinity;
          for (let i = 0; i + 1 < pts.length; i++) {
            const a = pts[i]!, b = pts[i + 1]!, dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
            const f = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)), d = Math.hypot(a[0] + dx * f - x, a[1] + dz * f - z);
            if (d < bd) { bd = d; best = cum[i]! + f * Math.sqrt(L2); }
          }
          return best;
        },
      };
    };
    const ss = slabSides(p);
    return [polySide("n", ss.n), polySide("e", ss.e), polySide("s", ss.s), polySide("w", ss.w)];
  }
  const hx = p.w / 2, hz = p.d / 2;
  const pt = (x: number, z: number) => ({ x, y: p.type === "ramp" ? rampHeight(p, (hz - z) / p.d) : 0, z });
  const sides: FenceSide[] = [
    { key: "n", len: p.w, at: (s, k) => pt(cl(-hx + s, -hx + k, hx - k), -hz + k), param: (x) => x + hx },
    { key: "e", len: p.d, at: (s, k) => pt(hx - k, cl(-hz + s, -hz + k, hz - k)), param: (_x, z) => z + hz },
    { key: "s", len: p.w, at: (s, k) => pt(cl(hx - s, -hx + k, hx - k), hz - k), param: (x) => hx - x },
    { key: "w", len: p.d, at: (s, k) => pt(-hx + k, cl(hz - s, -hz + k, hz - k)), param: (_x, z) => hz - z },
  ];
  return p.type === "ramp" ? sides.filter((s) => s.key === "e" || s.key === "w") : sides;
}

// A side's fenced spans, sorted, clipped to the side and with empty ones dropped.
function fenceSpans(f: Fence, len: number): [number, number][] {
  if (f === true) return [[0, len]];
  if (!f) return [];
  return f.map(([a, b]): [number, number] => [Math.max(0, Math.min(a, b)), Math.min(len, Math.max(a, b))])
    .filter(([a, b]) => b - a > 1e-6).sort((a, b) => a[0] - b[0]);
}

// Where along a side a rail from a to b bends: evenly along an arc side (and at its knots) or a ramp, else just its ends.
export function fenceSamples(p: Platform, side: FenceSide, a: number, b: number): number[] {
  const n = side.arc ? Math.max(1, Math.ceil(((b - a) / 90) * 12)) : p.type === "ramp" ? Math.max(1, Math.ceil(b - a)) : p.type === "slab" && (p.twist || p.curl) ? Math.max(1, Math.ceil((b - a) * 2)) : 1;
  const out = Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n);
  for (const k of side.knots ?? []) if (k > a + 1e-6 && k < b - 1e-6 && out.every((s) => Math.abs(s - k) > 1e-6)) out.push(k);
  return out.sort((x, y) => x - y);
}

// Fence: one rail at fence height (FENCE_RAIL_Y) over a path laid like a tube's: (x, y, z) is its
// first node and `path` the rest, relative to it before `rot`; a node's y is the surface the fence
// stands on there. `bend` rounds a corner, `mid` curves a segment, `smooth` makes it one curve.
// Each end turns straight down on FENCE_RAIL_CORNER, to FENCE_RAIL_FOOT below the surface.
export type FencePiece = Piece & { type: "fence" };
export function fenceRings(p: { path: TubeNode[]; smooth?: true }): TubeRing[] {
  const top = tubeNodes(p, FENCE_RAIL_Y), first = top[0]!, last = top[top.length - 1]!, lastNode = p.path[p.path.length - 1];
  if (!lastNode) return [];
  const down = (v: V3): V3 => [v[0], v[1] - FENCE_RAIL_Y - FENCE_RAIL_FOOT, v[2]];
  const lift = (m?: { x: number; y: number; z: number }) => (m ? { mid: { x: m.x, y: m.y + FENCE_RAIL_Y, z: m.z } } : {});
  const between: TubeNode[] = p.smooth
    ? smoothCurve(top).slice(1, -1).map((v) => ({ x: v[0], y: v[1], z: v[2], bend: 0 }))
    : p.path.slice(0, -1).map((n) => ({ x: n.x, y: n.y + FENCE_RAIL_Y, z: n.z, bend: n.bend, ...lift(n.mid) }));
  const foot = down(first), rel = (n: TubeNode): TubeNode => ({ ...n, x: n.x - foot[0], y: n.y - foot[1], z: n.z - foot[2], ...(n.mid ? { mid: { x: n.mid.x - foot[0], y: n.mid.y - foot[1], z: n.mid.z - foot[2] } } : {}) });
  const end = down(last);
  const path = [
    { x: first[0], y: first[1], z: first[2], bend: FENCE_RAIL_CORNER },
    ...between,
    { x: last[0], y: last[1], z: last[2], bend: FENCE_RAIL_CORNER, ...(p.smooth ? {} : lift(lastNode.mid)) },
    { x: end[0], y: end[1], z: end[2], bend: 0 },
  ].map(rel);
  return tubeRings({ path }, 0).map((q) => ({ ...q, c: add(q.c, foot) }));
}

// A soft fence is a snake: its head, SNAKE_HEAD.r round, rests on the surface (sunk SNAKE_HEAD.sink)
// at the fence's first end, its centre SNAKE_HEAD.out back along the fence's own line past the rail's
// drop, facing `d`, away from the fence. In the piece's frame like fenceRings.
export const SNAKE_HEAD = { r: 0.2, out: 0.1, sink: 0.03 };
export function snakeHead(p: FencePiece): { c: V3; d: V3 } | null {
  const top = tubeNodes(p, FENCE_RAIL_Y), first = top[0], mid = p.path[0]?.mid;
  const next: V3 | undefined = !p.smooth && mid ? [mid.x, 0, mid.z] : top[1];
  if (!first || !next) return null;
  const f = Math.hypot(next[0] - first[0], next[2] - first[2]);
  if (f < 1e-6) return null;
  const d: V3 = [(first[0] - next[0]) / f, 0, (first[2] - next[2]) / f];
  return { c: [first[0] + d[0] * SNAKE_HEAD.out, first[1] - FENCE_RAIL_Y + SNAKE_HEAD.r - SNAKE_HEAD.sink, first[2] + d[2] * SNAKE_HEAD.out], d };
}

// A fence piece along the whole of one side of platform `p` (a key from fenceSides).
export const platformFence = (p: Platform, key: string): Piece[] => legacyFences(p, { [key]: true });

// An older level's fenced sides on platform `p` as fence pieces: spans that meet at a corner join
// into one fence, each running clockwise so its inside is on its right. Arc stretches become
// curved segments, a ramp's side follows the slope node by node, and a tilted slab's are dropped.
function legacyFences(p: Platform, spec: Record<string, Fence>): Piece[] {
  if (isTilted(p)) return [];
  const sides = fenceSides(p), rot = pieceRot(p), r3 = (v: number) => Math.round(v * 1000) / 1000;
  const base = (side: FenceSide, at: number): V3 => {
    const q = side.at(at, FENCE_RAIL_INSET);
    if (p.type !== "slab" || (!p.twist && !p.curl)) return [q.x, q.y, q.z];
    const v = slabPoint(p, [q.x, FENCE_RAIL_Y + q.y, q.z]);
    return [v[0], v[1] - FENCE_RAIL_Y, v[2]];
  };
  type Node = { v: V3; mid?: V3 };
  const spans: { side: number; nodes: Node[]; start: boolean; end: boolean }[] = [];
  sides.forEach((side, k) => {
    for (const [a, b] of fenceSpans(spec[side.key] ?? false, side.len)) {
      const knots = side.knots ?? [];
      const cuts = side.arc ? [a, ...knots.filter((q) => q > a + 1e-6 && q < b - 1e-6), b] : fenceSamples(p, side, a, b);
      const nodes: Node[] = [{ v: base(side, cuts[0]!) }];
      for (let i = 1; i < cuts.length; i++) {
        const s0 = cuts[i - 1]!, s1 = cuts[i]!, onArc = side.arc && s0 >= knots[0]! - 1e-6 && s1 <= knots[1]! + 1e-6;
        nodes.push({ v: base(side, s1), ...(onArc ? { mid: base(side, (s0 + s1) / 2) } : {}) });
      }
      spans.push({ side: k, nodes, start: a < 1e-6, end: b > side.len - 1e-6 });
    }
  });
  const n = spans.length;
  if (!n) return [];
  const links = (i: number) => {
    const s = spans[i]!, t = spans[(i + 1) % n]!, ps = s.nodes[s.nodes.length - 1]!.v, pt = t.nodes[0]!.v;
    return s.end && t.start && t.side === (s.side + 1) % sides.length && Math.hypot(ps[0] - pt[0], ps[2] - pt[2]) < 1;
  };
  const runs: Node[][] = [];
  const all = spans.every((_, i) => links(i));
  for (let i = 0; i < n; i++) {
    if (!all && links((i + n - 1) % n)) continue;
    const run = [...spans[i]!.nodes];
    for (let j = i; links(j % n) && j - i < n - 1; j++) run.push(...spans[(j + 1) % n]!.nodes.slice(1));
    runs.push(run);
    if (all) break;
  }
  const world = (v: V3): V3 => { const o = rotXZ(v[0], v[2], rot); return [p.x + o.x, p.y + v[1], p.z + o.z]; };
  return runs.map((run): Piece => {
    const w = run.map((q) => ({ v: world(q.v), mid: q.mid ? world(q.mid) : undefined })), o = w[0]!.v;
    const rel = (v: V3) => ({ x: r3(v[0] - o[0]), y: r3(v[1] - o[1]), z: r3(v[2] - o[2]) });
    return { type: "fence", x: r3(o[0]), y: r3(o[1]), z: r3(o[2]), rot: 0,
      path: w.slice(1).map((q) => ({ ...rel(q.v), bend: FENCE_RAIL_CORNER, ...(q.mid ? { mid: rel(q.mid) } : {}) })) };
  });
}

// Lowest and highest top-surface y of a platform.
export function yRange(p: Platform): [number, number] {
  if (isCurled(p)) {
    const far = p.y + curlRadius(p) * (1 - Math.cos(Math.min((Math.abs(p.curl) * Math.PI) / 180, Math.PI)));
    return [Math.min(p.y, far), Math.max(p.y, far)];
  }
  if (p.type !== "ramp") return [p.y, p.y];
  const top = p.y + p.rise * LAYER_H;
  return [Math.min(p.y, top), Math.max(p.y, top)];
}

// Top-surface y of a platform at world (x, z), assuming the point is on it.
export function platformHeightAt(p: Platform, x: number, z: number): number {
  if (isCurled(p)) {
    const l = rotXZ(x - p.x, z - p.z, -p.rot), R = curlRadius(p);
    const a = Math.min(Math.asin(Math.max(0, Math.min(1, (p.d / 2 - l.z) / Math.abs(R)))), (Math.abs(p.curl) * Math.PI) / 180);
    return p.y + R * (1 - Math.cos(a));
  }
  if (p.type === "slab" && p.twist) {
    const l = rotXZ(x - p.x, z - p.z, -p.rot), a = twistAt(p, l.z);
    return p.y + l.x * Math.tan(Math.max(-1.55, Math.min(1.55, a)));
  }
  if (p.type !== "ramp") return p.y;
  const l = rotXZ(x - p.x, z - p.z, -pieceRot(p));
  return p.y + rampHeight(p, (p.d / 2 - l.z) / p.d);
}
// New pieces are sized in multiples of 4, the unit that looks right; a lane is two of them.
export const LANE_WIDTH = 8;

export type Bridge = Piece & { type: "bridge" };
export interface BridgePlank { y: number; z: number; tilt: number; len: number }
export interface BridgeChain { seg: number; hinges: { y: number; z: number }[]; planks: BridgePlank[] }

// A bridge's rest pose in local space: hinge points from the near anchor (local +z) to the far
// one, and each plank's centre, tilt about local x in degrees, and length. With slack the hinges
// lie on a circular arc through the two anchors, so every link is exactly `seg` long and the
// physics chain starts with no constraint to settle.
export function bridgeChain(p: Bridge): BridgeChain {
  const n = Math.max(1, Math.round(p.d / BRIDGE_PITCH));
  const seg = (p.d * (1 + (n > 1 ? BRIDGE_SLACK : 0))) / n;
  // Half-angle each link subtends at the arc centre: sin(n b) / sin(b) = d / seg.
  let lo = 1e-6, hi = Math.PI / (2 * n);
  const ratio = (b: number) => Math.sin(n * b) / Math.sin(b);
  if (n > 1 && ratio(hi) < p.d / seg) for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (ratio(m) > p.d / seg) lo = m; else hi = m; }
  const b = n > 1 ? (lo + hi) / 2 : 0;
  const R = b > 0 ? seg / (2 * Math.sin(b)) : Infinity;
  const hinges = Array.from({ length: n + 1 }, (_, k) => {
    if (b === 0) return { y: -BRIDGE_HINGE_DROP, z: p.d / 2 - k * seg };
    const phi = (n - 2 * k) * b;
    return { y: -BRIDGE_HINGE_DROP - R * (Math.cos(phi) - Math.cos(n * b)), z: R * Math.sin(phi) };
  });
  const planks = hinges.slice(0, -1).map((a, k) => {
    const c = hinges[k + 1]!;
    return { y: (a.y + c.y) / 2, z: (a.z + c.z) / 2, tilt: (Math.atan2(c.y - a.y, a.z - c.z) * 180) / Math.PI, len: seg - BRIDGE_PLANK_GAP };
  });
  return { seg, hinges, planks };
}

// `thumb`, given, is what the menu card's picture frames: a centre, how far round it to show, and
// `yaw` degrees to turn the camera round it from the usual angle.
// A ball (or prop) that falls this far below the level's lowest point is sent back.
export const RESPAWN_DROP = 8;
// The height below which a fallen ball respawns: RESPAWN_DROP under the lowest platform top, ramp
// end, path node, moving platform stop or prop in the level.
export function respawnY(level: Level): number {
  let low = Infinity;
  for (const p of level.pieces) {
    low = Math.min(low, p.y);
    if (p.type === "ramp" || isCurled(p)) low = Math.min(low, yRange(p)[0]);
    if (p.type === "tube" || p.type === "rails" || p.type === "fence" || p.type === "bean") for (const n of p.path) low = Math.min(low, p.y + n.y);
    if (p.type === "slab" && p.move) for (const s of p.move.stops) low = Math.min(low, p.y + s.y);
  }
  return (Number.isFinite(low) ? low : 0) - RESPAWN_DROP;
}
// The worlds levels are grouped into, a tab each in the level select; a level without `world` is in Archive.
// `tag` prefixes a level's number in the menus: B1, B2 in Basics, E1 in Expert, W1 in Workshop (community levels), A1 in Archive.
export const WORLDS = [{ id: "basics", name: "Basics", tag: "B" }, { id: "expert", name: "Expert", tag: "E" }, { id: "workshop", name: "Workshop", tag: "W" }, { id: "archive", name: "Archive", tag: "A" }] as const;
export type World = (typeof WORLDS)[number]["id"];
export const worldOf = (level: Level): World => level.world ?? "archive";
// A level's label in its world's list: the world's tag and its number there, B3 or E1.
export const levelCode = (level: Level, n: number): string => `${WORLDS.find((w) => w.id === worldOf(level))!.tag}${n}`;// `hidden` keeps a level out of the player's list (a playground); without it a level is public.
export interface Level { id: string; name: string; hidden?: true; world?: World; thumb?: { x: number; y: number; z: number; r: number; yaw?: number }; pieces: Piece[] }

export type PartKind = "platform" | "block";
// `r` rounds every edge and corner, as drawn.
export interface Box { kind: PartKind; x: number; y: number; z: number; w: number; h: number; d: number; r?: number }
// A ring sector sweeping from local +x toward -z, between angles a0 and a1 (degrees, default 0 and 90).
export interface Sector { kind: PartKind; inner: number; outer: number; y0: number; y1: number; a0?: number; a1?: number }
// An upright cylinder standing on the piece's y at local (x, z).
export interface Cylinder { r: number; h: number; x?: number; z?: number; y0?: number }

// Local-space parts of a piece, before the piece's rotation and translation.
export function pieceBoxes(p: Piece): Box[] {
  const T = PLATFORM_THICKNESS;
  if (p.type === "slab") return [{ kind: "platform", x: 0, y: -T / 2, z: 0, w: p.w, h: T, d: p.d }];
  if (p.type === "block") return [{ kind: "block", x: 0, y: p.h / 2, z: 0, w: p.w, h: p.h, d: p.d, r: Math.min(BLOCK_R, p.w / 2, p.h / 2, p.d / 2) }];
  if (p.type === "blockade") return [
    { kind: "block", x: 0, y: BLOCKADE_H / 2, z: 0, w: BLOCKADE_W, h: BLOCKADE_H, d: BLOCKADE_D, r: softProps() ? BUNNY.r : BLOCKADE_R },
    ...(softProps() ? [-1, 1].map((s): Box => ({ kind: "block", x: s * BUNNY.ear.x, y: BLOCKADE_H + BUNNY.ear.h / 2, z: 0, w: BUNNY.ear.w, h: BUNNY.ear.h, d: BUNNY.ear.d, r: BUNNY.ear.r })) : []),
  ];
  if (p.type === "barrier") { const h = BARRIER_H - BARRIER_LEG; return [{ kind: "block", x: 0, y: BARRIER_LEG + h / 2, z: 0, w: BARRIER_W, h, d: BARRIER_D, r: BARRIER_R }]; }
  // Rolled 180 a support turns over about its platform's mid-thickness (see supportPillars).
  if (p.type === "support" && softProps()) return whaleParts(p).boxes.map((b) => (supportOver(p) ? { ...b, x: -b.x, y: -PLATFORM_THICKNESS - b.y } : b));
  if (p.type === "support") return supportPillars(p).map((c) => {
    const mid = (c.y0 + c.y1) / 2;
    return { kind: "block", x: c.x, y: supportOver(p) ? -PLATFORM_THICKNESS - mid : mid, z: c.z, w: SUPPORT_W, h: c.y1 - c.y0, d: SUPPORT_D };
  });
  return [];
}

// The local axis a stool slides along: x (left and right) unless `slide` is "z" (front and back).
export const stoolAxis = (p: Piece & { type: "stool" }): "x" | "z" => (p.slide === "z" ? "z" : "x");
// How far a stool's centre can slide each way from its track's centre along its axis, and where
// it starts.
export function stoolSlide(p: Piece & { type: "stool" }): { lo: number; hi: number; at: number } {
  const half = Math.max(0, (p.track - (stoolAxis(p) === "z" ? p.d : p.w)) / 2);
  return { lo: -half, hi: half, at: Math.max(-half, Math.min(half, p.offset)) };
}

// Upright cylinders standing on the piece's y.
export function pieceCylinders(p: Piece): Cylinder[] {
  if (p.type === "barrier") return (softProps() ? [0] : [BARRIER_LEG_X, -BARRIER_LEG_X]).map((x) => ({ r: BARRIER_LEG_R, h: BARRIER_LEG + 0.1, x, z: 0 }));
  if (p.type === "column") return [{ r: COLUMN_R, h: p.h }];
  if (p.type === "support" && softProps()) return whaleParts(p).cylinders.map((c) => (supportOver(p) ? { ...c, x: -(c.x ?? 0), y0: -PLATFORM_THICKNESS - ((c.y0 ?? 0) + c.h) } : c));
  if (p.type === "pillar") return softProps() ? [{ r: PILLAR_R, h: GIRAFFE.neck }] : [
    { r: PILLAR_R, h: PILLAR_H - PILLAR_CAP },
    { r: PILLAR_R + PILLAR_COLLAR.r, h: PILLAR_COLLAR.h, y0: PILLAR_H - PILLAR_CAP },
    { r: PILLAR_R + PILLAR_RING.r, h: PILLAR_RING.h },
  ];
  if (p.type === "spinner") return [{ r: SPINNER_HUB_R, h: SPINNER_HEIGHT + 0.05 }];
  if (p.type === "goal") return [{ r: p.r, h: GOAL_DISC_H }];
  return [];
}

// Balls standing out of a piece at local (x, y, z): the giraffe's head, muzzle, ears and horns, the
// turtle's head and feet, the ladybug's head and the octopus's arms.
export interface Ball { r: number; x: number; y: number; z: number }
export function pieceBalls(p: Piece): Ball[] {
  if (!softProps()) return [];
  if (p.type === "kicker") {
    const T = TURTLE, f = p.flat ?? 0, front = (p.d + f) / 2, back = -front, [ha, hb] = kickerSpan(p, T.head.y);
    const feet = (z: number): Ball[] => { const [a, b] = kickerSpan(p, T.foot.y / p.h); return [{ r: T.foot.r, x: a - 0.02, y: T.foot.y, z }, { r: T.foot.r, x: b + 0.02, y: T.foot.y, z }]; };
    return [{ r: T.head.r, x: (ha + hb) / 2, y: p.h * T.head.y, z: back - T.head.out }, ...feet(front - 0.35 * p.d), ...feet(back + 0.3)];
  }
  if (p.type === "bumper") return [{ r: LADYBUG.head.r, x: 0, y: LADYBUG.head.y, z: LADYBUG.head.z }];
  if (p.type === "stool") return [-1, 1].map((s): Ball => ({ r: PIG.ear.r, x: s * (p.w / 2 - PIG.ear.in), y: p.h / 2 + PIG.ear.up, z: 0 }));
  if (p.type === "crate") return [-1, 1].flatMap((s): Ball[] => [
    { r: COW.ear.r, x: s * (p.w / 2 + COW.ear.out), y: p.h / 2 - COW.ear.down, z: p.d / 2 - COW.ear.back },
    { r: COW.horn.r, x: s * COW.horn.x, y: p.h / 2 + COW.horn.up, z: p.d / 2 - COW.horn.back },
  ]);
  if (p.type === "barrel") return [-1, 1].map((s): Ball => ({ r: OWL.tuft.r, x: s * OWL.tuft.x, y: p.h / 2 + OWL.tuft.up, z: 0 }));
  if (p.type === "column") return [{ r: PENGUIN.beak.r, x: 0, y: p.h - PENGUIN.beak.down, z: COLUMN_R + 0.02 }];
  if (p.type === "support") return whaleParts(p).balls.map((b) => (supportOver(p) ? { ...b, x: -b.x, y: -PLATFORM_THICKNESS - b.y } : b));
  if (p.type === "magnet") return Array.from({ length: OCTOPUS.arm.n }, (_, k): Ball => { const a = ((k + 0.5) / OCTOPUS.arm.n) * Math.PI * 2; return { r: OCTOPUS.arm.r, x: Math.sin(a) * OCTOPUS.arm.at, y: OCTOPUS.arm.y, z: Math.cos(a) * OCTOPUS.arm.at }; });
  if (p.type !== "pillar") return [];
  const G = GIRAFFE;
  return [
    { r: G.head, x: 0, y: G.headY, z: 0 },
    { r: G.muzzle.r, x: 0, y: G.headY + G.muzzle.y, z: G.muzzle.z },
    ...[-1, 1].flatMap((s) => [
      { r: G.ear.r, x: s * G.ear.x, y: G.headY + G.ear.y, z: G.ear.z },
      { r: G.horn.r, x: s * G.horn.x, y: G.headY + G.horn.y, z: G.horn.z },
    ]),
  ];
}

export function pieceSectors(p: Piece): Sector[] {
  if (p.type !== "curve") return [];
  return [{ kind: "platform", inner: p.inner, outer: p.outer, y0: -PLATFORM_THICKNESS, y1: 0, a1: curveSweep(p) }];
}

export function rotXZ(x: number, z: number, deg: number): { x: number; z: number } {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return { x: x * c + z * s, z: -x * s + z * c };
}

export type { XZ } from "./poly.ts";
import type { XZ } from "./poly.ts";
import { railsLoop } from "./geometry.ts";
import { ENV } from "./palette.ts";
import earcut from "earcut";

// A hole's outline in world XZ.
export function holeFootprint(h: Piece & { type: "hole" }): XZ[] {
  const hx = h.w / 2, hz = h.d / 2;
  const W = (x: number, z: number): XZ => { const o = rotXZ(x, z, h.rot); return [h.x + o.x, h.z + o.z]; };
  return [W(-hx, -hz), W(hx, -hz), W(hx, hz), W(-hx, hz)];
}

// A point in a slab's or hole's own frame (x across, y up from its top, z along) out to the world, and
// back: roll about z, then tilt about x, then `rot` about y, as the scene turns their groups.
type Framed = { x: number; y: number; z: number; rot?: number; tilt?: number; roll?: number };
export function frameToWorld(p: Framed, v: V3): V3 {
  const r = rollPoint(p.roll ?? 0, v), t = ((p.tilt ?? 0) * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const y = r[1] * c - r[2] * s, z = r[1] * s + r[2] * c, o = rotXZ(r[0], z, p.rot ?? 0);
  return [p.x + o.x, p.y + y, p.z + o.z];
}
export function worldToFrame(p: Framed, v: V3): V3 {
  const o = rotXZ(v[0] - p.x, v[2] - p.z, -(p.rot ?? 0)), t = ((p.tilt ?? 0) * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), y = v[1] - p.y;
  return rollPoint(-(p.roll ?? 0), [o.x, y * c + o.z * s, -y * s + o.z * c]);
}
// Holes cut into a tilted or rolled slab: those lying flat on its top, turned with it, as outlines in the
// slab's own x-z. (A level slab's holes are holesOn.)
export function holeCuts(level: Level, p: Piece): XZ[][] {
  if (p.type !== "slab" || !isTilted(p) || isMoving(p) || p.twist || p.curl || p.belt) return [];
  const out: XZ[][] = [];
  for (const h of level.pieces) {
    if (h.type !== "hole") continue;
    const local = [[-h.w / 2, -h.d / 2], [h.w / 2, -h.d / 2], [h.w / 2, h.d / 2], [-h.w / 2, h.d / 2]].map(([x, z]) => worldToFrame(p, frameToWorld(h, [x!, 0, z!])));
    if (local.every((v) => Math.abs(v[1]) < 1e-4)) out.push(local.map((v): XZ => [v[0], v[2]]));
  }
  return out;
}
// A hole that is tilted or rolled only ever cuts a slab turned the same way (holeCuts).
export const holeTurned = (h: Piece): boolean => h.type === "hole" && (!!h.tilt || !!h.roll);
// Holes cut into slab `p`: those resting on its top surface. Curves and ramps are not cut.
export function holesOn(level: Level, p: Piece): XZ[][] {
  if (p.type !== "slab" || isTilted(p) || isMoving(p) || p.twist || p.curl || p.belt) return [];
  const out: XZ[][] = [];
  for (const h of level.pieces) if (h.type === "hole" && !holeTurned(h) && Math.abs(h.y - p.y) < 1e-6) out.push(holeFootprint(h));
  return out;
}
export const CURVE_SEGMENTS = 24;

export type Curve = Piece & { type: "curve" };
// A rolled curve turns about the centre line of one end (end a, or end b with `rollAt`), level with its
// top, right-handed about that end's outward heading, as a slab rolls about its own centre line: that end
// stays where it was and banks off the platform it meets, and the other end swings round.
export function curveRollFrame(p: Curve): { pivot: V3; axis: V3 } {
  const c = curveStrip(p), m = (p.inner + p.outer) / 2;
  if (p.rollAt !== "b") return { pivot: [m, 0, 0], axis: [0, 0, 1] };
  const [x, z] = c.at(c.len, m);
  return { pivot: [x, 0, z], axis: [-Math.sin(c.sweep), 0, -Math.cos(c.sweep)] };
}
function rollAbout(p: Curve, v: V3, deg = p.roll ?? 0): V3 {
  const { pivot, axis: k } = curveRollFrame(p), t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const w = sub(v, pivot), kw: V3 = [k[1] * w[2] - k[2] * w[1], k[2] * w[0] - k[0] * w[2], k[0] * w[1] - k[1] * w[0]];
  return add(add(add(pivot, w, c), kw, s), k, dot(k, w) * (1 - c));
}
// The swinging end of a rolled curve lands on the grid: turned rigidly it would land off it (30 degrees
// swings it by cos 30), so it is moved to the nearest whole unit across and half layer up, and the curve
// takes that nudge in gradually from nothing at the end it turns about. Both ends stay square, and the
// end it turns about stays exactly put. Returned unrolled, in local space.
function curveRollNudge(p: Curve): V3 {
  const c = curveStrip(p), m = (p.inner + p.outer) / 2, [x, z] = c.at(p.rollAt === "b" ? 0 : c.len, m);
  const r = rollAbout(p, [x, 0, z]), o = rotXZ(r[0], r[2], p.rot), wx = p.x + o.x, wy = p.y + r[1], wz = p.z + o.z;
  const d = rotXZ(Math.round(wx) - wx, Math.round(wz) - wz, -p.rot), dy = Math.round(wy * 2) / 2 - wy;
  const { pivot } = curveRollFrame(p);
  return sub(rollAbout(p, add(pivot, [d.x, dy, d.z]), -(p.roll ?? 0)), pivot);
}
export function curveRollPoint(p: Curve, v: V3): V3 {
  const c = curveStrip(p), u = c.param(v[0], v[2]), t = Math.max(0, Math.min(1, p.rollAt === "b" ? 1 - u / c.len : u / c.len));
  return rollAbout(p, add(v, curveRollNudge(p), t * t * (3 - 2 * t)));
}
// Each end of a curve runs this far dead straight before the arc begins, so its ends are square.
export const CURVE_STRAIGHT = 2;
// A curve's arc turns `sweep` degrees: 90 (a corner, the default), 180 (a C, two corners in one
// piece) or 270 (a 3/4 ring, its far end heading back across the near end's line).
export const CURVE_SWEEPS = [90, 180, 270];
// A 3/4 curve's inner must be at least this, or its two straight ends cross.
export const CURVE_34_MIN_INNER = 2 * CURVE_STRAIGHT;
export const curveSweep = (p: Curve): number => p.sweep ?? 90;
// Segments round a curve's arc, in its footprint and its floor: CURVE_SEGMENTS per quarter turn.
export const curveSegments = (p: Curve): number => Math.round((CURVE_SEGMENTS * curveSweep(p)) / 90);

// A curve laid along its centre line, `len` long from end a (local +x) to end b: `at(u, r)` is the
// local point u along it and r out from the corner it turns round (r from inner to outer), and
// `param` maps a local point back to u. The ends run straight for `s`; the arc between them turns
// `sweep` about (s, -s), so a corner's ends sit where a plain quarter ring's would, a C's end b
// comes back level with end a, heading local +z, and a 3/4 curve's end b heads local +x, 2s on
// the far side of end a's line.
export function curveStrip(p: Curve): { s: number; len: number; sweep: number; at(u: number, r: number): XZ; param(x: number, z: number): number } {
  const s = Math.min(CURVE_STRAIGHT, Math.max(0, p.inner)), R = (p.inner + p.outer) / 2 - s, sweep = (curveSweep(p) * Math.PI) / 180, arc = R * sweep;
  const cs = Math.cos(sweep), sn = Math.sin(sweep);
  const at = (u: number, r: number): XZ => {
    if (u <= s) return [r, -u];
    if (u >= s + arc) { const e = u - s - arc; return [s + (r - s) * cs - e * sn, -s - (r - s) * sn - e * cs]; }
    const a = (u - s) / R;
    return [s + (r - s) * Math.cos(a), -s - (r - s) * Math.sin(a)];
  };
  return {
    s, len: 2 * s + arc, sweep, at,
    param: (x, z) => {
      // The nearest of the three runs (end a's straight, the arc, end b's straight), each clamped to
      // its own length and the strip's width: on the strip one of them lands exactly; past a half
      // turn the straights share the arc's open quarter, so neither can be told by its half-plane
      // alone, and unclamped, end a's line would run on through end b.
      const dx = x - s, dz = z + s, rc = (r: number) => Math.max(p.inner, Math.min(p.outer, r));
      let a = Math.atan2(-dz, dx); if (a < 0) a += 2 * Math.PI;
      const runs: [number, number][] = [
        [Math.max(0, Math.min(s, -z)), rc(x)],
        [s + R * Math.min(sweep, a), rc(s + Math.hypot(dx, dz))],
        [s + arc + Math.max(0, Math.min(s, -dx * sn - dz * cs)), rc(s + dx * cs - dz * sn)],
      ];
      let best = 0, near = Infinity;
      for (const [u, r] of runs) { const [px, pz] = at(u, r), d = Math.hypot(px - x, pz - z); if (d < near - 1e-9) { near = d; best = u; } }
      return best;
    },
  };
}

// Stations along a curve's centre line: its ends, both ends of its arc, and n even steps round the arc.
export function curveStations(p: Curve, n: number): number[] {
  const { s, len } = curveStrip(p), out = s > 0 ? [0] : [];
  for (let i = 0; i <= n; i++) out.push(s + ((len - 2 * s) * i) / n);
  if (s > 0) out.push(len);
  return out;
}

// A platform's top as convex polygons in world XZ (a curve is a row of quads along it).
export function platformFootprint(p: Piece): XZ[][] {
  const rot = pieceRot(p);
  const W = (x: number, z: number): XZ => { const o = rotXZ(x, z, rot); return [p.x + o.x, p.z + o.z]; };
  if (isTilted(p)) return [];
  if (isShaped(p)) {
    // The outline may be concave, so it is handed out as its triangles, each convex.
    const o = slabOutline(p).map(([x, z]) => W(x, z)), t = earcut(o.flatMap((v) => v));
    return Array.from({ length: t.length / 3 }, (_, k) => [o[t[k * 3]!]!, o[t[k * 3 + 1]!]!, o[t[k * 3 + 2]!]!]);
  }
  if (p.type === "slab" || p.type === "ramp") {
    const hx = p.w / 2, hz = p.d / 2, far = isCurled(p) ? hz - curlReach(p) : -hz;
    return [[W(-hx, far), W(hx, far), W(hx, hz), W(-hx, hz)]];
  }
  if (p.type === "curve") {
    const c = curveStrip(p), us = curveStations(p, curveSegments(p)), V = (u: number, r: number) => W(...c.at(u, r));
    return us.slice(1).map((u1, i) => { const u0 = us[i]!; return [V(u0, p.inner), V(u0, p.outer), V(u1, p.outer), V(u1, p.inner)]; });
  }
  return [];
}

const OVERLAP_EPS = 0.02;
// Separating-axis test that treats edge-to-edge contact (the normal seam) as not overlapping.
function convexOverlap(a: XZ[], b: XZ[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!, q = poly[(i + 1) % poly.length]!;
      const nx = q[1] - p[1], nz = p[0] - q[0];
      const len = Math.hypot(nx, nz);
      if (len < 1e-9) continue;
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const v of a) { const d = (v[0] * nx + v[1] * nz) / len; minA = Math.min(minA, d); maxA = Math.max(maxA, d); }
      for (const v of b) { const d = (v[0] * nx + v[1] * nz) / len; minB = Math.min(minB, d); maxB = Math.max(maxB, d); }
      if (maxA <= minB + OVERLAP_EPS || maxB <= minA + OVERLAP_EPS) return false;
    }
  }
  return true;
}

// Index pairs of slabs/curves whose bodies intersect. Pieces that merely touch are fine.
export function platformOverlaps(level: Level): [number, number][] {
  const fp = level.pieces.map((p) => platformFootprint(p));
  const out: [number, number][] = [];
  for (let i = 0; i < fp.length; i++) {
    if (!fp[i]!.length) continue;
    for (let j = i + 1; j < fp.length; j++) {
      if (!fp[j]!.length) continue;
      const [ai, bi] = yRange(level.pieces[i] as Platform), [aj, bj] = yRange(level.pieces[j] as Platform);
      if (Math.min(bi, bj) - Math.max(ai, aj) + PLATFORM_THICKNESS <= OVERLAP_EPS) continue;
      if (fp[i]!.some((a) => fp[j]!.some((b) => convexOverlap(a, b)))) out.push([i, j]);
    }
  }
  return out;
}

function inConvex(poly: XZ[], x: number, z: number): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    const c = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (Math.abs(c) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(c); else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

// Top-surface y of the highest platform under (x, z), or null over open air.
export function surfaceAt(level: Level, x: number, z: number): number | null {
  let best: number | null = null;
  for (const p of level.pieces) {
    if (!isPlatform(p)) continue;
    if (!platformFootprint(p).some((q) => inConvex(q, x, z))) continue;
    const y = platformHeightAt(p, x, z);
    if (best === null || y > best) best = y;
  }
  return best;
}

export function pieceRot(p: Piece): number {
  // A hole turns its own cut (holeFootprint), so its group is never turned.
  return p.type !== "hole" && "rot" in p && typeof p.rot === "number" ? p.rot : 0;
}
// Props that can be rolled and tilted: turned `roll` degrees about their own front-to-back axis (local z)
// and then `tilt` about their own side-to-side axis (local x), both before `rot`, through their base point
// (a crate's or barrel's centre), so one can stand out of a wall or lean. Kickers and jump pads turn their
// own way, the same order; a slab's are part of its own frame.
export const MIRRORED: PieceType[] = ["kicker"];
export const ROLLED_PROPS: PieceType[] = ["blockade", "barrier", "pillar", "column", "bumper", "magnet", "hoop", "crate", "barrel", "cube"];
export const pieceRoll = (p: Piece): number => (ROLLED_PROPS.includes(p.type) && "roll" in p && typeof p.roll === "number" ? p.roll : 0);
export const pieceTilt = (p: Piece): number => (ROLLED_PROPS.includes(p.type) && "tilt" in p && typeof p.tilt === "number" ? p.tilt : 0);
// How high above its y a crate's or barrel's centre rests when rolled and tilted: how far down its turned
// body reaches below its centre.
export type Prop = Piece & { type: "crate" | "barrel" | "cube" };
export const isProp = (p: Piece): p is Prop => p.type === "crate" || p.type === "barrel" || p.type === "cube";
export function propLift(p: Prop): number {
  const r = (pieceRoll(p) * Math.PI) / 180, t = (pieceTilt(p) * Math.PI) / 180;
  // The world up's components along the prop's own x, y and z.
  const ux = Math.abs(Math.cos(t) * Math.sin(r)), uy = Math.abs(Math.cos(t) * Math.cos(r)), uz = Math.abs(Math.sin(t));
  if (p.type === "crate") return (p.w / 2) * ux + (p.h / 2) * uy + (p.d / 2) * uz;
  if (p.type === "cube") return (CUBE_S / 2) * (ux + uy + uz);
  return (p.h / 2) * uy + p.r * Math.sqrt(Math.max(0, 1 - uy * uy));
}

export function newPiece(type: PieceType, x = 0, y = 0, z = 0): Piece {
  switch (type) {
    case "start": return { type, x, y, z };
    case "slab": return { type, x, y, z, w: LANE_WIDTH, d: 16, rot: 0, tilt: 0 };
    case "curve": return { type, x, y, z, inner: 8, outer: 8 + LANE_WIDTH, rot: 0 };
    case "ramp": return { type, x, y, z, w: LANE_WIDTH, d: 24, rot: 0, rise: RAMP_RISE };
    case "fence": return { type, x, y, z, rot: 0, path: [{ x: 0, y: 0, z: -8, bend: FENCE_RAIL_CORNER }] };
    case "bridge": return { type, x, y, z, w: 4, d: 8, rot: 0 };
    case "rails": return { type, x, y, z, rot: 0, path: [{ x: 0, y: 0, z: -12, bend: 0 }], smooth: true, lines: 2, a: "top", b: "top" };
    case "plank": return { type, x, y, z, w: 4, h: 8, rot: 0, tilt: 0 };
    case "seesaw": return { type, x, y, z, w: 4, d: 8, h: SEESAW_PIVOT_H, rot: 0, tilt: 10 };
    case "board": return { type, x, y, z, w: 4, d: 8, rot: 0, tilt: 0 };
    case "pangolin": return { type, x, y, z, w: 2.5, d: 8, rot: 0 };
    case "support": return { type, x, y, z, w: 6, h: SUPPORT_RISE, rot: 0 };
    case "gate": return { type, x, y, z, w: LANE_WIDTH, d: GATE_D, h: GATE_H, rot: 0 };
    case "kicker": return { type, x, y, z, w: KICKER_W, d: KICKER_D, h: KICKER_H, rot: 0 };
    case "hole": return { type, x, y, z, w: 4, d: 4, rot: 0 };
    case "block": return { type, x, y, z, w: 4, h: 1.2, d: 4, rot: 0 };
    case "blockade": return { type, x, y, z, rot: 0 };
    case "pillar": return { type, x, y, z };
    case "bumper": return { type, x, y, z };
    case "magnet": return { type, x, y, z };
    case "column": return { type, x, y, z, h: COLUMN_H };
    case "barrier": return { type, x, y, z, rot: 0 };
    case "crate": return { type, x, y, z, w: CRATE_W, h: CRATE_H, d: CRATE_D, rot: 0 };
    case "cube": return { type, x, y, z, rot: 0 };
    case "barrel": return { type, x, y, z, r: BARREL_R, h: BARREL_H, rot: 0 };
    case "jump": return { type, x, y, z, w: JUMP_W, d: JUMP_D, rot: 0, rise: JUMP_RISE };
    case "stool": return { type, x, y, z, w: STOOL_W, h: STOOL_H, d: STOOL_D, rot: 0, track: STOOL_TRACK, offset: 0 };
    case "bean": return { type, x, y, z, rot: 0, r: BEAN_R, len: BEAN_LEN, speed: BEAN_SPEED, wait: 0, offset: 0, loop: "pingpong", path: [{ x: 0, y: 0, z: -12, bend: 0 }] };
    case "spinner": return { type, x, y, z, length: 8, speed: 1.2 };
    case "goal": return { type, x, y, z, r: GOAL_R };
    case "hoop": return { type, x, y, z, rot: 0 };
    // Up three layers and down again: out along -z, an elbow up, a run across, an elbow down.
    case "tube": return { type, x, y, z, rot: 0, path: [
      { x: 0, y: 0, z: -3, bend: TUBE_BEND }, { x: 0, y: 3, z: -3, bend: TUBE_BEND }, { x: 0, y: 3, z: -9, bend: TUBE_BEND },
      { x: 0, y: 0, z: -9, bend: TUBE_BEND }, { x: 0, y: 0, z: -12, bend: 0 },
    ] };
  }
}

export function startOf(level: Level): Piece & { type: "start" } {
  const s = level.pieces.find((p): p is Piece & { type: "start" } => p.type === "start");
  if (!s) throw new Error(`level ${level.id} has no start`);
  return s;
}

export type Rails = Piece & { type: "rails" };

// Where a rails end's axis sits relative to the top of the platform it attaches to: fence-rail
// height over a top, or the middle of the side wall (the dark line of its edge strip).
// A rails top end stands at the height fence rails had when rails were made, kept apart from fences.
export const RAILS_TOP_Y = 0.45;
export const railEndAxis = (end: RailEnd): number => (end === "top" ? RAILS_TOP_Y : -PLATFORM_THICKNESS / 2);
// The same, as a rolling height (what an in-between node's y means).
const railEndRoll = (p: Rails, end: RailEnd): number => (end === "end" ? 0 : railEndAxis(end) - (railsAxisY(p.lines) - RAILS_SINK));

// Unit heading in local space for a yaw in degrees: 0 is local -z, turning like a piece's rot.
const yawDir = (deg: number): V3 => { const o = rotXZ(0, -1, deg); return [o.x, 0, o.z]; };

// The way each end's stub heads, from the end toward the rails, in local space: the end's own
// `aYaw` / `bYaw` when set, else square out of the wall for a side end, else toward the curve
// point of the segment leaving it or the next node.
function railsEndDirs(p: Rails, level?: Level): { a: V3; b: V3 } {
  const m = p.path.length, lastNode = p.path[m - 1]!;
  const local = (v: { x: number; y: number; z: number }): V3 => [v.x, v.y, v.z];
  const flat = (v: V3, fallback: V3): V3 => (Math.hypot(v[0], v[2]) > 1e-6 ? unit([v[0], 0, v[2]]) : fallback);
  const dir = (kind: RailEnd, node: V3, toward: V3, yaw: number | undefined): V3 => {
    if (yaw !== undefined) return yawDir(yaw);
    if (kind === "side" && level) {
      const o = rotXZ(node[0], node[2], p.rot), n = wallInward(level, p.x + o.x, p.z + o.z);
      if (n) { const l = rotXZ(-n[0], -n[1], -p.rot); return [l.x, 0, l.z]; }
    }
    return flat(sub(toward, node), [0, 0, -1]);
  };
  return {
    a: dir(p.a, [0, 0, 0], local(p.path[0]!.mid ?? (m > 1 ? p.path[0]! : lastNode)), p.aYaw),
    b: dir(p.b, local(lastNode), lastNode.mid ? local(lastNode.mid) : m > 1 ? local(p.path[m - 2]!) : [0, 0, 0], p.bYaw),
  };
}

// An end's current heading as a yaw in degrees (see yawDir), whether set or worked out.
export function railsEndYaw(p: Rails, end: "a" | "b", level?: Level): number {
  const d = railsEndDirs(p, level)[end];
  return Math.round(((Math.atan2(-d[0], -d[2]) * 180) / Math.PI) * 1000) / 1000 || 0;
}

// The rails' centre line in local space as tube rings (docs/levels.md "rails"). Each end meets its
// platform square: a stub RAILS_STUB long runs level from the end node, square to the wall for a
// side end or straight back toward the rails for a top end, and only past it does the path slope
// or turn, rounded into the stub. Past the end node a side end goes on level into the wall and a top
// end turns straight down into the surface on a fence rail's corner. `level` supplies that wall and
// surface; without it a side stub points back along the rails and a top end drops to its own node's
// platform height.
export function railsRings(p: Rails, level?: Level): TubeRing[] {
  const lift = railsAxisY(p.lines) - RAILS_SINK;
  const m = p.path.length;
  if (!m) return [];
  const local = (v: { x: number; y: number; z: number }): V3 => [v.x, v.y, v.z];
  const world = (v: V3) => { const o = rotXZ(v[0], v[2], p.rot); return { x: p.x + o.x, z: p.z + o.z }; };
  const lastNode = p.path[m - 1]!, dirs = railsEndDirs(p, level);
  // Each end: its node lifted to the rail's axis level, the stub's far node, and the node past it.
  const end = (kind: RailEnd, node: V3, out: V3) => {
    const at: V3 = [node[0], node[1] + railEndRoll(p, kind), node[2]];
    if (kind === "end") return { at, stub: add(at, out, RAILS_STUB), bend: 0 };
    if (kind === "side") return { at, stub: add(at, out, RAILS_STUB), past: add(at, out, -RAILS_EMBED), bend: 0 };
    const w = world(at), ground = (level ? surfaceAt(level, w.x, w.z) : null) ?? p.y + node[1];
    return { at, stub: add(at, out, RAILS_STUB), past: [at[0], ground - p.y - FENCE_RAIL_FOOT - lift, at[2]] as V3, bend: FENCE_RAIL_CORNER };
  };
  const a = end(p.a, [0, 0, 0], dirs.a);
  const b = end(p.b, local(lastNode), dirs.b);
  const head = a.past ?? a.at;
  const rel = (v: { x: number; y: number; z: number }) => ({ x: v.x - head[0], y: v.y - head[1], z: v.z - head[2] });
  const node = (v: V3, bend: number, mid?: { x: number; y: number; z: number }): TubeNode => ({ ...rel({ x: v[0], y: v[1], z: v[2] }), bend, ...(mid ? { mid: rel(mid) } : {}) });
  // A smooth path runs from stub to stub, leaving and meeting each along the stub's own heading.
  const between: TubeNode[] = p.smooth
    ? smoothCurve([a.stub, ...p.path.slice(0, m - 1).map(local), b.stub], dirs.a, [-dirs.b[0], -dirs.b[1], -dirs.b[2]]).map((v) => node(v, 0))
    : [
      node(a.stub, RAILS_STUB_BEND),
      ...p.path.slice(0, m - 1).map((n) => node(local(n), n.bend, n.mid)),
      // The segment that arrived at end b now arrives at its stub, curve point and all.
      node(b.stub, RAILS_STUB_BEND, lastNode.mid),
    ];
  const path: TubeNode[] = [...(a.past ? [node(a.at, a.bend)] : []), ...between, node(b.at, b.bend), ...(b.past ? [node(b.past, 0)] : [])];
  return tubeRings({ path }, lift).map((q) => ({ ...q, c: add(q.c, head) }));
}

// The rails' rings in world space.
export function railsRingsWorld(p: Rails, level?: Level): TubeRing[] {
  const r = (v: V3): V3 => { const o = rotXZ(v[0], v[2], p.rot); return [o.x, v[1], o.z]; };
  return railsRings(p, level).map((q) => ({ c: add([p.x, p.y, p.z], r(q.c)), d: r(q.d), m: r(q.m) }));
}

// Each rail as rings to railSweep at `off`, from the rails' `rings` (local or world), and the points
// a single rail's `end` ends are capped at (a ball of RAIL_R). Two rails with an `end` end are one
// line joined round it.
export function railsLines(p: Rails, rings: TubeRing[]): { lines: { rings: TubeRing[]; off: number }[]; caps: V3[] } {
  if (rings.length < 2) return { lines: [], caps: [] };
  const closeA = p.a === "end", closeB = p.b === "end";
  if (p.lines === 1) return { lines: [{ rings, off: 0 }], caps: [...(closeA ? [rings[0]!.c] : []), ...(closeB ? [rings[rings.length - 1]!.c] : [])] };
  if (closeA || closeB) return { lines: [{ rings: railsLoop(rings, RAILS_GAUGE / 2, closeA, closeB), off: 0 }], caps: [] };
  return { lines: [-RAILS_GAUGE / 2, RAILS_GAUGE / 2].map((off) => ({ rings, off })), caps: [] };
}

// The inward normal (x, z) of the platform side wall nearest (x, z), within RAILS_WALL_REACH.
function wallInward(level: Level, x: number, z: number): XZ | null {
  let best: { d: number; n: XZ } | null = null;
  for (const q of level.pieces) {
    if (!isPlatform(q)) continue;
    for (const poly of platformFootprint(q)) {
      const cx = poly.reduce((s, v) => s + v[0], 0) / poly.length, cz = poly.reduce((s, v) => s + v[1], 0) / poly.length;
      poly.forEach((a, i) => {
        const b = poly[(i + 1) % poly.length]!, ex = b[0] - a[0], ez = b[1] - a[1], len = Math.hypot(ex, ez);
        if (len < 1e-6) return;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / (len * len)));
        const d = Math.hypot(a[0] + ex * t - x, a[1] + ez * t - z);
        let n: XZ = [-ez / len, ex / len];
        if (n[0] * (cx - a[0]) + n[1] * (cz - a[1]) < 0) n = [-n[0], -n[1]];
        if (d < RAILS_WALL_REACH && (!best || d < best.d)) best = { d, n };
      });
    }
  }
  return best ? (best as { d: number; n: XZ }).n : null;
}

export function levelProblems(level: Level): string[] {
  const out: string[] = [];
  const count = (t: PieceType) => level.pieces.filter((p) => p.type === t).length;
  if (count("start") !== 1) out.push(`needs exactly one start, has ${count("start")}`);
  if (count("goal") !== 1) out.push(`needs exactly one goal, has ${count("goal")}`);
  level.pieces.forEach((p, i) => {
    if (isBelt(p) && (isTilted(p) || isMoving(p) || p.twist || p.curl)) out.push(`piece ${i}: a treadmill can't tilt, roll, twist, curl or move`);
    if (isCurled(p)) {
      if (p.tilt || p.roll || p.twist || p.move) out.push(`piece ${i}: a curled slab can't tilt, roll, twist or move`);
      if (Math.abs(p.curl) > CURL_MAX) out.push(`piece ${i}: curl must be within ±${CURL_MAX}°`);
      else if (Math.abs(curlRadius(p)) < CURL_MIN_R) out.push(`piece ${i}: a slab curled ${p.curl}° must be at least ${Math.ceil(((CURL_MIN_R * Math.abs(p.curl) * Math.PI) / 180) * 2) / 2} deep`);
    }
    if (isBelt(p) && Math.min(p.w, p.d) < BELT_MIN) out.push(`piece ${i}: treadmill w and d must be at least ${BELT_MIN}`);
    if (p.type === "curve" && p.inner >= p.outer) out.push(`piece ${i}: curve inner must be less than outer`);
    if (p.type === "curve" && p.inner < 0) out.push(`piece ${i}: curve inner must be >= 0`);
    if (p.type === "support" && (((p.roll ?? 0) % 180) + 180) % 180 !== 0) out.push(`piece ${i}: a support rolls 0 or 180, nothing between`);
    if (p.type === "support" && supportReach(p) < SUPPORT_MIN_REACH - 1e-9) out.push(`piece ${i}: a support's reach must be at least ${SUPPORT_MIN_REACH}`);
    if (p.type === "support" && supportPillars(p)[0]!.y0 > supportPillars(p)[0]!.y1 - 0.3) out.push(`piece ${i}: a support's reach is too big for its height: its bend would reach past the top`);
    if (p.mirror && !MIRRORED.includes(p.type)) out.push(`piece ${i}: a ${p.type} can't be mirrored`);
    if (p.type === "curve" && !CURVE_SWEEPS.includes(curveSweep(p))) out.push(`piece ${i}: curve sweep must be ${CURVE_SWEEPS.join(", ")}`);
    if (p.type === "curve" && curveSweep(p) === 270 && p.inner < CURVE_34_MIN_INNER) out.push(`piece ${i}: a 3/4 curve's inner must be at least ${CURVE_34_MIN_INNER}, or its two ends cross`);
    if (p.type === "ramp" && !Number.isInteger(p.rise)) out.push(`piece ${i}: ramp rise must be a whole number of layers`);
    if ((isPlatform(p) || p.type === "bridge" || p.type === "plank" || p.type === "seesaw" || p.type === "board" || p.type === "pangolin" || p.type === "support" || p.type === "gate") && Math.abs(p.y / HEIGHT_STEP - Math.round(p.y / HEIGHT_STEP)) > 1e-6) out.push(`piece ${i}: ${p.type} y must be a multiple of ${HEIGHT_STEP}`);
    if (p.type === "crate" && Math.min(p.w, p.h, p.d) <= 0) out.push(`piece ${i}: crate w, h and d must be positive`);
    if (p.type === "barrel" && Math.min(p.r, p.h) <= 0) out.push(`piece ${i}: barrel r and h must be positive`);
    if (p.type === "stool" && Math.min(p.w, p.h, p.d) <= 0) out.push(`piece ${i}: stool w, h and d must be positive`);
    if (p.type === "bean" && p.r <= 0) out.push(`piece ${i}: bean r must be positive`);
    if (p.type === "bean" && p.len < 2 * p.r) out.push(`piece ${i}: bean len must be at least twice its r`);
    if (p.type === "bean" && p.speed <= 0) out.push(`piece ${i}: bean speed must be positive`);
    if (p.type === "bean" && p.wait < 0) out.push(`piece ${i}: bean wait can't be negative`);
    if (p.type === "jump" && Math.min(p.w, p.d) < 2 * JUMP_RUN + 1) out.push(`piece ${i}: jump pad w and d must be at least ${2 * JUMP_RUN + 1}`);
    if (p.type === "jump" && p.rise <= 0) out.push(`piece ${i}: jump pad rise must be positive`);
    if (p.type === "stool" && p.track < (stoolAxis(p) === "z" ? p.d : p.w)) out.push(`piece ${i}: stool track must be at least its ${stoolAxis(p) === "z" ? "depth" : "width"}`);
    if (p.type === "kicker" && isSliding(p) && p.track! < p.w) out.push(`piece ${i}: kicker track must be at least its width`);
    if (p.type === "kicker" && isSliding(p) && (p.roll || p.tilt)) out.push(`piece ${i}: a sliding kicker can't roll or tilt`);
    if (p.type === "kicker" && p.top !== undefined && (p.top <= 0 || p.top > p.w)) out.push(`piece ${i}: a side kicker's top must be above 0 and at most its width`);
    if (p.type === "gate" && gateHang(p).chain < 1) out.push(`piece ${i}: gate h must be at least ${p.h - gateHang(p).chain + 1}`);
    if (p.type === "gate" && (p.w <= 0 || p.d < SUPPORT_W + 2 * GATE_CHAIN_R)) out.push(`piece ${i}: gate w must be positive and d at least ${SUPPORT_W + 2 * GATE_CHAIN_R}`);
    if (isShaped(p)) {
      const sh = p.shape, g = (v?: number) => v ?? 0;
      if (p.tilt || p.roll || p.twist || p.curl || p.belt || p.move) out.push(`piece ${i}: a shaped slab can't tilt, roll, twist, curl, move or be a treadmill`);
      const ends = [["north end", p.w + g(sh.e?.n) + g(sh.w?.n)], ["south end", p.w + g(sh.e?.s) + g(sh.w?.s)], ["east end", p.d + g(sh.n?.e) + g(sh.s?.e)], ["west end", p.d + g(sh.n?.w) + g(sh.s?.w)]] as const;
      for (const [name, size] of ends) if (size < 1) out.push(`piece ${i}: the slab's ${name} must stay at least 1 across`);
      if (g(sh.n?.bow) + g(sh.s?.bow) <= -(p.d - 1) || g(sh.e?.bow) + g(sh.w?.bow) <= -(p.w - 1)) out.push(`piece ${i}: the slab's sides bow in so far they meet`);
    }
    if (p.type === "plank" && (p.base ?? 0) < 0) out.push(`piece ${i}: plank base can't be negative`);
    if (p.type === "seesaw" && seesawPivot(p) < SEESAW_T) out.push(`piece ${i}: seesaw h must be at least ${SEESAW_T}`);
    if (p.type === "bridge" && p.d < 2 * BRIDGE_PITCH) out.push(`piece ${i}: bridge must span at least ${2 * BRIDGE_PITCH}`);
    if (p.type === "pangolin" && (p.d < PANGOLIN_MIN_D || p.w < 1)) out.push(`piece ${i}: pangolin d must be at least ${PANGOLIN_MIN_D} and w at least 1`);
  });
  for (const [i, j] of platformOverlaps(level)) out.push(`platforms ${i} and ${j} overlap`);
  return out;
}

// World position of a tube node (its inner floor), node 0 being the entrance.
export function tubeNodeWorld(p: PathPiece, k: number): { x: number; y: number; z: number } {
  const n = k === 0 ? { x: 0, y: 0, z: 0 } : p.path[k - 1]!;
  const o = rotXZ(n.x, n.z, p.rot);
  return { x: p.x + o.x, y: p.y + n.y, z: p.z + o.z };
}

// The tube's rings in world space.
export function tubeRingsWorld(p: Tube): TubeRing[] {
  const r = (v: V3): V3 => { const o = rotXZ(v[0], v[2], p.rot); return [o.x, v[1], o.z]; };
  return tubeRings(p).map((q) => ({ c: add([p.x, p.y, p.z], r(q.c)), d: r(q.d), m: r(q.m) }));
}


const railEnd = (v: unknown): RailEnd => (v === "side" || v === "end" ? v : "top");

function parsePath(raw: unknown, i: number): TubeNode[] {
  if (!Array.isArray(raw)) throw new Error(`piece ${i}: needs a path array`);
  return raw.map((q: unknown, k: number) => {
    const n = (q ?? {}) as Record<string, unknown>;
    const node: TubeNode = { x: num(n.x, `piece ${i}.path[${k}].x`), y: num(n.y, `piece ${i}.path[${k}].y`), z: num(n.z, `piece ${i}.path[${k}].z`), bend: num(n.bend ?? 0, "bend") };
    if (n.mid && typeof n.mid === "object") {
      const m = n.mid as Record<string, unknown>;
      node.mid = { x: num(m.x, `piece ${i}.path[${k}].mid.x`), y: num(m.y, `piece ${i}.path[${k}].mid.y`), z: num(m.z, `piece ${i}.path[${k}].mid.z`) };
    }
    return node;
  });
}

const num = (v: unknown, what: string): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${what} must be a finite number`);
  return v;
};
// A slab's shape from a level file: each side's ends and bow, with zeros and unknown keys dropped.
const shape = (v: unknown): SlabShape | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const out: SlabShape = {};
  for (const side of ["n", "e", "s", "w"] as const) {
    const raw = (v as Record<string, unknown>)[side];
    if (!raw || typeof raw !== "object") continue;
    const s: SideShape = {};
    for (const k of side === "n" || side === "s" ? (["w", "e", "bow"] as const) : (["n", "s", "bow"] as const)) {
      const n = (raw as Record<string, unknown>)[k];
      if (typeof n === "number" && Number.isFinite(n) && n !== 0) s[k] = n;
    }
    if (Object.keys(s).length) out[side] = s;
  }
  return Object.keys(out).length ? out : undefined;
};
const fence = (v: unknown): Fence => {
  if (!Array.isArray(v)) return v === true;
  const spans = v.filter((q): q is [number, number] => Array.isArray(q) && q.length === 2 && q.every((n) => typeof n === "number" && Number.isFinite(n)));
  return spans.length ? spans.map(([a, b]) => [a, b]) : false;
};

// A moving platform's schedule from a level file (the slab's `move`, or an older mover piece).
function parseMove(m: Record<string, unknown>, i: number): Move {
  const num = (v: unknown, what: string) => { if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`piece ${i}: ${what} must be a number`); return v; };
  const stops = (Array.isArray(m.stops) ? m.stops : []).map((q: unknown, k: number) => {
    const n = (q ?? {}) as Record<string, unknown>;
    return { x: num(n.x ?? 0, `stops[${k}].x`), y: num(n.y ?? 0, `stops[${k}].y`), z: num(n.z ?? 0, `stops[${k}].z`), wait: num(n.wait ?? 0, `stops[${k}].wait`) };
  });
  return { speed: num(m.speed ?? MOVER_SPEED, "speed"), wait: num(m.wait ?? 0, "wait"), offset: num(m.offset ?? 0, "offset"), loop: m.loop === "loop" ? "loop" : "pingpong", stops };
}

export function validateLevel(raw: unknown): Level {
  if (!raw || typeof raw !== "object") throw new Error("level must be an object");
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") throw new Error("level needs string id and name");
  if (!Array.isArray(r.pieces)) throw new Error("level needs a pieces array");
  const fenced: [Platform, Record<string, Fence>][] = [];
  const keep = <T extends Platform>(q: T, f: Record<string, unknown>, keys: string[]): T => {
    const spec = Object.fromEntries(keys.map((k) => [k, fence(f[k])]));
    if (Object.values(spec).some((v) => v)) fenced.push([q, spec]);
    return q;
  };
  const parsed = r.pieces.map((q: unknown, i: number): Piece => {
    const p = (q ?? {}) as Record<string, unknown>;
    // An older side kicker's "wall": "left" is a mirror.
    const at = { x: num(p.x, `piece ${i}.x`), y: num(p.y, `piece ${i}.y`), z: num(p.z, `piece ${i}.z`), ...(p.mirror === true || p.wall === "left" ? { mirror: true as const } : {}) };
    const f = (p.fences ?? {}) as Record<string, unknown>;
    switch (p.type) {
      case "start": return { type: "start", ...at };
      case "slab": return keep({ type: "slab", ...at, w: num(p.w, "w"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot"), tilt: num(p.tilt ?? 0, "tilt"), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.twist ? { twist: num(p.twist, "twist") } : {}), ...(p.curl ? { curl: num(p.curl, "curl") } : {}), ...(p.belt === true ? { belt: true as const } : {}), ...(p.glass === true ? { glass: true as const } : {}), ...(shape(p.shape) ? { shape: shape(p.shape)! } : {}),
        ...(p.move ? { move: parseMove(p.move as Record<string, unknown>, i) } : {}) }, f, ["n", "e", "s", "w"]);
      case "curve": return keep({ type: "curve", ...at, inner: num(p.inner, "inner"), outer: num(p.outer, "outer"), rot: num(p.rot ?? 0, "rot"), ...(p.sweep !== undefined && num(p.sweep, "sweep") !== 90 ? { sweep: num(p.sweep, "sweep") } : {}), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.rollAt === "b" ? { rollAt: "b" as const } : {}) }, f, ["a", "outer", "b", "inner"]);
      case "ramp": return keep({ type: "ramp", ...at, w: num(p.w, "w"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot"), rise: num(p.rise, "rise") }, f, ["e", "w"]);
      case "fence": return { type: "fence", ...at, rot: num(p.rot ?? 0, "rot"), path: parsePath(p.path, i), ...(p.smooth === true ? { smooth: true as const } : {}) };
      case "bridge": return { type: "bridge", ...at, w: num(p.w, "w"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot") };
      case "rails": return { type: "rails", ...at, rot: num(p.rot ?? 0, "rot"), path: parsePath(p.path, i), ...(p.smooth === true ? { smooth: true as const } : {}),
        lines: p.lines === 1 ? 1 : 2, a: railEnd(p.a), b: railEnd(p.b),
        ...(typeof p.aYaw === "number" ? { aYaw: p.aYaw } : {}), ...(typeof p.bYaw === "number" ? { bYaw: p.bYaw } : {}) };
      case "plank": return { type: "plank", ...at, w: num(p.w, "w"), h: num(p.h, "h"), rot: num(p.rot ?? 0, "rot"), tilt: num(p.tilt ?? 0, "tilt"), ...(p.side === true ? { side: true } : {}), ...(p.freeze === true ? { freeze: true } : {}), ...(p.base ? { base: num(p.base, "base") } : {}) };
      case "board": return { type: "board", ...at, w: num(p.w ?? 4, "w"), d: num(p.d ?? 8, "d"), rot: num(p.rot ?? 0, "rot"), tilt: num(p.tilt ?? 0, "tilt"), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.freeze === true ? { freeze: true } : {}) };
      case "pangolin": return { type: "pangolin", ...at, w: num(p.w ?? 2.5, "w"), d: num(p.d ?? 8, "d"), rot: num(p.rot ?? 0, "rot") };
      case "seesaw": return { type: "seesaw", ...at, w: num(p.w, "w"), d: num(p.d, "d"), h: num(p.h ?? SEESAW_PIVOT_H, "h"), rot: num(p.rot ?? 0, "rot"), tilt: num(p.tilt ?? 0, "tilt"), ...(p.freeze === true ? { freeze: true } : {}), ...(p.dips === "+z" || p.dips === "-z" ? { dips: p.dips } : {}) };
      // Older levels have moving platforms as their own "mover" piece: a slab with its schedule inline.
      case "mover": return { type: "slab", ...at, w: num(p.w, "w"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot"), tilt: 0, move: parseMove(p, i) };
      case "kicker": return { type: "kicker", ...at, w: num(p.w ?? KICKER_W, "w"), d: num(p.d ?? KICKER_D, "d"), h: num(p.h ?? KICKER_H, "h"), rot: num(p.rot ?? 0, "rot"),
        ...(p.flat !== undefined && num(p.flat, "flat") > 0 ? { flat: num(p.flat, "flat") } : {}), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.tilt ? { tilt: num(p.tilt, "tilt") } : {}),
        ...(p.track ? { track: num(p.track, "track"), offset: num(p.offset ?? 0, "offset") } : {}),
        ...(p.top !== undefined ? { top: num(p.top, "top") } : {}) };
      case "support": return { type: "support", ...at, w: num(p.w, "w"), h: num(p.h, "h"), rot: num(p.rot ?? 0, "rot"), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.reach !== undefined && num(p.reach, "reach") !== SUPPORT_REACH ? { reach: num(p.reach, "reach") } : {}) };
      case "gate": return { type: "gate", ...at, w: num(p.w ?? LANE_WIDTH, "w"), d: num(p.d ?? GATE_D, "d"), h: num(p.h ?? GATE_H, "h"), rot: num(p.rot ?? 0, "rot") };
      case "block": return { type: "block", ...at, w: num(p.w, "w"), h: num(p.h, "h"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot") };
      case "blockade": return { type: "blockade", ...at, rot: num(p.rot ?? 0, "rot"), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.tilt ? { tilt: num(p.tilt, "tilt") } : {}) };
      case "pillar": return { type: "pillar", ...at, ...(p.rot ? { rot: num(p.rot, "rot") } : {}), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.tilt ? { tilt: num(p.tilt, "tilt") } : {}) };
      case "bumper": return { type: "bumper", ...at, ...(p.rot ? { rot: num(p.rot, "rot") } : {}), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.tilt ? { tilt: num(p.tilt, "tilt") } : {}) };
      case "magnet": return { type: "magnet", ...at, ...(p.rot ? { rot: num(p.rot, "rot") } : {}), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.tilt ? { tilt: num(p.tilt, "tilt") } : {}) };
      case "column": return { type: "column", ...at, h: num(p.h ?? COLUMN_H, "h"), ...(p.rot ? { rot: num(p.rot, "rot") } : {}), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.tilt ? { tilt: num(p.tilt, "tilt") } : {}) };
      case "barrier": return { type: "barrier", ...at, rot: num(p.rot ?? 0, "rot"), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.tilt ? { tilt: num(p.tilt, "tilt") } : {}) };
      case "crate": {
        // Older levels give a cube's side as `s`.
        const s = p.s === undefined ? undefined : num(p.s, "s");
        return { type: "crate", ...at, w: num(p.w ?? s ?? CRATE_W, "w"), h: num(p.h ?? s ?? CRATE_H, "h"), d: num(p.d ?? s ?? CRATE_D, "d"), rot: num(p.rot ?? 0, "rot"), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.tilt ? { tilt: num(p.tilt, "tilt") } : {}) };
      }
      case "cube": return { type: "cube", ...at, rot: num(p.rot ?? 0, "rot"), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.tilt ? { tilt: num(p.tilt, "tilt") } : {}) };
      case "barrel": return { type: "barrel", ...at, r: num(p.r ?? BARREL_R, "r"), h: num(p.h ?? BARREL_H, "h"), rot: num(p.rot ?? 0, "rot"), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.tilt ? { tilt: num(p.tilt, "tilt") } : {}) };
      case "jump": return { type: "jump", ...at, w: num(p.w ?? JUMP_W, "w"), d: num(p.d ?? JUMP_D, "d"), rot: num(p.rot ?? 0, "rot"), rise: num(p.rise ?? JUMP_RISE, "rise"), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.tilt ? { tilt: num(p.tilt, "tilt") } : {}) };
      case "stool": return { type: "stool", ...at, w: num(p.w ?? STOOL_W, "w"), h: num(p.h ?? STOOL_H, "h"), d: num(p.d ?? STOOL_D, "d"), rot: num(p.rot ?? 0, "rot"),
        track: num(p.track ?? STOOL_TRACK, "track"), offset: num(p.offset ?? 0, "offset"), ...(p.slide === "z" ? { slide: "z" as const } : {}) };
      case "hole": return { type: "hole", ...at, w: num(p.w, "w"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot"), ...(p.tilt ? { tilt: num(p.tilt, "tilt") } : {}), ...(p.roll ? { roll: num(p.roll, "roll") } : {}) };
      case "bean": return { type: "bean", ...at, rot: num(p.rot ?? 0, "rot"), r: BEAN_R, len: num(p.len ?? BEAN_LEN, "len"), speed: num(p.speed ?? BEAN_SPEED, "speed"),
        wait: num(p.wait ?? 0, "wait"), offset: num(p.offset ?? 0, "offset"), loop: p.loop === "loop" ? "loop" : "pingpong", ...(p.turn ? { turn: num(p.turn, "turn") } : {}), ...(p.face === "follow" ? { face: "follow" as const } : {}), path: parsePath(p.path ?? [], i), ...(p.smooth === true ? { smooth: true as const } : {}) };
      case "spinner": return { type: "spinner", ...at, length: num(p.length, "length"), speed: num(p.speed, "speed") };
      case "goal": return { type: "goal", ...at, r: GOAL_R };
      case "tube": return { type: "tube", ...at, rot: num(p.rot ?? 0, "rot"), path: parsePath(p.path, i), ...(p.smooth === true ? { smooth: true as const } : {}) };
      case "hoop": return { type: "hoop", ...at, rot: num(p.rot ?? 0, "rot"), ...(p.roll ? { roll: num(p.roll, "roll") } : {}), ...(p.tilt ? { tilt: num(p.tilt, "tilt") } : {}) };
      default: throw new Error(`piece ${i}: unknown type ${String(p.type)}`);
    }
  });
  const pieces = [...parsed, ...fenced.flatMap(([q, spec]) => legacyFences(q, spec))];
  const t = r.thumb as Record<string, unknown> | undefined;
  const thumb = t ? { x: num(t.x, "thumb.x"), y: num(t.y, "thumb.y"), z: num(t.z, "thumb.z"), r: num(t.r, "thumb.r"), ...(t.yaw ? { yaw: num(t.yaw, "thumb.yaw") } : {}) } : undefined;
  if (r.world !== undefined && !WORLDS.some((w) => w.id === r.world)) throw new Error(`level ${String(r.id)}: unknown world ${String(r.world)}`);
  const world = r.world as World | undefined;
  const level: Level = { id: r.id, name: r.name, ...(r.hidden === true ? { hidden: true as const } : {}), ...(world && world !== "archive" ? { world } : {}), ...(thumb ? { thumb } : {}), pieces };
  const problems = levelProblems(level);
  if (problems.length) throw new Error(`level ${level.id}: ${problems.join("; ")}`);
  return level;
}

export function cloneLevel(level: Level): Level {
  return JSON.parse(JSON.stringify(level)) as Level;
}
