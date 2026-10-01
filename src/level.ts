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
export const BALL_RADIUS = 0.55;
export const FENCE_HEIGHT = 0.9;
export const FENCE_THICKNESS = 0.4;
export const SPINNER_HEIGHT = 0.6;
export const SPINNER_WIDTH = 0.4;
export const BLOCKADE_W = 3, BLOCKADE_H = 1.5, BLOCKADE_D = 3;
export const PILLAR_R = 0.7, PILLAR_H = 2.2;
export const BARRIER_W = 3, BARRIER_H = 1.4, BARRIER_D = 0.5;
export const CRATE_S = 1.2;
// The goal beam: touching it anywhere up to this height wins.
export const GOAL_BEAM_H = 40;
// The start pad: a low disc the ball spawns on top of.
export const START_PAD_R = 1.3, START_PAD_H = 0.22;
// Structures snap their centre to this grid and sit on the platform beneath them.
export const STRUCT_GRID = 1;
// Platform heights come in layers of one platform thickness; a ramp climbs or drops a
// whole number of them, four by default.
export const LAYER_H = PLATFORM_THICKNESS;
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
// Knock-down plank: a tall panel standing on a platform edge, hinged along its bottom edge. It
// holds still until anything touches it, then topples under physics and lies across the gap.
// Place every plank 0.5 tiles back from the border of the platform it stands on (docs/levels.md).
export const PLANK_T = 0.12;
// The hinge runs through the middle of the panel's base, held this high above the surface in a
// yoke at each end: just over half the panel's thickness, so whichever way it topples the base
// corners swing past the floor instead of into it, and it lies flat either way.
export const PLANK_HINGE_H = PLANK_T / 2 + 0.01;
// Seesaw: a board `w` wide and `d` long (along local z) pinned at its middle on an axle between
// two posts, live under physics from the start, so the ball's weight tips it. Thinner than a
// knock-down plank so the ball rolls onto its low end without a big step.
export const SEESAW_T = 0.1, SEESAW_PIVOT_H = 1.2, SEESAW_POST_W = 0.36, SEESAW_POST_D = 0.8;

// Pose of a knock-down plank's centre relative to the piece origin before yaw, for its start
// angle: `tilt` degrees about the hinge, 0 standing up, positive leaning toward local -z (the
// way a push from +z knocks it), 90 lying flat. Clamped to lying flat either way.
export function plankPose(p: Piece & { type: "plank" }): { y: number; z: number; tilt: number } {
  const tilt = Math.max(-90, Math.min(90, p.tilt)), a = (tilt * Math.PI) / 180;
  return { y: PLANK_HINGE_H + (p.h / 2) * Math.cos(a), z: -(p.h / 2) * Math.sin(a), tilt };
}

// Steepest a seesaw can sit before an end meets the surface, in degrees.
export function seesawMaxTilt(p: Piece & { type: "seesaw" }): number {
  let lo = 0, hi = Math.PI / 2;
  const clear = (a: number) => SEESAW_PIVOT_H - (p.d / 2) * Math.sin(a) - (SEESAW_T / 2) * Math.cos(a);
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (clear(m) > 0) lo = m; else hi = m; }
  return (lo * 180) / Math.PI;
}
// A seesaw's start angle: positive raises its local -z end; clamped to resting on an end.
export const seesawTilt = (p: Piece & { type: "seesaw" }): number => Math.max(-seesawMaxTilt(p), Math.min(seesawMaxTilt(p), p.tilt));
// Support: three pillars standing against a platform's side wall, carrying a platform `h` layers
// above. The piece origin is on the lower platform's edge at its top surface; the pillars stand
// just outside that edge on local +z, from the lower platform's side wall up to the upper one's
// underside.
// Kicker: a small solid wedge sitting on a platform, rising `h` toward local -z over its depth
// `d`. The default 1 over 3 is an 18 degree slope.
export const KICKER_W = 3, KICKER_D = 3, KICKER_H = 1;
// A kicker's six corners in local space: the low front edge at local +z on the surface, the
// high back edge `h` up at local -z.
export function kickerCorners(p: Piece & { type: "kicker" }): [number, number, number][] {
  const x = p.w / 2, z = p.d / 2;
  return [[-x, 0, z], [x, 0, z], [x, 0, -z], [-x, 0, -z], [x, p.h, -z], [-x, p.h, -z]];
}
export const SUPPORT_W = 0.8, SUPPORT_D = 0.7, SUPPORT_RISE = 4;
// Each pillar stands SUPPORT_GAP off the lower platform's side wall; its foot bends inward on
// an arc of inner radius SUPPORT_BEND_R and runs straight into that wall at mid-thickness.
export const SUPPORT_GAP = 0.5, SUPPORT_BEND_R = 0.3;
export function supportPillars(p: Piece & { type: "support" }): { x: number; z: number; y0: number; y1: number }[] {
  const e = p.w / 2 - SUPPORT_W / 2;
  return [-e, 0, e].map((x) => ({ x, z: SUPPORT_GAP + SUPPORT_D / 2, y0: -PLATFORM_THICKNESS / 2 - SUPPORT_D / 2, y1: p.h * LAYER_H - PLATFORM_THICKNESS }));
}

// Tube: a glass pipe just wide enough for the ball, routed through a list of nodes. The piece
// origin is the first mouth; `path` holds the remaining nodes relative to it (before `rot`), the
// last being the other mouth. Node y is the tube's inner floor, so a mouth sitting on a platform
// top is flush with it. A node's `bend` is the radius of the arc through it, 0 for a sharp mitred
// elbow. Nothing is checked: the designer places mouths and turns freely. Nothing pushes the
// ball either; it runs either way under the player's own push, so the two mouths are alike.
// A single glass skin with no wall thickness.
export const TUBE_R = 0.58;
// The glass is drawn as one thin skin, but in the physics it is a solid wall this thick outside the
// skin, so nothing can slip through it from outside however it arrives.
export const TUBE_SOLID_WALL = 0.08;
// The metal collar round each mouth: this thick outside the glass and this long back from the
// mouth. It is solid, in the physics as in the picture.
export const TUBE_COLLAR_T = 0.16, TUBE_COLLAR_L = 0.4;
export const TUBE_BEND = 1.5;
// `mid`, when set, is a point the segment arriving at this node passes through halfway, which
// bends that segment into a smooth curve (see tubeSegments); without it the segment is straight.
export interface TubeNode { x: number; y: number; z: number; bend: number; mid?: { x: number; y: number; z: number } }
export type Tube = Piece & { type: "tube" };

type V3 = [number, number, number];
// A ring of the tube: centre `c`, its circle square to `d`, projected along `d` onto the plane
// through `c` with normal `m` (equal to `d` except at a sharp elbow, where `m` is the mitre).
export interface TubeRing { c: V3; d: V3; m: V3 }

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const angle = (a: V3, b: V3) => (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180) / Math.PI;

// Centreline nodes in the piece's local space (unrotated), first mouth first.
export function tubeNodes(p: Tube): V3[] {
  return [[0, TUBE_R, 0], ...p.path.map((n): V3 => [n.x, n.y + TUBE_R, n.z])];
}

// Each segment's centreline from its start node to its end node. A straight segment is just its
// two ends. A curved one follows the circle through its start, `mid` and end as seen from above,
// with the height changing smoothly along it (a quadratic through the three heights), so a curve
// that climbs climbs all the way round rather than at the nodes. If seen from above the three
// points are in a line (or two coincide), it is the smooth curve through them in 3D instead.
export function tubeSegments(p: Tube): V3[][] {
  const c = tubeNodes(p);
  return p.path.map((n, i) => {
    const a = c[i]!, b = c[i + 1]!;
    if (!n.mid) return [a, b];
    const m: V3 = [n.mid.x, n.mid.y + TUBE_R, n.mid.z];
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
const tangentIn = (s: V3[]) => unit(sub(s[s.length - 1]!, s[s.length - 2]!));
const tangentOut = (s: V3[]) => unit(sub(s[1]!, s[0]!));

// Turn in degrees at each node (0 at the two mouths), between the tangents meeting there.
export function tubeTurns(p: Tube): number[] {
  const segs = tubeSegments(p);
  return tubeNodes(p).map((_, k) => (k === 0 || k === segs.length ? 0 : angle(tangentIn(segs[k - 1]!), tangentOut(segs[k]!))));
}

// How far each node's arc reaches back and forward along its segments, shrunk where two arcs
// would overlap on one segment. Only a corner between two straight segments is rounded.
function tubeReach(p: Tube): number[] {
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
export function tubeRings(p: Tube): TubeRing[] {
  const c = tubeNodes(p);
  if (c.length < 2 || c.some((q, k) => k > 0 && Math.hypot(...sub(q, c[k - 1]!)) < 1e-6)) return [];
  const segs = tubeSegments(p), reach = tubeReach(p), turns = tubeTurns(p);
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
export type Mover = Piece & { type: "mover" };
export const MOVER_SPEED = 3;

interface MoverLeg { a: MoverStop; b: MoverStop; travel: number; wait: number }
function moverLegs(p: Mover): MoverLeg[] {
  const start: MoverStop = { x: 0, y: 0, z: 0, wait: p.wait };
  const route = [start, ...p.stops];
  const order = p.loop === "loop" ? [...route, start] : [...route, ...route.slice(0, -1).reverse()];
  const speed = Math.max(1e-3, p.speed);
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
  const legs = moverLegs(p);
  const period = p.wait + legs.reduce((s, l) => s + l.travel + l.wait, 0);
  if (!legs.length || period <= 1e-9) return { x: 0, y: 0, z: 0 };
  let u = (((t + p.offset) % period) + period) % period;
  if (u < p.wait) return { x: 0, y: 0, z: 0 };
  u -= p.wait;
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

export interface Fences4 { n: boolean; e: boolean; s: boolean; w: boolean }
export interface CurveFences { inner: boolean; outer: boolean; a: boolean; b: boolean }
export interface RampFences { e: boolean; w: boolean }
interface At { x: number; y: number; z: number }

export type Piece =
  | (At & { type: "start" })
  | (At & { type: "slab"; w: number; d: number; rot: number; tilt: number; fences: Fences4 })
  | (At & { type: "curve"; inner: number; outer: number; rot: number; fences: CurveFences })
  | (At & { type: "ramp"; w: number; d: number; rot: number; rise: number; fences: RampFences })
  | (At & { type: "bridge"; w: number; d: number; rot: number })
  | (At & { type: "plank"; w: number; h: number; rot: number; tilt: number })
  | (At & { type: "seesaw"; w: number; d: number; rot: number; tilt: number })
  | (At & { type: "support"; w: number; h: number; rot: number })
  | (At & { type: "kicker"; w: number; d: number; h: number; rot: number })
  | (At & { type: "block"; w: number; h: number; d: number; rot: number })
  | (At & { type: "blockade"; rot: number })
  | (At & { type: "pillar" })
  | (At & { type: "barrier"; rot: number })
  | (At & { type: "crate"; w: number; h: number; d: number; rot: number })
  | (At & { type: "hole"; w: number; d: number; rot: number })
  | (At & { type: "spinner"; length: number; speed: number })
  | (At & { type: "goal"; r: number })
  | (At & { type: "tube"; rot: number; path: TubeNode[] })
  | (At & { type: "mover"; w: number; d: number; rot: number; speed: number; wait: number; offset: number; loop: MoverLoop; stops: MoverStop[] });

export type PieceType = Piece["type"];
export const PIECE_TYPES: PieceType[] = ["slab", "curve", "ramp", "mover", "bridge", "plank", "seesaw", "support", "kicker", "hole", "blockade", "barrier", "pillar", "crate", "block", "spinner", "tube", "goal", "start"];
// Pieces that sit on a platform: grid-snapped, with y taken from the surface beneath.
export const isStructure = (p: Piece): boolean =>
  p.type === "block" || p.type === "blockade" || p.type === "pillar" || p.type === "hole" || p.type === "barrier" || p.type === "crate" || p.type === "kicker";
export type Platform = Piece & { type: "slab" | "curve" | "ramp" };
export const isPlatform = (p: Piece): p is Platform => p.type === "slab" || p.type === "curve" || p.type === "ramp";
export type Ramp = Piece & { type: "ramp" };
// A slab tilted about its local x axis (degrees; 90 stands it up as a wall, pivoting on its
// centre). Tilted slabs leave the welded floor and become solid rotated boxes instead.
export const isTilted = (p: Piece): boolean => p.type === "slab" && p.tilt !== 0;

// Fraction of a ramp's length that stays level at each end before the incline begins.
export const RAMP_FLAT = 0.25;

// Height of a ramp above its base y at fraction t along its length (0 at local +z, 1 at
// local -z): level landings at both ends with an S-curve climb between them.
export function rampHeight(p: Ramp, t: number): number {
  const s = Math.max(0, Math.min(1, (t - RAMP_FLAT) / (1 - 2 * RAMP_FLAT)));
  return p.rise * LAYER_H * s * s * (3 - 2 * s);
}

// Lowest and highest top-surface y of a platform.
export function yRange(p: Platform): [number, number] {
  if (p.type !== "ramp") return [p.y, p.y];
  const top = p.y + p.rise * LAYER_H;
  return [Math.min(p.y, top), Math.max(p.y, top)];
}

// Top-surface y of a platform at world (x, z), assuming the point is on it.
export function platformHeightAt(p: Platform, x: number, z: number): number {
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

export interface Level { id: string; name: string; pieces: Piece[] }

export type PartKind = "platform" | "fence" | "block";
export interface Box { kind: PartKind; x: number; y: number; z: number; w: number; h: number; d: number }
export interface Sector { kind: PartKind; inner: number; outer: number; y0: number; y1: number }
export interface Cylinder { r: number; h: number }

// Local-space parts of a piece, before the piece's rotation and translation.
export function pieceBoxes(p: Piece): Box[] {
  const T = PLATFORM_THICKNESS, FH = FENCE_HEIGHT, FT = FENCE_THICKNESS;
  if (p.type === "slab") {
    const out: Box[] = [{ kind: "platform", x: 0, y: -T / 2, z: 0, w: p.w, h: T, d: p.d }];
    const f = p.fences;
    if (f.n) out.push({ kind: "fence", x: 0, y: FH / 2, z: -p.d / 2 + FT / 2, w: p.w, h: FH, d: FT });
    if (f.s) out.push({ kind: "fence", x: 0, y: FH / 2, z: p.d / 2 - FT / 2, w: p.w, h: FH, d: FT });
    if (f.e) out.push({ kind: "fence", x: p.w / 2 - FT / 2, y: FH / 2, z: 0, w: FT, h: FH, d: p.d });
    if (f.w) out.push({ kind: "fence", x: -p.w / 2 + FT / 2, y: FH / 2, z: 0, w: FT, h: FH, d: p.d });
    return out;
  }
  if (p.type === "curve") {
    const out: Box[] = [];
    const span = p.outer - p.inner, mid = (p.inner + p.outer) / 2;
    if (p.fences.a) out.push({ kind: "fence", x: mid, y: FH / 2, z: -FT / 2, w: span, h: FH, d: FT });
    if (p.fences.b) out.push({ kind: "fence", x: FT / 2, y: FH / 2, z: -mid, w: FT, h: FH, d: span });
    return out;
  }
  if (p.type === "block") return [{ kind: "block", x: 0, y: p.h / 2, z: 0, w: p.w, h: p.h, d: p.d }];
  if (p.type === "blockade") return [{ kind: "block", x: 0, y: BLOCKADE_H / 2, z: 0, w: BLOCKADE_W, h: BLOCKADE_H, d: BLOCKADE_D }];
  if (p.type === "barrier") return [{ kind: "block", x: 0, y: BARRIER_H / 2, z: 0, w: BARRIER_W, h: BARRIER_H, d: BARRIER_D }];
  if (p.type === "support") return supportPillars(p).map((c) => ({ kind: "block", x: c.x, y: (c.y0 + c.y1) / 2, z: c.z, w: SUPPORT_W, h: c.y1 - c.y0, d: SUPPORT_D }));
  return [];
}

// Upright cylinders standing on the piece's y.
export function pieceCylinders(p: Piece): Cylinder[] {
  return p.type === "pillar" ? [{ r: PILLAR_R, h: PILLAR_H }] : [];
}

export function pieceSectors(p: Piece): Sector[] {
  if (p.type !== "curve") return [];
  const out: Sector[] = [{ kind: "platform", inner: p.inner, outer: p.outer, y0: -PLATFORM_THICKNESS, y1: 0 }];
  if (p.fences.inner) out.push({ kind: "fence", inner: p.inner, outer: p.inner + FENCE_THICKNESS, y0: 0, y1: FENCE_HEIGHT });
  if (p.fences.outer) out.push({ kind: "fence", inner: p.outer - FENCE_THICKNESS, outer: p.outer, y0: 0, y1: FENCE_HEIGHT });
  return out;
}

export function rotXZ(x: number, z: number, deg: number): { x: number; z: number } {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return { x: x * c + z * s, z: -x * s + z * c };
}

export type { XZ } from "./poly.ts";
import type { XZ } from "./poly.ts";

// A hole's outline in world XZ.
export function holeFootprint(h: Piece & { type: "hole" }): XZ[] {
  const hx = h.w / 2, hz = h.d / 2;
  const W = (x: number, z: number): XZ => { const o = rotXZ(x, z, h.rot); return [h.x + o.x, h.z + o.z]; };
  return [W(-hx, -hz), W(hx, -hz), W(hx, hz), W(-hx, hz)];
}

// Holes cut into slab `p`: those resting on its top surface. Curves and ramps are not cut.
export function holesOn(level: Level, p: Piece): XZ[][] {
  if (p.type !== "slab" || isTilted(p)) return [];
  const out: XZ[][] = [];
  for (const h of level.pieces) if (h.type === "hole" && Math.abs(h.y - p.y) < 1e-6) out.push(holeFootprint(h));
  return out;
}
export const CURVE_SEGMENTS = 24;

// A platform's top as convex polygons in world XZ (a curve is a fan of sector quads).
export function platformFootprint(p: Piece): XZ[][] {
  const rot = pieceRot(p);
  const W = (x: number, z: number): XZ => { const o = rotXZ(x, z, rot); return [p.x + o.x, p.z + o.z]; };
  if (isTilted(p)) return [];
  if (p.type === "slab" || p.type === "ramp") {
    const hx = p.w / 2, hz = p.d / 2;
    return [[W(-hx, -hz), W(hx, -hz), W(hx, hz), W(-hx, hz)]];
  }
  if (p.type === "curve") {
    const out: XZ[][] = [];
    for (let i = 0; i < CURVE_SEGMENTS; i++) {
      const a0 = (i / CURVE_SEGMENTS) * (Math.PI / 2), a1 = ((i + 1) / CURVE_SEGMENTS) * (Math.PI / 2);
      out.push([
        W(p.inner * Math.cos(a0), -p.inner * Math.sin(a0)), W(p.outer * Math.cos(a0), -p.outer * Math.sin(a0)),
        W(p.outer * Math.cos(a1), -p.outer * Math.sin(a1)), W(p.inner * Math.cos(a1), -p.inner * Math.sin(a1)),
      ]);
    }
    return out;
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
  return p.type === "slab" || p.type === "curve" || p.type === "ramp" || p.type === "bridge" || p.type === "plank" || p.type === "seesaw" || p.type === "support" || p.type === "kicker" || p.type === "block" || p.type === "blockade" || p.type === "barrier" || p.type === "crate" || p.type === "tube" || p.type === "mover" ? p.rot : 0;
}

export function newPiece(type: PieceType, x = 0, y = 0, z = 0): Piece {
  switch (type) {
    case "start": return { type, x, y, z };
    case "slab": return { type, x, y, z, w: LANE_WIDTH, d: 16, rot: 0, tilt: 0, fences: { n: false, e: false, s: false, w: false } };
    case "curve": return { type, x, y, z, inner: 8, outer: 8 + LANE_WIDTH, rot: 0, fences: { inner: false, outer: false, a: false, b: false } };
    case "ramp": return { type, x, y, z, w: LANE_WIDTH, d: 24, rot: 0, rise: RAMP_RISE, fences: { e: false, w: false } };
    case "bridge": return { type, x, y, z, w: 4, d: 8, rot: 0 };
    case "plank": return { type, x, y, z, w: 4, h: 8, rot: 0, tilt: 0 };
    case "seesaw": return { type, x, y, z, w: 4, d: 8, rot: 0, tilt: 10 };
    case "mover": return { type, x, y, z, w: LANE_WIDTH, d: 8, rot: 0, speed: MOVER_SPEED, wait: 1, offset: 0, loop: "pingpong", stops: [{ x: 0, y: 0, z: -12, wait: 1 }] };
    case "support": return { type, x, y, z, w: 6, h: SUPPORT_RISE, rot: 0 };
    case "kicker": return { type, x, y, z, w: KICKER_W, d: KICKER_D, h: KICKER_H, rot: 0 };
    case "hole": return { type, x, y, z, w: 4, d: 4, rot: 0 };
    case "block": return { type, x, y, z, w: 4, h: 1.2, d: 4, rot: 0 };
    case "blockade": return { type, x, y, z, rot: 0 };
    case "pillar": return { type, x, y, z };
    case "barrier": return { type, x, y, z, rot: 0 };
    case "crate": return { type, x, y, z, w: CRATE_S, h: CRATE_S, d: CRATE_S, rot: 0 };
    case "spinner": return { type, x, y, z, length: 8, speed: 1.2 };
    case "goal": return { type, x, y, z, r: 1.2 };
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

export function levelProblems(level: Level): string[] {
  const out: string[] = [];
  const count = (t: PieceType) => level.pieces.filter((p) => p.type === t).length;
  if (count("start") !== 1) out.push(`needs exactly one start, has ${count("start")}`);
  if (count("goal") !== 1) out.push(`needs exactly one goal, has ${count("goal")}`);
  level.pieces.forEach((p, i) => {
    if (p.type === "curve" && p.inner >= p.outer) out.push(`piece ${i}: curve inner must be less than outer`);
    if (p.type === "curve" && p.inner < 0) out.push(`piece ${i}: curve inner must be >= 0`);
    if (p.type === "ramp" && !Number.isInteger(p.rise)) out.push(`piece ${i}: ramp rise must be a whole number of layers`);
    if ((isPlatform(p) || p.type === "bridge" || p.type === "plank" || p.type === "seesaw" || p.type === "support") && Math.abs(p.y / LAYER_H - Math.round(p.y / LAYER_H)) > 1e-6) out.push(`piece ${i}: ${p.type} y must be a multiple of ${LAYER_H}`);
    if (p.type === "crate" && Math.min(p.w, p.h, p.d) <= 0) out.push(`piece ${i}: crate w, h and d must be positive`);
    if (p.type === "bridge" && p.d < 2 * BRIDGE_PITCH) out.push(`piece ${i}: bridge must span at least ${2 * BRIDGE_PITCH}`);
  });
  for (const [i, j] of platformOverlaps(level)) out.push(`platforms ${i} and ${j} overlap`);
  return out;
}

// World position of a tube node (its inner floor), node 0 being the entrance.
export function tubeNodeWorld(p: Tube, k: number): { x: number; y: number; z: number } {
  const n = k === 0 ? { x: 0, y: 0, z: 0 } : p.path[k - 1]!;
  const o = rotXZ(n.x, n.z, p.rot);
  return { x: p.x + o.x, y: p.y + n.y, z: p.z + o.z };
}

// The tube's rings in world space.
export function tubeRingsWorld(p: Tube): TubeRing[] {
  const r = (v: V3): V3 => { const o = rotXZ(v[0], v[2], p.rot); return [o.x, v[1], o.z]; };
  return tubeRings(p).map((q) => ({ c: add([p.x, p.y, p.z], r(q.c)), d: r(q.d), m: r(q.m) }));
}


const num = (v: unknown, what: string): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${what} must be a finite number`);
  return v;
};
const bool = (v: unknown): boolean => v === true;

export function validateLevel(raw: unknown): Level {
  if (!raw || typeof raw !== "object") throw new Error("level must be an object");
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") throw new Error("level needs string id and name");
  if (!Array.isArray(r.pieces)) throw new Error("level needs a pieces array");
  const pieces = r.pieces.map((q: unknown, i: number): Piece => {
    const p = (q ?? {}) as Record<string, unknown>;
    const at = { x: num(p.x, `piece ${i}.x`), y: num(p.y, `piece ${i}.y`), z: num(p.z, `piece ${i}.z`) };
    const f = (p.fences ?? {}) as Record<string, unknown>;
    switch (p.type) {
      case "start": return { type: "start", ...at };
      case "slab": return { type: "slab", ...at, w: num(p.w, "w"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot"), tilt: num(p.tilt ?? 0, "tilt"),
        fences: { n: bool(f.n), e: bool(f.e), s: bool(f.s), w: bool(f.w) } };
      case "curve": return { type: "curve", ...at, inner: num(p.inner, "inner"), outer: num(p.outer, "outer"), rot: num(p.rot ?? 0, "rot"),
        fences: { inner: bool(f.inner), outer: bool(f.outer), a: bool(f.a), b: bool(f.b) } };
      case "ramp": return { type: "ramp", ...at, w: num(p.w, "w"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot"), rise: num(p.rise, "rise"),
        fences: { e: bool(f.e), w: bool(f.w) } };
      case "bridge": return { type: "bridge", ...at, w: num(p.w, "w"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot") };
      case "plank": return { type: "plank", ...at, w: num(p.w, "w"), h: num(p.h, "h"), rot: num(p.rot ?? 0, "rot"), tilt: num(p.tilt ?? 0, "tilt") };
      case "seesaw": return { type: "seesaw", ...at, w: num(p.w, "w"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot"), tilt: num(p.tilt ?? 0, "tilt") };
      case "mover": {
        const stops = (Array.isArray(p.stops) ? p.stops : []).map((q: unknown, k: number) => {
          const n = (q ?? {}) as Record<string, unknown>;
          return { x: num(n.x ?? 0, `piece ${i}.stops[${k}].x`), y: num(n.y ?? 0, `piece ${i}.stops[${k}].y`), z: num(n.z ?? 0, `piece ${i}.stops[${k}].z`), wait: num(n.wait ?? 0, `piece ${i}.stops[${k}].wait`) };
        });
        return { type: "mover", ...at, w: num(p.w, "w"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot"), speed: num(p.speed ?? MOVER_SPEED, "speed"),
          wait: num(p.wait ?? 0, "wait"), offset: num(p.offset ?? 0, "offset"), loop: p.loop === "loop" ? "loop" : "pingpong", stops };
      }
      case "kicker": return { type: "kicker", ...at, w: num(p.w ?? KICKER_W, "w"), d: num(p.d ?? KICKER_D, "d"), h: num(p.h ?? KICKER_H, "h"), rot: num(p.rot ?? 0, "rot") };
      case "support": return { type: "support", ...at, w: num(p.w, "w"), h: num(p.h, "h"), rot: num(p.rot ?? 0, "rot") };
      case "block": return { type: "block", ...at, w: num(p.w, "w"), h: num(p.h, "h"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot") };
      case "blockade": return { type: "blockade", ...at, rot: num(p.rot ?? 0, "rot") };
      case "pillar": return { type: "pillar", ...at };
      case "barrier": return { type: "barrier", ...at, rot: num(p.rot ?? 0, "rot") };
      case "crate": {
        // Older levels give a cube's side as `s`.
        const s = num(p.s ?? CRATE_S, "s");
        return { type: "crate", ...at, w: num(p.w ?? s, "w"), h: num(p.h ?? s, "h"), d: num(p.d ?? s, "d"), rot: num(p.rot ?? 0, "rot") };
      }
      case "hole": return { type: "hole", ...at, w: num(p.w, "w"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot") };
      case "spinner": return { type: "spinner", ...at, length: num(p.length, "length"), speed: num(p.speed, "speed") };
      case "goal": return { type: "goal", ...at, r: num(p.r, "r") };
      case "tube": {
        if (!Array.isArray(p.path)) throw new Error(`piece ${i}: tube needs a path array`);
        const path = p.path.map((q: unknown, k: number) => {
          const n = (q ?? {}) as Record<string, unknown>;
          const node: TubeNode = { x: num(n.x, `piece ${i}.path[${k}].x`), y: num(n.y, `piece ${i}.path[${k}].y`), z: num(n.z, `piece ${i}.path[${k}].z`), bend: num(n.bend ?? 0, "bend") };
          if (n.mid && typeof n.mid === "object") {
            const m = n.mid as Record<string, unknown>;
            node.mid = { x: num(m.x, `piece ${i}.path[${k}].mid.x`), y: num(m.y, `piece ${i}.path[${k}].mid.y`), z: num(m.z, `piece ${i}.path[${k}].mid.z`) };
          }
          return node;
        });
        return { type: "tube", ...at, rot: num(p.rot ?? 0, "rot"), path };
      }
      default: throw new Error(`piece ${i}: unknown type ${String(p.type)}`);
    }
  });
  const level = { id: r.id, name: r.name, pieces };
  const problems = levelProblems(level);
  if (problems.length) throw new Error(`level ${level.id}: ${problems.join("; ")}`);
  return level;
}

export function cloneLevel(level: Level): Level {
  return JSON.parse(JSON.stringify(level)) as Level;
}
