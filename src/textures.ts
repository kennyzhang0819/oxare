import * as THREE from "three";
import { MAGNET_R, MAGNET_REACH, START_PAD_BOWL, START_PAD_R } from "./level.ts";

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
  barrierPanel: THREE.Texture; grille: THREE.Texture; stoolTop: THREE.Texture; bumperTop: THREE.Texture; barrelPanel: THREE.Texture;
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

// Circuit board every obstacle carries, drawn K times up so its lines stay bold; `cpu` is the
// chip's size before that scaling. `round` makes it a round board inside the rectangle.
function circuitPanel(ctx: Ctx, px: number, py: number, pw: number, ph: number, seed: number, cpu: number, K = 2.7, round = false) {
  ctx.save(); ctx.translate(px, py); ctx.scale(K, K);
  drawBoard(ctx, 0, 0, pw / K, ph / K, seed, cpu, round);
  ctx.restore();
}

// One CPU on a grey board, buses of parallel traces leaving its pins and bending at 45 degrees to
// end in vias, two status lights, all in greys. Traces never cross: everything drawn is stamped
// into a mask that later traces avoid.
function drawBoard(ctx: Ctx, px: number, py: number, pw: number, ph: number, seed: number, cpu: number, round = false) {
  const rnd = seeded(seed);
  const P = 6, TW = 2.2;
  const C = { edge: "#6f7a85", board: "#8d979f", trace: "#b4bdc5", pad: "#dfe5ea", hole: "#525c66", chip: "#3e464e", chipTop: "#4a535c", pin: "#dfe5ea", silk: "#dfe5ea" };
  const ox = px + pw / 2, oy = py + ph / 2, R = Math.min(pw, ph) / 2;
  if (round) {
    ctx.fillStyle = C.edge; ctx.beginPath(); ctx.arc(ox, oy, R + 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.board; ctx.beginPath(); ctx.arc(ox, oy, R, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = C.edge; ctx.fillRect(px - 4, py - 4, pw + 8, ph + 8);
    ctx.fillStyle = C.board; ctx.fillRect(px, py, pw, ph);
  }

  const mw = Math.ceil(pw) + 1, mh = Math.ceil(ph) + 1, mask = new Uint8Array(mw * mh);
  const inside = (x: number, y: number, m: number) => round ? Math.hypot(x - ox, y - oy) <= R - m : x >= px + m && y >= py + m && x <= px + pw - m && y <= py + ph - m;
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
  const trace = (pts: Pt[], startVia: boolean) => {
    stroke(ctx, pts, C.trace);
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
  rnd(); // was the lit bus's roll; kept so every board keeps its layout
  // Pins sit at mid + along * n, n the normal of the outward heading, so the bus offsets land on them.
  const bus = (mid: Pt, dir: number, along: number[]) => {
    if (!along.length) return;
    const c = along.reduce((a, b) => a + b, 0) / along.length;
    const n: Pt = [-DIRS[dir]![1], DIRS[dir]![0]];
    const centre = route([mid[0] + n[0] * c, mid[1] + n[1] * c], dir);
    const runs = along.map((a, k) => {
      const pts = offset(centre, a - c), L = reach(pts, 9) - (k % 2) * 7;
      return L > 8 ? cut(pts, L) : null;
    });
    for (const pts of runs) if (pts) trace(pts, false);
  };

  // One square CPU in the middle with pins all round, every pin routed out as far as the board allows.
  const x = Math.round(px + (pw - cpu) / 2), y = Math.round(py + (ph - cpu) / 2);
  markRect(x - 6, y - 6, cpu + 12, cpu + 12);
  ctx.strokeStyle = C.silk; ctx.lineWidth = 0.8;
  ctx.strokeRect(x - 5.5, y - 5.5, cpu + 11, cpu + 11);
  const count = Math.floor((cpu - 4) / P), along = Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * P);
  const sides: [Pt, number][] = [[[x + cpu / 2, y], 6], [[x + cpu / 2, y + cpu], 2], [[x, y + cpu / 2], 4], [[x + cpu, y + cpu / 2], 0]];
  ctx.fillStyle = C.pin;
  for (const [mid, dir] of sides) {
    const n: Pt = [-DIRS[dir]![1], DIRS[dir]![0]], o = DIRS[dir]!;
    for (const a of along) {
      const cx = mid[0] + n[0] * a, cy = mid[1] + n[1] * a, ex = cx + o[0] * 4, ey = cy + o[1] * 4, hw = 1.2;
      ctx.fillRect(Math.min(cx, ex) - Math.abs(n[0]) * hw, Math.min(cy, ey) - Math.abs(n[1]) * hw, Math.abs(ex - cx) + Math.abs(n[0]) * 2 * hw, Math.abs(ey - cy) + Math.abs(n[1]) * 2 * hw);
    }
  }
  ctx.fillStyle = C.chip; ctx.fillRect(x, y, cpu, cpu);
  ctx.fillStyle = C.chipTop; ctx.fillRect(x + 1.5, y + 1.5, cpu - 3, cpu - 3);
  ctx.fillStyle = "#6f7a85"; ctx.beginPath(); ctx.arc(x + 4.5, y + 4.5, 1.6, 0, Math.PI * 2); ctx.fill();
  for (const [mid, dir] of sides) bus([mid[0] + DIRS[dir]![0] * 4, mid[1] + DIRS[dir]![1] * 4], dir, along);

  // Two status lights where there is room.
  for (let i = 0; i < 2; i++) for (let t = 0; t < 30; t++) {
    const lx = px + 6 + rnd() * (pw - 16), ly = py + 6 + rnd() * (ph - 12);
    if (!rectFree(lx - 2, ly - 2, 8.5, 6.6)) continue;
    markRect(lx - 2, ly - 2, 8.5, 6.6);
    ctx.fillStyle = C.trace; ctx.fillRect(lx, ly, 4.5, 2.6);
    break;
  }
}

// Stool top: the circuit board, its CPU sized for the 2:1 top.
function stoolTopTexture(): THREE.Texture {
  const W = 256, H = 128;
  const [c, ctx] = canvas2x(W, H);
  ctx.fillStyle = "#6f7a85"; ctx.fillRect(0, 0, W, H);
  circuitPanel(ctx, 8, 8, W - 16, H - 16, 7, 22, 2.6);
  const mk = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return mk(c);
}

// Bumper top: a round circuit board filling the square, its CPU in the middle; the corners are unused.
function bumperTopTexture(): THREE.Texture {
  const W = 256;
  const [c, ctx] = canvas2x(W, W);
  ctx.fillStyle = "#6f7a85"; ctx.fillRect(0, 0, W, W);
  circuitPanel(ctx, 11, 11, W - 22, W - 22, 31, 26, 2.6, true);
  const mk = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return mk(c);
}

// Barrel side panel: a tall circuit board, its CPU sized for the narrow panel.
function barrelPanelTexture(): THREE.Texture {
  const W = 120, H = 200;
  const [c, ctx] = canvas2x(W, H);
  ctx.fillStyle = "#6f7a85"; ctx.fillRect(0, 0, W, H);
  circuitPanel(ctx, 6, 6, W - 12, H - 12, 41, 18, 2.6);
  const mk = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return mk(c);
}

// Barrier: the circuit board edge to edge, and a louvred end grille.
function barrierTextures(): [THREE.Texture, THREE.Texture] {
  const W = 512, H = 140;
  const [c, ctx] = canvas2x(W, H);
  ctx.fillStyle = "#6f7a85"; ctx.fillRect(0, 0, W, H);
  circuitPanel(ctx, 8, 8, W - 16, H - 16, 23, 24);
  const [gc, gctx] = canvas(128, 128);
  gctx.fillStyle = "#b9c2c9"; gctx.fillRect(0, 0, 128, 128);
  gctx.fillStyle = "#5d6873";
  for (let y = 10; y < 128; y += 14) gctx.fillRect(8, y, 112, 6);
  const mk = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return [mk(c), mk(gc)];
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
  // Only the rim outside the bowl shows this texture: lay its bands out across that, 0 at the
  // bowl's edge and 1 at the pad's.
  const q = START_PAD_BOWL / START_PAD_R, rim = (f: number) => q + f * (1 - q);
  ring(t, rim(0.67), rim(0.88), "#2fe6ff");
  ring(g, rim(0.67), rim(0.88), "#2fe6ff");
  ring(t, rim(0.88), 1.0, "#dfe5ea");
  // Circuit arcs with gaps on the axes.
  const rnd = seeded(5);
  for (let k = 0; k < 4; k++) {
    const a0 = k * Math.PI / 2 + 0.16, a1 = (k + 1) * Math.PI / 2 - 0.16;
    t.fillStyle = "#6f7a85";
    t.beginPath(); t.arc(c0, c0, R * rim(0.55), a0, a1); t.arc(c0, c0, R * rim(0.1), a1, a0, true); t.closePath(); t.fill();
    t.fillStyle = "#b6bfc7";
    for (let i = 0; i < 9; i++) {
      const a = a0 + 0.06 + rnd() * (a1 - a0 - 0.12), r = R * rim(0.17 + rnd() * 0.25), s = 4 + rnd() * 6;
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

// Crate face: white plate, a screen in the middle, green corner brackets that glow.
function crateFaces(): [THREE.Texture, THREE.Texture] {
  const S = 256;
  const [c, ctx] = canvas(S, S);
  const [e, ectx] = canvas(S, S);
  ctx.fillStyle = "#d3dae0";
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "#eef2f5";
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
// Magnet aura: red, strongest at the magnet's foot and fading out to nothing at its reach (the edge).
export function magnetAuraTexture(): THREE.Texture {
  const W = 256, [c, ctx] = canvas(W, W), g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2), r0 = MAGNET_R / MAGNET_REACH;
  g.addColorStop(0, "rgba(255,40,40,0.55)");
  for (let k = 0; k <= 8; k++) { const t = k / 8; g.addColorStop(r0 + (1 - r0) * t, `rgba(255,40,40,${(0.55 * (1 - t) ** 2).toFixed(3)})`); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function structTextures(): StructMaps {
  // Sized to the blockade's 1.6 x 1.1 side panel, so nothing is stretched.
  const W = 304, H = 208;
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
  circuitPanel(ctx, 96, 26, W - 192, H - 52, 11, 18);

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
  const [barrierPanel, grille] = barrierTextures();
  const stoolTop = stoolTopTexture(), bumperTop = bumperTopTexture(), barrelPanel = barrelPanelTexture();
  return { panel: mk(c), panelGlow: mk(e), pillar, crate, crateGlow, goalDisc: goalDisc(), padTop, padGlow, padCentre, padSkirt, barrierPanel, grille, stoolTop, bumperTop, barrelPanel };
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
