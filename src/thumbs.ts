import * as THREE from "three";
import { PIECE_TYPES, PIECE_VARIANTS, magnetProfile, newPiece, type Level, type Piece, type PieceType } from "./level.ts";
import { addLights, buildLevel, fitSun } from "./scene.ts";
import { ENV } from "./palette.ts";

// Behind a picture: the game's mist, its light top fading to its sea-green bottom (or `sky` where
// a theme has no mist), so a card looks like the level does in play.
let MIST: THREE.CanvasTexture | null = null;
function backdrop(sky: number): THREE.Color | THREE.Texture {
  if (!ENV.mist) return new THREE.Color(sky);
  if (!MIST) {
    const c = document.createElement("canvas"), g = c.getContext("2d")!, grad = g.createLinearGradient(0, 0, 0, 64);
    c.width = 2; c.height = 64;
    grad.addColorStop(0, `#${ENV.mistTop.toString(16).padStart(6, "0")}`);
    grad.addColorStop(1, `#${ENV.mistBottom.toString(16).padStart(6, "0")}`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 64);
    MIST = new THREE.CanvasTexture(c);
    MIST.colorSpace = THREE.SRGBColorSpace;
  }
  return MIST;
}

const W = 112, H = 84;
let cache: Map<string, string> | null = null;

// One picture per piece type and variant (by name) for the editor's add buttons, rendered once
// from the real piece builders so the buttons always show what the piece currently looks like.
export function pieceThumbs(renderer: THREE.WebGLRenderer): Map<string, string> {
  if (cache) return cache;
  cache = new Map();
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  const scene = new THREE.Scene();
  scene.background = backdrop(0xd6e6f5);
  const sun = addLights(scene);
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 500);
  const pixels = new Uint8Array(W * H * 4);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const prevTarget = renderer.getRenderTarget();

  const entries: [string, Piece][] = [...PIECE_TYPES.map((t): [string, Piece] => [t, newPiece(t, 0, 0, 0)]), ...PIECE_VARIANTS.map((v): [string, Piece] => [v.name, v.make(0, 0, 0)])];
  for (const [type, piece] of entries) {
    // Movers' track guides would be most of the picture; those thumbs show the object alone.
    const built = buildLevel({ id: "thumb", name: "thumb", pieces: [piece] }, !["bean", "stool", "sliding kicker"].includes(type));
    scene.add(built.group);
    const box = new THREE.Box3().setFromObject(built.group);
    if (type === "magnet") { const r = Math.max(...magnetProfile().flat().map((v) => v[0])); box.min.x = box.min.z = -r; box.max.x = box.max.z = r; } // frame the body, not its aura
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.8, box.getSize(new THREE.Vector3()).length() / 2);
    camera.position.copy(center).add(new THREE.Vector3(1, 0.75, 1.15).normalize().multiplyScalar(radius * 2.9));
    camera.lookAt(center);
    fitSun(sun, built);
    // The play view may have paused shadow updates; this picture needs its own.
    renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, pixels);
    // GL rows run bottom-up; flip into the canvas.
    for (let y = 0; y < H; y++) img.data.set(pixels.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    ctx.putImageData(img, 0, 0);
    cache.set(type, canvas.toDataURL());
    scene.remove(built.group);
  }
  renderer.setRenderTarget(prevTarget);
  rt.dispose();
  sun.dispose();
  return cache;
}

const LW = 360, LH = 225;
const FEATURED: PieceType[] = ["gate", "tube", "rails", "bean", "seesaw", "jump", "ramp", "plank", "bridge", "kicker", "spinner", "crate", "curve"];
const levelCache = new Map<string, string>();

// Menu card pictures are saved as files in public/thumbs/<id>.png, with index.json naming, for each
// level, the thumbKey its picture was taken from (and, after a dot, when) (dev: the editor's Save and the admin panel's
// Rebuild thumbnails write them). A card uses its file while the key still matches, and renders the
// level live (levelThumb) when the file is missing or the level has changed since.
let saved: Record<string, string> = {};
export async function loadThumbIndex(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}thumbs/index.json`, { cache: "no-store" });
    if (res.ok) saved = (await res.json()) as Record<string, string>;
  } catch { /* no saved pictures: every card renders live */ }
}
// What a level's picture depends on: its pieces and framing, not its name or visibility.
export function thumbKey(level: Level): string {
  const s = JSON.stringify({ thumb: level.thumb ?? null, ...(level.floor ? { floor: level.floor } : {}), pieces: level.pieces });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, "0");
}
export function levelThumbSrc(renderer: THREE.WebGLRenderer, level: Level): string {
  const key = thumbKey(level), have = saved[level.id];
  return have?.split(".")[0] === key ? `${import.meta.env.BASE_URL}thumbs/${level.id}.png?v=${have}` : levelThumb(renderer, level);
}
// Renders the level's picture and saves it through the dev server.
export async function saveThumb(renderer: THREE.WebGLRenderer, level: Level): Promise<void> {
  const key = thumbKey(level);
  const res = await fetch("/__thumb/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: level.id, key, png: levelThumb(renderer, level) }) });
  if (!res.ok) throw new Error(await res.text() || `${res.status} ${res.statusText}`);
  saved[level.id] = `${key}.${Date.now().toString(36)}`;
}

// A card picture rendered live: the level's own `thumb` frame if it has one, else a close shot of
// its most telling piece, first match in FEATURED.
export function levelThumb(renderer: THREE.WebGLRenderer, level: Level): string {
  const key = JSON.stringify(level);
  const hit = levelCache.get(key);
  if (hit) return hit;
  const rt = new THREE.WebGLRenderTarget(LW, LH, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  const scene = new THREE.Scene();
  scene.background = backdrop(0x9cc8f2);
  const sun = addLights(scene);
  const built = buildLevel(level, false);
  scene.add(built.group);
  fitSun(sun, built);
  let center: THREE.Vector3, radius: number;
  if (level.thumb) {
    center = new THREE.Vector3(level.thumb.x, level.thumb.y, level.thumb.z);
    radius = level.thumb.r;
  } else {
    const i = FEATURED.reduce((found, type) => found >= 0 ? found : level.pieces.findIndex((p) => p.type === type), -1);
    const box = new THREE.Box3().setFromObject(i >= 0 ? built.pieceGroups[i]! : built.group);
    box.max.y = Math.min(box.max.y, box.min.y + 6); // a tall piece would otherwise set the framing
    center = box.getCenter(new THREE.Vector3());
    radius = Math.max(3.5, box.getSize(new THREE.Vector3()).length() / 2);
  }
  const camera = new THREE.PerspectiveCamera(40, LW / LH, 0.1, 2000);
  const view = new THREE.Vector3(0.55, 0.75, 1).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), ((level.thumb?.yaw ?? 0) * Math.PI) / 180);
  camera.position.copy(center).add(view.multiplyScalar(radius * 2.1));
  camera.lookAt(center);
  const prevTarget = renderer.getRenderTarget();
  renderer.shadowMap.needsUpdate = true;
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  const pixels = new Uint8Array(LW * LH * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, LW, LH, pixels);
  renderer.setRenderTarget(prevTarget);
  rt.dispose();
  sun.dispose();
  // The level was built only for this picture: free its geometry (materials are shared).
  built.group.traverse((o) => { if (o instanceof THREE.Mesh || o instanceof THREE.Line) o.geometry.dispose(); });
  const canvas = document.createElement("canvas");
  canvas.width = LW; canvas.height = LH;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(LW, LH);
  for (let y = 0; y < LH; y++) img.data.set(pixels.subarray((LH - 1 - y) * LW * 4, (LH - y) * LW * 4), y * LW * 4);
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL();
  levelCache.set(key, url);
  return url;
}
