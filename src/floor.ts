import { PLATFORM_EDGE_DROP, PLATFORM_EDGE_INSET, PLATFORM_SEAM_DROP, PLATFORM_THICKNESS, holesOn, isTilted, pieceRot, rampHeight, rotXZ, type Level } from "./level.ts";
import { cutHole } from "./poly.ts";

type XZ = [number, number];
const SNAP = 1000;
const EPS = 1e-3;
const snap = (v: number) => Math.round(v * SNAP) / SNAP;
const BX = PLATFORM_EDGE_INSET, BY = PLATFORM_EDGE_DROP;
const BEVEL_STEPS = 4;

// Every platform top as convex polygons in world space, each vertex with its own height,
// plus the piece's outline so edges on it can be rounded. The whole floor becomes one
// welded trimesh so Rapier can treat piece seams as internal edges (see sim.ts).
interface Poly { pts: XZ[]; ys: number[]; outline: XZ[] }
function topPolys(level: Level): Poly[] {
  const out: Poly[] = [];
  for (const p of level.pieces) {
    if (isTilted(p)) continue;
    const rot = pieceRot(p);
    const W = (x: number, z: number): XZ => { const o = rotXZ(x, z, rot); return [snap(p.x + o.x), snap(p.z + o.z)]; };
    if (p.type === "slab" || p.type === "ramp") {
      const hx = p.w / 2, hz = p.d / 2;
      const outline = [W(-hx, -hz), W(hx, -hz), W(hx, hz), W(-hx, hz)];
      if (p.type === "slab") {
        let polys: XZ[][] = [outline];
        for (const h of holesOn(level, p)) polys = polys.flatMap((q) => cutHole(q, h));
        for (const q of polys) {
          const pts: XZ[] = [];
          for (const v of q) { const s: XZ = [snap(v[0]), snap(v[1])]; const l = pts[pts.length - 1]; if (!l || l[0] !== s[0] || l[1] !== s[1]) pts.push(s); }
          if (pts.length >= 3) out.push({ pts, ys: pts.map(() => p.y), outline });
        }
      } else {
        const n = Math.max(1, Math.ceil(p.d));
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + 1) / n;
          const z0 = p.d / 2 - t0 * p.d, z1 = p.d / 2 - t1 * p.d;
          const y0 = snap(p.y + rampHeight(p, t0)), y1 = snap(p.y + rampHeight(p, t1));
          out.push({ pts: [W(-hx, z0), W(hx, z0), W(hx, z1), W(-hx, z1)], ys: [y0, y0, y1, y1], outline });
        }
      }
    } else if (p.type === "curve") {
      const n = 12;
      const inner: XZ[] = [], outer: XZ[] = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * (Math.PI / 2);
        inner.push(W(p.inner * Math.cos(a), -p.inner * Math.sin(a)));
        outer.push(W(p.outer * Math.cos(a), -p.outer * Math.sin(a)));
      }
      const outline = [...outer, ...inner.slice().reverse()];
      for (let i = 0; i < n; i++) {
        out.push({ pts: [inner[i]!, outer[i]!, outer[i + 1]!, inner[i + 1]!], ys: [p.y, p.y, p.y, p.y], outline });
      }
    }
  }
  return out;
}

function onSegment(v: XZ, a: XZ, b: XZ): number | null {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
  if (L2 < EPS) return null;
  const t = ((v[0] - a[0]) * dx + (v[1] - a[1]) * dz) / L2;
  if (t <= EPS || t >= 1 - EPS) return null;
  const px = a[0] + dx * t, pz = a[1] + dz * t;
  return Math.hypot(px - v[0], pz - v[1]) < EPS ? t : null;
}

function distToSegment(v: XZ, a: XZ, b: XZ): number {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
  const t = L2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((v[0] - a[0]) * dx + (v[1] - a[1]) * dz) / L2));
  return Math.hypot(a[0] + dx * t - v[0], a[1] + dz * t - v[1]);
}
const onOutline = (outline: XZ[], v: XZ) => outline.some((a, i) => distToSegment(v, a, outline[(i + 1) % outline.length]!) < 2 * EPS);

// Depth below the flat top, `s` in from the edge line (0 at the edge). An open edge's lip is a
// quarter ellipse that rounds away; a seam's is a shallow cosine dip, level at the seam line and
// at the inset, so the ball rolls through it instead of striking a steep face.
const drop = (s: number, depth: number) => depth === BY
  ? BY - BY * Math.sqrt(Math.max(0, 1 - ((BX - s) / BX) * ((BX - s) / BX)))
  : (depth * (1 + Math.cos((Math.PI * s) / BX))) / 2;

export interface Mesh { positions: Float32Array; indices: Uint32Array }
// `top` is the rolling surface; `body` is the solid underneath it: side walls from just
// below the lip down to the underside, and the underside itself.
export interface Floor extends Mesh { body: Mesh }

type V = { v: XZ; y: number };

// Open edges on a piece's outline get the same rounded lip the visuals have, so they round
// away; where two pieces meet the lip is only a faint dip, so the ball keeps its speed.
export function floorMesh(level: Level): Floor {
  const polys = topPolys(level);
  const byY = new Map<number, XZ[]>();
  for (const q of polys) q.pts.forEach((v, i) => { const y = q.ys[i]!; if (!byY.has(y)) byY.set(y, []); byY.get(y)!.push(v); });

  // Split every edge at neighbours' vertices and wind each polygon so its normal points up.
  const split: { poly: V[]; outline: XZ[] }[] = [];
  for (const q of polys) {
    const poly: V[] = [];
    for (let e = 0; e < q.pts.length; e++) {
      const a = q.pts[e]!, b = q.pts[(e + 1) % q.pts.length]!, ya = q.ys[e]!, yb = q.ys[(e + 1) % q.pts.length]!;
      poly.push({ v: a, y: ya });
      // Only level edges can host a T-junction with a neighbour at the same height.
      if (ya !== yb) continue;
      const splits: { t: number; v: XZ }[] = [];
      for (const v of byY.get(ya)!) { const t = onSegment(v, a, b); if (t !== null) splits.push({ t, v }); }
      splits.sort((p, r) => p.t - r.t);
      for (const s of splits) if (!poly.some((w) => w.v[0] === s.v[0] && w.v[1] === s.v[1])) poly.push({ v: s.v, y: ya });
    }
    let area = 0;
    for (let i = 0; i < poly.length; i++) { const a = poly[i]!.v, b = poly[(i + 1) % poly.length]!.v; area += a[1] * b[0] - b[1] * a[0]; }
    if (area < 0) poly.reverse();
    split.push({ poly, outline: q.outline });
  }
  // Edges used by only one polygon are exposed sides: a piece's open edge or a hole's wall.
  const edgeKey = (a: V, b: V) => { const ka = `${a.v[0]},${a.y},${a.v[1]}`, kb = `${b.v[0]},${b.y},${b.v[1]}`; return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`; };
  const uses = new Map<string, number>();
  const countUses = () => {
    uses.clear();
    for (const { poly } of split) for (let i = 0; i < poly.length; i++) {
      const k = edgeKey(poly[i]!, poly[(i + 1) % poly.length]!);
      uses.set(k, (uses.get(k) ?? 0) + 1);
    }
  };
  countUses();
  // A seam edge that meets an open rim edge at a corner gets an extra vertex one lip width in
  // from that corner, so the seam is shallow along its length and only deepens into the corner.
  // The piece on the other side of the seam inserts the same point, so the weld holds.
  const isRim = (outline: XZ[], a: V, b: V) => onOutline(outline, [(a.v[0] + b.v[0]) / 2, (a.v[1] + b.v[1]) / 2]);
  for (const q of split) {
    const { poly, outline } = q, n = poly.length;
    const kind = poly.map((a, i) => {
      const b = poly[(i + 1) % n]!;
      return !isRim(outline, a, b) ? "inner" : (uses.get(edgeKey(a, b)) ?? 0) > 1 ? "seam" : "open";
    });
    const out: V[] = [];
    for (let i = 0; i < n; i++) {
      const a = poly[i]!, b = poly[(i + 1) % n]!;
      out.push(a);
      if (kind[i] !== "seam") continue;
      const len = Math.hypot(b.v[0] - a.v[0], b.v[1] - a.v[1]);
      if (len <= 2 * BX + EPS) continue;
      const at = (t: number): V => ({ v: [snap(a.v[0] + (b.v[0] - a.v[0]) * t), snap(a.v[1] + (b.v[1] - a.v[1]) * t)], y: snap(a.y + (b.y - a.y) * t) });
      if (kind[(i + n - 1) % n] === "open") out.push(at(BX / len));
      if (kind[(i + 1) % n] === "open") out.push(at(1 - BX / len));
    }
    q.poly = out;
  }
  countUses();

  const mesh = () => {
    const pos: number[] = [], idx: number[] = [];
    const keys = new Map<string, number>();
    const vertex = (x: number, y: number, z: number) => {
      const k = `${x},${y},${z}`;
      let i = keys.get(k);
      if (i === undefined) { i = pos.length / 3; keys.set(k, i); pos.push(x, y, z); }
      return i;
    };
    return { pos, idx, vertex, tri: (a: number, b: number, c: number) => idx.push(a, b, c) };
  };
  const top = mesh(), under = mesh();

  for (const { poly, outline } of split) {
    const n = poly.length;
    const cx = poly.reduce((a, w) => a + w.v[0], 0) / n, cz = poly.reduce((a, w) => a + w.v[1], 0) / n;

    // Each edge's line, pushed BX inward when the edge lies on the piece outline.
    const lines = poly.map((w, i) => {
      const u = poly[(i + 1) % n]!;
      const dx = u.v[0] - w.v[0], dz = u.v[1] - w.v[1], len = Math.hypot(dx, dz) || 1;
      let nx = -dz / len, nz = dx / len;
      const mx = (w.v[0] + u.v[0]) / 2, mz = (w.v[1] + u.v[1]) / 2;
      if (nx * (cx - mx) + nz * (cz - mz) < 0) { nx = -nx; nz = -nz; }
      const rim = onOutline(outline, [mx, mz]);
      // A rim edge another polygon also uses is a seam between two pieces: it gets the shallow lip.
      const seam = rim && (uses.get(edgeKey(w, u)) ?? 0) > 1;
      const off = rim ? BX : 0;
      return { rim, seam, px: w.v[0] + nx * off, pz: w.v[1] + nz * off, dx: dx / len, dz: dz / len, nx, nz };
    });
    // The inset corner at each vertex, with its height read off the two edges that meet there.
    const inner: V[] = poly.map((w, i) => {
      const la = lines[(i + n - 1) % n]!, lb = lines[i]!;
      if (!la.rim && !lb.rim) return w;
      const det = la.dx * lb.dz - la.dz * lb.dx;
      let x: number, z: number;
      if (Math.abs(det) < 1e-9) { const l = la.rim ? la : lb; x = w.v[0] + l.nx * BX; z = w.v[1] + l.nz * BX; }
      else {
        const t = ((lb.px - la.px) * lb.dz - (lb.pz - la.pz) * lb.dx) / det;
        x = la.px + la.dx * t; z = la.pz + la.dz * t;
      }
      const prev = poly[(i + n - 1) % n]!, next = poly[(i + 1) % n]!;
      const along = (o: V) => {
        const ex = o.v[0] - w.v[0], ez = o.v[1] - w.v[1], L2 = ex * ex + ez * ez;
        return L2 < 1e-12 ? 0 : (((x - w.v[0]) * ex + (z - w.v[1]) * ez) / L2) * (o.y - w.y);
      };
      return { v: [snap(x), snap(z)], y: w.y + along(prev) + along(next) };
    });

    // Flat interior: fan from the centroid of the inset polygon.
    const ids = inner.map((w) => top.vertex(w.v[0], w.y, w.v[1]));
    const icx = inner.reduce((a, w) => a + w.v[0], 0) / n, icz = inner.reduce((a, w) => a + w.v[1], 0) / n;
    const icy = inner.reduce((a, w) => a + w.y, 0) / n;
    const c = top.pos.length / 3;
    top.pos.push(icx, icy, icz);
    for (let i = 0; i < n; i++) top.tri(c, ids[i]!, ids[(i + 1) % n]!);

    // Rounded rim strips between each outline edge and its inset edge. A seam strip is shallow,
    // except at a corner it shares with an open rim edge: there both strips use the full depth so
    // the corner diagonal they share is one line and the mesh stays welded.
    const depthAt = (i: number) => {
      const la = lines[(i + n - 1) % n]!, lb = lines[i]!;
      return (la.rim && !la.seam) || (lb.rim && !lb.seam) ? BY : PLATFORM_SEAM_DROP;
    };
    for (let i = 0; i < n; i++) {
      if (!lines[i]!.rim) continue;
      const o0 = poly[i]!, o1 = poly[(i + 1) % n]!, i0 = inner[i]!, i1 = inner[(i + 1) % n]!;
      const deep = !lines[i]!.seam;
      const d0 = deep ? BY : depthAt(i), d1 = deep ? BY : depthAt((i + 1) % n);
      const row = (j: number): [number, number] => {
        const t = j / BEVEL_STEPS;
        const at = (o: V, w: V, depth: number) => j === 0 ? top.vertex(o.v[0], o.y - depth, o.v[1])
          : j === BEVEL_STEPS ? top.vertex(w.v[0], w.y, w.v[1])
          : top.vertex(o.v[0] + (w.v[0] - o.v[0]) * t, o.y + (w.y - o.y) * t - drop(BX * t, depth), o.v[1] + (w.v[1] - o.v[1]) * t);
        return [at(o0, i0, d0), at(o1, i1, d1)];
      };
      let [a, b] = row(0);
      for (let j = 1; j <= BEVEL_STEPS; j++) {
        const [a2, b2] = row(j);
        top.tri(a, b, b2);
        top.tri(a, b2, a2);
        a = a2; b = b2;
      }
    }

    // Solid body: a wall under every exposed edge, from just under the lip to the underside, and the underside.
    const WALL_TOP = BY + 0.02;
    for (let i = 0; i < n; i++) {
      const a = poly[i]!, b = poly[(i + 1) % n]!;
      if ((uses.get(edgeKey(a, b)) ?? 0) !== 1) continue;
      const at = under.vertex(a.v[0], a.y - WALL_TOP, a.v[1]), bt = under.vertex(b.v[0], b.y - WALL_TOP, b.v[1]);
      const ab = under.vertex(a.v[0], a.y - PLATFORM_THICKNESS, a.v[1]), bb = under.vertex(b.v[0], b.y - PLATFORM_THICKNESS, b.v[1]);
      under.tri(at, ab, bb);
      under.tri(at, bb, bt);
    }
    const bids = poly.map((w) => under.vertex(w.v[0], w.y - PLATFORM_THICKNESS, w.v[1]));
    const bc = under.pos.length / 3;
    under.pos.push(cx, poly.reduce((a, w) => a + w.y, 0) / n - PLATFORM_THICKNESS, cz);
    for (let i = 0; i < n; i++) under.tri(bc, bids[(i + 1) % n]!, bids[i]!);
  }
  return {
    positions: new Float32Array(top.pos), indices: new Uint32Array(top.idx),
    body: { positions: new Float32Array(under.pos), indices: new Uint32Array(under.idx) },
  };
}
