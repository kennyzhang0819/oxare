import * as THREE from "three";
import { PIECE_TYPES, newPiece, type PieceType } from "./level.ts";
import { SUN_OFFSET, buildLevel } from "./scene.ts";

const W = 112, H = 84;
let cache: Map<PieceType, string> | null = null;

// One picture per piece type for the editor's add buttons, rendered once from the real
// piece builders so the buttons always show what the piece currently looks like.
export function pieceThumbs(renderer: THREE.WebGLRenderer): Map<PieceType, string> {
  if (cache) return cache;
  cache = new Map();
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd6e6f5);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7ea0c8, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.copy(SUN_OFFSET);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 500);
  const pixels = new Uint8Array(W * H * 4);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const prevTarget = renderer.getRenderTarget();

  for (const type of PIECE_TYPES) {
    const built = buildLevel({ id: "thumb", name: "thumb", pieces: [newPiece(type, 0, 0, 0)] }, true);
    scene.add(built.group);
    const box = new THREE.Box3().setFromObject(built.group);
    if (type === "goal") box.max.y = Math.min(box.max.y, 2.5); // frame the disc, not the whole beam
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.8, box.getSize(new THREE.Vector3()).length() / 2);
    camera.position.copy(center).add(new THREE.Vector3(1, 0.75, 1.15).normalize().multiplyScalar(radius * 2.9));
    camera.lookAt(center);
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
  return cache;
}
