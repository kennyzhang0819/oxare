export type XZ = [number, number];
const EPS = 1e-9;

export function polyArea(q: XZ[]): number {
  let a = 0;
  for (let i = 0; i < q.length; i++) { const p = q[i]!, r = q[(i + 1) % q.length]!; a += p[0] * r[1] - r[0] * p[1]; }
  return a / 2;
}

function dedupe(q: XZ[]): XZ[] {
  const out: XZ[] = [];
  for (const v of q) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last[0] - v[0], last[1] - v[1]) > 1e-7) out.push(v);
  }
  if (out.length > 1 && Math.hypot(out[0]![0] - out[out.length - 1]![0], out[0]![1] - out[out.length - 1]![1]) <= 1e-7) out.pop();
  return out;
}

// Part of convex `q` on the side of line a->b where cross(b - a, p - a) * keep >= 0.
function clipHalf(q: XZ[], a: XZ, b: XZ, keep: 1 | -1): XZ[] {
  const side = (p: XZ) => ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * keep;
  const out: XZ[] = [];
  for (let i = 0; i < q.length; i++) {
    const p = q[i]!, r = q[(i + 1) % q.length]!;
    const sp = side(p), sr = side(r);
    if (sp >= -EPS) out.push(p);
    if ((sp > EPS && sr < -EPS) || (sp < -EPS && sr > EPS)) {
      const t = sp / (sp - sr);
      out.push([p[0] + (r[0] - p[0]) * t, p[1] + (r[1] - p[1]) * t]);
    }
  }
  return dedupe(out);
}

// Convex `q` minus convex `hole`, as convex pieces: peel off the outside of each hole
// edge in turn, so what is left at the end is exactly q ∩ hole and gets dropped.
export function cutHole(q: XZ[], hole: XZ[]): XZ[][] {
  const orient: 1 | -1 = polyArea(hole) >= 0 ? 1 : -1;
  const out: XZ[][] = [];
  let cur = q;
  for (let i = 0; i < hole.length && cur.length >= 3; i++) {
    const a = hole[i]!, b = hole[(i + 1) % hole.length]!;
    const outside = clipHalf(cur, a, b, orient === 1 ? -1 : 1);
    if (outside.length >= 3 && Math.abs(polyArea(outside)) > 1e-6) out.push(outside);
    cur = clipHalf(cur, a, b, orient);
  }
  return out;
}
