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
