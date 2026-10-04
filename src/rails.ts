import * as THREE from "three";
import { ENV, RAILS } from "./palette.ts";
import { railSweep } from "./geometry.ts";
import { PAINT, FENCE_RAIL_Y, RAIL_R, fenceRings, railsLines, railsRings, tubeRings, type FencePiece, type Level, type Rails, type TubeRing } from "./level.ts";


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

// Fence piece: its rail swept along fenceRings, and a light strip along the rail's right-hand side
// (its inside, for a fence running clockwise round a platform), stopping short of the turn-downs.
export function buildFence(p: FencePiece, into: THREE.Group): void {
  const rings = fenceRings(p);
  if (rings.length < 2) return;
  const rail = mesh(railSweep(rings, 0, RAIL_R, 16, 0), RAIL_MAT);
  rail.castShadow = true;
  into.add(rail);
  const top = trim(tubeRings(p, FENCE_RAIL_Y), 0.25);
  if (top.length > 1 && ENV.style !== "ruin") into.add(mesh(railSweep(top, STRIPE_IN - 0.025, 0.025, 6, 0), STRIPE_MAT));
}

// Rails piece: each rail swept along the shared rings with a light strip down its outer side, and a
// single rail's closed end rounded off.
export function buildRailsPiece(p: Rails, into: THREE.Group, level: Level): void {
  const { lines, caps } = railsLines(p, railsRings(p, level));
  for (const { rings, off } of lines) {
    const rail = mesh(railSweep(rings, off, RAIL_R, 16, 0), RAIL_MAT);
    rail.castShadow = true;
    into.add(rail);
    // A joined line's outside is on its right-hand side (railsLoop).
    if (ENV.style !== "ruin") for (const side of p.lines === 1 ? [-1, 1] : off === 0 ? [-1] : [Math.sign(off)]) into.add(mesh(railSweep(rings, off + side * RAIL_R * 0.85, 0.022, 6, 0), STRIPE_MAT));
  }
  for (const c of caps) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(RAIL_R, 16, 8), RAIL_MAT);
    cap.position.set(...c);
    cap.castShadow = true;
    into.add(cap);
  }
}
