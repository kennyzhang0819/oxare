import * as THREE from "three";
import { BALL_RADIUS, STEP, createSim } from "./sim";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec5ff);
scene.fog = new THREE.Fog(0xdfefff, 20, 60);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xffffff, 0x6a8fbf, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(5, 10, 3);
scene.add(sun);

scene.add(
  new THREE.Mesh(
    new THREE.BoxGeometry(12, 1, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8dde3, flatShading: true }),
  ).translateY(-0.5),
);
const ballMesh = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_RADIUS, 32, 16),
  new THREE.MeshStandardMaterial({ color: 0xff6b3d, flatShading: true }),
);
scene.add(ballMesh);

const keys = new Set<string>();
addEventListener("keydown", (e) => keys.add(e.key));
addEventListener("keyup", (e) => keys.delete(e.key));

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

const sim = await createSim();
let acc = 0;
let last = performance.now();

function frame(now: number) {
  acc += Math.min((now - last) / 1000, 0.1);
  last = now;
  const tx = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
  const tz = (keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0);
  while (acc >= STEP) {
    sim.step(tx, tz);
    acc -= STEP;
  }
  const p = sim.ball.translation();
  const r = sim.ball.rotation();
  ballMesh.position.set(p.x, p.y, p.z);
  ballMesh.quaternion.set(r.x, r.y, r.z, r.w);
  camera.position.set(p.x, p.y + 8, p.z + 10);
  camera.lookAt(p.x, p.y, p.z);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
