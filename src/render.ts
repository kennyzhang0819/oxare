// Dev-only still-image harness: builds src/showcase.json in the real scene and exposes window.shoot
// for a headless browser to frame a camera and read the canvas. Not part of the game.
import * as THREE from "three";
import type { Level } from "./level.ts";
import { buildLevel, createScene, fitSun, initMaterials, makeBall } from "./scene.ts";
import showcase from "./showcase.json";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
initMaterials(renderer);
const env = createScene();
const built = buildLevel(showcase as Level, false);
const ball = makeBall();
env.scene.add(built.group, ball.mesh);
fitSun(env.sun, built);
const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 500);

interface Shot { w: number; h: number; pos: [number, number, number]; look: [number, number, number]; fov?: number; ball?: [number, number, number] }
(window as unknown as { shoot: (s: Shot) => boolean }).shoot = (s) => {
  renderer.setSize(s.w, s.h, false);
  camera.aspect = s.w / s.h;
  camera.fov = s.fov ?? 50;
  camera.updateProjectionMatrix();
  camera.position.set(...s.pos);
  camera.lookAt(...s.look);
  if (s.ball) ball.mesh.position.set(...s.ball); else ball.mesh.position.set(0, -100, 0);
  renderer.shadowMap.needsUpdate = true;
  ball.reflect(renderer, env);
  ball.reflect(renderer, env);
  env.render(renderer, camera);
  return true;
};
(window as unknown as { ready: boolean }).ready = true;
