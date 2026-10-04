import earcut from "earcut";
import { clipBox, cutRegion, edgeGaps, type XZ } from "./poly.ts";

// A drawn platform's mesh as plain arrays, free of three so the physics can take a moving or tilted
// platform's collider from the very same vertices. Groups are [start, count, material].
// `seams` pairs the two copies of each wall ring's closing vertex, which must share one normal.
export interface PlatformMesh { positions: number[]; uv: Float32Array; indices: number[]; groups: [number, number, number][]; seams: [number, number][] }

// Lays the straight strip (x along its length L, z across it) out along a curve: `at(u, z)` is where the
// point u = x + L/2 along it lands. Long edges also break at each `knots` u, where the curve kinks.
export interface PlatformBend { at(u: number, z: number): XZ; knots: number[] }

// See docs/platforms.md. Material groups: 0 top/bottom, 1 walls, 2 lips, 3 borders; scene.ts indexes materials by them.
// `twist`, given, rolls each cross-section about the top's centre line (x = 0, y = 0) by twist(z) radians.
// `open` leaves out the tiled top and underside inside their square corners (a treadmill's opening, BELT_FRAME in).
// `outline`, given, replaces the L x W rectangle with that shape (a shaped slab's), centred like it.
// `deform`, given, carries every point of the finished strip somewhere else (a curled slab's bend),
// after `twist`; its texture coordinates stay those of the flat strip.
// `joins` are the edge spans, in the flat strip's frame, where another platform carries on; `uvFrame`
// carries a point's texture coordinates into the level's frame, so the tiles run on across a join.
export interface PlatformJoins { joins?: XZ[][]; uvFrame?: (x: number, z: number) => XZ }
const JOIN_EPS = 0.01;
export function platformMesh(L: number, W: number, thick: number, bevel: { inset: number; drop: number; border: number }, tile: number, bend?: PlatformBend, warp?: (t: number) => number, cuts: XZ[][] = [], twist?: (z: number) => number, open = false, outline?: XZ[], deform?: (v: [number, number, number]) => [number, number, number], { joins = [], uvFrame }: PlatformJoins = {}): PlatformMesh {
  const A = L / 2, B = W / 2;
  const by = Math.max(0.01, Math.min(bevel.drop, thick / 2 - 0.01));
  const K = 4, KB = 4;
  const y1 = 0, y0 = -thick;
  const fine = !!twist || !!deform;
  const step = fine ? 0.5 : bend || warp ? 1 : 2;
  const rect: XZ[] = outline ?? [[-A, -B], [-A, B], [A, B], [A, -B]];
  const shaped = !!outline;
  const region = cuts.length || shaped ? cutRegion(rect, cuts) : [[rect]];

  const pos: number[] = [], uvKind: number[] = [], perim: number[] = [], out: number[] = [], idx: number[] = [], seams: [number, number][] = [];
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
  type Corner = { pts: XZ[]; nrm: XZ[]; n2: XZ };
  const arc = (C: XZ, rho: number, n1: XZ, n2: XZ): Corner => {
    const t1 = Math.atan2(n1[1], n1[0]);
    let dt = Math.atan2(n2[1], n2[0]) - t1;
    if (dt > Math.PI) dt -= 2 * Math.PI;
    if (dt < -Math.PI) dt += 2 * Math.PI;
    const pts: XZ[] = [], nrm: XZ[] = [];
    for (let k = 0; k <= K; k++) {
      const t = t1 + (dt * k) / K, u: XZ = [Math.cos(t), Math.sin(t)];
      pts.push([C[0] + rho * u[0], C[1] + rho * u[1]]);
      nrm.push([-u[0], -u[1]]);
    }
    return { pts, nrm, n2 };
  };
  const corner = (loop: XZ[], i: number, o: number, sz: Size, sc: number[], fc: number[], jn: boolean[], flat: boolean): Corner => {
    const n = loop.length, v = loop[i]!, n1 = inward(loop, (i + n - 1) % n), n2 = inward(loop, i);
    const det = n1[0] * n2[1] - n1[1] * n2[0];
    const s1 = sc[(i + n - 1) % n]!, s2 = sc[i]!, j1 = jn[(i + n - 1) % n]!, j2 = jn[i]!;
    if (j1 || j2) {
      // A joined edge has no lip, and its corners are square.
      const o1 = j1 ? 0 : o * s1, o2 = j2 ? 0 : o * s2;
      if (j1 !== j2 && Math.abs(det) < 1e-6) {
        // An open edge running straight on into a join: the ring steps across the joined span's end,
        // so the lips here carry the far platform's side lip on, to meet this one on the mitre.
        const w = loop[j2 ? (i + 1) % n : (i + n - 1) % n]!, len = Math.hypot(w[0] - v[0], w[1] - v[1]) || 1;
        const oo = j2 ? o1 : o2, no = j2 ? n1 : n2, d: XZ = [(w[0] - v[0]) / len, (w[1] - v[1]) / len];
        const p2: XZ = [v[0] + d[0] * oo, v[1] + d[1] * oo], p1: XZ = [p2[0] + no[0] * oo, p2[1] + no[1] * oo];
        const pts = Array.from({ length: K + 1 }, (_, k): XZ => ((j2 ? k === 0 : k === K) ? p1 : p2));
        return { pts, nrm: pts.map((q): XZ => (q === p1 ? [-no[0], -no[1]] : [-d[0], -d[1]])), n2 };
      }
      const c1 = n1[0] * v[0] + n1[1] * v[1] + o1, c2 = n2[0] * v[0] + n2[1] * v[1] + o2;
      const C: XZ = Math.abs(det) < 1e-9 ? [v[0] + n1[0] * o1, v[1] + n1[1] * o1] : [(c1 * n2[1] - c2 * n1[1]) / det, (n1[0] * c2 - n2[0] * c1) / det];
      return arc(C, 0, n1, n2);
    }
    const sm = Math.min(s1, s2), b = sz.b * sm, re = sz.re * sm, om = o * sm;
    const rc = om <= b ? b - om + (re * om) / b : re - (om - b);
    const rho = flat ? 0 : (det < 0 ? -rc : b + om) * fc[i]!;
    const c1 = n1[0] * v[0] + n1[1] * v[1] + o * s1 - rho, c2 = n2[0] * v[0] + n2[1] * v[1] + o * s2 - rho;
    const C: XZ = Math.abs(det) < 1e-9 ? [v[0] + n1[0] * (o * s1 - rho), v[1] + n1[1] * (o * s1 - rho)]
      : [(c1 * n2[1] - c2 * n1[1]) / det, (n1[0] * c2 - n2[0] * c1) / det];
    return arc(C, rho, n1, n2);
  };
  // `joined[i]` marks the span from point i to the next as lying on a joined edge.
  type Ring = { pts: XZ[]; out: XZ[]; joined: boolean[] };
  const ringAt = (loop: XZ[], o: number, sz: Size, sc: number[], fc: number[], jn: boolean[], flat = false): Ring => {
    const n = loop.length, pts: XZ[] = [], nrm: XZ[] = [], joined: boolean[] = [];
    const corners = loop.map((_, i) => corner(loop, i, o, sz, sc, fc, jn, flat));
    for (let i = 0; i < n; i++) {
      const c = corners[i]!;
      pts.push(...c.pts);
      nrm.push(...c.nrm);
      joined.push(...c.pts.map((_, k) => k === K && jn[i]!));
      const v = loop[i]!, w = loop[(i + 1) % n]!, segs = Math.max(1, Math.ceil(Math.hypot(w[0] - v[0], w[1] - v[1]) / step));
      const s0 = c.pts[K]!, s1 = corners[(i + 1) % n]!.pts[0]!;
      const ts = Array.from({ length: segs - 1 }, (_, k) => (k + 1) / segs);
      // Every ring gets the same knots, clamped onto its edge, or the strips between rings misalign.
      if (bend && Math.abs(w[1] - v[1]) < 1e-9) for (const u of bend.knots) if ((u - A - v[0]) * (u - A - w[0]) < 0) ts.push(Math.max(0, Math.min(1, (u - A - s0[0]) / (s1[0] - s0[0] || 1))));
      for (const t of ts.sort((a, b) => a - b)) {
        pts.push([s0[0] + (s1[0] - s0[0]) * t, s0[1] + (s1[1] - s0[1]) * t]);
        nrm.push([-c.n2[0], -c.n2[1]]);
        joined.push(jn[i]!);
      }
    }
    return { pts, out: nrm, joined };
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
  // `skip` leaves out the spans on a joined edge: they face into the neighbour, and their ink hull and
  // shadow would show along the join.
  const strip = (ra: number, rb: number, N: number, up: number, wrap = true, skip?: boolean[]) => {
    for (let i = 0; i < (wrap ? N : N - 1); i++) {
      if (skip?.[i]) continue;
      const j = (i + 1) % N;
      quad(ra + i, ra + j, rb + j, rb + i, out[(ra + i) * 2]!, up, out[(ra + i) * 2 + 1]!);
    }
  };

  const b0 = Math.max(0.01, Math.min(bevel.inset, W / 2 - 0.01, L / 2 - 0.01));
  const g0 = Math.max(0, Math.min(bevel.border, W / 2 - b0 - 0.01, L / 2 - b0 - 0.01));
  const sz: Size = { b: b0, g: g0, re: b0 / 2 };
  const fitCorners = (loop: XZ[], sc: number[], jn: boolean[]): number[] => {
    const n = loop.length, fc = loop.map(() => 1);
    const insets = [0, ...Array.from({ length: KB }, (_, k) => sz.b * (1 - Math.cos(((k + 1) / KB) * (Math.PI / 2)))), sz.b + sz.g];
    for (let it = 0; it < 12; it++) {
      const bad = new Set<number>();
      for (const o of insets) {
        const cs = loop.map((_, i) => corner(loop, i, o, sz, sc, fc, jn, false));
        for (let i = 0; i < n; i++) {
          const v = loop[i]!, w = loop[(i + 1) % n]!, dx = w[0] - v[0], dz = w[1] - v[1];
          const along = (q: XZ) => (q[0] - v[0]) * dx + (q[1] - v[1]) * dz;
          if (along(cs[i]!.pts[K]!) > along(cs[(i + 1) % n]!.pts[0]!) + 1e-9) { bad.add(i); bad.add((i + 1) % n); }
        }
      }
      if (!bad.size) break;
      for (const i of bad) fc[i]! *= 0.7;
    }
    return fc;
  };

  // Each loop split where a join starts or ends along it; `jn[i]` marks edge i as joined.
  const splitJoins = (loop: XZ[]): { loop: XZ[]; jn: boolean[] } => {
    if (!joins.length) return { loop, jn: loop.map(() => false) };
    const pts: XZ[] = [], jn: boolean[] = [];
    loop.forEach((a, i) => {
      const b = loop[(i + 1) % loop.length]!, dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      const spans: [number, number][] = [];
      if (len > JOIN_EPS) for (const [s0, s1] of joins) {
        const off = (q: XZ) => Math.abs((q[0] - a[0]) * dz - (q[1] - a[1]) * dx) / len, t = (q: XZ) => ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / (len * len);
        if (off(s0!) > JOIN_EPS || off(s1!) > JOIN_EPS) continue;
        const lo = Math.max(0, Math.min(t(s0!), t(s1!))), hi = Math.min(1, Math.max(t(s0!), t(s1!)));
        if ((hi - lo) * len > JOIN_EPS) spans.push([lo, hi]);
      }
      spans.sort((p, q) => p[0] - q[0]);
      const merged: [number, number][] = [];
      for (const [lo, hi] of spans) { const m = merged[merged.length - 1]; if (m && (lo - m[1]) * len <= JOIN_EPS) m[1] = Math.max(m[1], hi); else merged.push([lo, hi]); }
      const ts = [0], kind: boolean[] = [];
      for (const [lo, hi] of merged) {
        const l = lo * len < JOIN_EPS ? 0 : lo, h = (1 - hi) * len < JOIN_EPS ? 1 : hi;
        if (l > ts[ts.length - 1]!) { kind.push(false); ts.push(l); }
        kind.push(true); ts.push(h);
      }
      if (ts[ts.length - 1]! < 1) { kind.push(false); ts.push(1); }
      kind.forEach((k, j) => { pts.push([a[0] + dx * ts[j]!, a[1] + dz * ts[j]!]); jn.push(k); });
    });
    return { loop: pts, jn };
  };
  const parts = region.map((loops0) => {
    const split = loops0.map(splitJoins), loops = split.map((q) => q.loop);
    const gaps = cuts.length || shaped ? edgeGaps(loops) : loops.map((q) => q.map(() => Infinity));
    return loops.map((loop, k) => {
      const sc = gaps[k]!.map((w) => Math.max(0.05, Math.min(1, (w - 0.02) / (2 * (b0 + g0))))), jn = split[k]!.jn;
      return { loop, sc, jn, fc: fitCorners(loop, sc, jn) };
    });
  });
  const joined = parts.some((part) => part.some((l) => l.jn.includes(true)));

  const lips = (yEdge: number, dir: 1 | -1) => {
    for (const { loop, sc, fc, jn } of parts.flat()) {
      let prev = -1, N = 0;
      for (let k = 0; k <= KB; k++) {
        const t = (k / KB) * (Math.PI / 2);
        const r = ringAt(loop, sz.b * (1 - Math.cos(t)), sz, sc, fc, jn);
        N = r.pts.length;
        const ring = addRing(r, yEdge + dir * by * Math.sin(t), 0);
        if (prev >= 0) strip(prev, ring, N, dir, true, r.joined);
        prev = ring;
      }
    }
  };
  const borders = (y: number, dir: 1 | -1) => {
    if (sz.g <= 0) return;
    for (const { loop, sc, fc, jn } of parts.flat()) {
      const a = ringAt(loop, sz.b, sz, sc, fc, jn), c = ringAt(loop, sz.b + sz.g, sz, sc, fc, jn);
      strip(addRing(a, y, 0), addRing(c, y, 0), a.pts.length, dir, true, a.joined);
    }
  };
  const faces = (y: number, dir: 1 | -1) => {
    for (const part of parts) {
      const o = sz.b + sz.g, loops = part.map((l) => l.loop);
      if (!cuts.length && !shaped) {
        const rf = sz.re - sz.g, ga = A - o - rf, gb = B - o - rf;
        const nsx = Math.max(1, Math.ceil(L / step)), nsz = Math.max(1, Math.ceil(W / (fine ? step : 2)));
        const { sc, fc, jn } = part[0]!;
        if (joined) {
          // The face inside the lips, laid as the grid's cells each clipped to it, so a bend or warp still has points to bend.
          const ring = ringAt(loops[0]!, o, sz, sc, fc, jn).pts.filter((q, i, a) => { const l = a[(i + a.length - 1) % a.length]!; return Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-6; });
          const lines = (h: number, ns: number, g: number) => [...Array.from({ length: ns + 1 }, (_, i) => -h + (2 * h * i) / ns), ...(open ? [-g, g] : [])].sort((a, b) => a - b).filter((v, i, a) => !i || v - a[i - 1]! > 1e-6);
          const xs = lines(A, nsx, ga), zs = lines(B, nsz, gb), ids = new Map<string, number>();
          const at = (x: number, z: number) => { const k = `${x.toFixed(4)},${z.toFixed(4)}`; let i = ids.get(k); if (i === undefined) { i = addPoint(x, y, z); ids.set(k, i); } return i; };
          for (let j = 0; j + 1 < zs.length; j++) for (let i = 0; i + 1 < xs.length; i++) {
            const x0 = xs[i]!, x1 = xs[i + 1]!, z0 = zs[j]!, z1 = zs[j + 1]!;
            if (open && x0 > -ga - 1e-6 && x1 < ga + 1e-6 && z0 > -gb - 1e-6 && z1 < gb + 1e-6) continue;
            const c = clipBox(ring, x0, x1, z0, z1);
            if (c.length < 3) continue;
            const vs = c.map(([x, z]) => at(x, z)), t = earcut(c.flat());
            for (let k = 0; k < t.length; k += 3) tri(vs[t[k]!]!, vs[t[k + 1]!]!, vs[t[k + 2]!]!, 0, dir, 0);
          }
          continue;
        }
        if (rf > 0) { const a = ringAt(loops[0]!, o, sz, sc, fc, jn), c = ringAt(loops[0]!, o + rf, sz, sc, fc, jn, true); strip(addRing(a, y, 0), addRing(c, y, 0), a.pts.length, dir); }
        if (open) continue;
        const gridBase = pos.length / 3;
        for (let j = 0; j <= nsz; j++) for (let i = 0; i <= nsx; i++) addPoint(-ga + ((2 * ga) * i) / nsx, y, -gb + ((2 * gb) * j) / nsz);
        for (let j = 0; j < nsz; j++) for (let i = 0; i < nsx; i++) {
          const a = gridBase + j * (nsx + 1) + i;
          quad(a, a + 1, a + nsx + 2, a + nsx + 1, 0, dir, 0);
        }
        continue;
      }
      const base = pos.length / 3;
      const contours = part.map(({ loop, sc, fc, jn }) => ringAt(loop, o, sz, sc, fc, jn).pts.map(([x, z]) => { addPoint(x, y, z); return [x, z] as XZ; }));
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
  for (const { loop, sc, fc, jn } of parts.flat()) {
    const r = ringAt(loop, 0, sz, sc, fc, jn);
    // Closed on a copy of its first point: wrapping back to it would squeeze the whole perimeter's u into one quad.
    r.pts.push(r.pts[0]!); r.out.push(r.out[0]!); r.joined.push(false);
    const N = r.pts.length, a = addRing(r, y1 - by, 1), b = addRing(r, y0 + by, 1);
    strip(a, b, N, 0, false, r.joined);
    seams.push([a, a + N - 1], [b, b + N - 1]);
  }
  const wallsTo = idx.length;

  // Texture coordinates come from the flat strip, so the tiles keep their size on a twist or a curl.
  const flat = fine ? pos.slice() : pos;
  if (twist) {
    for (let i = 0; i < pos.length; i += 3) {
      const a = twist(pos[i + 2]!), x = pos[i]!, y = pos[i + 1]!;
      pos[i] = x * Math.cos(a) - y * Math.sin(a);
      pos[i + 1] = x * Math.sin(a) + y * Math.cos(a);
    }
  }
  if (deform) {
    for (let i = 0; i < pos.length; i += 3) {
      const v = deform([pos[i]!, pos[i + 1]!, pos[i + 2]!]);
      pos[i] = v[0]; pos[i + 1] = v[1]; pos[i + 2] = v[2];
    }
  }
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
    const F = (k: number) => (fine ? flat[i * 3 + k] ?? 0 : P(i, k));
    if (uvKind[i] === 0) { const [u, v] = uvFrame ? uvFrame(F(0), F(2)) : [F(0), F(2)]; uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile; }
    else { uv[i * 2] = (perim[i] ?? 0) / tile; uv[i * 2 + 1] = (F(1) - (lift[i] ?? 0) - y0) / thick; }
  }
  return {
    positions: pos, uv, indices: idx, seams,
    groups: [[0, topLipTo, 2], [topLipTo, topBorderTo - topLipTo, 3], [topBorderTo, botLipFrom - topBorderTo, 0], [botLipFrom, botLipTo - botLipFrom, 2],
      [botLipTo, botBorderTo - botLipTo, 3], [botBorderTo, wallsFrom - botBorderTo, 0], [wallsFrom, wallsTo - wallsFrom, 1]],
  };
}
