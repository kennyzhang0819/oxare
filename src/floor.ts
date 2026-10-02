import { PLATFORM_EDGE_DROP, PLATFORM_EDGE_INSET, PLATFORM_SEAM_DROP, PLATFORM_THICKNESS, curveStations, curveStrip, holesOn, isMoving, isTilted, pieceRot, twistPoint, rampHeight, rotXZ, type Level } from "./level.ts";
import earcut from "earcut";
import { cutRegion, edgeGaps, polyArea } from "./poly.ts";

type XZ = [number, number];
const SNAP = 1000;
const EPS = 1e-3;
const snap = (v: number) => Math.round(v * SNAP) / SNAP;
const BX = PLATFORM_EDGE_INSET, BY = PLATFORM_EDGE_DROP;
const BEVEL_STEPS = 4;

type V = { v: XZ; y: number };
// `warped`: its corners are not in one plane (a twisted slab's strip), so its solid is built per triangle.
interface Poly { loops: V[][]; rim: (m: XZ) => boolean; narrow: boolean; warped?: boolean }
const snapXZ = (q: XZ[]) => q.map(([x, z]): XZ => [snap(x), snap(z)]).filter((v, i, a) => { const l = a[(i + a.length - 1) % a.length]!; return a.length < 2 || v[0] !== l[0] || v[1] !== l[1]; });
const oriented = (q: V[]) => polyArea(q.map((w) => w.v)) < 0 ? q : q.slice().reverse();
// See docs/platforms.md. Must stay free of three: check.ts runs it in Node.
function topPolys(level: Level): Poly[] {
  const out: Poly[] = [];
  for (const p of level.pieces) {
    if (isTilted(p) || isMoving(p)) continue;
    const rot = pieceRot(p);
    const W = (x: number, z: number): XZ => { const o = rotXZ(x, z, rot); return [snap(p.x + o.x), snap(p.z + o.z)]; };
    if (p.type === "slab" || p.type === "ramp") {
      const hx = p.w / 2, hz = p.d / 2;
      const outline = [W(-hx, -hz), W(hx, -hz), W(hx, hz), W(-hx, hz)];
      if (p.type === "slab" && p.twist) {
        // A grid of small quads over the rolled top, half a unit along it and one across, so each
        // is nearly flat; the long sides carry the lip as on any slab.
        const n = Math.max(1, Math.ceil(p.d * 2)), k = Math.max(1, Math.ceil(p.w));
        const zs = Array.from({ length: n + 1 }, (_, i) => p.d / 2 - (i / n) * p.d), xs = Array.from({ length: k + 1 }, (_, j) => -hx + (j / k) * p.w);
        const at = (x: number, z: number): V => { const t = twistPoint(p, [x, 0, z]); return { v: W(t[0], t[2]), y: snap(p.y + t[1]) }; };
        const grid = zs.map((z) => xs.map((x) => at(x, z)));
        const rim = [...grid.map((r) => r[k]!.v), ...grid.slice().reverse().map((r) => r[0]!.v)];
        for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) {
          out.push({ loops: [oriented([grid[i]![j]!, grid[i]![j + 1]!, grid[i + 1]![j + 1]!, grid[i + 1]![j]!])], rim: (m) => onOutline(rim, m), narrow: false, warped: true });
        }
      } else if (p.type === "slab") {
        for (const region of cutRegion(outline, holesOn(level, p))) {
          const snapped = region.map(snapXZ);
          if (snapped[0]!.length < 3) continue;
          const loops = snapped.filter((q) => q.length >= 3);
          out.push({ loops: loops.map((q) => q.map((v) => ({ v, y: p.y }))), rim: () => true, narrow: true });
        }
      } else {
        const n = Math.max(1, Math.ceil(p.d));
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + 1) / n;
          const z0 = p.d / 2 - t0 * p.d, z1 = p.d / 2 - t1 * p.d;
          const y0 = snap(p.y + rampHeight(p, t0)), y1 = snap(p.y + rampHeight(p, t1));
          const q: V[] = [{ v: W(-hx, z0), y: y0 }, { v: W(hx, z0), y: y0 }, { v: W(hx, z1), y: y1 }, { v: W(-hx, z1), y: y1 }];
          out.push({ loops: [oriented(q)], rim: (m) => onOutline(outline, m), narrow: false });
        }
      }
    } else if (p.type === "curve") {
      const c = curveStrip(p), us = curveStations(p, 12);
      const inner = us.map((u) => W(...c.at(u, p.inner))), outer = us.map((u) => W(...c.at(u, p.outer)));
      const outline = [...outer, ...inner.slice().reverse()];
      for (let i = 0; i < us.length - 1; i++) {
        const q = [inner[i]!, outer[i]!, outer[i + 1]!, inner[i + 1]!].map((v) => ({ v, y: p.y }));
        out.push({ loops: [oriented(q)], rim: (m) => onOutline(outline, m), narrow: false });
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

const drop = (s: number, depth: number, w: number) => depth === BY
  ? BY - BY * Math.sqrt(Math.max(0, 1 - ((w - s) / w) * ((w - s) / w)))
  : (depth * (1 + Math.cos((Math.PI * s) / w))) / 2;

export interface Mesh { positions: Float32Array; indices: Uint32Array }
// `solids` are point clouds for convex hulls filling each platform from its underside to just
// under its rolling surface. The meshes are zero-thickness shells that only push from their front
// face, so a ball that reaches the corner where a side wall meets the lip could pass straight in;
// a solid pushes any overlap back out. They sit SOLID_GAP below the surface, under the lip's
// chord, so the ball rolling on top never touches them.
export interface Floor extends Mesh { body: Mesh; solids: Float32Array[] }
const SOLID_GAP = 0.03;

export function floorMesh(level: Level): Floor {
  const polys = topPolys(level);
  const byY = new Map<number, XZ[]>();
  for (const q of polys) for (const loop of q.loops) for (const w of loop) { if (!byY.has(w.y)) byY.set(w.y, []); byY.get(w.y)!.push(w.v); }

  for (const q of polys) q.loops = q.loops.map((loop) => {
    const out: V[] = [];
    for (let e = 0; e < loop.length; e++) {
      const a = loop[e]!, b = loop[(e + 1) % loop.length]!;
      out.push(a);
      if (a.y !== b.y) continue;
      const splits: { t: number; v: XZ }[] = [];
      for (const v of byY.get(a.y)!) { const t = onSegment(v, a.v, b.v); if (t !== null) splits.push({ t, v }); }
      splits.sort((p, r) => p.t - r.t);
      for (const s of splits) if (!out.some((w) => w.v[0] === s.v[0] && w.v[1] === s.v[1])) out.push({ v: s.v, y: a.y });
    }
    return out;
  });
  const edgeKey = (a: V, b: V) => { const ka = `${a.v[0]},${a.y},${a.v[1]}`, kb = `${b.v[0]},${b.y},${b.v[1]}`; return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`; };
  const uses = new Map<string, number>();
  const countUses = () => {
    uses.clear();
    for (const q of polys) for (const loop of q.loops) for (let i = 0; i < loop.length; i++) {
      const k = edgeKey(loop[i]!, loop[(i + 1) % loop.length]!);
      uses.set(k, (uses.get(k) ?? 0) + 1);
    }
  };
  countUses();
  const mid = (a: V, b: V): XZ => [(a.v[0] + b.v[0]) / 2, (a.v[1] + b.v[1]) / 2];
  for (const q of polys) q.loops = q.loops.map((loop) => {
    const n = loop.length;
    const kind = loop.map((a, i) => {
      const b = loop[(i + 1) % n]!;
      return !q.rim(mid(a, b)) ? "inner" : (uses.get(edgeKey(a, b)) ?? 0) > 1 ? "seam" : "open";
    });
    const out: V[] = [];
    for (let i = 0; i < n; i++) {
      const a = loop[i]!, b = loop[(i + 1) % n]!;
      out.push(a);
      if (kind[i] !== "seam") continue;
      const len = Math.hypot(b.v[0] - a.v[0], b.v[1] - a.v[1]);
      if (len <= 2 * BX + EPS) continue;
      const at = (t: number): V => ({ v: [snap(a.v[0] + (b.v[0] - a.v[0]) * t), snap(a.v[1] + (b.v[1] - a.v[1]) * t)], y: snap(a.y + (b.y - a.y) * t) });
      // The piece across the seam adds the same point; if they differ the weld breaks.
      if (kind[(i + n - 1) % n] === "open") out.push(at(BX / len));
      if (kind[(i + 1) % n] === "open") out.push(at(1 - BX / len));
    }
    return out;
  });
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
  const solids: Float32Array[] = [];
  const cloud = (pts: { v: XZ; y: number }[]) => new Float32Array(pts.flatMap((w) => [w.v[0], w.y, w.v[1]]));
  const convex = (q: V[]) => q.every((a, i) => {
    const b = q[(i + 1) % q.length]!, c = q[(i + 2) % q.length]!;
    return (b.v[0] - a.v[0]) * (c.v[1] - b.v[1]) - (b.v[1] - a.v[1]) * (c.v[0] - b.v[0]) <= 1e-9;
  }) || q.every((a, i) => {
    const b = q[(i + 1) % q.length]!, c = q[(i + 2) % q.length]!;
    return (b.v[0] - a.v[0]) * (c.v[1] - b.v[1]) - (b.v[1] - a.v[1]) * (c.v[0] - b.v[0]) >= -1e-9;
  });
  const fill = (m: ReturnType<typeof mesh>, loops: V[][], ids: number[][], up: boolean) => {
    const flat: number[] = [], holes: number[] = [], all = ids.flat();
    loops.forEach((loop, k) => { if (k > 0) holes.push(flat.length / 2); for (const w of loop) flat.push(w.v[0], w.v[1]); });
    const t = earcut(flat, holes);
    for (let i = 0; i < t.length; i += 3) {
      const a = t[i]!, b = t[i + 1]!, c = t[i + 2]!;
      const s = (flat[b * 2]! - flat[a * 2]!) * (flat[c * 2 + 1]! - flat[a * 2 + 1]!) - (flat[b * 2 + 1]! - flat[a * 2 + 1]!) * (flat[c * 2]! - flat[a * 2]!);
      if ((s < 0) === up) m.tri(all[a]!, all[b]!, all[c]!); else m.tri(all[a]!, all[c]!, all[b]!);
    }
  };

  for (const q of polys) {
    const insets: V[][] = [];
    const gaps = q.narrow ? edgeGaps(q.loops.map((l) => l.map((w) => w.v))) : null;
    q.loops.forEach((loop, k) => {
      const n = loop.length;
      const lines = loop.map((w, i) => {
        const u = loop[(i + 1) % n]!;
        const dx = u.v[0] - w.v[0], dz = u.v[1] - w.v[1], len = Math.hypot(dx, dz) || 1;
        const nx = dz / len, nz = -dx / len;
        const rim = q.rim(mid(w, u));
        const seam = rim && (uses.get(edgeKey(w, u)) ?? 0) > 1;
        const off = !rim ? 0 : BX * Math.max(0.05, Math.min(1, ((gaps?.[k]![i] ?? Infinity) - 0.02) / (2 * BX)));
        return { rim, seam, off, px: w.v[0] + nx * off, pz: w.v[1] + nz * off, dx: dx / len, dz: dz / len, nx, nz };
      });
      const inner: V[] = loop.map((w, i) => {
        const la = lines[(i + n - 1) % n]!, lb = lines[i]!;
        if (!la.rim && !lb.rim) return w;
        const det = la.dx * lb.dz - la.dz * lb.dx;
        let x: number, z: number;
        if (Math.abs(det) < 1e-9) { const l = la.rim ? la : lb; x = w.v[0] + l.nx * l.off; z = w.v[1] + l.nz * l.off; }
        else {
          const t = ((lb.px - la.px) * lb.dz - (lb.pz - la.pz) * lb.dx) / det;
          x = la.px + la.dx * t; z = la.pz + la.dz * t;
        }
        const prev = loop[(i + n - 1) % n]!, next = loop[(i + 1) % n]!;
        const along = (o: V) => {
          const ex = o.v[0] - w.v[0], ez = o.v[1] - w.v[1], L2 = ex * ex + ez * ez;
          return L2 < 1e-12 ? 0 : (((x - w.v[0]) * ex + (z - w.v[1]) * ez) / L2) * (o.y - w.y);
        };
        return { v: [snap(x), snap(z)], y: w.y + along(prev) + along(next) };
      });
      insets.push(inner);

      // At a corner shared with an open edge both strips must use full depth, or the mesh stops welding.
      const depthAt = (i: number) => {
        const la = lines[(i + n - 1) % n]!, lb = lines[i]!;
        return (la.rim && !la.seam) || (lb.rim && !lb.seam) ? BY : PLATFORM_SEAM_DROP;
      };
      for (let i = 0; i < n; i++) {
        if (!lines[i]!.rim) continue;
        const o0 = loop[i]!, o1 = loop[(i + 1) % n]!, i0 = inner[i]!, i1 = inner[(i + 1) % n]!;
        const deep = !lines[i]!.seam, bx = lines[i]!.off;
        const d0 = deep ? BY : depthAt(i), d1 = deep ? BY : depthAt((i + 1) % n);
        const row = (j: number): [number, number] => {
          const t = j / BEVEL_STEPS;
          const at = (o: V, w: V, depth: number) => j === 0 ? top.vertex(o.v[0], o.y - depth, o.v[1])
            : j === BEVEL_STEPS ? top.vertex(w.v[0], w.y, w.v[1])
            : top.vertex(o.v[0] + (w.v[0] - o.v[0]) * t, o.y + (w.y - o.y) * t - drop(bx * t, depth, bx), o.v[1] + (w.v[1] - o.v[1]) * t);
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

      const WALL_TOP = BY + 0.02;
      for (let i = 0; i < n; i++) {
        const a = loop[i]!, b = loop[(i + 1) % n]!;
        if ((uses.get(edgeKey(a, b)) ?? 0) !== 1) continue;
        const at = under.vertex(a.v[0], a.y - WALL_TOP, a.v[1]), bt = under.vertex(b.v[0], b.y - WALL_TOP, b.v[1]);
        const ab = under.vertex(a.v[0], a.y - PLATFORM_THICKNESS, a.v[1]), bb = under.vertex(b.v[0], b.y - PLATFORM_THICKNESS, b.v[1]);
        under.tri(at, ab, bb);
        under.tri(at, bb, bt);
      }
    });
    fill(top, insets, insets.map((l) => l.map((w) => top.vertex(w.v[0], w.y, w.v[1]))), true);
    const lip = (w: V) => ({ v: w.v, y: w.y - BY - SOLID_GAP }), base = (w: V) => ({ v: w.v, y: w.y - PLATFORM_THICKNESS });
    if (q.loops.length === 1 && convex(q.loops[0]!) && !q.warped) {
      // One hull: the full outline from the underside to just under the lip, chamfered in to the
      // inset ring just under the surface.
      const loop = q.loops[0]!;
      solids.push(cloud([...loop.map(base), ...loop.map(lip), ...insets[0]!.map((w) => ({ v: w.v, y: w.y - SOLID_GAP }))]));
    } else {
      // A slab cut by holes, or a warped strip: prisms over its triangles up to just under the lip.
      const flat: number[] = [], holes: number[] = [], all = q.loops.flat();
      q.loops.forEach((loop, k) => { if (k > 0) holes.push(flat.length / 2); for (const w of loop) flat.push(w.v[0], w.v[1]); });
      const t = earcut(flat, holes);
      for (let i = 0; i < t.length; i += 3) {
        const tri = [all[t[i]!]!, all[t[i + 1]!]!, all[t[i + 2]!]!];
        solids.push(cloud([...tri.map(base), ...tri.map(lip)]));
      }
    }
    fill(under, q.loops, q.loops.map((l) => l.map((w) => under.vertex(w.v[0], w.y - PLATFORM_THICKNESS, w.v[1]))), false);
  }
  return {
    positions: new Float32Array(top.pos), indices: new Uint32Array(top.idx),
    body: { positions: new Float32Array(under.pos), indices: new Uint32Array(under.idx) },
    solids,
  };
}
