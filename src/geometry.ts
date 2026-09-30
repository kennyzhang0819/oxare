export interface TriMesh { positions: Float32Array; indices: Uint32Array }

// Quarter (or other) annulus sweeping from +x toward -z about the origin.
export function sectorMesh(inner: number, outer: number, y0: number, y1: number, angle = Math.PI / 2, segments = 12): TriMesh {
  const pts: number[] = [];
  const idx: number[] = [];
  const ring = (r: number, y: number) => {
    const base = pts.length / 3;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * angle;
      pts.push(r * Math.cos(a), y, -r * Math.sin(a));
    }
    return base;
  };
  const iT = ring(inner, y1), oT = ring(outer, y1), iB = ring(inner, y0), oB = ring(outer, y0);
  const quad = (a: number, b: number, c: number, d: number, hx: number, hy: number, hz: number) => {
    const P = (i: number, k: number) => pts[i * 3 + k] ?? 0;
    const ux = P(b, 0) - P(a, 0), uy = P(b, 1) - P(a, 1), uz = P(b, 2) - P(a, 2);
    const vx = P(c, 0) - P(a, 0), vy = P(c, 1) - P(a, 1), vz = P(c, 2) - P(a, 2);
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * hx + ny * hy + nz * hz >= 0) idx.push(a, b, c, a, c, d);
    else idx.push(a, c, b, a, d, c);
  };
  for (let i = 0; i < segments; i++) {
    const a = ((i + 0.5) / segments) * angle;
    const rx = Math.cos(a), rz = -Math.sin(a);
    quad(iT + i, oT + i, oT + i + 1, iT + i + 1, 0, 1, 0);
    quad(iB + i, oB + i, oB + i + 1, iB + i + 1, 0, -1, 0);
    quad(oT + i, oT + i + 1, oB + i + 1, oB + i, rx, 0, rz);
    quad(iT + i, iT + i + 1, iB + i + 1, iB + i, -rx, 0, -rz);
  }
  quad(iT, oT, oB, iB, 0, 0, 1);
  const s = segments;
  quad(iT + s, oT + s, oB + s, iB + s, -Math.sin(angle), 0, -Math.cos(angle));
  return { positions: new Float32Array(pts), indices: new Uint32Array(idx) };
}
