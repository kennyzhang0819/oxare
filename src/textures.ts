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
  barrierPanel: THREE.Texture; barrierGlow: THREE.Texture; grille: THREE.Texture;
}

// The grey circuit panel every obstacle carries: a darker frame, grey face, pale traces and bits.
function circuitPanel(ctx: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, seed: number) {
  ctx.fillStyle = "#6f7a85";
  ctx.fillRect(px - 4, py - 4, pw + 8, ph + 8);
  ctx.fillStyle = "#8d979f";
  ctx.fillRect(px, py, pw, ph);
  const rnd = seeded(seed);
  ctx.strokeStyle = "#b4bdc5";
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    let x = px + 10 + rnd() * (pw - 20), y = py + 10 + rnd() * (ph - 20);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      if (k % 2 === 0) x = Math.min(px + pw - 8, Math.max(px + 8, x + (rnd() - 0.5) * 120));
      else y = Math.min(py + ph - 8, Math.max(py + 8, y + (rnd() - 0.5) * 70));
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 26; i++) {
    const x = px + 8 + rnd() * (pw - 24), y = py + 8 + rnd() * (ph - 24), s = 5 + rnd() * 10;
    ctx.fillStyle = rnd() < 0.5 ? "#dfe5ea" : "#525c66";
    if (rnd() < 0.5) ctx.fillRect(x, y, s, s);
    else { ctx.beginPath(); ctx.arc(x, y, s / 2, 0, Math.PI * 2); ctx.fill(); }
  }
}

// Barrier: the shared grey circuit panel edge to edge, and a louvred end grille.
function barrierTextures(): [THREE.Texture, THREE.Texture, THREE.Texture] {
  const W = 512, H = 192;
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  ctx.fillStyle = "#6f7a85"; ctx.fillRect(0, 0, W, H);
  circuitPanel(ctx, 10, 10, W - 20, H - 20, 23);
  ectx.fillStyle = "#000"; ectx.fillRect(0, 0, W, H);
  for (const [x, y] of [[40, H - 36], [W - 44, 36]] as const) {
    for (const t of [ctx, ectx]) { t.fillStyle = "#2fe6ff"; t.beginPath(); t.arc(x, y, 6, 0, Math.PI * 2); t.fill(); }
  }
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

// Blockade side: a grey circuit plate between two stacks of cyan light bars, which
// also go into an emissive map so they glow. Pillar: three tiers of vertical slats.
export function structTextures(): StructMaps {
  const W = 512, H = 256;
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  ctx.fillStyle = "#e9eef3";
  ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = "#000";
  ectx.fillRect(0, 0, W, H);
  for (const x0 of [22, W - 62]) {
    ctx.fillStyle = "#c9d2da";
    ctx.fillRect(x0 - 6, 18, 52, H - 36);
    for (let k = 0; k < 5; k++) {
      const y = 30 + k * 42;
      for (const t of [ctx, ectx]) {
        t.fillStyle = "#2fe6ff";
        t.beginPath();
        t.roundRect(x0, y, 40, 22, 6);
        t.fill();
      }
    }
  }
  circuitPanel(ctx, 96, 30, W - 192, H - 60, 11);

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
  return { panel: mk(c), panelGlow: mk(e), pillar, crate, crateGlow, goalDisc: goalDisc(), padTop, padGlow, padCentre, padSkirt, barrierPanel, barrierGlow, grille };
}

export interface BallMaps { map: THREE.Texture; emissive: THREE.Texture; roughness: THREE.Texture }

// Deep blue metal split into eight panels by great-circle seams: a dark groove with a
// bright bevel on each side, and cyan light dashes running inside the groove.
export function ballTextures(): BallMaps {
  const W = 1024, H = 512;
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  const [r, rctx] = canvas(W, H);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#2c5fd6");
  grad.addColorStop(0.5, "#1d46b4");
  grad.addColorStop(1, "#163a93");
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
  stroke(ctx, "#4d82ea", 26, []);
  stroke(ctx, "#0a1d55", 14, []);
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
