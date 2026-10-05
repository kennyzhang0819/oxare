// Dev-only still-image harness: builds src/showcase.json in the real scene and exposes window.shoot
// for a headless browser to frame a camera and read the canvas. Not part of the game.
import * as THREE from "three";
import type { Level } from "./level.ts";
import { buildLevel, createScene, fitSun, hideHullsAround, initMaterials, unfadeAll } from "./scene.ts";
import { makeHedgehog } from "./hedgehog.ts";
import { NEAR_ON } from "./fade.ts";
import showcase from "./showcase.json";
import { LEVELS } from "./levels/index.ts";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
initMaterials(renderer);
const env = createScene();
// `?level=<id>` builds that level in place of the showcase.
const pick = new URLSearchParams(location.search).get("level");
const built = buildLevel(LEVELS.find((l) => l.id === pick) ?? (showcase as Level), false);
const ball = makeHedgehog();
env.scene.add(built.group, ball.mesh);
fitSun(env.sun, built);
const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 500);

// `play` draws it as the game's own view does: props and plants near the camera see-through.
interface Shot { w: number; h: number; pos: [number, number, number]; look: [number, number, number]; fov?: number; ball?: [number, number, number]; play?: boolean }
(window as unknown as { shoot: (s: Shot) => boolean }).shoot = (s) => {
  renderer.setSize(s.w, s.h, false);
  camera.aspect = s.w / s.h;
  camera.fov = s.fov ?? 50;
  camera.updateProjectionMatrix();
  camera.position.set(...s.pos);
  camera.lookAt(...s.look);
  if (s.ball) ball.mesh.position.set(...s.ball); else ball.mesh.position.set(0, -100, 0);
  renderer.shadowMap.needsUpdate = true;
  ball.update(0, { rot: { x: 0, y: 0, z: 0, w: 1 }, spin: 0, rise: 0, push: false, eye: camera.position });
  camera.updateMatrixWorld();
  unfadeAll(built);
  if (s.play) {
    built.group.updateMatrixWorld(true);
    hideHullsAround(built, camera.position);
    NEAR_ON.value = 1;
  }
  env.render(renderer, camera);
  NEAR_ON.value = 0;
  return true;
};
(window as unknown as { ready: boolean; built: unknown; showcase: unknown }).built = built;
(window as unknown as { showcase: unknown }).showcase = showcase;
(window as unknown as { ready: boolean }).ready = true;
