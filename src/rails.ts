import * as THREE from "three";
import { railSweep, type SweepRing } from "./geometry.ts";
import { PAINT, FENCE_RAIL_INSET as INSET, FENCE_RAIL_Y as RAIL_Y, RAIL_R, RAILS_GAUGE, fenceRailPath, fenceRuns, fenceSamples, fenceSides, railsRings, type FenceSpanRail, type Level, type Piece, type Rails } from "./level.ts";


type XZ = [number, number];
type XYZ = [number, number, number];
type Stripe = { kind: "line"; inward: XZ } | { kind: "path"; pts: XYZ[] } | null;

export const RAIL_MAT = new THREE.MeshStandardMaterial({ color: 0xaab4be, roughness: 0.4, metalness: 0.2 });
// A light strip's outer face sits this far in from the rail's centre: PAINT proud of the tube.
const STRIPE_IN = RAIL_R + PAINT;
export const STRIPE_MAT = new THREE.MeshStandardMaterial({ color: 0x2ee8ff, emissive: 0x2ee8ff, emissiveIntensity: 0.8, roughness: 0.4 });

// A fenced span's light strip: straight along a straight side, following the rail round a curve's
// arc side, none on a ramp.
function stripe(p: Piece, span: FenceSpanRail): Stripe {
  if (p.type !== "slab" && p.type !== "ramp" && p.type !== "curve") return null;
  if (p.type === "slab" && p.twist) return null; // a straight strip can't follow a twisted side
  const side = fenceSides(p)[span.side]!, { a, b } = span;
  if (side.arc) return { kind: "path", pts: fenceSamples(p, side, a, b).map((s): XYZ => { const q = side.at(s, INSET + STRIPE_IN - 0.025); return [q.x, RAIL_Y + q.y, q.z]; }) };
  const m = side.at((a + b) / 2, INSET), m2 = side.at((a + b) / 2, INSET + 0.1);
  if (p.type === "ramp") return null;
  const dx = m2.x - m.x, dz = m2.z - m.z, l = Math.hypot(dx, dz);
  return { kind: "line", inward: [dx / l, dz / l] };
}

export function buildRails(p: Piece, into: THREE.Group, env: THREE.Texture | null): void {
  RAIL_MAT.envMap = env;
  RAIL_MAT.envMapIntensity = 0.4;
  for (const run of fenceRuns(p)) {
    const pts = fenceRailPath(run).map((q) => new THREE.Vector3(q[0], q[1], q[2]));
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < pts.length - (run.closed ? 0 : 1); i++) path.add(new THREE.LineCurve3(pts[i]!, pts[(i + 1) % pts.length]!));
    const len = path.getLength();
    const tube = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(48, Math.ceil(len * 12)), RAIL_R, 10, run.closed), RAIL_MAT);
    tube.castShadow = true;
    into.add(tube);

    for (const s of run.spans) {
      const st = stripe(p, s);
      if (st?.kind === "line") {
        const a = s.pts[0]!, b = s.pts[s.pts.length - 1]!, inward = st.inward;
        const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz);
        if (L <= 0.5) continue;
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(L - 0.5, 0.06, 0.04), STRIPE_MAT);
        const k = STRIPE_IN - 0.02;
        stripe.position.set((a[0] + b[0]) / 2 + inward[0] * k, RAIL_Y, (a[2] + b[2]) / 2 + inward[1] * k);
        stripe.rotation.y = Math.atan2(-dz, dx);
        into.add(stripe);
      } else if (st?.kind === "path" && st.pts.length > 1) {
        const pts = st.pts, dir = (u: XYZ, v: XYZ): XYZ => { const l = Math.hypot(v[0] - u[0], v[2] - u[2]) || 1; return [(v[0] - u[0]) / l, 0, (v[2] - u[2]) / l]; };
        const rings = pts.map((c, i): SweepRing => {
          const da = i > 0 ? dir(pts[i - 1]!, c) : null, db = i < pts.length - 1 ? dir(c, pts[i + 1]!) : null;
          const d: XYZ = da && db ? dir([0, 0, 0], [da[0] + db[0], 0, da[2] + db[2]]) : (da ?? db)!;
          return { c, d, m: d };
        });
        const t = railSweep(rings, 0, 0.025, 6, 0), geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(t.positions, 3));
        geo.setIndex(t.indices);
        geo.computeVertexNormals();
        into.add(new THREE.Mesh(geo, STRIPE_MAT));
      }
    }
  }
}

// Rails piece: each rail swept along the shared rings with a light strip down its outer side.
export function buildRailsPiece(p: Rails, into: THREE.Group, env: THREE.Texture | null, level: Level): void {
  RAIL_MAT.envMap = env;
  RAIL_MAT.envMapIntensity = 0.4;
  const rings = railsRings(p, level);
  if (rings.length < 2) return;
  const mesh = (m: { positions: number[]; indices: number[] }, mat: THREE.Material) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(m.positions, 3));
    geo.setIndex(m.indices);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  };
  for (const off of p.lines === 1 ? [0] : [-RAILS_GAUGE / 2, RAILS_GAUGE / 2]) {
    const rail = mesh(railSweep(rings, off, RAIL_R, 16, 0), RAIL_MAT);
    rail.castShadow = true;
    into.add(rail);
    for (const side of p.lines === 1 ? [-1, 1] : [Math.sign(off)]) into.add(mesh(railSweep(rings, off + side * RAIL_R * 0.85, 0.022, 6, 0), STRIPE_MAT));
  }
}
