import * as THREE from "three";
import { sectorMesh } from "./geometry.ts";
import { BALL_RADIUS, SPINNER_HEIGHT, SPINNER_WIDTH, pieceBoxes, pieceRot, pieceSectors, type Level, type PartKind } from "./level.ts";

export const SKY_TOP = 0x4f9dff;
export const SKY_HORIZON = 0xe2f2ff;

const MAT: Record<PartKind, THREE.Material> = {
  platform: new THREE.MeshStandardMaterial({ color: 0xdde3ea, flatShading: true, roughness: 0.9 }),
  fence: new THREE.MeshStandardMaterial({ color: 0xa9b6c6, flatShading: true, roughness: 0.8 }),
  block: new THREE.MeshStandardMaterial({ color: 0x6f7f92, flatShading: true, roughness: 0.7 }),
};
const SPINNER_MAT = new THREE.MeshStandardMaterial({ color: 0xff8a3d, flatShading: true, roughness: 0.6 });
const GOAL_MAT = new THREE.MeshStandardMaterial({ color: 0x7dffb0, emissive: 0x2fd66f, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 });
const START_MAT = new THREE.MeshBasicMaterial({ color: 0xffd23f, wireframe: true });

export function createScene(): { scene: THREE.Scene; sun: THREE.DirectionalLight } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_HORIZON);
  scene.fog = new THREE.Fog(SKY_HORIZON, 30, 110);
  scene.add(makeSky());
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7ea0c8, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -24; c.right = 24; c.top = 24; c.bottom = -24; c.near = 1; c.far = 60;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  return { scene, sun };
}

function makeSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(SKY_TOP) }, bottom: { value: new THREE.Color(SKY_HORIZON) } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
      void main(){ float t = clamp(normalize(vP).y * 1.6 + 0.15, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), mat);
  m.frustumCulled = false;
  return m;
}

export interface Built {
  group: THREE.Group;
  pieceGroups: THREE.Group[];
  spinnerBars: Map<number, THREE.Mesh>;
  goal: { index: number; mesh: THREE.Object3D } | null;
}

export function buildLevel(level: Level, editor: boolean): Built {
  const group = new THREE.Group();
  const pieceGroups: THREE.Group[] = [];
  const spinnerBars = new Map<number, THREE.Mesh>();
  let goal: Built["goal"] = null;

  level.pieces.forEach((p, index) => {
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = (pieceRot(p) * Math.PI) / 180;
    g.userData.pieceIndex = index;
    for (const b of pieceBoxes(p)) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), MAT[b.kind]);
      m.position.set(b.x, b.y, b.z);
      m.castShadow = b.kind !== "platform";
      m.receiveShadow = true;
      g.add(m);
    }
    for (const s of pieceSectors(p)) {
      const t = sectorMesh(s.inner, s.outer, s.y0, s.y1);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(t.positions, 3));
      geo.setIndex(new THREE.BufferAttribute(t.indices, 1));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, MAT[s.kind]);
      m.castShadow = s.kind !== "platform";
      m.receiveShadow = true;
      g.add(m);
    }
    if (p.type === "spinner") {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(p.length, SPINNER_HEIGHT, SPINNER_WIDTH), SPINNER_MAT);
      bar.position.y = SPINNER_HEIGHT / 2;
      bar.castShadow = true;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, SPINNER_HEIGHT + 0.1, 12), MAT.block);
      hub.position.y = SPINNER_HEIGHT / 2;
      g.add(bar, hub);
      spinnerBars.set(index, bar);
    }
    if (p.type === "goal") {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.08, 32), GOAL_MAT);
      pad.position.y = 0.04;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r, 0.08, 8, 40), GOAL_MAT);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.1;
      g.add(pad, ring);
      goal = { index, mesh: g };
    }
    if (p.type === "start" && editor) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 12, 8), START_MAT);
      m.position.y = BALL_RADIUS;
      g.add(m);
    }
    group.add(g);
    pieceGroups.push(g);
  });

  return { group, pieceGroups, spinnerBars, goal };
}

export function makeBall(): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
    ctx.fillStyle = (x + y) % 2 ? "#ff6b3d" : "#fff3e6";
    ctx.fillRect(x * 32, y * 32, 32, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 16),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.15 }),
  );
  m.castShadow = true;
  return m;
}
