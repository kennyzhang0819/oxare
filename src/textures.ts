import * as THREE from "three";

export const TILE = 4;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!];
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function tileTexture(anisotropy: number): THREE.Texture {
  const n = 16, px = 64;
  const [c, ctx] = canvas(n * px, n * px);
  const rnd = seeded(7);
  const taken = new Set<number>();
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (taken.has(y * n + x)) continue;
    const wide = x + 1 < n && !taken.has(y * n + x + 1) && rnd() < 0.35;
    if (wide) taken.add(y * n + x + 1);
    const w = wide ? 2 : 1;
    const l = 90 + rnd() * 5;
    ctx.fillStyle = `hsl(210 10% ${l}%)`;
    ctx.fillRect(x * px, y * px, w * px, px);
    ctx.fillStyle = `hsl(210 10% ${l + 2}%)`;
    ctx.fillRect(x * px, y * px, w * px, 2);
    ctx.fillRect(x * px, y * px, 2, px);
    ctx.fillStyle = `hsl(210 10% ${l - 2}%)`;
    ctx.fillRect(x * px, y * px + px - 2, w * px, 2);
    ctx.fillRect((x + w) * px - 2, y * px, 2, px);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

export interface EdgeMaps { map: THREE.Texture; glow: THREE.Texture }

// Platform wall, bottom (v = 0) to top (v = 1), mirror-symmetric about the middle so a
// flipped platform looks the same: under each white lip a grey strip, then a cyan light
// line each side of the dark recess. Holes use the same strip on their inner walls.
export function edgeTextures(): EdgeMaps {
  const W = 8, H = 256;
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  const band = (v0: number, v1: number, col: string, glow = false) => {
    const y0 = Math.round((1 - v1) * H), y1 = Math.round((1 - v0) * H);
    ctx.fillStyle = col; ctx.fillRect(0, y0, W, y1 - y0);
    ectx.fillStyle = glow ? col : "#000"; ectx.fillRect(0, y0, W, y1 - y0);
  };
  band(0, 0.28, "#e6ebef");
  band(0.28, 0.33, "#a3adb6");
  band(0.33, 0.38, "#2fe6ff", true);
  band(0.38, 0.62, "#343b43");
  band(0.62, 0.67, "#2fe6ff", true);
  band(0.67, 0.72, "#a3adb6");
  band(0.72, 1, "#e6ebef");
  const mk = (cv: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    return t;
  };
  return { map: mk(c), glow: mk(e) };
}

export interface StructMaps {
  panel: THREE.Texture; panelGlow: THREE.Texture; pillar: THREE.Texture; crate: THREE.Texture; crateGlow: THREE.Texture; goalDisc: THREE.Texture;
  padTop: THREE.Texture; padGlow: THREE.Texture; padCentre: THREE.Texture; padSkirt: THREE.Texture;
  barrierPanel: THREE.Texture; barrierGlow: THREE.Texture; grille: THREE.Texture; stoolTop: THREE.Texture; stoolTopGlow: THREE.Texture;
}

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];
const S2 = Math.SQRT1_2;
const DIRS: Pt[] = [[1, 0], [S2, S2], [0, 1], [-S2, S2], [-1, 0], [-S2, -S2], [0, -1], [S2, -S2]];

// A logical w x h canvas drawn at twice the resolution, so the small parts stay crisp.
function canvas2x(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const [c, ctx] = canvas(w * 2, h * 2);
  ctx.scale(2, 2);
  return [c, ctx];
}

// Motherboard panel every obstacle carries, drawn K times up so its lines and parts stay bold.
function circuitPanel(ctx: Ctx, glow: Ctx, px: number, py: number, pw: number, ph: number, seed: number, K = 2.7) {
  for (const t of [ctx, glow]) { t.save(); t.translate(px, py); t.scale(K, K); }
  drawBoard(ctx, glow, 0, 0, pw / K, ph / K, seed);
  for (const t of [ctx, glow]) t.restore();
}

// Chips and a pin header on a grey board, buses of parallel traces leaving their pins and bending
// at 45 degrees to end in vias, a few small parts. Traces never cross: everything drawn is stamped
// into a mask that later parts avoid.
function drawBoard(ctx: Ctx, glow: Ctx, px: number, py: number, pw: number, ph: number, seed: number) {
  const rnd = seeded(seed);
  const P = 6, TW = 2.2;
  const C = { edge: "#6f7a85", board: "#8d979f", trace: "#b4bdc5", lit: "#7ff4ff", pad: "#dfe5ea", hole: "#525c66", chip: "#3e464e", chipTop: "#4a535c", pin: "#dfe5ea", silk: "#dfe5ea", light: "#2fe6ff" };
  ctx.fillStyle = C.edge; ctx.fillRect(px - 4, py - 4, pw + 8, ph + 8);
  ctx.fillStyle = C.board; ctx.fillRect(px, py, pw, ph);

  const mw = Math.ceil(pw) + 1, mh = Math.ceil(ph) + 1, mask = new Uint8Array(mw * mh);
  const inside = (x: number, y: number, m: number) => x >= px + m && y >= py + m && x <= px + pw - m && y <= py + ph - m;
  const cell = (x: number, y: number) => {
    const i = Math.round(x - px), j = Math.round(y - py);
    return i < 0 || j < 0 || i >= mw || j >= mh ? -1 : j * mw + i;
  };
  const discFree = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const i = dx * dx + dy * dy <= r * r ? cell(x + dx, y + dy) : -1;
      if (i >= 0 && mask[i]) return false;
    }
    return true;
  };
  const markDisc = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const i = dx * dx + dy * dy <= r * r ? cell(x + dx, y + dy) : -1;
      if (i >= 0) mask[i] = 1;
    }
  };
  const rectFree = (x: number, y: number, w: number, h: number) => {
    if (!inside(x, y, 2) || !inside(x + w, y + h, 2)) return false;
    for (let j = Math.floor(y); j <= y + h; j++) for (let i = Math.floor(x); i <= x + w; i++) if (mask[cell(i, j)]) return false;
    return true;
  };
  const markRect = (x: number, y: number, w: number, h: number) => {
    for (let j = Math.floor(y); j <= y + h; j++) for (let i = Math.floor(x); i <= x + w; i++) { const k = cell(i, j); if (k >= 0) mask[k] = 1; }
  };

  const len = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const normal = (a: Pt, b: Pt): Pt => { const l = len(a, b); return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]; };
  // Parallel copy of a polyline at distance o; mitred corners keep a bus evenly spaced through its bends.
  const offset = (pts: Pt[], o: number): Pt[] => pts.map((p, i) => {
    const a = i > 0 ? normal(pts[i - 1]!, p) : null, b = i < pts.length - 1 ? normal(p, pts[i + 1]!) : null;
    let m: Pt;
    if (a && b) { const k = 1 + a[0] * b[0] + a[1] * b[1]; m = [(a[0] + b[0]) / k, (a[1] + b[1]) / k]; }
    else m = (a ?? b)!;
    return [p[0] + m[0] * o, p[1] + m[1] * o];
  });
  const walk = (pts: Pt[], fn: (x: number, y: number, s: number) => boolean) => {
    let s = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]!, b = pts[i + 1]!, l = len(a, b);
      for (let t = 0; t < l; t++) if (!fn(a[0] + (b[0] - a[0]) * t / l, a[1] + (b[1] - a[1]) * t / l, s + t)) return s + t;
      s += l;
    }
    return s;
  };
  const cut = (pts: Pt[], L: number): Pt[] => {
    const out: Pt[] = [pts[0]!];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]!, b = pts[i + 1]!, l = len(a, b);
      if (l >= L) { out.push([a[0] + (b[0] - a[0]) * L / l, a[1] + (b[1] - a[1]) * L / l]); return out; }
      out.push(b); L -= l;
    }
    return out;
  };
  // How far a trace can run before it nears the board edge or anything already placed.
  const reach = (pts: Pt[], skip: number) => Math.max(0, walk(pts, (x, y, s) => s < skip || (inside(x, y, 6) && discFree(x, y, 3))) - 4);
  const via = (x: number, y: number) => {
    ctx.fillStyle = C.pad; ctx.beginPath(); ctx.arc(x, y, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.hole; ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
    markDisc(x, y, 5);
  };
  const stroke = (t: Ctx, pts: Pt[], col: string) => {
    t.strokeStyle = col; t.lineWidth = TW; t.lineJoin = "miter"; t.lineCap = "round";
    t.beginPath(); pts.forEach(([x, y], i) => i ? t.lineTo(x, y) : t.moveTo(x, y)); t.stroke();
  };
  const trace = (pts: Pt[], lit: boolean, startVia: boolean) => {
    stroke(ctx, pts, lit ? C.lit : C.trace);
    if (lit) stroke(glow, pts, C.light);
    walk(pts, (x, y) => { markDisc(x, y, 2); return true; });
    if (startVia) via(...pts[0]!);
    via(...pts[pts.length - 1]!);
  };
  // A centre line from start: a short straight, then a few 45-degree bends, never more than 90 off its heading.
  const route = (start: Pt, dir: number): Pt[] => {
    const pts: Pt[] = [start];
    let d = dir, side = rnd() < 0.5 ? 1 : -1;
    const legs = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < legs; i++) {
      if (i > 0) {
        const off = (d + side - dir + 12) % 8 - 4;
        if (Math.abs(off) > 2) side = -side;
        d = (d + side + 8) % 8;
        if (rnd() < 0.6) side = -side;
      }
      const l = i === 0 ? 10 + rnd() * 10 : i === legs - 1 ? 40 + rnd() * 120 : 24 + rnd() * 40;
      const [x, y] = pts[pts.length - 1]!;
      pts.push([x + DIRS[d]![0] * l, y + DIRS[d]![1] * l]);
    }
    return pts;
  };
  let litBus = rnd() < 0.8;
  // Pins sit at mid + along * n, n the normal of the outward heading, so the bus offsets land on them.
  const bus = (mid: Pt, dir: number, along: number[]) => {
    if (!along.length) return;
    const c = along.reduce((a, b) => a + b, 0) / along.length;
    const n: Pt = [-DIRS[dir]![1], DIRS[dir]![0]];
    const centre = route([mid[0] + n[0] * c, mid[1] + n[1] * c], dir);
    const lit = litBus; litBus = false;
    const runs = along.map((a, k) => {
      const pts = offset(centre, a - c), L = reach(pts, 9) - (k % 2) * 7;
      return L > 8 ? cut(pts, L) : null;
    });
    for (const pts of runs) if (pts) trace(pts, lit, false);
  };

  // Chips: a QFP with pins all round, SOICs with pins on the long sides, and a two-row pin header.
  const specs: [w: number, h: number, sides: number, header?: boolean][] = [[34, 34, 4], [12, P * 6, 2, true], [30, 14, 2], [22, 22, 4]];
  for (const [w0, h0, sides, header] of specs) {
    const turn = header ? rnd() < 0.5 : rnd() < 0.3;
    const w = turn ? h0 : w0, h = turn ? w0 : h0;
    let spot: Pt | null = null;
    for (let t = 0; t < 60 && !spot; t++) {
      const x = px + 10 + rnd() * (pw - 20 - w), y = py + 10 + rnd() * (ph - 20 - h);
      if (rectFree(x - 9, y - 9, w + 18, h + 18)) spot = [Math.round(x), Math.round(y)];
    }
    if (!spot) continue;
    const [x, y] = spot;
    // Each side: midpoint, outward heading, length.
    const all: [Pt, number, number][] = [[[x + w / 2, y], 6, w], [[x + w / 2, y + h], 2, w], [[x, y + h / 2], 4, h], [[x + w, y + h / 2], 0, h]];
    const pinned = sides === 4 ? all : w >= h ? all.slice(0, 2) : all.slice(2);
    const out = header ? 0 : 4;
    markRect(x - out - 2, y - out - 2, w + 2 * out + 4, h + 2 * out + 4);
    ctx.strokeStyle = C.silk; ctx.lineWidth = 0.8;
    ctx.strokeRect(x - out - 1.5, y - out - 1.5, w + 2 * out + 3, h + 2 * out + 3);
    const routes: [Pt, number, number[]][] = [];
    if (header) {
      const cols = Math.round(w / P), rows = Math.round(h / P);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const cx = x + (i + 0.5) * P, cy = y + (j + 0.5) * P;
        ctx.fillStyle = C.pad; ctx.fillRect(cx - 2.2, cy - 2.2, 4.4, 4.4);
        ctx.fillStyle = C.hole; ctx.beginPath(); ctx.arc(cx, cy, 1.1, 0, Math.PI * 2); ctx.fill();
      }
      const side = (w >= h ? all.slice(0, 2) : all.slice(2))[rnd() < 0.5 ? 0 : 1]!;
      const count = Math.round(side[2] / P), along = Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * P);
      const o = DIRS[side[1]]!;
      routes.push([[side[0][0] + o[0] * 2, side[0][1] + o[1] * 2], side[1], along.slice(1, count - 1)]);
    } else {
      for (const [mid, dir, l] of pinned) {
        const n: Pt = [-DIRS[dir]![1], DIRS[dir]![0]], o = DIRS[dir]!;
        const count = Math.floor((l - 4) / P), along = Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * P);
        ctx.fillStyle = C.pin;
        for (const a of along) {
          const cx = mid[0] + n[0] * a, cy = mid[1] + n[1] * a;
          const ex = cx + o[0] * 4, ey = cy + o[1] * 4, hw = 1.2;
          ctx.fillRect(Math.min(cx, ex) - Math.abs(n[0]) * hw, Math.min(cy, ey) - Math.abs(n[1]) * hw, Math.abs(ex - cx) + Math.abs(n[0]) * 2 * hw, Math.abs(ey - cy) + Math.abs(n[1]) * 2 * hw);
        }
        if (rnd() < 0.85) {
          const m = Math.min(count, 2 + Math.floor(rnd() * 3)), s0 = Math.floor(rnd() * (count - m + 1));
          routes.push([[mid[0] + o[0] * 4, mid[1] + o[1] * 4], dir, along.slice(s0, s0 + m)]);
        }
      }
      ctx.fillStyle = C.chip; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = C.chipTop; ctx.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
      ctx.fillStyle = "#6f7a85"; ctx.beginPath(); ctx.arc(x + 4.5, y + 4.5, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    for (const [mid, dir, along] of routes) bus(mid, dir, along);
  }

  // Loose buses from a row of vias to a row of vias.
  for (let i = 0; i < 40; i++) {
    const x = px + 8 + rnd() * (pw - 16), y = py + 8 + rnd() * (ph - 16), dir = Math.floor(rnd() * 4) * 2;
    const count = rnd() < 0.5 ? 1 : 2 + Math.floor(rnd() * 2);
    const along = Array.from({ length: count }, (_, k) => (k - (count - 1) / 2) * P * 1.3);
    const n: Pt = [-DIRS[dir]![1], DIRS[dir]![0]];
    if (!along.every((a) => inside(x + n[0] * a, y + n[1] * a, 8) && discFree(x + n[0] * a, y + n[1] * a, 6))) continue;
    const centre = route([x, y], dir);
    const runs = along.map((a) => { const pts = offset(centre, a); return cut(pts, reach(pts, 0)); });
    if (runs.some((pts) => walk(pts, () => true) < 18)) continue;
    for (const pts of runs) trace(pts, false, true);
  }

  // A few small parts in what space is left: an electrolytic can, a crystal, resistors, status LEDs.
  const place = (w: number, h: number, draw: (x: number, y: number, w: number, h: number) => void) => {
    for (let t = 0; t < 30; t++) {
      const turn = rnd() < 0.5, ww = turn ? h : w, hh = turn ? w : h;
      const x = px + 6 + rnd() * (pw - 12 - ww), y = py + 6 + rnd() * (ph - 12 - hh);
      if (!rectFree(x - 2, y - 2, ww + 4, hh + 4)) continue;
      markRect(x - 2, y - 2, ww + 4, hh + 4);
      draw(x, y, ww, hh);
      return;
    }
  };
  for (let i = 0; i < 1; i++) place(16, 16, (x, y, w) => {
    const r = w / 2, cx = x + r, cy = y + r;
    ctx.strokeStyle = C.silk; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#c9d1d8"; ctx.beginPath(); ctx.arc(cx, cy, r - 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#6f7a85"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy); ctx.lineTo(cx + r * 0.5, cy); ctx.moveTo(cx, cy - r * 0.5); ctx.lineTo(cx, cy + r * 0.5); ctx.stroke();
  });
  place(14, 6, (x, y, w, h) => {
    ctx.fillStyle = "#c9d1d8"; ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(w, h) / 2); ctx.fill();
    ctx.strokeStyle = "#eef2f5"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.roundRect(x + 1.2, y + 1.2, w - 2.4, h - 2.4, Math.min(w, h) / 2 - 1.2); ctx.stroke();
  });
  for (let i = 0; i < 4; i++) place(7, 3.5, (x, y, w, h) => {
    ctx.fillStyle = C.pin; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = rnd() < 0.5 ? "#3e464e" : "#6f7a85";
    if (w > h) ctx.fillRect(x + 1.6, y, w - 3.2, h); else ctx.fillRect(x, y + 1.6, w, h - 3.2);
  });
  for (let i = 0; i < 2; i++) place(4.5, 2.6, (x, y, w, h) => {
    for (const t of [ctx, glow]) { t.fillStyle = C.light; t.fillRect(x, y, w, h); }
  });
}

// Barrier: the shared motherboard panel edge to edge, and a louvred end grille.
// Stool top: the motherboard panel at a finer scale so its CPU chip fits the 2:1 top.
function stoolTopTextures(): [THREE.Texture, THREE.Texture] {
  const W = 256, H = 128;
  const [c, ctx] = canvas2x(W, H);
  const [e, ectx] = canvas2x(W, H);
  ctx.fillStyle = "#6f7a85"; ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = "#000"; ectx.fillRect(0, 0, W, H);
  circuitPanel(ctx, ectx, 8, 8, W - 16, H - 16, 7, 1.5);
  const mk = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return [mk(c), mk(e)];
}

function barrierTextures(): [THREE.Texture, THREE.Texture, THREE.Texture] {
  const W = 512, H = 140;
  const [c, ctx] = canvas2x(W, H);
  const [e, ectx] = canvas2x(W, H);
  ctx.fillStyle = "#6f7a85"; ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = "#000"; ectx.fillRect(0, 0, W, H);
  circuitPanel(ctx, ectx, 8, 8, W - 16, H - 16, 23);
  const [gc, gctx] = canvas(128, 128);
  gctx.fillStyle = "#b9c2c9"; gctx.fillRect(0, 0, 128, 128);
  gctx.fillStyle = "#5d6873";
  for (let y = 10; y < 128; y += 14) gctx.fillRect(8, y, 112, 6);
  const mk = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return [mk(c), mk(e), mk(gc)];
}

// Start pad: white top with a cyan ring and four grey circuit arcs; a centre disc of
// concentric rings; a ribbed grey skirt around the side.
function padTextures(): [THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture] {
  const S = 512, c0 = S / 2, R = S / 2;
  const [top, t] = canvas(S, S);
  const [glow, g] = canvas(S, S);
  t.fillStyle = "#eef2f5"; t.fillRect(0, 0, S, S);
  g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
  const ring = (ctx: CanvasRenderingContext2D, r0: number, r1: number, col: string) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c0, c0, R * r1, 0, Math.PI * 2); ctx.arc(c0, c0, R * r0, 0, Math.PI * 2, true); ctx.fill();
  };
  ring(t, 0.86, 0.95, "#2fe6ff");
  ring(g, 0.86, 0.95, "#2fe6ff");
  ring(t, 0.95, 1.0, "#dfe5ea");
  // Circuit arcs with gaps on the axes.
  const rnd = seeded(5);
  for (let k = 0; k < 4; k++) {
    const a0 = k * Math.PI / 2 + 0.16, a1 = (k + 1) * Math.PI / 2 - 0.16;
    t.fillStyle = "#6f7a85";
    t.beginPath(); t.arc(c0, c0, R * 0.8, a0, a1); t.arc(c0, c0, R * 0.62, a1, a0, true); t.closePath(); t.fill();
    t.fillStyle = "#b6bfc7";
    for (let i = 0; i < 9; i++) {
      const a = a0 + 0.06 + rnd() * (a1 - a0 - 0.12), r = R * (0.65 + rnd() * 0.12), s = 5 + rnd() * 9;
      const x = c0 + Math.cos(a) * r, y = c0 + Math.sin(a) * r;
      if (rnd() < 0.6) t.fillRect(x, y, s, 4); else t.fillRect(x, y, 4, s);
    }
  }
  const [centre, cc] = canvas(S, S);
  cc.fillStyle = "#b9c2c9"; cc.fillRect(0, 0, S, S);
  for (let i = 5; i >= 1; i--) {
    cc.fillStyle = i % 2 ? "#9aa4ad" : "#aeb7bf";
    cc.beginPath(); cc.arc(c0, c0, R * (i / 5) * 0.96, 0, Math.PI * 2); cc.fill();
    cc.strokeStyle = "#5d6873"; cc.lineWidth = 4; cc.stroke();
  }
  const [skirt, sk] = canvas(384, 64);
  sk.fillStyle = "#aeb7bf"; sk.fillRect(0, 0, 384, 64);
  sk.fillStyle = "#5d6873";
  for (let x = 0; x < 384; x += 24) sk.fillRect(x, 0, 4, 64);
  sk.fillStyle = "#8f99a2"; sk.fillRect(0, 0, 384, 6);
  const mk = (cv: HTMLCanvasElement) => { const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; return tx; };
  const sktx = mk(skirt); sktx.wrapS = THREE.RepeatWrapping; sktx.repeat.x = 2;
  return [mk(top), mk(glow), mk(centre), sktx];
}

// Crate face: grey plate, a screen in the middle, green corner brackets that glow.
function crateFaces(): [THREE.Texture, THREE.Texture] {
  const S = 256;
  const [c, ctx] = canvas(S, S);
  const [e, ectx] = canvas(S, S);
  ctx.fillStyle = "#8c959d";
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "#a3abb2";
  ctx.fillRect(14, 14, S - 28, S - 28);
  ctx.fillStyle = "#6c757d";
  ctx.fillRect(70, 86, 116, 84);
  ctx.fillStyle = "#d4dde4";
  ctx.fillRect(80, 96, 96, 64);
  ctx.fillStyle = "#4e565e";
  for (const [x, y, w, h] of [[36, 112, 22, 32], [198, 112, 22, 32], [112, 40, 32, 14], [112, 202, 32, 14]] as const) ctx.fillRect(x, y, w, h);
  ectx.fillStyle = "#000";
  ectx.fillRect(0, 0, S, S);
  const arm = 44, t = 12, m = 10;
  for (const target of [ctx, ectx]) {
    target.fillStyle = "#39e07a";
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [S - m, m, -1, 1], [m, S - m, 1, -1], [S - m, S - m, -1, -1]] as const) {
      target.fillRect(sx > 0 ? x : x - arm, sy > 0 ? y : y - t, arm, t);
      target.fillRect(sx > 0 ? x : x - t, sy > 0 ? y : y - arm, t, arm);
    }
  }
  const mk = (cv: HTMLCanvasElement) => { const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; return tx; };
  return [mk(c), mk(e)];
}

// Goal base: dark disc with light spokes and a hub.
function goalDisc(): THREE.Texture {
  const S = 256;
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = "#2a3137";
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#8d969e";
  ctx.lineWidth = 3;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(S / 2, S / 2); ctx.lineTo(S / 2 + Math.cos(a) * S * 0.46, S / 2 + Math.sin(a) * S * 0.46); ctx.stroke();
  }
  ctx.fillStyle = "#b9c2c9";
  ctx.beginPath(); ctx.arc(S / 2, S / 2, 10, 0, Math.PI * 2); ctx.fill();
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}

// Blockade side: a motherboard plate between two stacks of cyan light bars, which
// also go into an emissive map so they glow. Pillar: three tiers of vertical slats.
export function structTextures(): StructMaps {
  const W = 512, H = 208;
  const [c, ctx] = canvas2x(W, H);
  const [e, ectx] = canvas2x(W, H);
  ctx.fillStyle = "#e9eef3";
  ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = "#000";
  ectx.fillRect(0, 0, W, H);
  for (const x0 of [22, W - 62]) {
    ctx.fillStyle = "#c9d2da";
    ctx.fillRect(x0 - 6, 18, 52, H - 36);
    for (let k = 0; k < 5; k++) {
      const y = 26 + k * 33.5;
      for (const t of [ctx, ectx]) {
        t.fillStyle = "#2fe6ff";
        t.beginPath();
        t.roundRect(x0, y, 40, 22, 6);
        t.fill();
      }
    }
  }
  circuitPanel(ctx, ectx, 96, 26, W - 192, H - 52, 11);

  // Pillar wrap (u runs once around): twelve wide slats per tier, light rings between tiers.
  const PW = 384, PH = 256, SLATS = 12;
  const [pc, pctx] = canvas(PW, PH);
  pctx.fillStyle = "#e3e9ee";
  pctx.fillRect(0, 0, PW, PH);
  const tier = PH / 3, period = PW / SLATS;
  for (let t = 0; t < 3; t++) {
    const y0 = t * tier + 12, y1 = (t + 1) * tier - 12;
    pctx.fillStyle = "#4f5a66";
    for (let k = 0; k < SLATS; k++) pctx.fillRect(Math.round(k * period + period * 0.22), y0, Math.round(period * 0.56), y1 - y0);
    pctx.fillStyle = "#c3ccd4";
    pctx.fillRect(0, y1 + 4, PW, 4);
  }
  const mk = (cv: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const pillar = mk(pc);
  pillar.wrapS = THREE.RepeatWrapping;
  pillar.anisotropy = 16;
  const [crate, crateGlow] = crateFaces();
  const [padTop, padGlow, padCentre, padSkirt] = padTextures();
  const [barrierPanel, barrierGlow, grille] = barrierTextures();
  const [stoolTop, stoolTopGlow] = stoolTopTextures();
  return { panel: mk(c), panelGlow: mk(e), pillar, crate, crateGlow, goalDisc: goalDisc(), padTop, padGlow, padCentre, padSkirt, barrierPanel, barrierGlow, grille, stoolTop, stoolTopGlow };
}

export interface BallMaps { map: THREE.Texture; emissive: THREE.Texture; roughness: THREE.Texture }

// Light blue metal split into eight panels by great-circle seams: a dark groove with a
// bright bevel on each side, and cyan light dashes running inside the groove.
export function ballTextures(): BallMaps {
  const W = 1024, H = 512;
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  const [r, rctx] = canvas(W, H);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#5592f2");
  grad.addColorStop(0.5, "#417ee8");
  grad.addColorStop(1, "#326bd2");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = "#000";
  ectx.fillRect(0, 0, W, H);
  rctx.fillStyle = "#2a2a2a";
  rctx.fillRect(0, 0, W, H);

  type Line = (lon: number) => number;
  const tilt = Math.atan(Math.SQRT2);
  const lines: Line[] = [0, 1, 2].map((k) => (lon) => Math.atan(Math.tan(tilt) * Math.sin(lon - (k * 2 * Math.PI) / 3)));
  lines.push(() => 0);
  const stroke = (target: CanvasRenderingContext2D, color: string, width: number, dash: number[], offset = 0) => {
    target.strokeStyle = color;
    target.lineWidth = width;
    target.lineCap = "round";
    target.setLineDash(dash);
    lines.forEach((line, k) => {
      target.lineDashOffset = offset + k * 97;
      for (let wrap = -1; wrap <= 1; wrap++) {
        target.beginPath();
        for (let i = 0; i <= 512; i++) {
          const lon = (i / 512) * 2 * Math.PI;
          const x = ((lon + wrap * 2 * Math.PI) / (2 * Math.PI)) * W + W / 2;
          const y = (0.5 - line(lon) / Math.PI) * H;
          if (i === 0) target.moveTo(x, y); else target.lineTo(x, y);
        }
        target.stroke();
      }
    });
  };
  stroke(ctx, "#86b4fa", 26, []);
  stroke(ctx, "#143584", 14, []);
  stroke(ctx, "#2fd9f2", 6, [150, 90]);
  stroke(ectx, "#2fe6ff", 6, [150, 90]);
  stroke(rctx, "#aaaaaa", 14, []);

  const mk = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: mk(c, true), emissive: mk(e, true), roughness: mk(r, false) };
}
