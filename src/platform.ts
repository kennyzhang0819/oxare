import * as THREE from "three";

// A slab with every top edge rounded, optionally bent into a 90-degree arc about
// the origin (local x runs along the arc, local z across it, arc radius rmid + z).
export function platformGeometry(L: number, W: number, thick: number, bevel: number, tile: number, bend?: { rmid: number }): THREE.BufferGeometry {
  const b = Math.max(0.01, Math.min(bevel, W / 2 - 0.01, L / 2 - 0.01, thick - 0.01));
  const A = L / 2, B = W / 2;
  const ns = Math.max(1, Math.ceil(L / (bend ? 1 : 2)));
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

  // Bevel rings from the wall top up to the flat top, then the flat interior.
  let prev = -1;
  for (let k = 0; k <= KB; k++) {
    const t = (k / KB) * (Math.PI / 2);
    const o = b * (1 - Math.cos(t));
    const ring = addRing(ringPts(A - o, B - o, b - o), y1 - b + b * Math.sin(t), 0);
    if (prev >= 0) strip(prev, ring, outward(b));
    prev = ring;
  }
  const gridBase = pos.length / 3;
  for (let j = 0; j <= nt; j++) for (let i = 0; i <= ns; i++) {
    pos.push(-(A - b) + ((2 * (A - b)) * i) / ns, y1, -(B - b) + ((2 * (B - b)) * j) / nt);
    uvKind.push(0); perim.push(0);
  }
  for (let j = 0; j < nt; j++) for (let i = 0; i < ns; i++) {
    const a = gridBase + j * (ns + 1) + i;
    quad(a, a + 1, a + ns + 2, a + ns + 1, 0, 1, 0);
  }
  // Walls and bottom.
  const outer = ringPts(A, B, b);
  const wallTop = addRing(outer, y1 - b, 1);
  const wallBot = addRing(outer, y0, 1);
  strip(wallTop, wallBot, outward(0));
  const botRing = addRing(outer, y0, 0);
  const center = pos.length / 3;
  pos.push(0, y0, 0); uvKind.push(0); perim.push(0);
  for (let i = 0; i < N; i++) tri(center, botRing + i, botRing + ((i + 1) % N), 0, -1, 0);

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
    else { uv[i * 2] = (perim[i] ?? 0) / tile; uv[i * 2 + 1] = P(i, 1) / tile; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
