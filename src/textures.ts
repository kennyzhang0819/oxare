import * as THREE from "three";
import { BARRIER, BEAN, BLOCKADE, BOARD, CRATE, CUBE, EFFECTS, ENV, GOAL, PILLAR, PLATFORM, PROPS, START_PAD, TILE_SHADES, TILE_STEP, TREADMILL, css, shade } from "./palette.ts";
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
  if (ENV.floes) return iceTileTexture(anisotropy);
  const n = 16, px = 64;
  const tints = ENV.tileTints;
  const mixc = (a: number, b: number, t: number) => [16, 8, 0].reduce((o, sh) => o | (Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t) << sh), 0);
  const [c, ctx] = canvas(n * px, n * px);
  const rnd = seeded(7);
  const taken = new Set<number>();
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (taken.has(y * n + x)) continue;
    const room = Array.from({ length: ENV.tileWide - 1 }, (_, i) => x + 1 + i).every((xx) => xx < n && !taken.has(y * n + xx));
    const wide = ENV.tileWide > 1 && room && rnd() < 0.35;
    if (wide) for (let i = 1; i < ENV.tileWide; i++) taken.add(y * n + x + i);
    const w = wide ? ENV.tileWide : 1;
    const k = 1 - (1 + Math.floor(rnd() * TILE_SHADES)) * TILE_STEP;
    const base = tints ? mixc(PLATFORM.tile, tints[Math.floor(rnd() * tints.length)]!, 0.6) : PLATFORM.tile;
    ctx.fillStyle = css(shade(base, k));
    ctx.fillRect(x * px, y * px, w * px, px);
    ctx.fillStyle = css(shade(base, k + 2 * TILE_STEP));
    ctx.fillRect(x * px, y * px, w * px, 2);
    ctx.fillRect(x * px, y * px, 2, px);
    ctx.fillStyle = css(shade(base, k - 2 * TILE_STEP));
    ctx.fillRect(x * px, y * px + px - 2, w * px, 2);
    ctx.fillRect((x + w) * px - 2, y * px, 2, px);
    if (ENV.tileGrout !== null) {
      ctx.strokeStyle = css(ENV.tileGrout);
      ctx.lineWidth = 3;
      ctx.strokeRect(x * px + 1.5, y * px + 1.5, w * px - 3, px - 3);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

// Ice pack: a few irregular floes to the texture (one repeat is TILE units), split by dark-water
// seams, each floe a slightly different white, darkening a little toward its seams, hairline
// cracks across. Toroidal distances keep the pattern seamless.
function iceTileTexture(anisotropy: number): THREE.Texture {
  const S = 1024, N = 10, SEAM = 7;
  const [c, ctx] = canvas(S, S);
  const rnd = seeded(23);
  const sites = Array.from({ length: N }, () => ({ x: rnd() * S, y: rnd() * S, k: 1 - rnd() * 0.045 }));
  const seam = ENV.tileGrout ?? shade(PLATFORM.tile, 0.7);
  const img = ctx.createImageData(S, S), d = img.data;
  const rgb = (col: number): [number, number, number] => [(col >> 16) & 255, (col >> 8) & 255, col & 255];
  const [sr, sg, sb] = rgb(seam);
  const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let d1 = Infinity, d2 = Infinity, near = 0;
    for (let i = 0; i < N; i++) {
      let dx = Math.abs(x - sites[i]!.x), dy = Math.abs(y - sites[i]!.y);
      if (dx > S / 2) dx = S - dx;
      if (dy > S / 2) dy = S - dy;
      const dd = Math.hypot(dx, dy);
      if (dd < d1) { d2 = d1; d1 = dd; near = i; } else if (dd < d2) d2 = dd;
    }
    const edge = d2 - d1;
    const f = sm(0, SEAM, edge);
    const bevel = 1 - 0.07 * (1 - sm(SEAM, SEAM + 90, edge));
    const grain = 1 + ((((x * 1103515245 + y * 12345) >>> 0) % 1000) / 1000 - 0.5) * 0.02;
    const [r, g, b] = rgb(shade(PLATFORM.tile, sites[near]!.k * bevel * grain));
    const o = (y * S + x) * 4;
    d[o] = sr + (r - sr) * f; d[o + 1] = sg + (g - sg) * f; d[o + 2] = sb + (b - sb) * f; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Hairline cracks: short bent lines inside the floes.
  ctx.strokeStyle = css(shade(PLATFORM.tile, 0.84)); ctx.lineWidth = 1.5; ctx.lineCap = "round"; ctx.globalAlpha = 0.6;
  for (let i = 0; i < 16; i++) {
    let x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) { const l = 30 + rnd() * 70; a += (rnd() - 0.5) * 1.2; x += Math.cos(a) * l; y += Math.sin(a) * l; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

// Treadmill rod: u runs once round the rod, the way its top runs, v along BELT_TILE of its length.
// Two staggered orange chevrons point toward -u (the way the surface runs under them) between dark
// grooves along the rod; `glow` is the chevrons alone.
export const BELT_TILE = 1.5;
export function beltTextures(): { map: THREE.Texture; glow: THREE.Texture } {
  const U = 512, V = 256;
  const draw = (glow: boolean) => {
    const [c, ctx] = canvas(U, V);
    ctx.fillStyle = glow ? "#000" : css(TREADMILL.rod);
    ctx.fillRect(0, 0, U, V);
    if (!glow) {
      ctx.fillStyle = css(TREADMILL.groove);
      for (let k = 0; k < 8; k++) ctx.fillRect((k * U) / 8, 0, 3, V);
    }
    ctx.strokeStyle = css(TREADMILL.arrow);
    ctx.lineWidth = 10;
    ctx.lineJoin = "miter";
    for (const [cx, cy] of [[U * 0.25, V * 0.25], [U * 0.75, V * 0.75]] as const) {
      const dx = 44, dy = 70, t = 34;
      ctx.beginPath();
      ctx.moveTo(cx + dx, cy - dy); ctx.lineTo(cx - dx, cy); ctx.lineTo(cx + dx, cy + dy);
      ctx.lineTo(cx + dx + t, cy + dy); ctx.lineTo(cx - dx + t, cy); ctx.lineTo(cx + dx + t, cy - dy);
      ctx.closePath();
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: draw(false), glow: draw(true) };
}

export interface EdgeMaps { map: THREE.Texture; glow: THREE.Texture }

// Platform wall, bottom (v = 0) to top (v = 1), mirror-symmetric about the middle so a
// flipped platform looks the same: under each white lip a grey strip, then a cyan light
// line each side of the dark recess. Holes use the same strip on their inner walls.
export function edgeTextures(): EdgeMaps {
  if (ENV.style === "ice") return iceEdgeTextures();
  if (ENV.style === "cute") return cuteEdgeTextures();
  const W = 8, H = 256;
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  const band = (v0: number, v1: number, col: string, glow = false) => {
    const y0 = Math.round((1 - v1) * H), y1 = Math.round((1 - v0) * H);
    ctx.fillStyle = col; ctx.fillRect(0, y0, W, y1 - y0);
    ectx.fillStyle = glow ? col : "#000"; ectx.fillRect(0, y0, W, y1 - y0);
  };
  const lip = css(PLATFORM.lip), line = css(PLATFORM.lipLine), cyan = css(PROPS.cyan);
  band(0, 0.28, lip);
  band(0.28, 0.33, line);
  band(0.33, 0.38, cyan, true);
  band(0.38, 0.62, css(PLATFORM.recess));
  band(0.62, 0.67, cyan, true);
  band(0.67, 0.72, line);
  band(0.72, 1, lip);
  const mk = (cv: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    return t;
  };
  return { map: mk(c), glow: mk(e) };
}

// Ice edge: pale lips over a band of deep water seen through the ice, lighter toward the top,
// with icicle streaks hanging from its top edge and one glowing core line through its middle.
function iceEdgeTextures(): EdgeMaps {
  const W = 256, H = 256;
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  const rnd = seeded(5);
  const Y = (v: number) => Math.round((1 - v) * H);
  const band = (t: CanvasRenderingContext2D, v0: number, v1: number, col: string | CanvasGradient) => { t.fillStyle = col; t.fillRect(0, Y(v1), W, Y(v0) - Y(v1)); };
  const lip = css(PLATFORM.lip), line = css(PLATFORM.lipLine), core = css(PROPS.cyan);
  ectx.fillStyle = "#000"; ectx.fillRect(0, 0, W, H);
  band(ctx, 0, 1, lip);
  const g = ctx.createLinearGradient(0, Y(0.3), 0, Y(0.72));
  g.addColorStop(0, css(shade(PLATFORM.recess, 0.8)));
  g.addColorStop(1, css(shade(PLATFORM.recess, 2.1)));
  band(ctx, 0.3, 0.72, g);
  // Icicles: translucent streaks from the top of the water band, and a few short ones up from the bottom.
  for (let i = 0; i < 22; i++) {
    const x = rnd() * W, w = 4 + rnd() * 10, len = (0.2 + rnd() * 0.45) * (0.72 - 0.3);
    ctx.fillStyle = css(shade(PLATFORM.recess, 2.6)); ctx.globalAlpha = 0.3 + rnd() * 0.3;
    ctx.beginPath(); ctx.moveTo(x - w / 2, Y(0.72)); ctx.lineTo(x + w / 2, Y(0.72)); ctx.lineTo(x, Y(0.72 - len)); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  band(ctx, 0.28, 0.3, line); band(ctx, 0.72, 0.74, line);
  band(ctx, 0.495, 0.525, core); band(ectx, 0.495, 0.525, core);
  const mk = (cv: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    return t;
  };
  return { map: mk(c), glow: mk(e) };
}

// Cute edge: pale lips over one soft pastel band carrying a single fat rounded light line and a
// row of big faint polka dots; nothing thin, nothing sharp.
function cuteEdgeTextures(): EdgeMaps {
  const W = 256, H = 256;
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  const Y = (v: number) => Math.round((1 - v) * H);
  const band = (t: CanvasRenderingContext2D, v0: number, v1: number, col: string) => { t.fillStyle = col; t.fillRect(0, Y(v1), W, Y(v0) - Y(v1)); };
  ectx.fillStyle = "#000"; ectx.fillRect(0, 0, W, H);
  band(ctx, 0, 1, css(PLATFORM.lip));
  band(ctx, 0.3, 0.72, css(PLATFORM.recess));
  ctx.fillStyle = css(shade(PLATFORM.recess, 1.12));
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc((i + 0.5) * (W / 4), (Y(0.3) + Y(0.72)) / 2, 22, 0, Math.PI * 2); ctx.fill(); }
  for (const t of [ctx, ectx]) {
    t.fillStyle = css(PROPS.cyan); t.beginPath(); t.roundRect(-10, Y(0.56), W + 20, Y(0.46) - Y(0.56), 8); t.fill();
  }
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
  cubeFace: THREE.Texture; cubeFaceGlow: THREE.Texture; cubeTop: THREE.Texture; cubeTopGlow: THREE.Texture;
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
  if (ENV.style === "ice") drawFrost(ctx, 0, 0, pw / K, ph / K, seed, cpu, round);
  else if (ENV.style === "cute") drawKawaii(ctx, 0, 0, pw / K, ph / K, seed, cpu, round);
  else drawBoard(ctx, 0, 0, pw / K, ph / K, seed, cpu, round);
  ctx.restore();
}

// A six-armed snowflake: arms with two pairs of side branches and a small hexagon at the heart.
function flake(ctx: Ctx, cx: number, cy: number, r: number, col: string, lw: number) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (let k = 0; k < 6; k++) {
    ctx.save(); ctx.rotate((k * Math.PI) / 3);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r, 0); ctx.stroke();
    for (const [at, len] of [[0.42, 0.3], [0.68, 0.2]] as const) for (const sgn of [1, -1]) {
      ctx.beginPath(); ctx.moveTo(r * at, 0); ctx.lineTo(r * at + r * len * Math.cos(Math.PI / 3), sgn * r * len * Math.sin(Math.PI / 3)); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.beginPath();
  for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3 + Math.PI / 6; ctx.lineTo(r * 0.16 * Math.cos(a), r * 0.16 * Math.sin(a)); }
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}

// A heart, point down, r tall about (cx, cy).
function heart(ctx: Ctx, cx: number, cy: number, r: number, col: string) {
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.55);
  ctx.bezierCurveTo(cx - r * 1.1, cy - r * 0.25, cx - r * 0.55, cy - r * 0.95, cx, cy - r * 0.35);
  ctx.bezierCurveTo(cx + r * 0.55, cy - r * 0.95, cx + r * 1.1, cy - r * 0.25, cx, cy + r * 0.55);
  ctx.fill();
}
// A five-point star of radius r.
function star(ctx: Ctx, cx: number, cy: number, r: number, col: string) {
  ctx.fillStyle = col; ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
  ctx.closePath(); ctx.fill();
}
// A kawaii face: two big round eyes with a highlight, round blush, a small open smile.
function kawaii(ctx: Ctx, cx: number, cy: number, s: number, eye: string, blush: string, shine: string) {
  const ex = s * 0.42, ey = -s * 0.08, er = s * 0.17;
  for (const sgn of [-1, 1]) {
    ctx.fillStyle = eye; ctx.beginPath(); ctx.ellipse(cx + sgn * ex, cy + ey, er, er * 1.25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shine; ctx.beginPath(); ctx.arc(cx + sgn * ex - er * 0.3, cy + ey - er * 0.45, er * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = blush; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.ellipse(cx + sgn * s * 0.62, cy + s * 0.3, s * 0.17, s * 0.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = eye; ctx.lineWidth = Math.max(1.2, s * 0.06); ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(cx, cy + s * 0.22, s * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
}

// The cute panel in place of the circuit board: a rounded pastel plate with a kawaii face in the
// middle, hearts and stars around it, and two round pips. A wide panel gets a heart at each end.
function drawKawaii(ctx: Ctx, px: number, py: number, pw: number, ph: number, seed: number, cpu: number, round = false) {
  const rnd = seeded(seed);
  const C = { edge: css(BOARD.edge), board: css(BOARD.board), blush: css(BOARD.trace), shine: css(BOARD.pad), eye: css(BOARD.chip) };
  const ox = px + pw / 2, oy = py + ph / 2, R = Math.min(pw, ph) / 2;
  ctx.save();
  if (round) {
    ctx.fillStyle = C.edge; ctx.beginPath(); ctx.arc(ox, oy, R + 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.board; ctx.beginPath(); ctx.arc(ox, oy, R, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ox, oy, R, 0, Math.PI * 2); ctx.clip();
  } else {
    ctx.fillStyle = C.edge; ctx.fillRect(px - 4, py - 4, pw + 8, ph + 8);
    ctx.fillStyle = C.board; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, Math.min(10, R * 0.4)); ctx.fill();
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, Math.min(10, R * 0.4)); ctx.clip();
  }
  const s = cpu * 1.1;
  // A soft lighter disc behind the face.
  ctx.fillStyle = C.shine; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(ox, oy, s * 1.15, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  kawaii(ctx, ox, oy, s, C.eye, C.blush, C.shine);
  if (pw / ph > 2.2) for (const f of [0.14, 0.86]) heart(ctx, px + pw * f, oy, s * 0.5, C.blush);
  for (let i = 0, tries = 0; i < 7 && tries < 60; tries++) {
    const x = px + 8 + rnd() * (pw - 16), y = py + 8 + rnd() * (ph - 16), r = 2.5 + rnd() * 3;
    if (Math.hypot(x - ox, y - oy) < s * 1.5 || (round && Math.hypot(x - ox, y - oy) > R - 9)) continue;
    if (rnd() < 0.5) heart(ctx, x, y, r, C.blush); else star(ctx, x, y, r, C.shine);
    i++;
  }
  ctx.fillStyle = C.blush;
  const pxp = round ? ox - 5 : px + 8, pyp = round ? oy + R - 12 : py + ph - 8;
  for (const dx of [0, 8]) { ctx.beginPath(); ctx.arc(pxp + dx, pyp, 2.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// The ice pack's panel in place of the circuit board: deep water under a frosted frame, soft
// aurora bands across it, a pale snowflake in the middle inside a thin ring of light and a dashed
// outer ring, frost sparkles around, and two coloured pips. A wide panel gets a small flake at each end.
function drawFrost(ctx: Ctx, px: number, py: number, pw: number, ph: number, seed: number, cpu: number, round = false) {
  const rnd = seeded(seed);
  const C = { edge: css(BOARD.edge), board: css(BOARD.board), ring: css(BOARD.trace), ice: css(BOARD.pad), pip: css(BOARD.chip) };
  const ox = px + pw / 2, oy = py + ph / 2, R = Math.min(pw, ph) / 2;
  ctx.save();
  if (round) {
    ctx.fillStyle = C.edge; ctx.beginPath(); ctx.arc(ox, oy, R + 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ox, oy, R, 0, Math.PI * 2); ctx.clip();
  } else {
    ctx.fillStyle = C.edge; ctx.fillRect(px - 4, py - 4, pw + 8, ph + 8);
    ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
  }
  ctx.fillStyle = C.board; ctx.fillRect(px - 4, py - 4, pw + 8, ph + 8);
  // Aurora: two soft bands, one in the ring's colour and one in the pips', drifting at a slight tilt.
  for (const [col, v, h] of [[C.ring, 0.3, 0.22], [C.pip, 0.66, 0.18]] as const) {
    const y = py + ph * v, g = ctx.createLinearGradient(0, y - ph * h, 0, y + ph * h);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, col); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save(); ctx.globalAlpha = 0.22; ctx.translate(ox, y); ctx.rotate(-0.08); ctx.translate(-ox, -y);
    ctx.fillStyle = g; ctx.fillRect(px - pw, y - ph * h, pw * 3, ph * h * 2); ctx.restore();
  }
  const r = cpu * 0.95;
  flake(ctx, ox, oy, r, C.ice, 2);
  ctx.strokeStyle = C.ring; ctx.lineWidth = 1.2; ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(ox, oy, r * 1.3, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(ox, oy, r * 1.55, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  if (pw / ph > 2.2) for (const f of [0.17, 0.83]) flake(ctx, px + pw * f, oy, r * 0.55, C.ice, 1.6);
  // Sparkles: small four-point stars away from the flake.
  ctx.strokeStyle = C.ice; ctx.lineWidth = 1; ctx.globalAlpha = 0.85;
  for (let i = 0, tries = 0; i < 12 && tries < 80; tries++) {
    const x = px + 6 + rnd() * (pw - 12), y = py + 6 + rnd() * (ph - 12), s = 2 + rnd() * 2.5;
    if (Math.hypot(x - ox, y - oy) < r * 1.9 || (round && Math.hypot(x - ox, y - oy) > R - 8)) continue;
    ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke();
    i++;
  }
  ctx.globalAlpha = 1;
  // Two pips in a corner, like the board's status lights.
  const pxp = round ? ox - 6 : px + 7, pyp = round ? oy + R - 14 : py + ph - 9;
  ctx.fillStyle = C.pip;
  for (const dx of [0, 7]) { ctx.beginPath(); ctx.roundRect(pxp + dx, pyp, 5, 2.8, 1.4); ctx.fill(); }
  ctx.restore();
}

// One CPU on a grey board, buses of parallel traces leaving its pins and bending at 45 degrees to
// end in vias, two status lights, all in greys. Traces never cross: everything drawn is stamped
// into a mask that later traces avoid.
function drawBoard(ctx: Ctx, px: number, py: number, pw: number, ph: number, seed: number, cpu: number, round = false) {
  const rnd = seeded(seed);
  const P = 6, TW = 2.2;
  const C = { edge: css(BOARD.edge), board: css(BOARD.board), trace: css(BOARD.trace), pad: css(BOARD.pad), hole: css(BOARD.hole), chip: css(BOARD.chip), chipTop: css(BOARD.chipTop), pin: css(BOARD.pad), silk: css(BOARD.pad) };
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
  ctx.fillStyle = C.edge; ctx.beginPath(); ctx.arc(x + 4.5, y + 4.5, 1.6, 0, Math.PI * 2); ctx.fill();
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
  ctx.fillStyle = css(BOARD.edge); ctx.fillRect(0, 0, W, H);
  circuitPanel(ctx, 8, 8, W - 16, H - 16, 7, 22, 2.6);
  const mk = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return mk(c);
}

// Bumper top: a round circuit board filling the square, its CPU in the middle; the corners are unused.
function bumperTopTexture(): THREE.Texture {
  const W = 256;
  const [c, ctx] = canvas2x(W, W);
  ctx.fillStyle = css(BOARD.edge); ctx.fillRect(0, 0, W, W);
  circuitPanel(ctx, 11, 11, W - 22, W - 22, 31, 26, 2.6, true);
  const mk = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return mk(c);
}

// Barrel side panel: a tall circuit board, its CPU sized for the narrow panel.
function barrelPanelTexture(): THREE.Texture {
  const W = 120, H = 200;
  const [c, ctx] = canvas2x(W, H);
  ctx.fillStyle = css(BOARD.edge); ctx.fillRect(0, 0, W, H);
  circuitPanel(ctx, 6, 6, W - 12, H - 12, 41, 18, 2.6);
  const mk = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return mk(c);
}

// Barrier: the circuit board edge to edge, and a louvred end grille.
function barrierTextures(): [THREE.Texture, THREE.Texture] {
  const W = 512, H = 140;
  const [c, ctx] = canvas2x(W, H);
  ctx.fillStyle = css(BOARD.edge); ctx.fillRect(0, 0, W, H);
  circuitPanel(ctx, 8, 8, W - 16, H - 16, 23, 24);
  const [gc, gctx] = canvas(128, 128);
  gctx.fillStyle = css(BARRIER.grille); gctx.fillRect(0, 0, 128, 128);
  gctx.fillStyle = css(BARRIER.louvre);
  for (let y = 10; y < 128; y += 14) gctx.fillRect(8, y, 112, 6);
  const mk = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return [mk(c), mk(gc)];
}

// Start pad: a plain white top with the cyan ring; a centre disc of concentric rings; a plain
// white side.
function padTextures(): [THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture] {
  const S = 512, c0 = S / 2, R = S / 2;
  const [top, t] = canvas(S, S);
  const [glow, g] = canvas(S, S);
  t.fillStyle = css(START_PAD.top); t.fillRect(0, 0, S, S);
  g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
  const ring = (ctx: CanvasRenderingContext2D, r0: number, r1: number, col: string) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c0, c0, R * r1, 0, Math.PI * 2); ctx.arc(c0, c0, R * r0, 0, Math.PI * 2, true); ctx.fill();
  };
  // Only the rim outside the bowl shows this texture: lay its bands out across that, 0 at the
  // bowl's edge and 1 at the pad's.
  const q = START_PAD_BOWL / START_PAD_R, rim = (f: number) => q + f * (1 - q);
  ring(t, rim(0.3), rim(0.55), css(PROPS.cyan));
  ring(g, rim(0.3), rim(0.55), css(PROPS.cyan));
  const [centre, cc] = canvas(S, S);
  cc.fillStyle = css(START_PAD.centre); cc.fillRect(0, 0, S, S);
  for (let i = 5; i >= 1; i--) {
    cc.fillStyle = css(i % 2 ? START_PAD.centreDark : START_PAD.centreLight);
    cc.beginPath(); cc.arc(c0, c0, R * (i / 5) * 0.96, 0, Math.PI * 2); cc.fill();
    cc.strokeStyle = css(START_PAD.groove); cc.lineWidth = 4; cc.stroke();
  }
  const [skirt, sk] = canvas(64, 64);
  sk.fillStyle = css(START_PAD.side); sk.fillRect(0, 0, 64, 64);
  const mk = (cv: HTMLCanvasElement) => { const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; return tx; };
  const sktx = mk(skirt); sktx.wrapS = THREE.RepeatWrapping; sktx.repeat.x = 2;
  return [mk(top), mk(glow), mk(centre), sktx];
}

// Crate face, on every face: a white plate crossed by a dark band with stepped ends and a dark stem
// up and down to a tab at each edge, a framed screen where they cross, and a green bracket glowing
// round each corner, right at the edge so it wraps the rounded corner.
function crateFaces(): [THREE.Texture, THREE.Texture] {
  if (ENV.style === "ice") return iceCrateFaces();
  if (ENV.style === "cute") return cuteCrateFaces();
  const S = 256;
  const [c, ctx] = canvas2x(S, S);
  const [e, ectx] = canvas2x(S, S);
  const box = (x0: number, y0: number, x1: number, y1: number, col: number) => { ctx.fillStyle = css(col); ctx.fillRect(x0, y0, x1 - x0, y1 - y0); };
  box(0, 0, S, S, CRATE.body);
  // The cross: a stem top to bottom, a band across with thinner ends, and a tab at each end of the stem.
  box(106, 40, 150, 216, CRATE.cross);
  box(70, 98, 186, 158, CRATE.cross);
  box(34, 110, 70, 146, CRATE.cross);
  box(186, 110, 222, 146, CRATE.cross);
  for (const y of [28, 196]) { box(94, y, 162, y + 32, CRATE.cross); box(110, y + 9, 146, y + 23, CRATE.body); }
  // An "=" at each end of the band, and a mark on the stem above and below the screen.
  for (const x of [42, 196]) for (const y of [119, 131]) box(x, y, x + 18, y + 5, CRATE.body);
  for (const y of [70, 178]) box(122, y, 134, y + 8, CRATE.body);
  // The screen, framed by the cross, with a pale line along its top.
  box(84, 92, 172, 164, CRATE.cross);
  box(92, 100, 164, 156, CRATE.screen);
  box(96, 104, 160, 107, CRATE.shine);
  ectx.fillStyle = "#000";
  ectx.fillRect(0, 0, S, S);
  const arm = 66, t = 18;
  for (const target of [ctx, ectx]) {
    target.fillStyle = css(CRATE.light);
    for (const [x, y] of [[0, 0], [S - arm, 0], [0, S - t], [S - arm, S - t]] as const) target.fillRect(x, y, arm, t);
    for (const [x, y] of [[0, 0], [S - t, 0], [0, S - arm], [S - t, S - arm]] as const) target.fillRect(x, y, t, arm);
  }
  const mk = (cv: HTMLCanvasElement) => { const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; return tx; };
  return [mk(c), mk(e)];
}

// Ice crate face: a block of ice with a deep frozen window in its middle (lighter toward the top,
// as if lit from above), a snowflake frozen inside, cracks running out of the window's corners,
// and a glowing rounded bracket on each corner.
function iceCrateFaces(): [THREE.Texture, THREE.Texture] {
  const S = 256;
  const [c, ctx] = canvas2x(S, S);
  const [e, ectx] = canvas2x(S, S);
  const rnd = seeded(29);
  ctx.fillStyle = css(CRATE.body); ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = css(shade(CRATE.body, rnd() < 0.5 ? 0.95 : 1.04)); ctx.globalAlpha = 0.3 + rnd() * 0.3;
    const x = rnd() * S, y = rnd() * S; ctx.fillRect(x, y, 3 + rnd() * 10, 20 + rnd() * 60);
  }
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(0, 48, 0, 208);
  g.addColorStop(0, css(shade(CRATE.cross, 1.5))); g.addColorStop(1, css(shade(CRATE.cross, 0.85)));
  ctx.fillStyle = css(CRATE.screen); ctx.beginPath(); ctx.roundRect(42, 42, 172, 172, 22); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(48, 48, 160, 160, 18); ctx.fill();
  flake(ctx, S / 2, S / 2, 58, css(CRATE.shine), 3.2);
  ctx.strokeStyle = css(CRATE.screen); ctx.lineWidth = 1.6; ctx.lineCap = "round"; ctx.globalAlpha = 0.9;
  for (const [x, y] of [[48, 48], [208, 48], [48, 208], [208, 208]] as const) {
    const dx = x < S / 2 ? -1 : 1, dy = y < S / 2 ? -1 : 1;
    ctx.beginPath(); ctx.moveTo(x, y);
    let px = x, py = y;
    for (let k = 0; k < 3; k++) { px += dx * (6 + rnd() * 10); py += dy * (4 + rnd() * 10); ctx.lineTo(px, py); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ectx.fillStyle = "#000"; ectx.fillRect(0, 0, S, S);
  const arm = 60, t = 16;
  for (const target of [ctx, ectx]) {
    target.fillStyle = css(CRATE.light);
    for (const [x, y] of [[0, 0], [S - arm, 0], [0, S - t], [S - arm, S - t]] as const) { target.beginPath(); target.roundRect(x, y, arm, t, 6); target.fill(); }
    for (const [x, y] of [[0, 0], [S - t, 0], [0, S - arm], [S - t, S - arm]] as const) { target.beginPath(); target.roundRect(x, y, t, arm, 6); target.fill(); }
  }
  const mk = (cv: HTMLCanvasElement) => { const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; return tx; };
  return [mk(c), mk(e)];
}

// Cute crate face: a macaron: a pastel body, a big rounded plate with a kawaii face, polka dots
// round it, and fat rounded glowing brackets on the corners.
function cuteCrateFaces(): [THREE.Texture, THREE.Texture] {
  const S = 256;
  const [c, ctx] = canvas2x(S, S);
  const [e, ectx] = canvas2x(S, S);
  const rnd = seeded(37);
  ctx.fillStyle = css(CRATE.body); ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = css(CRATE.screen); ctx.globalAlpha = 0.9;
  for (let i = 0; i < 14; i++) { const x = rnd() * S, y = rnd() * S; if (Math.hypot(x - S / 2, y - S / 2) > 112) { ctx.beginPath(); ctx.arc(x, y, 5 + rnd() * 5, 0, Math.PI * 2); ctx.fill(); } }
  ctx.globalAlpha = 1;
  ctx.fillStyle = css(CRATE.cross); ctx.beginPath(); ctx.roundRect(44, 44, 168, 168, 54); ctx.fill();
  ctx.fillStyle = css(CRATE.shine); ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.roundRect(56, 54, 144, 60, 30); ctx.fill(); ctx.globalAlpha = 1;
  kawaii(ctx, S / 2, S / 2 + 6, 62, css(CRATE.screen), css(CRATE.light), css(CRATE.shine));
  ectx.fillStyle = "#000"; ectx.fillRect(0, 0, S, S);
  const arm = 56, t = 18;
  for (const target of [ctx, ectx]) {
    target.fillStyle = css(CRATE.light);
    for (const [x, y] of [[0, 0], [S - arm, 0], [0, S - t], [S - arm, S - t]] as const) { target.beginPath(); target.roundRect(x, y, arm, t, 9); target.fill(); }
    for (const [x, y] of [[0, 0], [S - t, 0], [0, S - arm], [S - t, S - arm]] as const) { target.beginPath(); target.roundRect(x, y, t, arm, 9); target.fill(); }
  }
  const mk = (cv: HTMLCanvasElement) => { const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; return tx; };
  return [mk(c), mk(e)];
}

// Cube faces, one square each: slate, with an octagon in the middle, a plate inside a green glowing
// border of three dashes a side (a pale plate, on every face) or one solid line (a white plate, on
// the top). Each with its glow map.
function cubeFaces(): [THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture] {
  const S = 256, R = 76, PLATE = 62, LINE = 7, side = 2 * R * Math.sin(Math.PI / 8), gap = side / 9, dash = (side - 3 * gap) / 3;
  const mk = (cv: HTMLCanvasElement) => { const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; return tx; };
  const oct = (t: CanvasRenderingContext2D, r: number) => {
    t.beginPath();
    for (let k = 0; k < 8; k++) { const a = ((k + 0.5) * Math.PI) / 4; t.lineTo(S / 2 + r * Math.cos(a), S / 2 + r * Math.sin(a)); }
    t.closePath();
  };
  const face = (plate: number, dashed: boolean): [THREE.Texture, THREE.Texture] => {
    const [c, ctx] = canvas2x(S, S), [e, ectx] = canvas2x(S, S);
    ctx.fillStyle = css(CUBE.body); ctx.fillRect(0, 0, S, S);
    ectx.fillStyle = "#000"; ectx.fillRect(0, 0, S, S);
    ctx.fillStyle = css(plate); oct(ctx, PLATE); ctx.fill();
    for (const t of [ctx, ectx]) {
      t.strokeStyle = css(CUBE.glow); t.lineWidth = LINE;
      // The pattern starts half a gap in, so every corner falls in a gap.
      t.setLineDash(dashed ? [dash, gap] : []); t.lineDashOffset = dash + gap / 2;
      oct(t, R); t.stroke();
    }
    return [mk(c), mk(e)];
  };
  return [...face(CUBE.plate, true), ...face(CUBE.top, false)];
}

// Ice pillar wrap: a frozen column of vertical frost streaks and trapped bubbles, two deep-water
// bands each with a hairline of light, and a snowflake stamped on the body between them.
function icePillar(ctx: Ctx, PW: number, PH: number) {
  const rnd = seeded(17);
  ctx.fillStyle = css(PILLAR.white); ctx.fillRect(0, 0, PW, PH);
  for (let i = 0; i < 46; i++) {
    const x = rnd() * PW, w = 2 + rnd() * 12, y0 = rnd() * PH * 0.6, h = PH * (0.3 + rnd() * 0.7);
    ctx.fillStyle = css(shade(PILLAR.white, rnd() < 0.5 ? 0.94 : 1.04)); ctx.globalAlpha = 0.35 + rnd() * 0.4;
    ctx.fillRect(x, y0, w, h);
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 28; i++) {
    const x = rnd() * PW, y = rnd() * PH, r = 1.5 + rnd() * 4;
    ctx.fillStyle = css(shade(PILLAR.white, 0.9)); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = css(shade(PILLAR.white, 1.08)); ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
  }
  for (const y of [22, 164]) {
    ctx.fillStyle = css(PILLAR.slate); ctx.fillRect(0, y, PW, 22);
    ctx.fillStyle = css(PROPS.cyan); ctx.fillRect(0, y + 9.5, PW, 3);
  }
  for (let k = 0; k < 3; k++) flake(ctx, (k + 0.5) * (PW / 3), 104, 30, css(PILLAR.slate), 2.4);
}

// Cute pillar wrap: soft diagonal candy stripes, two fat pastel bands each with a rounded light
// line, and a row of hearts between them.
function cutePillar(ctx: Ctx, PW: number, PH: number) {
  ctx.fillStyle = css(PILLAR.white); ctx.fillRect(0, 0, PW, PH);
  ctx.fillStyle = css(PILLAR.pale);
  const n = 8, w = PW / n;
  for (let k = 0; k < n; k++) {
    ctx.beginPath(); ctx.moveTo(k * w, PH); ctx.lineTo(k * w + w * 0.5, PH); ctx.lineTo(k * w + w * 0.5 + PH * 0.35, 0); ctx.lineTo(k * w + PH * 0.35, 0); ctx.closePath(); ctx.fill();
  }
  // The stripes wrap: the ones that run off the right come back in on the left.
  for (let k = 0; k < 2; k++) {
    ctx.beginPath(); ctx.moveTo(k * w - PW, PH); ctx.lineTo(k * w + w * 0.5 - PW, PH); ctx.lineTo(k * w + w * 0.5 + PH * 0.35 - PW, 0); ctx.lineTo(k * w + PH * 0.35 - PW, 0); ctx.closePath(); ctx.fill();
  }
  for (const y of [18, 162]) {
    ctx.fillStyle = css(PILLAR.slate); ctx.beginPath(); ctx.roundRect(-10, y, PW + 20, 30, 10); ctx.fill();
    ctx.fillStyle = css(PROPS.cyan); ctx.beginPath(); ctx.roundRect(-10, y + 11, PW + 20, 8, 4); ctx.fill();
  }
  for (let k = 0; k < 6; k++) heart(ctx, (k + 0.5) * (PW / 6), 106, 13, css(PILLAR.slate));
}

// Goal base: dark disc with light spokes and a hub.
function goalDisc(): THREE.Texture {
  const S = 256;
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = css(GOAL.disc);
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = css(GOAL.spokes);
  ctx.lineWidth = 3;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(S / 2, S / 2); ctx.lineTo(S / 2 + Math.cos(a) * S * 0.46, S / 2 + Math.sin(a) * S * 0.46); ctx.stroke();
  }
  ctx.fillStyle = css(GOAL.hub);
  ctx.beginPath(); ctx.arc(S / 2, S / 2, 10, 0, Math.PI * 2); ctx.fill();
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}

// Bean wrap: u once round, v from tip to tip along its length, drawn to the bean's own size so the
// pattern never stretches: light grey caps; at each end of the straight part a red stripe, a white
// band and a red stripe; between them the dark body dotted white in staggered rows that go round
// evenly, so the wrap has no seam. One texture per size.
const BEAN_PX = 160, BEAN_DOT = 0.055, BEAN_ROW = 0.22, BEAN_COL = 0.3;
const beanWraps = new Map<string, THREE.Texture>();
export function beanTexture(r: number, len: number): THREE.Texture {
  const key = `${r},${len}`, hit = beanWraps.get(key);
  if (hit) return hit;
  const circ = 2 * Math.PI * r, W = Math.max(8, Math.round(BEAN_PX * circ)), H = Math.max(8, Math.round(BEAN_PX * len));
  const [c, ctx] = canvas2x(W, H);
  const px = (u: number) => u * BEAN_PX;
  // A band `a` to `b` along the axis from each tip, mirrored about the middle.
  const band = (a: number, b: number, color: number) => {
    ctx.fillStyle = css(color);
    ctx.fillRect(0, px(a), W, px(b) - px(a));
    ctx.fillRect(0, px(len - b), W, px(b) - px(a));
  };
  const in0 = r + 0.17;
  band(0, len / 2, BEAN.cap);
  band(in0, len / 2, BEAN.body);
  band(r - 0.05, r, BEAN.stripe);
  band(r, r + 0.12, BEAN.band);
  band(r + 0.12, in0, BEAN.stripe);
  // Dots: rows centred on the middle, columns an even share of the way round, every other row
  // shifted half a column, each dot drawn again a turn either side so one crossing the seam joins up.
  const cols = Math.max(4, Math.round(circ / BEAN_COL)), colW = circ / cols, mid = len / 2;
  const rows = Math.max(1, Math.floor((len - 2 * in0 - 2 * BEAN_DOT) / BEAN_ROW));
  ctx.fillStyle = css(BEAN.dot);
  for (let i = 0; i < rows; i++) {
    const y = mid + (i - (rows - 1) / 2) * BEAN_ROW, off = i % 2 ? colW / 2 : 0;
    for (let j = 0; j < cols; j++) for (const turn of [-circ, 0, circ]) {
      ctx.beginPath();
      ctx.arc(px(j * colW + off + turn), px(y), px(BEAN_DOT), 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = THREE.RepeatWrapping;
  beanWraps.set(key, t);
  return t;
}

// Blockade side: a motherboard plate between two stacks of cyan light bars, which
// also go into an emissive map so they glow. Pillar: three tiers of vertical slats.
// Magnet aura: red, strongest at the magnet's foot and fading out to nothing at its reach (the edge).
export function magnetAuraTexture(): THREE.Texture {
  const W = 256, [c, ctx] = canvas(W, W), g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2), r0 = MAGNET_R / MAGNET_REACH;
  const rgb = [EFFECTS.magnetAura >> 16, (EFFECTS.magnetAura >> 8) & 255, EFFECTS.magnetAura & 255].join(",");
  g.addColorStop(0, `rgba(${rgb},0.55)`);
  for (let k = 0; k <= 8; k++) { const t = k / 8; g.addColorStop(r0 + (1 - r0) * t, `rgba(${rgb},${(0.55 * (1 - t) ** 2).toFixed(3)})`); }
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
  ctx.fillStyle = css(PROPS.white);
  ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = "#000";
  ectx.fillRect(0, 0, W, H);
  for (const x0 of [22, W - 62]) {
    ctx.fillStyle = css(BLOCKADE.plate);
    ctx.fillRect(x0 - 6, 18, 52, H - 36);
    for (let k = 0; k < 5; k++) {
      const y = 26 + k * 33.5;
      for (const t of [ctx, ectx]) {
        t.fillStyle = css(PROPS.cyan);
        t.beginPath();
        t.roundRect(x0, y, 40, 22, 6);
        t.fill();
      }
    }
  }
  circuitPanel(ctx, 96, 26, W - 192, H - 52, 11, 18);

  // Pillar wrap (u runs once around, top of the body at the top): three tiers of twelve slats, the
  // white between slats wider than the slats; a cyan band split by a white line above each tier;
  // a white foot under the last, above the base ring.
  const PW = 384, PH = 256, SLATS = 12, BAND = 16, GAP = 6, TIER = 54;
  const [pc, pctx] = canvas(PW, PH);
  pctx.fillStyle = css(PILLAR.white);
  pctx.fillRect(0, 0, PW, PH);
  const period = PW / SLATS;
  if (ENV.style === "ice") icePillar(pctx, PW, PH);
  else if (ENV.style === "cute") cutePillar(pctx, PW, PH);
  else for (let t = 0; t < 3; t++) {
    const b = t * (BAND + GAP + TIER + GAP), y0 = b + BAND + GAP;
    pctx.fillStyle = css(PROPS.cyan);
    pctx.fillRect(0, b, PW, BAND);
    pctx.fillStyle = css(PILLAR.white);
    pctx.fillRect(0, b + BAND / 2 - 2, PW, 4);
    pctx.fillStyle = css(PILLAR.slate);
    for (let k = 0; k < SLATS; k++) pctx.fillRect(Math.round(k * period + period * 0.31), y0, Math.round(period * 0.38), TIER);
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
  const [cubeFace, cubeFaceGlow, cubeTop, cubeTopGlow] = cubeFaces();
  return { panel: mk(c), panelGlow: mk(e), pillar, crate, crateGlow, goalDisc: goalDisc(), padTop, padGlow, padCentre, padSkirt, barrierPanel, grille, stoolTop, bumperTop, barrelPanel, cubeFace, cubeFaceGlow, cubeTop, cubeTopGlow };
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
  grad.addColorStop(0, css(EFFECTS.ball.light));
  grad.addColorStop(0.5, css(EFFECTS.ball.mid));
  grad.addColorStop(1, css(EFFECTS.ball.dark));
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
  if (EFFECTS.ball.chrome) {
    // A plain polished ball: one colour, mirror-smooth, no lines or lights.
    ctx.fillStyle = css(EFFECTS.ball.mid); ctx.fillRect(0, 0, W, H);
    rctx.fillStyle = "#141414"; rctx.fillRect(0, 0, W, H);
  } else {
    stroke(ctx, css(EFFECTS.ball.bevel), 26, []);
    stroke(ctx, css(EFFECTS.ball.groove), 14, []);
    stroke(ctx, css(EFFECTS.ball.dash), 6, [150, 90]);
    stroke(ectx, css(PROPS.cyan), 6, [150, 90]);
    stroke(rctx, "#aaaaaa", 14, []);
  }

  const mk = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: mk(c, true), emissive: mk(e, true), roughness: mk(r, false) };
}
