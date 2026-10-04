import * as THREE from "three";
import { ANIMALS, ENV, RAILS } from "./palette.ts";
import { railSweep } from "./geometry.ts";
import { PAINT, FENCE_RAIL_Y, RAIL_R, fenceRings, railsLines, railsRings, snakeHead, SNAKE_HEAD, tubeRings, type FencePiece, type Level, type Rails, type TubeRing } from "./level.ts";


// The props' surface exactly, so the same white looks the same on a rail as on a prop.
export const RAIL_MAT = new THREE.MeshStandardMaterial({ color: RAILS.rail, roughness: ENV.bodyRoughness, metalness: 0.05 });
// A light strip's outer face sits this far in from the rail's centre: PAINT proud of the tube.
const STRIPE_IN = RAIL_R + PAINT;
export const STRIPE_MAT = new THREE.MeshStandardMaterial({ color: RAILS.stripe, emissive: RAILS.stripe, emissiveIntensity: 0.8 * ENV.glow, roughness: ENV.lightRoughness, metalness: ENV.lightMetal });
const mesh = (m: { positions: number[]; indices: number[] }, mat: THREE.Material) => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(m.positions, 3));
  geo.setIndex(m.indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
};

// `rings` with `cut` of their length taken off each end.
function trim(rings: TubeRing[], cut: number): TubeRing[] {
  const at: number[] = [0];
  for (let i = 1; i < rings.length; i++) at.push(at[i - 1]! + Math.hypot(...rings[i]!.c.map((v, k) => v - rings[i - 1]!.c[k]!)));
  const total = at[at.length - 1]!;
  if (total <= 2 * cut) return [];
  // The ring `t` along the line, between the samples either side of it.
  const ringAt = (t: number): TubeRing => {
    const i = Math.max(1, at.findIndex((v) => v >= t)), a = rings[i - 1]!, b = rings[i]!, f = (t - at[i - 1]!) / (at[i]! - at[i - 1]! || 1);
    return { c: [0, 1, 2].map((k) => a.c[k]! + (b.c[k]! - a.c[k]!) * f) as TubeRing["c"], d: b.d, m: b.d };
  };
  return [ringAt(cut), ...rings.filter((_, i) => at[i]! > cut && at[i]! < total - cut), ringAt(total - cut)];
}

// Soft fences are snakes: the rail is the body in the snake's skin with a band every SNAKE_BAND.every
// along it, its head (snakeHead, solid) resting at the first end wearing two eyes, and its last
// SNAKE_TAIL tapering to a tail as it drops into the surface.
const SNAKE_BAND = { every: 0.9, len: 0.3 }, SNAKE_TAIL = 0.8, SNAKE_TIP = 0.35;
const ANIMAL_MATS = new Map<number, THREE.MeshStandardMaterial>();
function animal(c: number): THREE.MeshStandardMaterial {
  let m = ANIMAL_MATS.get(c);
  if (!m) ANIMAL_MATS.set(c, (m = new THREE.MeshStandardMaterial({ color: c, roughness: ENV.bodyRoughness })));
  return m;
}
// Distance along the line to each ring; the ring `t` along it, between the samples either side; and
// the rings from `t0` to `t1`.
const along = (rings: TubeRing[]): number[] => rings.reduce<number[]>((at, q, i) => (i ? [...at, at[i - 1]! + Math.hypot(...q.c.map((v, k) => v - rings[i - 1]!.c[k]!))] : [0]), []);
function ringAt(rings: TubeRing[], at: number[], t: number): TubeRing {
  const found = at.findIndex((v) => v >= t), i = Math.min(rings.length - 1, Math.max(1, found < 0 ? rings.length - 1 : found)), a = rings[i - 1]!, b = rings[i]!, f = (t - at[i - 1]!) / (at[i]! - at[i - 1]! || 1);
  return { c: [0, 1, 2].map((k) => a.c[k]! + (b.c[k]! - a.c[k]!) * f) as TubeRing["c"], d: b.d, m: b.d };
}
const stretch = (rings: TubeRing[], at: number[], t0: number, t1: number): TubeRing[] => [ringAt(rings, at, t0), ...rings.filter((_, i) => at[i]! > t0 && at[i]! < t1), ringAt(rings, at, t1)];
// A snake's body along `rings` (`off` to one side, as railSweep takes it), `r` thick: the rail in the
// skin with a band every SNAKE_BAND.every along it; with `taper` its last SNAKE_TAIL thins to a tail
// (each ring's points drawn in toward its centre, down to SNAKE_TIP of the radius at the end).
export function snakeBody(rings: TubeRing[], into: THREE.Group, taper: boolean, r = RAIL_R, off = 0): void {
  const S = ANIMALS.snake, skin = animal(S.skin), at = along(rings), total = at[at.length - 1]!, tail = taper ? Math.max(0, total - SNAKE_TAIL) : total;
  const body = mesh(railSweep(stretch(rings, at, 0, tail), off, r, 16, 0), skin);
  body.castShadow = true;
  into.add(body);
  for (let t = SNAKE_BAND.every; t + SNAKE_BAND.len < tail; t += SNAKE_BAND.every) into.add(mesh(railSweep(stretch(rings, at, t, t + SNAKE_BAND.len), off, r + 0.006, 16, 0), animal(S.band)));
  if (!taper) return;
  const tr = stretch(rings, at, tail, total), tm = railSweep(tr, off, r, 16, 0), ta = along(tr), tl = ta[ta.length - 1]! || 1;
  for (let i = 0; i < tr.length; i++) {
    const k = 1 - (1 - SNAKE_TIP) * (ta[i]! / tl), c = tr[i]!.c;
    for (let j = 0; j < 16; j++) for (let x = 0; x < 3; x++) { const n = (i * 16 + j) * 3 + x; tm.positions[n] = c[x]! + (tm.positions[n]! - c[x]!) * k; }
  }
  const tailMesh = mesh(tm, skin);
  tailMesh.castShadow = true;
  into.add(tailMesh);
}
// A snake's head: a ball of SNAKE_HEAD.r at `c` looking along `d`, two eyes on its `up` side.
export function snakeHeadMesh(c: [number, number, number], d: [number, number, number], into: THREE.Group, up: [number, number, number] = [0, 1, 0]): void {
  const head = new THREE.Mesh(new THREE.SphereGeometry(SNAKE_HEAD.r, 32, 20), animal(ANIMALS.snake.skin));
  head.position.set(...c);
  head.castShadow = true;
  into.add(head);
  const look = new THREE.Vector3(...d).normalize(), top = new THREE.Vector3(...up).normalize(), side = top.clone().cross(look).normalize();
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10), animal(ANIMALS.eye));
    e.position.set(...c).addScaledVector(look, 0.1).addScaledVector(side, s * 0.11).addScaledVector(top, 0.12);
    e.userData.noShadow = true;
    into.add(e);
  }
}

// Fence piece: its rail swept along fenceRings, and a light strip along the rail's right-hand side
// (its inside, for a fence running clockwise round a platform), stopping short of the turn-downs.
export function buildFence(p: FencePiece, into: THREE.Group): void {
  const rings = fenceRings(p);
  if (rings.length < 2) return;
  if (ENV.props === "soft") { snakeBody(rings, into, true); const h = snakeHead(p); if (h) snakeHeadMesh(h.c, h.d, into); return; }
  const rail = mesh(railSweep(rings, 0, RAIL_R, 16, 0), RAIL_MAT);
  rail.castShadow = true;
  into.add(rail);
  const top = trim(tubeRings(p, FENCE_RAIL_Y), 0.25);
  if (top.length > 1) into.add(mesh(railSweep(top, STRIPE_IN - 0.025, 0.025, 6, 0), STRIPE_MAT));
}

// Rails piece: each rail swept along the shared rings with a light strip down its outer side, and a
// single rail's closed end rounded off. Soft rails are snakes: each rail a snake's body, a closed end
// its head looking out.
export function buildRailsPiece(p: Rails, into: THREE.Group, level: Level): void {
  const { lines, caps } = railsLines(p, railsRings(p, level));
  const soft = ENV.props === "soft";
  for (const { rings, off } of lines) {
    if (soft) { snakeBody(rings, into, false, RAIL_R, off); continue; }
    const rail = mesh(railSweep(rings, off, RAIL_R, 16, 0), RAIL_MAT);
    rail.castShadow = true;
    into.add(rail);
    // A joined line's outside is on its right-hand side (railsLoop).
    for (const side of p.lines === 1 ? [-1, 1] : off === 0 ? [-1] : [Math.sign(off)]) into.add(mesh(railSweep(rings, off + side * RAIL_R * 0.85, 0.022, 6, 0), STRIPE_MAT));
  }
  for (const c of caps) {
    if (soft) {
      const r = lines[0]!.rings, a = r[0]!, b = r[r.length - 1]!, atA = Math.hypot(c[0] - a.c[0], c[1] - a.c[1], c[2] - a.c[2]) < 1e-6;
      snakeHeadMesh(c, atA ? [-a.d[0], -a.d[1], -a.d[2]] : b.d, into);
      continue;
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(RAIL_R, 16, 8), RAIL_MAT);
    cap.position.set(...c);
    cap.castShadow = true;
    into.add(cap);
  }
}
