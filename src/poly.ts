import polygonClipping from "polygon-clipping";

export type XZ = [number, number];

export function polyArea(q: XZ[]): number {
  let a = 0;
  for (let i = 0; i < q.length; i++) { const p = q[i]!, r = q[(i + 1) % q.length]!; a += p[0] * r[1] - r[0] * p[1]; }
  return a / 2;
}

function tidy(q: XZ[]): XZ[] {
  let pts = q.map(([x, z]): XZ => [Math.round(x * 1e6) / 1e6, Math.round(z * 1e6) / 1e6]);
  for (let changed = true; changed && pts.length >= 3;) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length]!, b = pts[i]!, c = pts[(i + 1) % pts.length]!;
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6 || Math.abs(cross) < 1e-9) { pts.splice(i, 1); changed = true; break; }
    }
  }
  return pts;
}

// Outer loops come out clockwise, holes anticlockwise (solid on the right). platform.ts and floor.ts rely on it.
export function cutRegion(outline: XZ[], cuts: XZ[][]): XZ[][][] {
  const ring = (q: XZ[]) => [...q, q[0]!];
  const parts = cuts.length ? polygonClipping.difference([ring(outline)], ...cuts.map((c) => [ring(c)])) : [[ring(outline)]];
  const out: XZ[][][] = [];
  for (const poly of parts) {
    const loops = poly.map((r, k) => {
      const q = tidy(r as XZ[]);
      return (polyArea(q) < 0) === (k === 0) ? q : q.reverse();
    });
    if (loops[0]!.length >= 3 && -polyArea(loops[0]!) >= 1) out.push(loops.filter((q) => q.length >= 3));
  }
  return out;
}

function distToSegment(v: XZ, a: XZ, b: XZ): number {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
  const t = L2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((v[0] - a[0]) * dx + (v[1] - a[1]) * dz) / L2));
  return Math.hypot(a[0] + dx * t - v[0], a[1] + dz * t - v[1]);
}

export function edgeGaps(loops: XZ[][]): number[][] {
  const edges = loops.flatMap((q) => q.map((a, i) => {
    const b = q[(i + 1) % q.length]!, len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { a, b, nx: (b[1] - a[1]) / len, nz: -(b[0] - a[0]) / len };
  }));
  const gap = edges.map((e) => {
    let w = Infinity;
    for (const f of edges) {
      if (f.a === e.b || f.b === e.a || e.nx * f.nx + e.nz * f.nz > -0.5) continue;
      const ahead = Math.max((f.a[0] - e.a[0]) * e.nx + (f.a[1] - e.a[1]) * e.nz, (f.b[0] - e.a[0]) * e.nx + (f.b[1] - e.a[1]) * e.nz);
      if (ahead <= 1e-6) continue;
      w = Math.min(w, distToSegment(e.a, f.a, f.b), distToSegment(e.b, f.a, f.b), distToSegment(f.a, e.a, e.b), distToSegment(f.b, e.a, e.b));
    }
    return w;
  });
  let k = 0;
  return loops.map((q) => q.map(() => gap[k++]!));
}
