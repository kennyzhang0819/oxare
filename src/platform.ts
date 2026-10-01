import * as THREE from "three";
import { cutHole, type XZ } from "./poly.ts";

// A slab rounded identically top and bottom, so it reads the same flipped, optionally bent into a 90-degree arc about
// the origin (local x runs along the arc, local z across it, arc radius rmid + z),
// or lifted by `warp(t)` with t running 0..1 along local x. `cuts` are convex holes in
// local XZ removed from the flat top. The lip is a quarter-ellipse `bevel.inset` wide and
// `bevel.drop` tall, and inside it a flat band `bevel.border` wide frames each face. Group 0 is
// the top and bottom, group 1 the outer walls (uv v runs 0..1 from the bottom to the top of
// the slab), group 2 the two rounded lips, group 3 the two border bands.
export function platformGeometry(L: number, W: number, thick: number, bevel: { inset: number; drop: number; border: number }, tile: number, bend?: { rmid: number }, warp?: (t: number) => number, cuts: XZ[][] = []): THREE.BufferGeometry {
  const b = Math.max(0.01, Math.min(bevel.inset, W / 2 - 0.01, L / 2 - 0.01));
  const by = Math.max(0.01, Math.min(bevel.drop, thick / 2 - 0.01));
  const g = Math.max(0, Math.min(bevel.border, W / 2 - b - 0.01, L / 2 - b - 0.01));
  // Plan-view corner radius where the lip meets the border, and inside the border.
  const re = b / 2, rf = Math.max(0, re - g);
  const A = L / 2, B = W / 2;
  const ns = Math.max(1, Math.ceil(L / (bend || warp ? 1 : 2)));
  const nt = Math.max(1, Math.ceil(W / 2));
  const K = 4, KB = 4;
  const y1 = 0, y0 = -thick;

  const pos: number[] = [], uvKind: number[] = [], perim: number[] = [], idx: number[] = [];
  const P = (i: number, k: number) => pos[i * 3 + k] ?? 0;
  const tri = (a: number, c: number, d: number, hx: number, hy: number, hz: number) => {
    const ux = P(c, 0) - P(a, 0), uy = P(c, 1) - P(a, 1), uz = P(c, 2) - P(a, 2);
    const vx = P(d, 0) - P(a, 0), vy = P(d, 1) - P(a, 1), vz = P(d, 2) - P(a, 2);
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * hx + ny * hy + nz * hz >= 0) idx.push(a, c, d); else idx.push(a, d, c);
  };
  const quad = (a: number, c: number, d: number, e: number, hx: number, hy: number, hz: number) => {
    tri(a, c, d, hx, hy, hz);
    tri(a, d, e, hx, hy, hz);
  };

  const ringPts = (a: number, c: number, cr: number): [number, number][] => {
    const pts: [number, number][] = [];
    const seg = (x0: number, z0: number, x1: number, z1: number, n: number) => {
      for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n]);
    };
    const arc = (cx: number, cz: number, a0: number) => {
      for (let i = 0; i < K; i++) { const t = a0 + (i / K) * (Math.PI / 2); pts.push([cx + cr * Math.cos(t), cz + cr * Math.sin(t)]); }
    };
    seg(-(a - cr), -c, a - cr, -c, ns);
    arc(a - cr, -c + cr, -Math.PI / 2);
    seg(a, -c + cr, a, c - cr, nt);
    arc(a - cr, c - cr, 0);
    seg(a - cr, c, -(a - cr), c, ns);
    arc(-(a - cr), c - cr, Math.PI / 2);
    seg(-a, c - cr, -a, -c + cr, nt);
    arc(-(a - cr), -c + cr, Math.PI);
    return pts;
  };
  const addRing = (pts: [number, number][], y: number, kind: number) => {
    const base = pos.length / 3;
    let d = 0;
    pts.forEach(([x, z], i) => {
      if (i > 0) d += Math.hypot(x - pts[i - 1]![0], z - pts[i - 1]![1]);
      pos.push(x, y, z); uvKind.push(kind); perim.push(d);
    });
    return base;
  };
  const N = 2 * ns + 2 * nt + 4 * K;
  const strip = (ra: number, rb: number, hint: (i: number) => [number, number, number]) => {
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const [hx, hy, hz] = hint(ra + i);
      quad(ra + i, ra + j, rb + j, rb + i, hx, hy, hz);
    }
  };
  const outward = (up: number) => (v: number): [number, number, number] => [P(v, 0), up, P(v, 2)];

  // Bevel rings from the wall edge out to a flat face; `dir` is +1 for the top, -1 for the bottom.
  const bevelRings = (yEdge: number, dir: 1 | -1) => {
    let prev = -1;
    for (let k = 0; k <= KB; k++) {
      const t = (k / KB) * (Math.PI / 2);
      const o = b * (1 - Math.cos(t));
      const ring = addRing(ringPts(A - o, B - o, b - o + (re * o) / b), yEdge + dir * by * Math.sin(t), 0);
      if (prev >= 0) strip(prev, ring, outward(dir * by));
      prev = ring;
    }
  };
  const fans = (y: number, dir: 1 | -1, polys: XZ[][]) => {
    for (const c of cuts) polys = polys.flatMap((q) => cutHole(q, c));
    for (const q of polys) {
      const base = pos.length / 3;
      for (const [x, z] of q) { pos.push(x, y, z); uvKind.push(0); perim.push(0); }
      const c = pos.length / 3;
      pos.push(q.reduce((s, v) => s + v[0], 0) / q.length, y, q.reduce((s, v) => s + v[1], 0) / q.length);
      uvKind.push(0); perim.push(0);
      for (let i = 0; i < q.length; i++) tri(c, base + i, base + ((i + 1) % q.length), 0, dir, 0);
    }
  };
  const rect = (x0: number, z0: number, x1: number, z1: number): XZ[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  // Band between two concentric rounded rings, subdivided like the lip so warp and bend follow
  // it; with holes, each of its quads is cut separately.
  const band = (y: number, dir: 1 | -1, outerR: XZ[], innerR: XZ[]) => {
    if (cuts.length) fans(y, dir, outerR.map((v, i) => [v, outerR[(i + 1) % N]!, innerR[(i + 1) % N]!, innerR[i]!]));
    else strip(addRing(outerR, y, 0), addRing(innerR, y, 0), () => [0, dir, 0]);
  };
  const ia = A - b, ib = B - b, fa = ia - g, fb = ib - g, ga = fa - rf, gb = fb - rf;
  const border = (y: number, dir: 1 | -1) => {
    if (g > 0) band(y, dir, ringPts(ia, ib, re), ringPts(fa, fb, rf));
  };
  // Flat face at `y` inside the border: rounded corners as a band round a rectangle that is
  // hole-cut fans or a grid (the grid gives the warp its shape).
  const face = (y: number, dir: 1 | -1) => {
    if (rf > 0) band(y, dir, ringPts(fa, fb, rf), ringPts(ga, gb, 0));
    if (cuts.length) fans(y, dir, [rect(-ga, -gb, ga, gb)]);
    else {
      const gridBase = pos.length / 3;
      for (let j = 0; j <= nt; j++) for (let i = 0; i <= ns; i++) {
        pos.push(-ga + ((2 * ga) * i) / ns, y, -gb + ((2 * gb) * j) / nt);
        uvKind.push(0); perim.push(0);
      }
      for (let j = 0; j < nt; j++) for (let i = 0; i < ns; i++) {
        const a = gridBase + j * (ns + 1) + i;
        quad(a, a + 1, a + ns + 2, a + ns + 1, 0, dir, 0);
      }
    }
  };
  bevelRings(y1 - by, 1);
  const topLipTo = idx.length;
  border(y1, 1);
  const topBorderTo = idx.length;
  face(y1, 1);
  const botLipFrom = idx.length;
  bevelRings(y0 + by, -1);
  const botLipTo = idx.length;
  border(y0, -1);
  const botBorderTo = idx.length;
  face(y0, -1);
  // Walls between the two lips.
  const outer = ringPts(A, B, b);
  const wallTop = addRing(outer, y1 - by, 1);
  const wallBot = addRing(outer, y0 + by, 1);
  const wallsFrom = idx.length;
  strip(wallTop, wallBot, outward(0));
  const wallsTo = idx.length;

  const lift: number[] = [];
  if (warp) {
    for (let i = 0; i < pos.length; i += 3) { const w = warp((pos[i]! + A) / L); lift.push(w); pos[i + 1] = pos[i + 1]! + w; }
  }
  if (bend) {
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i]!, z = pos[i + 2]!;
      const a = (x + A) / bend.rmid, r = bend.rmid + z;
      pos[i] = r * Math.cos(a);
      pos[i + 2] = -r * Math.sin(a);
    }
  }
  const uv = new Float32Array((pos.length / 3) * 2);
  for (let i = 0; i < pos.length / 3; i++) {
    if (uvKind[i] === 0) { uv[i * 2] = P(i, 0) / tile; uv[i * 2 + 1] = P(i, 2) / tile; }
    else { uv[i * 2] = (perim[i] ?? 0) / tile; uv[i * 2 + 1] = (P(i, 1) - (lift[i] ?? 0) - y0) / thick; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.addGroup(0, topLipTo, 2);
  geo.addGroup(topLipTo, topBorderTo - topLipTo, 3);
  geo.addGroup(topBorderTo, botLipFrom - topBorderTo, 0);
  geo.addGroup(botLipFrom, botLipTo - botLipFrom, 2);
  geo.addGroup(botLipTo, botBorderTo - botLipTo, 3);
  geo.addGroup(botBorderTo, wallsFrom - botBorderTo, 0);
  geo.addGroup(wallsFrom, wallsTo - wallsFrom, 1);
  geo.addGroup(wallsTo, idx.length - wallsTo, 0);
  geo.computeVertexNormals();
  return geo;
}
