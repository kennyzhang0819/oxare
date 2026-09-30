import { pieceRot, type Level } from "./level.ts";
import { rotXZ } from "./sim.ts";

type XZ = [number, number];
const SNAP = 1000;
const EPS = 1e-3;
const snap = (v: number) => Math.round(v * SNAP) / SNAP;

// Every platform top as convex quads in world space. The whole floor becomes one
// welded trimesh so Rapier can treat piece seams as internal edges (see sim.ts).
function topQuads(level: Level): { quads: XZ[][]; ys: number[] } {
  const quads: XZ[][] = [], ys: number[] = [];
  for (const p of level.pieces) {
    const rot = pieceRot(p);
    const W = (x: number, z: number): XZ => { const o = rotXZ(x, z, rot); return [snap(p.x + o.x), snap(p.z + o.z)]; };
    if (p.type === "slab") {
      const hx = p.w / 2, hz = p.d / 2;
      quads.push([W(-hx, -hz), W(hx, -hz), W(hx, hz), W(-hx, hz)]);
      ys.push(p.y);
    } else if (p.type === "curve") {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * (Math.PI / 2), a1 = ((i + 1) / n) * (Math.PI / 2);
        quads.push([
          W(p.inner * Math.cos(a0), -p.inner * Math.sin(a0)), W(p.outer * Math.cos(a0), -p.outer * Math.sin(a0)),
          W(p.outer * Math.cos(a1), -p.outer * Math.sin(a1)), W(p.inner * Math.cos(a1), -p.inner * Math.sin(a1)),
        ]);
        ys.push(p.y);
      }
    }
  }
  return { quads, ys };
}

function onSegment(v: XZ, a: XZ, b: XZ): number | null {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
  if (L2 < EPS) return null;
  const t = ((v[0] - a[0]) * dx + (v[1] - a[1]) * dz) / L2;
  if (t <= EPS || t >= 1 - EPS) return null;
  const px = a[0] + dx * t, pz = a[1] + dz * t;
  return Math.hypot(px - v[0], pz - v[1]) < EPS ? t : null;
}

export function floorMesh(level: Level): { positions: Float32Array; indices: Uint32Array } {
  const { quads, ys } = topQuads(level);
  const byY = new Map<number, XZ[]>();
  quads.forEach((q, i) => { const y = ys[i]!; if (!byY.has(y)) byY.set(y, []); byY.get(y)!.push(...q); });
  const pos: number[] = [], idx: number[] = [];
  const keys = new Map<string, number>();
  const vertex = (x: number, y: number, z: number) => {
    const k = `${x},${y},${z}`;
    let i = keys.get(k);
    if (i === undefined) { i = pos.length / 3; keys.set(k, i); pos.push(x, y, z); }
    return i;
  };
  quads.forEach((q, qi) => {
    const y = ys[qi]!;
    const others = byY.get(y)!;
    const poly: XZ[] = [];
    for (let e = 0; e < q.length; e++) {
      const a = q[e]!, b = q[(e + 1) % q.length]!;
      poly.push(a);
      const splits: { t: number; v: XZ }[] = [];
      for (const v of others) { const t = onSegment(v, a, b); if (t !== null) splits.push({ t, v }); }
      splits.sort((p, r) => p.t - r.t);
      for (const s of splits) if (!poly.some((w) => w[0] === s.v[0] && w[1] === s.v[1])) poly.push(s.v);
    }
    // Oriented mesh: wind every polygon so its normal points up.
    let area = 0;
    for (let i = 0; i < poly.length; i++) { const a = poly[i]!, b = poly[(i + 1) % poly.length]!; area += a[1] * b[0] - b[1] * a[0]; }
    if (area < 0) poly.reverse();
    // Fan from the centroid: a fan from a corner can put a split seam edge on a collinear triangle.
    const ids = poly.map((v) => vertex(v[0], y, v[1]));
    const cx = poly.reduce((a, v) => a + v[0], 0) / poly.length, cz = poly.reduce((a, v) => a + v[1], 0) / poly.length;
    const c = pos.length / 3;
    pos.push(cx, y, cz);
    for (let i = 0; i < ids.length; i++) idx.push(c, ids[i]!, ids[(i + 1) % ids.length]!);
  });
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}
