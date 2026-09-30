export const BALL_RADIUS = 0.5;
export const PLATFORM_THICKNESS = 1;
export const FENCE_HEIGHT = 0.7;
export const FENCE_THICKNESS = 0.25;
export const SPINNER_HEIGHT = 0.6;
export const SPINNER_WIDTH = 0.4;

export interface Fences4 { n: boolean; e: boolean; s: boolean; w: boolean }
export interface CurveFences { inner: boolean; outer: boolean; a: boolean; b: boolean }
interface At { x: number; y: number; z: number }

export type Piece =
  | (At & { type: "start" })
  | (At & { type: "slab"; w: number; d: number; rot: number; fences: Fences4 })
  | (At & { type: "curve"; inner: number; outer: number; rot: number; fences: CurveFences })
  | (At & { type: "block"; w: number; h: number; d: number; rot: number })
  | (At & { type: "spinner"; length: number; speed: number })
  | (At & { type: "goal"; r: number });

export type PieceType = Piece["type"];
export const PIECE_TYPES: PieceType[] = ["slab", "curve", "block", "spinner", "goal", "start"];
export const LANE_WIDTH = 10;

export interface Level { id: string; name: string; pieces: Piece[] }

export type PartKind = "platform" | "fence" | "block";
export interface Box { kind: PartKind; x: number; y: number; z: number; w: number; h: number; d: number }
export interface Sector { kind: PartKind; inner: number; outer: number; y0: number; y1: number }

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
  return [];
}

export function pieceSectors(p: Piece): Sector[] {
  if (p.type !== "curve") return [];
  const out: Sector[] = [{ kind: "platform", inner: p.inner, outer: p.outer, y0: -PLATFORM_THICKNESS, y1: 0 }];
  if (p.fences.inner) out.push({ kind: "fence", inner: p.inner, outer: p.inner + FENCE_THICKNESS, y0: 0, y1: FENCE_HEIGHT });
  if (p.fences.outer) out.push({ kind: "fence", inner: p.outer - FENCE_THICKNESS, outer: p.outer, y0: 0, y1: FENCE_HEIGHT });
  return out;
}

export function pieceRot(p: Piece): number {
  return p.type === "slab" || p.type === "curve" || p.type === "block" ? p.rot : 0;
}

export function newPiece(type: PieceType, x = 0, y = 0, z = 0): Piece {
  switch (type) {
    case "start": return { type, x, y, z };
    case "slab": return { type, x, y, z, w: LANE_WIDTH, d: 20, rot: 0, fences: { n: false, e: true, s: false, w: true } };
    case "curve": return { type, x, y, z, inner: 4, outer: 4 + LANE_WIDTH, rot: 0, fences: { inner: true, outer: true, a: false, b: false } };
    case "block": return { type, x, y, z, w: 3, h: 1.2, d: 4, rot: 0 };
    case "spinner": return { type, x, y, z, length: 6, speed: 1.2 };
    case "goal": return { type, x, y, z, r: 2 };
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
  });
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
      case "slab": return { type: "slab", ...at, w: num(p.w, "w"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot"),
        fences: { n: bool(f.n), e: bool(f.e), s: bool(f.s), w: bool(f.w) } };
      case "curve": return { type: "curve", ...at, inner: num(p.inner, "inner"), outer: num(p.outer, "outer"), rot: num(p.rot ?? 0, "rot"),
        fences: { inner: bool(f.inner), outer: bool(f.outer), a: bool(f.a), b: bool(f.b) } };
      case "block": return { type: "block", ...at, w: num(p.w, "w"), h: num(p.h, "h"), d: num(p.d, "d"), rot: num(p.rot ?? 0, "rot") };
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
