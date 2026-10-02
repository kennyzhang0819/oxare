export interface TriMesh { positions: Float32Array; indices: Uint32Array; uvs: Float32Array }
export interface SectorOpts { angle?: number; segments?: number; bevel?: number; tile?: number }

// Annulus sector sweeping from +x toward -z about the origin; the cross-section
// profile is swept along the arc, with an optional rounded top edge.
export function sectorMesh(inner: number, outer: number, y0: number, y1: number, opts: SectorOpts = {}): TriMesh {
  const { angle = Math.PI / 2, segments = 12, bevel = 0, tile = 8 } = opts;
  type P = [r: number, y: number];
  const loop: P[] = [[inner, y0]];
  const planar = new Set<number>();
  if (bevel > 0) {
    const n = 4;
    for (let k = 0; k <= n; k++) {
      const t = (k / n) * (Math.PI / 2);
      if (k > 0) planar.add(loop.length);
      loop.push([inner + bevel - bevel * Math.cos(t), y1 - bevel + bevel * Math.sin(t)]);
    }
    for (let k = n; k >= 0; k--) {
      const t = (k / n) * (Math.PI / 2);
      if (k > 0) planar.add(loop.length);
      loop.push([outer - bevel + bevel * Math.cos(t), y1 - bevel + bevel * Math.sin(t)]);
    }
  } else {
    planar.add(loop.length); loop.push([inner, y1]);
    planar.add(loop.length); loop.push([outer, y1]);
  }
  loop.push([outer, y0]);

  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const P3 = (i: number, k: number) => pos[i * 3 + k] ?? 0;
  const tri = (a: number, b: number, c: number, hx: number, hy: number, hz: number) => {
    const ux = P3(b, 0) - P3(a, 0), uy = P3(b, 1) - P3(a, 1), uz = P3(b, 2) - P3(a, 2);
    const vx = P3(c, 0) - P3(a, 0), vy = P3(c, 1) - P3(a, 1), vz = P3(c, 2) - P3(a, 2);
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * hx + ny * hy + nz * hz >= 0) idx.push(a, b, c); else idx.push(a, c, b);
  };
  const ring = (p: P, isPlanar: boolean) => {
    const base = pos.length / 3;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * angle;
      const x = p[0] * Math.cos(a), z = -p[0] * Math.sin(a);
      pos.push(x, p[1], z);
      if (isPlanar) uv.push(x / tile, z / tile); else uv.push((a * p[0]) / tile, p[1] / tile);
    }
    return base;
  };
  const strip = (p: P, q: P, isPlanar: boolean) => {
    const A = ring(p, isPlanar), B = ring(q, isPlanar);
    const dr = q[0] - p[0], dy = q[1] - p[1];
    const nr = -dy, ny = dr;
    for (let i = 0; i < segments; i++) {
      const a = ((i + 0.5) / segments) * angle;
      const hx = nr * Math.cos(a), hz = -nr * Math.sin(a);
      tri(A + i, B + i, B + i + 1, hx, ny, hz);
      tri(A + i, B + i + 1, A + i + 1, hx, ny, hz);
    }
  };
  for (let k = 0; k < loop.length; k++) {
    const p = loop[k]!, q = loop[(k + 1) % loop.length]!;
    const isPlanar = planar.has(k) && planar.has((k + 1) % loop.length) || k === loop.length - 1;
    strip(p, q, isPlanar);
  }
  const cap = (a: number, hx: number, hz: number) => {
    const base = pos.length / 3;
    for (const [r, y] of loop) {
      pos.push(r * Math.cos(a), y, -r * Math.sin(a));
      uv.push(r / tile, y / tile);
    }
    for (let k = 1; k < loop.length - 1; k++) tri(base, base + k, base + k + 1, hx, 0, hz);
  };
  cap(0, 0, 1);
  cap(angle, -Math.sin(angle), -Math.cos(angle));
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx), uvs: new Float32Array(uv) };
}

type V3 = [number, number, number];
export interface SweepRing { c: V3; d: V3; m: V3 }

// Each ring's level sideways direction. A ring running straight up or down (a top end's drop into
// the platform) has none of its own and takes its neighbour's, so the rails' feet stay side by side.
function railSides(rings: SweepRing[]): V3[] {
  const own = rings.map((q): V3 | null => { const f = Math.hypot(q.d[0], q.d[2]); return f > 1e-3 ? [-q.d[2] / f, 0, q.d[0] / f] : null; });
  const out = own.slice();
  for (let i = 1; i < out.length; i++) out[i] ??= out[i - 1]!;
  for (let i = out.length - 2; i >= 0; i--) out[i] ??= out[i + 1]!;
  return out.map((v) => v ?? [1, 0, 0]);
}

// One rail of radius `r` running `offset` to the side of `rings` (sideways stays level), as a
// `sides`-gon whose flat facets touch the true circle. A facet's middle faces `face` radians from
// straight up toward the rails' centre: Rapier bumps a ball rolling along a vertex, never a facet.
export function railSweep(rings: SweepRing[], offset: number, r: number, sides: number, face: number): { positions: number[]; indices: number[] } {
  const pos: number[] = [], idx: number[] = [];
  const rr = r / Math.cos(Math.PI / sides);
  const inward = offset > 0 ? -1 : 1;
  const sides3 = railSides(rings);
  rings.forEach((ring, i) => {
    const d = ring.d, s = sides3[i]!;
    const n: V3 = [s[1] * d[2] - s[2] * d[1], s[2] * d[0] - s[0] * d[2], s[0] * d[1] - s[1] * d[0]];
    const c: V3 = [ring.c[0] + s[0] * offset, ring.c[1], ring.c[2] + s[2] * offset];
    const md = ring.m[0] * d[0] + ring.m[1] * d[1] + ring.m[2] * d[2];
    for (let j = 0; j < sides; j++) {
      const a = face + Math.PI / sides + (j * 2 * Math.PI) / sides, ca = Math.cos(a) * rr, sa = Math.sin(a) * rr * inward;
      const off: V3 = [n[0] * ca + s[0] * sa, n[1] * ca + s[1] * sa, n[2] * ca + s[2] * sa];
      const t = -(ring.m[0] * off[0] + ring.m[1] * off[1] + ring.m[2] * off[2]) / md;
      pos.push(c[0] + off[0] + d[0] * t, c[1] + off[1] + d[1] * t, c[2] + off[2] + d[2] * t);
    }
  });
  for (let i = 0; i + 1 < rings.length; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j, b = i * sides + ((j + 1) % sides), c = a + sides, e = b + sides;
      idx.push(a, b, c, b, e, c);
    }
  }
  // Wind every face outward: test one against the direction out from the axis.
  if (rings.length > 1) {
    const P = (k: number): V3 => [pos[k * 3]!, pos[k * 3 + 1]!, pos[k * 3 + 2]!];
    const [A, B, C] = [P(idx[0]!), P(idx[1]!), P(idx[2]!)];
    const u: V3 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v: V3 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const nrm: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const ring = rings[0]!, s = sides3[0]!;
    const out: V3 = [A[0] - (ring.c[0] + s[0] * offset), A[1] - ring.c[1], A[2] - (ring.c[2] + s[2] * offset)];
    if (nrm[0] * out[0] + nrm[1] * out[1] + nrm[2] * out[2] < 0) for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]!; idx[k + 1] = idx[k + 2]!; idx[k + 2] = t; }
  }
  return { positions: pos, indices: idx };
}

// A thick-walled tube between radii `rIn` and `rOut` swept through `rings`, cut into one convex
// block per ring pair per side, each as a point cloud for a convex hull. `rIn` must sit far enough
// out that each block's flat inner face (a chord of the circle) clears the bore.
export function tubeWallBlocks(rings: SweepRing[], rIn: number, rOut: number, sides = 20): Float32Array[] {
  const inner = sweepTube(rings, rIn, true, sides).positions, outer = sweepTube(rings, rOut, false, sides).positions;
  const out: Float32Array[] = [];
  for (let i = 0; i + 1 < rings.length; i++) {
    for (let j = 0; j < sides; j++) {
      const pts: number[] = [];
      for (const k of [i * sides + j, i * sides + ((j + 1) % sides), (i + 1) * sides + j, (i + 1) * sides + ((j + 1) % sides)]) {
        pts.push(inner[k * 3]!, inner[k * 3 + 1]!, inner[k * 3 + 2]!, outer[k * 3]!, outer[k * 3 + 1]!, outer[k * 3 + 2]!);
      }
      out.push(new Float32Array(pts));
    }
  }
  return out;
}

// torusMesh stood up round centre c with its axis along unit d (ring radius R, rail radius r): the
// torus's own axis (y) goes to d and its x to the level direction square to d.
export function ringMesh(c: V3, d: V3, R: number, r: number, sides: number, segments: number): { positions: number[]; indices: number[] } {
  const t = torusMesh(R, r, sides, segments), f = Math.hypot(d[0], d[2]);
  const u: V3 = f > 1e-6 ? [d[2] / f, 0, -d[0] / f] : [1, 0, 0];
  const w: V3 = [u[1] * d[2] - u[2] * d[1], u[2] * d[0] - u[0] * d[2], u[0] * d[1] - u[1] * d[0]];
  const pos: number[] = [];
  for (let i = 0; i < t.positions.length; i += 3) {
    const x = t.positions[i]!, y = t.positions[i + 1]!, z = t.positions[i + 2]!;
    pos.push(c[0] + x * u[0] + y * d[0] + z * w[0], c[1] + x * u[1] + y * d[1] + z * w[1], c[2] + x * u[2] + y * d[2] + z * w[2]);
  }
  return { positions: pos, indices: t.indices };
}

// A torus lying flat (axis up) about the origin: ring radius R, tube radius r. Drawn by the scene and
// used as-is for the physics, so the two match vertex for vertex.
export function torusMesh(R: number, r: number, tubeSides = 10, segments = 48): { positions: number[]; indices: number[] } {
  const pos: number[] = [], idx: number[] = [];
  for (let j = 0; j <= tubeSides; j++) for (let i = 0; i <= segments; i++) {
    const u = (i / segments) * Math.PI * 2, v = (j / tubeSides) * Math.PI * 2, c = R + r * Math.cos(v);
    pos.push(c * Math.cos(u), r * Math.sin(v), c * Math.sin(u));
  }
  for (let j = 0; j < tubeSides; j++) for (let i = 0; i < segments; i++) {
    const a = j * (segments + 1) + i, b = a + segments + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return { positions: pos, indices: idx };
}

// Points of a surface of revolution about y: `profile` is [radius, y] pairs, swept round in
// `sides` steps from angle 0, the way three's CylinderGeometry and SphereGeometry place theirs.
// A surface of revolution through `profile` ([radius, y], listed outside in over the top, so faces
// wind outward), `sides` around. `seam` repeats the first column at the end, for texture seams;
// leave it off for physics, so every edge is shared.
export function revolveMesh(profile: [number, number][], sides: number, seam = false): { positions: number[]; indices: number[] } {
  const cols = seam ? sides + 1 : sides, pos: number[] = [], idx: number[] = [];
  for (const [r, y] of profile) for (let i = 0; i < cols; i++) { const a = (i / sides) * Math.PI * 2; pos.push(r * Math.sin(a), y, r * Math.cos(a)); }
  for (let j = 0; j + 1 < profile.length; j++) for (let i = 0; i < sides; i++) {
    const n = seam ? i + 1 : (i + 1) % sides, a = j * cols + i, b = j * cols + n, c = (j + 1) * cols + i, d = (j + 1) * cols + n;
    idx.push(a, b, c, b, d, c);
  }
  return { positions: pos, indices: idx };
}

export function revolvePoints(profile: [number, number][], sides: number): number[] {
  const out: number[] = [];
  for (const [r, y] of profile) for (let i = 0; i < sides; i++) { const a = (i / sides) * Math.PI * 2; out.push(r * Math.sin(a), y, r * Math.cos(a)); }
  return out;
}

// Circles of radius `r` swept through `rings` (see TubeRing in level.ts) as a triangle tube.
// The circle's frame is carried from ring to ring by the smallest rotation between their
// directions, so the surface never twists on itself; `inward` winds the faces toward the axis.
export function sweepTube(rings: SweepRing[], r: number, inward: boolean, sides = 20, first = 0): { positions: number[]; indices: number[] } {
  const pos: number[] = [], idx: number[] = [];
  const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const d0 = rings[0]!.d;
  let n: V3 = Math.abs(d0[1]) < 0.9 ? norm([-d0[0] * d0[1], 1 - d0[1] * d0[1], -d0[2] * d0[1]]) : norm(cross(d0, [1, 0, 0]));
  let prev = d0;
  for (const ring of rings) {
    const d = ring.d;
    // Rodrigues rotation of n by the turn from prev to d.
    const axis = cross(prev, d), s = Math.hypot(...axis), c = dot(prev, d);
    if (s > 1e-9) {
      const k = norm(axis), kn = cross(k, n), kd = dot(k, n);
      n = norm([n[0] * c + kn[0] * s + k[0] * kd * (1 - c), n[1] * c + kn[1] * s + k[1] * kd * (1 - c), n[2] * c + kn[2] * s + k[2] * kd * (1 - c)]);
    }
    n = norm([n[0] - d[0] * dot(n, d), n[1] - d[1] * dot(n, d), n[2] - d[2] * dot(n, d)]);
    const b = cross(d, n);
    const md = dot(ring.m, d);
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2, ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      const off: V3 = [n[0] * ca + b[0] * sa, n[1] * ca + b[1] * sa, n[2] * ca + b[2] * sa];
      const t = -dot(ring.m, off) / md;
      pos.push(ring.c[0] + off[0] + d[0] * t, ring.c[1] + off[1] + d[1] * t, ring.c[2] + off[2] + d[2] * t);
    }
    prev = d;
  }
  for (let i = 0; i + 1 < rings.length; i++) {
    for (let j = 0; j < sides; j++) {
      const a = first + i * sides + j, b = first + i * sides + ((j + 1) % sides), c = a + sides, e = b + sides;
      // Ring points run counter-clockwise about d, so (a, b, c) faces outward.
      if (inward) idx.push(a, c, b, b, c, e); else idx.push(a, b, c, b, e, c);
    }
  }
  return { positions: pos, indices: idx };
}
