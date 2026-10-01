// Units: 1 on x/z is one placement-grid cell; 1 on y is one platform thickness, which is
// also one height layer, so platforms stack at whole-number y. The ball stands a little
// taller than a platform.
export const PLATFORM_THICKNESS = 1;
// The rounded lip on every platform edge, in the visuals and the physics floor alike:
// a wide, shallow quarter-ellipse, `INSET` in from the edge and `DROP` down to the wall.
export const PLATFORM_EDGE_INSET = 0.45;
export const PLATFORM_EDGE_DROP = 0.28;
export const BALL_RADIUS = 0.55;
export const FENCE_HEIGHT = 0.9;
export const FENCE_THICKNESS = 0.4;
export const SPINNER_HEIGHT = 0.6;
export const SPINNER_WIDTH = 0.4;
export const BLOCKADE_W = 3, BLOCKADE_H = 1.5, BLOCKADE_D = 3;
export const PILLAR_R = 0.7, PILLAR_H = 2.2;
export const BARRIER_W = 4, BARRIER_H = 1.4, BARRIER_D = 0.5;
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
export const PLANK_T = 0.3;

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
  | (At & { type: "plank"; w: number; h: number; rot: number })
  | (At & { type: "block"; w: number; h: number; d: number; rot: number })
  | (At & { type: "blockade"; rot: number })
  | (At & { type: "pillar" })
  | (At & { type: "barrier"; rot: number })
  | (At & { type: "crate"; rot: number; s: number })
  | (At & { type: "hole"; w: number; d: number; rot: number })
  | (At & { type: "spinner"; length: number; speed: number })
  | (At & { type: "goal"; r: number });

export type PieceType = Piece["type"];
export const PIECE_TYPES: PieceType[] = ["slab", "curve", "ramp", "bridge", "plank", "hole", "blockade", "barrier", "pillar", "crate", "block", "spinner", "goal", "start"];
// Pieces that sit on a platform: grid-snapped, with y taken from the surface beneath.
export const isStructure = (p: Piece): boolean =>
  p.type === "block" || p.type === "blockade" || p.type === "pillar" || p.type === "hole" || p.type === "barrier" || p.type === "crate";
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
export const LANE_WIDTH = 10;

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
  return p.type === "slab" || p.type === "curve" || p.type === "ramp" || p.type === "bridge" || p.type === "plank" || p.type === "block" || p.type === "blockade" || p.type === "barrier" || p.type === "crate" ? p.rot : 0;
}

export function newPiece(type: PieceType, x = 0, y = 0, z = 0): Piece {
  switch (type) {
    case "start": return { type, x, y, z };
    case "slab": return { type, x, y, z, w: LANE_WIDTH, d: 20, rot: 0, tilt: 0, fences: { n: false, e: false, s: false, w: false } };
    case "curve": return { type, x, y, z, inner: 10, outer: 10 + LANE_WIDTH, rot: 0, fences: { inner: false, outer: false, a: false, b: false } };
    case "ramp": return { type, x, y, z, w: LANE_WIDTH, d: 20, rot: 0, rise: RAMP_RISE, fences: { e: false, w: false } };
    case "bridge": return { type, x, y, z, w: 4, d: 10, rot: 0 };
    case "plank": return { type, x, y, z, w: 4, h: 10, rot: 0 };
    case "hole": return { type, x, y, z, w: 4, d: 3, rot: 0 };
    case "block": return { type, x, y, z, w: 3, h: 1.2, d: 4, rot: 0 };
    case "blockade": return { type, x, y, z, rot: 0 };
    case "pillar": return { type, x, y, z };
    case "barrier": return { type, x, y, z, rot: 0 };
    case "crate": return { type, x, y, z, rot: 0, s: CRATE_S };
    case "spinner": return { type, x, y, z, length: 6, speed: 1.2 };
    case "goal": return { type, x, y, z, r: 1.2 };
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
    if ((isPlatform(p) || p.type === "bridge" || p.type === "plank") && Math.abs(p.y / LAYER_H - Math.round(p.y / LAYER_H)) > 1e-6) out.push(`piece ${i}: ${p.type} y must be a multiple of ${LAYER_H}`);
    if (p.type === "bridge" && p.d < 2 * BRIDGE_PITCH) out.push(`piece ${i}: bridge must span at least ${2 * BRIDGE_PITCH}`);
  });
  for (const [i, j] of platformOverlaps(level)) out.push(`platforms ${i} and ${j} overlap`);
  return out;
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
      case "plank": return { type: "plank", ...at, w: num(p.w, "w"), h: num(p.h, "h"), rot: num(p.rot ?? 0, "rot") };
      case "block": return { type: "block", ...at, w: num(p.w, "w"), h: num(p.h, "h"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot") };
      case "blockade": return { type: "blockade", ...at, rot: num(p.rot ?? 0, "rot") };
      case "pillar": return { type: "pillar", ...at };
      case "barrier": return { type: "barrier", ...at, rot: num(p.rot ?? 0, "rot") };
      case "crate": return { type: "crate", ...at, rot: num(p.rot ?? 0, "rot"), s: num(p.s ?? CRATE_S, "s") };
      case "hole": return { type: "hole", ...at, w: num(p.w, "w"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot") };
      case "spinner": return { type: "spinner", ...at, length: num(p.length, "length"), speed: num(p.speed, "speed") };
      case "goal": return { type: "goal", ...at, r: num(p.r, "r") };
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
