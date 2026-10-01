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
