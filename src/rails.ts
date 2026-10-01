import * as THREE from "three";
import { railSweep, sectorMesh } from "./geometry.ts";
import { FENCE_RAIL_INSET as INSET, FENCE_RAIL_Y as RAIL_Y, RAIL_R, RAILS_GAUGE, fenceRailPath, fenceRuns, fenceSides, railsRings, type FenceSpanRail, type Level, type Piece, type Rails } from "./level.ts";


type XZ = [number, number];
type XYZ = [number, number, number];
type Stripe = { kind: "line"; inward: XZ } | { kind: "arc"; r: number; a0: number; a1: number } | null;

const RAIL_MAT = new THREE.MeshStandardMaterial({ color: 0xaab4be, roughness: 0.4, metalness: 0.2 });
const STRIPE_MAT = new THREE.MeshStandardMaterial({ color: 0x2ee8ff, emissive: 0x2ee8ff, emissiveIntensity: 0.8, roughness: 0.4 });

// A fenced span's light strip: straight along a straight side, an arc along a curve's arc side,
// none on a ramp.
function stripe(p: Piece, span: FenceSpanRail): Stripe {
  if (p.type !== "slab" && p.type !== "ramp" && p.type !== "curve") return null;
  const side = fenceSides(p)[span.side]!, { a, b } = span;
  const m = side.at((a + b) / 2, INSET), m2 = side.at((a + b) / 2, INSET + 0.1);
  if (side.arc) {
    const ang = (s: number) => { const q = side.at(s, INSET); return Math.atan2(-q.z, q.x); };
    const r = Math.hypot(m.x, m.z), inward = Math.hypot(m2.x, m2.z) > r ? 1 : -1;
    return { kind: "arc", r: r + inward * RAIL_R, a0: Math.min(ang(a), ang(b)), a1: Math.max(ang(a), ang(b)) };
  }
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
        stripe.position.set((a[0] + b[0]) / 2 + inward[0] * RAIL_R, RAIL_Y, (a[2] + b[2]) / 2 + inward[1] * RAIL_R);
        stripe.rotation.y = Math.atan2(-dz, dx);
        into.add(stripe);
      } else if (st?.kind === "arc") {
        const { r, a0, a1 } = st;
        const t = sectorMesh(r - 0.025, r + 0.025, RAIL_Y - 0.03, RAIL_Y + 0.03, { angle: a1 - a0, segments: Math.max(2, Math.ceil(((a1 - a0) / (Math.PI / 2)) * 24)) });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(t.positions, 3));
        geo.setIndex(new THREE.BufferAttribute(t.indices, 1));
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, STRIPE_MAT);
        m.rotation.y = a0;
        into.add(m);
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
