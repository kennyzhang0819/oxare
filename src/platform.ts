import earcut from "earcut";
import { cutRegion, edgeGaps, type XZ } from "./poly.ts";

// A drawn platform's mesh as plain arrays, free of three so the physics can take a moving or tilted
// platform's collider from the very same vertices. Groups are [start, count, material].
export interface PlatformMesh { positions: number[]; uv: Float32Array; indices: number[]; groups: [number, number, number][] }

// Lays the straight strip (x along its length L, z across it) out along a curve: `at(u, z)` is where the
// point u = x + L/2 along it lands. Long edges also break at each `knots` u, where the curve kinks.
export interface PlatformBend { at(u: number, z: number): XZ; knots: number[] }

// See docs/platforms.md. Material groups: 0 top/bottom, 1 walls, 2 lips, 3 borders; scene.ts indexes materials by them.
export function platformMesh(L: number, W: number, thick: number, bevel: { inset: number; drop: number; border: number }, tile: number, bend?: PlatformBend, warp?: (t: number) => number, cuts: XZ[][] = []): PlatformMesh {
  const A = L / 2, B = W / 2;
  const by = Math.max(0.01, Math.min(bevel.drop, thick / 2 - 0.01));
  const K = 4, KB = 4;
  const y1 = 0, y0 = -thick;
  const step = bend || warp ? 1 : 2;
  const rect: XZ[] = [[-A, -B], [-A, B], [A, B], [A, -B]];
  const region = cuts.length ? cutRegion(rect, cuts) : [[rect]];

  const pos: number[] = [], uvKind: number[] = [], perim: number[] = [], out: number[] = [], idx: number[] = [];
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

  type Size = { b: number; g: number; re: number };
  const inward = (loop: XZ[], i: number): XZ => {
    const a = loop[i]!, c = loop[(i + 1) % loop.length]!, len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    return [(c[1] - a[1]) / len, -(c[0] - a[0]) / len];
  };
  const corner = (loop: XZ[], i: number, o: number, sz: Size, sc: number[], fc: number[], flat: boolean) => {
    const n = loop.length, v = loop[i]!, n1 = inward(loop, (i + n - 1) % n), n2 = inward(loop, i);
    const det = n1[0] * n2[1] - n1[1] * n2[0];
    const s1 = sc[(i + n - 1) % n]!, s2 = sc[i]!, sm = Math.min(s1, s2), b = sz.b * sm, re = sz.re * sm, om = o * sm;
    const rc = om <= b ? b - om + (re * om) / b : re - (om - b);
    const rho = flat ? 0 : (det < 0 ? -rc : b + om) * fc[i]!;
    const c1 = n1[0] * v[0] + n1[1] * v[1] + o * s1 - rho, c2 = n2[0] * v[0] + n2[1] * v[1] + o * s2 - rho;
    const C: XZ = Math.abs(det) < 1e-9 ? [v[0] + n1[0] * (o * s1 - rho), v[1] + n1[1] * (o * s1 - rho)]
      : [(c1 * n2[1] - c2 * n1[1]) / det, (n1[0] * c2 - n2[0] * c1) / det];
    const t1 = Math.atan2(n1[1], n1[0]);
    let dt = Math.atan2(n2[1], n2[0]) - t1;
    if (dt > Math.PI) dt -= 2 * Math.PI;
    if (dt < -Math.PI) dt += 2 * Math.PI;
    return { C, rho, t1, dt, n2 };
  };
  type Ring = { pts: XZ[]; out: XZ[] };
  const ringAt = (loop: XZ[], o: number, sz: Size, sc: number[], fc: number[], flat = false): Ring => {
    const n = loop.length, pts: XZ[] = [], nrm: XZ[] = [];
    const corners = loop.map((_, i) => corner(loop, i, o, sz, sc, fc, flat));
    for (let i = 0; i < n; i++) {
      const { C, rho, t1, dt, n2 } = corners[i]!;
      for (let k = 0; k <= K; k++) {
        const t = t1 + (dt * k) / K, u: XZ = [Math.cos(t), Math.sin(t)];
        pts.push([C[0] + rho * u[0], C[1] + rho * u[1]]);
        nrm.push([-u[0], -u[1]]);
      }
      const v = loop[i]!, w = loop[(i + 1) % n]!, segs = Math.max(1, Math.ceil(Math.hypot(w[0] - v[0], w[1] - v[1]) / step));
      const nx = corners[(i + 1) % n]!, s0 = pts[pts.length - 1]!;
      const s1: XZ = [nx.C[0] + nx.rho * Math.cos(nx.t1), nx.C[1] + nx.rho * Math.sin(nx.t1)];
      const ts = Array.from({ length: segs - 1 }, (_, k) => (k + 1) / segs);
      // Every ring gets the same knots, clamped onto its edge, or the strips between rings misalign.
      if (bend && Math.abs(w[1] - v[1]) < 1e-9) for (const u of bend.knots) if ((u - A - v[0]) * (u - A - w[0]) < 0) ts.push(Math.max(0, Math.min(1, (u - A - s0[0]) / (s1[0] - s0[0] || 1))));
      for (const t of ts.sort((a, b) => a - b)) {
        pts.push([s0[0] + (s1[0] - s0[0]) * t, s0[1] + (s1[1] - s0[1]) * t]);
        nrm.push([-n2[0], -n2[1]]);
      }
    }
    return { pts, out: nrm };
  };

  const addRing = (r: Ring, y: number, kind: number) => {
    const base = pos.length / 3;
    let d = 0;
    r.pts.forEach(([x, z], i) => {
      if (i > 0) d += Math.hypot(x - r.pts[i - 1]![0], z - r.pts[i - 1]![1]);
      pos.push(x, y, z); uvKind.push(kind); perim.push(d); out.push(r.out[i]![0], r.out[i]![1]);
    });
    return base;
  };
  const addPoint = (x: number, y: number, z: number) => { pos.push(x, y, z); uvKind.push(0); perim.push(0); out.push(0, 0); return pos.length / 3 - 1; };
  const strip = (ra: number, rb: number, N: number, up: number) => {
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      quad(ra + i, ra + j, rb + j, rb + i, out[(ra + i) * 2]!, up, out[(ra + i) * 2 + 1]!);
    }
  };

  const b0 = Math.max(0.01, Math.min(bevel.inset, W / 2 - 0.01, L / 2 - 0.01));
  const g0 = Math.max(0, Math.min(bevel.border, W / 2 - b0 - 0.01, L / 2 - b0 - 0.01));
  const sz: Size = { b: b0, g: g0, re: b0 / 2 };
  const fitCorners = (loop: XZ[], sc: number[]): number[] => {
    const n = loop.length, fc = loop.map(() => 1);
    const insets = [0, ...Array.from({ length: KB }, (_, k) => sz.b * (1 - Math.cos(((k + 1) / KB) * (Math.PI / 2)))), sz.b + sz.g];
    for (let it = 0; it < 12; it++) {
      const bad = new Set<number>();
      for (const o of insets) {
        const cs = loop.map((_, i) => corner(loop, i, o, sz, sc, fc, false));
        for (let i = 0; i < n; i++) {
          const a = cs[i]!, c = cs[(i + 1) % n]!, v = loop[i]!, w = loop[(i + 1) % n]!;
          const dx = w[0] - v[0], dz = w[1] - v[1];
          const along = (C: XZ, rho: number, u: XZ) => (C[0] + rho * u[0] - v[0]) * dx + (C[1] + rho * u[1] - v[1]) * dz;
          if (along(a.C, a.rho, a.n2) > along(c.C, c.rho, a.n2) + 1e-9) { bad.add(i); bad.add((i + 1) % n); }
        }
      }
      if (!bad.size) break;
      for (const i of bad) fc[i]! *= 0.7;
    }
    return fc;
  };

  const parts = region.map((loops) => {
    const gaps = cuts.length ? edgeGaps(loops) : loops.map((q) => q.map(() => Infinity));
    return loops.map((loop, k) => {
      const sc = gaps[k]!.map((w) => Math.max(0.05, Math.min(1, (w - 0.02) / (2 * (b0 + g0)))));
      return { loop, sc, fc: fitCorners(loop, sc) };
    });
  });

  const lips = (yEdge: number, dir: 1 | -1) => {
    for (const { loop, sc, fc } of parts.flat()) {
      let prev = -1, N = 0;
      for (let k = 0; k <= KB; k++) {
        const t = (k / KB) * (Math.PI / 2);
        const r = ringAt(loop, sz.b * (1 - Math.cos(t)), sz, sc, fc);
        N = r.pts.length;
        const ring = addRing(r, yEdge + dir * by * Math.sin(t), 0);
        if (prev >= 0) strip(prev, ring, N, dir);
        prev = ring;
      }
    }
  };
  const borders = (y: number, dir: 1 | -1) => {
    if (sz.g <= 0) return;
    for (const { loop, sc, fc } of parts.flat()) {
      const a = ringAt(loop, sz.b, sz, sc, fc), c = ringAt(loop, sz.b + sz.g, sz, sc, fc);
      strip(addRing(a, y, 0), addRing(c, y, 0), a.pts.length, dir);
    }
  };
  const faces = (y: number, dir: 1 | -1) => {
    for (const part of parts) {
      const o = sz.b + sz.g, loops = part.map((l) => l.loop);
      if (!cuts.length) {
        const rf = sz.re - sz.g, ga = A - o - rf, gb = B - o - rf;
        const nsx = Math.max(1, Math.ceil(L / step)), nsz = Math.max(1, Math.ceil(W / 2));
        const { sc, fc } = part[0]!;
        if (rf > 0) { const a = ringAt(loops[0]!, o, sz, sc, fc), c = ringAt(loops[0]!, o + rf, sz, sc, fc, true); strip(addRing(a, y, 0), addRing(c, y, 0), a.pts.length, dir); }
        const gridBase = pos.length / 3;
        for (let j = 0; j <= nsz; j++) for (let i = 0; i <= nsx; i++) addPoint(-ga + ((2 * ga) * i) / nsx, y, -gb + ((2 * gb) * j) / nsz);
        for (let j = 0; j < nsz; j++) for (let i = 0; i < nsx; i++) {
          const a = gridBase + j * (nsx + 1) + i;
          quad(a, a + 1, a + nsx + 2, a + nsx + 1, 0, dir, 0);
        }
        continue;
      }
      const base = pos.length / 3;
      const contours = part.map(({ loop, sc, fc }) => ringAt(loop, o, sz, sc, fc).pts.map(([x, z]) => { addPoint(x, y, z); return [x, z] as XZ; }));
      const flat: number[] = [], holes: number[] = [];
      contours.forEach((c, k) => { if (k) holes.push(flat.length / 2); for (const [x, z] of c) flat.push(x, z); });
      const t = earcut(flat, holes);
      for (let k = 0; k < t.length; k += 3) tri(base + t[k]!, base + t[k + 1]!, base + t[k + 2]!, 0, dir, 0);
    }
  };

  lips(y1 - by, 1);
  const topLipTo = idx.length;
  borders(y1, 1);
  const topBorderTo = idx.length;
  faces(y1, 1);
  const botLipFrom = idx.length;
  lips(y0 + by, -1);
  const botLipTo = idx.length;
  borders(y0, -1);
  const botBorderTo = idx.length;
  faces(y0, -1);
  const wallsFrom = idx.length;
  for (const { loop, sc, fc } of parts.flat()) {
    const r = ringAt(loop, 0, sz, sc, fc);
    strip(addRing(r, y1 - by, 1), addRing(r, y0 + by, 1), r.pts.length, 0);
  }
  const wallsTo = idx.length;

  const lift: number[] = [];
  if (warp) {
    for (let i = 0; i < pos.length; i += 3) { const w = warp((pos[i]! + A) / L); lift.push(w); pos[i + 1] = pos[i + 1]! + w; }
  }
  if (bend) {
    for (let i = 0; i < pos.length; i += 3) {
      const [x, z] = bend.at(pos[i]! + A, pos[i + 2]!);
      pos[i] = x;
      pos[i + 2] = z;
    }
  }
  const uv = new Float32Array((pos.length / 3) * 2);
  for (let i = 0; i < pos.length / 3; i++) {
    if (uvKind[i] === 0) { uv[i * 2] = P(i, 0) / tile; uv[i * 2 + 1] = P(i, 2) / tile; }
    else { uv[i * 2] = (perim[i] ?? 0) / tile; uv[i * 2 + 1] = (P(i, 1) - (lift[i] ?? 0) - y0) / thick; }
  }
  return {
    positions: pos, uv, indices: idx,
    groups: [[0, topLipTo, 2], [topLipTo, topBorderTo - topLipTo, 3], [topBorderTo, botLipFrom - topBorderTo, 0], [botLipFrom, botLipTo - botLipFrom, 2],
      [botLipTo, botBorderTo - botLipTo, 3], [botBorderTo, wallsFrom - botBorderTo, 0], [wallsFrom, wallsTo - wallsFrom, 1]],
  };
}
