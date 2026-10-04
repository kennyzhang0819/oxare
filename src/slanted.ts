// Editor: standing a prop on a slanted platform's top, snapped to the grid laid on that top (docs/levels.md).
import * as THREE from "three";
import { curveRollPoint, frameToWorld, isTilted, rampHeight, rotXZ, slabPoint, worldToFrame, type Piece } from "./level.ts";

// A slanted platform's top as a map from its own flat frame (u across, v along, as it would lie level) to the
// world, with its grid's origin and the size it spans (curves: no bounds); null for a level platform.
export type Top = { at: (u: number, v: number) => THREE.Vector3; u0: number; v0: number; w?: number; d?: number; guess: (h: THREE.Vector3) => [number, number] };
export function slantedTop(p: Piece): Top | null {
  const local = (h: THREE.Vector3, q: { x: number; z: number; rot: number }): [number, number] => { const o = rotXZ(h.x - q.x, h.z - q.z, -q.rot); return [o.x, o.z]; };
  if (p.type === "slab" && (isTilted(p) || p.twist || p.curl)) {
    return { at: (u, v) => new THREE.Vector3(...frameToWorld(p, slabPoint(p, [u, 0, v]))), u0: -p.w / 2, v0: -p.d / 2, w: p.w, d: p.d,
      guess: (h) => { const l = worldToFrame(p, [h.x, h.y, h.z]); return [l[0], l[2]]; } };
  }
  if (p.type === "ramp") {
    return { at: (u, v) => { const o = rotXZ(u, v, p.rot); return new THREE.Vector3(p.x + o.x, p.y + rampHeight(p, (p.d / 2 - v) / p.d), p.z + o.z); },
      u0: -p.w / 2, v0: -p.d / 2, w: p.w, d: p.d, guess: (h) => local(h, p) };
  }
  if (p.type === "curve" && p.roll) {
    return { at: (u, v) => { const r = curveRollPoint(p, [u, 0, v]), o = rotXZ(r[0], r[2], p.rot); return new THREE.Vector3(p.x + o.x, p.y + r[1], p.z + o.z); },
      u0: 0, v0: 0, guess: (h) => local(h, p) };
  }
  return null;
}
// Where on `top` a world point lies, found by Gauss-Newton from the top's own guess; null if it is off the top
// (on a wall or underside).
export function onTop(top: Top, h: THREE.Vector3): [number, number] | null {
  let [u, v] = top.guess(h);
  const e = 0.01, su = new THREE.Vector3(), sv = new THREE.Vector3(), r = new THREE.Vector3();
  for (let k = 0; k < 12; k++) {
    r.copy(top.at(u, v)).sub(h);
    su.copy(top.at(u + e, v)).sub(top.at(u - e, v)).divideScalar(2 * e);
    sv.copy(top.at(u, v + e)).sub(top.at(u, v - e)).divideScalar(2 * e);
    const a = su.dot(su), b = su.dot(sv), c = sv.dot(sv), det = a * c - b * b;
    if (det < 1e-9) break;
    const gu = su.dot(r), gv = sv.dot(r);
    u -= (c * gu - b * gv) / det; v -= (a * gv - b * gu) / det;
  }
  if (top.w !== undefined && (Math.abs(u) > top.w / 2 + 0.05 || Math.abs(v) > top.d! / 2 + 0.05)) return null;
  return top.at(u, v).distanceTo(h) < 0.25 ? [u, v] : null;
}
// The point on `top` at the grid crossing nearest (u, v), `step` apart from its corner, and the top's normal there on `side`.
export function snapOnTop(top: Top, [u, v]: [number, number], step: number, side: THREE.Vector3): { point: THREE.Vector3; normal: THREE.Vector3 } {
  const lock = (x: number, x0: number, span?: number) => {
    const g = x0 + Math.round((x - x0) / step) * step;
    return span === undefined ? g : Math.max(-span / 2, Math.min(span / 2, g));
  };
  const su = lock(u, top.u0, top.w), sv = lock(v, top.v0, top.d), e = 0.01;
  const du = top.at(su + e, sv).sub(top.at(su - e, sv)), dv = top.at(su, sv + e).sub(top.at(su, sv - e));
  const normal = du.cross(dv).normalize();
  if (normal.dot(side) < 0) normal.negate();
  return { point: top.at(su, sv), normal };
}
