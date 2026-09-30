import * as THREE from "three";
import { sectorMesh } from "./geometry.ts";
import { type Piece } from "./level.ts";

const RAIL_Y = 0.78;
const RAIL_R = 0.11;
const INSET = 0.32;
const CORNER = 0.3;
const COLLAR_EVERY = 4;

type XZ = [number, number];
type Seg =
  | { kind: "line"; pts: XZ[]; inward: XZ }
  | { kind: "arc"; pts: XZ[]; r: number; inward: 1 | -1 };

const RAIL_MAT = new THREE.MeshStandardMaterial({ color: 0xe9eef3, roughness: 0.3, metalness: 0.15 });
const COLLAR_MAT = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.35, metalness: 0.15 });
const STRIPE_MAT = new THREE.MeshStandardMaterial({ color: 0x2ee8ff, emissive: 0x2ee8ff, emissiveIntensity: 1.4, roughness: 0.4 });
const UP = new THREE.Vector3(0, 1, 0);

function arcPts(r: number, segments = 12): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * (Math.PI / 2);
    out.push([r * Math.cos(a), -r * Math.sin(a)]);
  }
  return out;
}

// Fenced sides in cyclic order; null where a side is open.
function segments(p: Piece): (Seg | null)[] {
  if (p.type === "slab") {
    const hx = p.w / 2 - INSET, hz = p.d / 2 - INSET;
    const nw: XZ = [-hx, -hz], ne: XZ = [hx, -hz], se: XZ = [hx, hz], sw: XZ = [-hx, hz];
    const f = p.fences;
    return [
      f.n ? { kind: "line", pts: [nw, ne], inward: [0, 1] } : null,
      f.e ? { kind: "line", pts: [ne, se], inward: [-1, 0] } : null,
      f.s ? { kind: "line", pts: [se, sw], inward: [0, -1] } : null,
      f.w ? { kind: "line", pts: [sw, nw], inward: [1, 0] } : null,
    ];
  }
  if (p.type === "curve") {
    const ri = p.inner + INSET, ro = p.outer - INSET;
    const f = p.fences;
    const outer = arcPts(ro), inner = arcPts(ri).reverse();
    return [
      f.a ? { kind: "line", pts: [[ri, -INSET], [ro, -INSET]], inward: [0, -1] } : null,
      f.outer ? { kind: "arc", pts: outer, r: ro, inward: -1 } : null,
      f.b ? { kind: "line", pts: [[INSET, -ro], [INSET, -ri]], inward: [1, 0] } : null,
      f.inner ? { kind: "arc", pts: inner, r: ri, inward: 1 } : null,
    ];
  }
  return [];
}

function runs(segs: (Seg | null)[]): { segs: Seg[]; closed: boolean }[] {
  if (!segs.length || !segs.some((s) => s)) return [];
  if (segs.every((s) => s)) return [{ segs: segs as Seg[], closed: true }];
  const out: { segs: Seg[]; closed: boolean }[] = [];
  const n = segs.length;
  for (let i = 0; i < n; i++) {
    if (!segs[i] || segs[(i + n - 1) % n]) continue;
    const run: Seg[] = [];
    for (let j = i; segs[j % n] && run.length < n; j++) run.push(segs[j % n]!);
    out.push({ segs: run, closed: false });
  }
  return out;
}

function tubePath(pts: THREE.Vector3[], closed: boolean): THREE.CurvePath<THREE.Vector3> {
  const n = pts.length;
  const V = (i: number) => pts[((i % n) + n) % n]!;
  const corner = (i: number) => {
    if (!closed && (i === 0 || i === n - 1)) return { entry: V(i), exit: V(i) };
    const p = V(i), da = V(i - 1).clone().sub(p), db = V(i + 1).clone().sub(p);
    const r = Math.min(CORNER, da.length() / 2, db.length() / 2);
    return { entry: p.clone().addScaledVector(da.normalize(), r), exit: p.clone().addScaledVector(db.normalize(), r) };
  };
  const path = new THREE.CurvePath<THREE.Vector3>();
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = corner(i).exit, b = corner(i + 1).entry;
    if (a.distanceTo(b) > 1e-4) path.add(new THREE.LineCurve3(a, b));
    if (closed || i + 1 < n - 1) {
      const c = corner(i + 1);
      path.add(new THREE.QuadraticBezierCurve3(c.entry, V(i + 1), c.exit));
    }
  }
  return path;
}

export function buildRails(p: Piece, into: THREE.Group, env: THREE.Texture | null): void {
  RAIL_MAT.envMap = env;
  for (const run of runs(segments(p))) {
    const pts: THREE.Vector3[] = [];
    for (const s of run.segs) for (const [x, z] of s.pts) {
      const v = new THREE.Vector3(x, RAIL_Y, z);
      if (!pts.length || pts[pts.length - 1]!.distanceTo(v) > 1e-4) pts.push(v);
    }
    if (run.closed && pts.length > 1 && pts[0]!.distanceTo(pts[pts.length - 1]!) < 1e-4) pts.pop();
    if (!run.closed) {
      pts.unshift(new THREE.Vector3(pts[0]!.x, -0.1, pts[0]!.z));
      pts.push(new THREE.Vector3(pts[pts.length - 1]!.x, -0.1, pts[pts.length - 1]!.z));
    }
    const path = tubePath(pts, run.closed);
    const len = path.getLength();
    const tube = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(24, Math.ceil(len * 5)), RAIL_R, 10, run.closed), RAIL_MAT);
    tube.castShadow = true;
    into.add(tube);

    for (const s of run.segs) {
      if (s.kind === "line") {
        const [a, b] = [s.pts[0]!, s.pts[1]!];
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
        const yaw = Math.atan2(-dz, dx);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0, L - 0.5), 0.07, 0.05), STRIPE_MAT);
        stripe.position.set((a[0] + b[0]) / 2 + s.inward[0] * RAIL_R, RAIL_Y, (a[1] + b[1]) / 2 + s.inward[1] * RAIL_R);
        stripe.rotation.y = yaw;
        into.add(stripe);
        for (let d = COLLAR_EVERY / 2; d < L - 0.5; d += COLLAR_EVERY) {
          const c = collar();
          c.position.set(a[0] + (dx / L) * d, RAIL_Y, a[1] + (dz / L) * d);
          c.quaternion.setFromUnitVectors(UP, new THREE.Vector3(dx / L, 0, dz / L));
          into.add(c);
        }
      } else {
        const rs = s.r + s.inward * RAIL_R;
        const t = sectorMesh(rs - 0.025, rs + 0.025, RAIL_Y - 0.035, RAIL_Y + 0.035, { segments: 24 });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(t.positions, 3));
        geo.setIndex(new THREE.BufferAttribute(t.indices, 1));
        geo.computeVertexNormals();
        into.add(new THREE.Mesh(geo, STRIPE_MAT));
        const L = (s.r * Math.PI) / 2;
        for (let d = COLLAR_EVERY / 2; d < L - 0.5; d += COLLAR_EVERY) {
          const a = d / s.r;
          const c = collar();
          c.position.set(s.r * Math.cos(a), RAIL_Y, -s.r * Math.sin(a));
          c.quaternion.setFromUnitVectors(UP, new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)));
          into.add(c);
        }
      }
    }
  }
}

function collar(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(RAIL_R + 0.05, RAIL_R + 0.05, 0.3, 12), COLLAR_MAT);
  m.castShadow = true;
  return m;
}
