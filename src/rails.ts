import * as THREE from "three";
import { ENV, PILLAR, RAILS } from "./palette.ts";
import { railSweep } from "./geometry.ts";
import { PAINT, FENCE_RAIL_Y, RAIL_R, fenceRings, railsLines, railsRings, tubeRings, type FencePiece, type Level, type Rails, type TubeRing } from "./level.ts";


// The props' surface exactly, so the same white looks the same on a rail as on a prop.
export const RAIL_MAT = new THREE.MeshStandardMaterial({ color: RAILS.rail, roughness: ENV.bodyRoughness, metalness: 0.05 });
// A light strip's outer face sits this far in from the rail's centre: PAINT proud of the tube.
const STRIPE_IN = RAIL_R + PAINT;
export const STRIPE_MAT = new THREE.MeshStandardMaterial({ color: RAILS.stripe, emissive: RAILS.stripe, emissiveIntensity: 0.8 * ENV.glow, roughness: ENV.lightRoughness, metalness: ENV.lightMetal });
// Soft rails: the rail in the pastel tint, no stripe, round beads in the light colour at the ends
// and at every turn.
const SOFT_RAIL = new THREE.MeshStandardMaterial({ color: PILLAR.pale, roughness: ENV.bodyRoughness, metalness: 0.05 });
const BEAD_R = RAIL_R * 1.7;
function beads(rings: TubeRing[], off: number, into: THREE.Group, ends: boolean): void {
  const bead = new THREE.SphereGeometry(BEAD_R, 16, 12);
  const at = (i: number) => {
    const r = rings[i]!, m = new THREE.Mesh(bead, STRIPE_MAT);
    // Offset sideways the way railSweep does, along the ring's right-hand vector.
    const d = new THREE.Vector3(...r.d).normalize(), side = new THREE.Vector3(0, 1, 0).cross(d).normalize();
    m.position.set(r.c[0], r.c[1], r.c[2]).addScaledVector(side, off);
    m.castShadow = true;
    into.add(m);
  };
  if (ends) { at(0); at(rings.length - 1); }
  for (let i = 1; i + 1 < rings.length; i++) {
    const a = rings[i - 1]!.d, b = rings[i]!.d;
    if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < 0.6) at(i);
  }
}

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

// Fence piece: its rail swept along fenceRings, and a light strip along the rail's right-hand side
// (its inside, for a fence running clockwise round a platform), stopping short of the turn-downs.
export function buildFence(p: FencePiece, into: THREE.Group): void {
  const rings = fenceRings(p);
  if (rings.length < 2) return;
  const soft = ENV.props === "soft";
  const rail = mesh(railSweep(rings, 0, RAIL_R, 16, 0), soft ? SOFT_RAIL : RAIL_MAT);
  rail.castShadow = true;
  into.add(rail);
  if (soft) { beads(tubeRings(p, FENCE_RAIL_Y), 0, into, true); return; }
  const top = trim(tubeRings(p, FENCE_RAIL_Y), 0.25);
  if (top.length > 1) into.add(mesh(railSweep(top, STRIPE_IN - 0.025, 0.025, 6, 0), STRIPE_MAT));
}

// Rails piece: each rail swept along the shared rings with a light strip down its outer side, and a
// single rail's closed end rounded off.
export function buildRailsPiece(p: Rails, into: THREE.Group, level: Level): void {
  const { lines, caps } = railsLines(p, railsRings(p, level));
  const soft = ENV.props === "soft";
  for (const { rings, off } of lines) {
    const rail = mesh(railSweep(rings, off, RAIL_R, 16, 0), soft ? SOFT_RAIL : RAIL_MAT);
    rail.castShadow = true;
    into.add(rail);
    if (soft) { beads(rings, off, into, false); continue; }
    // A joined line's outside is on its right-hand side (railsLoop).
    for (const side of p.lines === 1 ? [-1, 1] : off === 0 ? [-1] : [Math.sign(off)]) into.add(mesh(railSweep(rings, off + side * RAIL_R * 0.85, 0.022, 6, 0), STRIPE_MAT));
  }
  for (const c of caps) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(soft ? BEAD_R : RAIL_R, 16, 8), soft ? STRIPE_MAT : RAIL_MAT);
    cap.position.set(...c);
    cap.castShadow = true;
    into.add(cap);
  }
}
