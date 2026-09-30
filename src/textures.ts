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
    const l = 86 + rnd() * 5;
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

export function ballTextures(): { map: THREE.Texture; emissive: THREE.Texture } {
  const W = 1024, H = 512;
  const [c, ctx] = canvas(W, H);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#2559c4");
  grad.addColorStop(0.5, "#123a9c");
  grad.addColorStop(1, "#0b2668");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  const rnd = seeded(3);
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W, y = rnd() * H, r = 40 + rnd() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(120,170,240,${0.08 + rnd() * 0.12})`);
    g.addColorStop(1, "rgba(150,200,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const [e, ectx] = canvas(W, H);
  ectx.fillStyle = "#000";
  ectx.fillRect(0, 0, W, H);
  const seams = (target: CanvasRenderingContext2D, color: string, width: number) => {
    target.strokeStyle = color;
    target.lineWidth = width;
    target.lineCap = "round";
    target.setLineDash([260, 70]);
    const tilt = Math.atan(Math.SQRT2);
    for (let k = 0; k < 3; k++) {
      const phase = (k * 2 * Math.PI) / 3;
      target.lineDashOffset = k * 110;
      for (let wrap = -1; wrap <= 1; wrap++) {
        target.beginPath();
        for (let i = 0; i <= 256; i++) {
          const lon = (i / 256) * 2 * Math.PI;
          const lat = Math.atan(Math.tan(tilt) * Math.sin(lon - phase));
          const x = ((lon + wrap * 2 * Math.PI) / (2 * Math.PI)) * W + W / 2;
          const y = (0.5 - lat / Math.PI) * H;
          if (i === 0) target.moveTo(x, y); else target.lineTo(x, y);
        }
        target.stroke();
      }
    }
  };
  seams(ctx, "#4fd8ec", 10);
  seams(ectx, "#2ee8ff", 10);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissive = new THREE.CanvasTexture(e);
  emissive.colorSpace = THREE.SRGBColorSpace;
  return { map, emissive };
}
