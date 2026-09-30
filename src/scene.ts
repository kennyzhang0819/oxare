import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { BALL_RADIUS, PLATFORM_THICKNESS, SPINNER_HEIGHT, SPINNER_WIDTH, pieceBoxes, pieceRot, type Level, type PartKind } from "./level.ts";
import { TILE, ballTextures, tileTexture } from "./textures.ts";
import { buildRails } from "./rails.ts";
import { platformGeometry } from "./platform.ts";

export const EDGE_RADIUS = 0.3;

export const SKY_TOP = 0x4f9dff;
export const SKY_HORIZON = 0xe2f2ff;

let MAT: Record<Exclude<PartKind, "fence">, THREE.Material> | null = null;
let ENV: THREE.Texture | null = null;

export function initMaterials(renderer: THREE.WebGLRenderer): void {
  if (MAT) return;
  const tiles = tileTexture(renderer.capabilities.getMaxAnisotropy());
  MAT = {
    platform: new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.85 }),
    block: new THREE.MeshStandardMaterial({ map: tiles, color: 0x8a97a6, roughness: 0.8 }),
  };
  const pmrem = new THREE.PMREMGenerator(renderer);
  ENV = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}

// Box UVs projected from the dominant normal axis so tiles stay world-sized on every face.
function roundedBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const geo = new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2));
  const p = geo.getAttribute("position"), n = geo.getAttribute("normal");
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
    uv[i * 2] = u / TILE; uv[i * 2 + 1] = v / TILE;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}
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
  if (!MAT) throw new Error("initMaterials first");
  const mat = MAT;
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
      if (b.kind !== "block") continue;
      const m = new THREE.Mesh(roundedBox(b.w, b.h, b.d, EDGE_RADIUS), mat.block);
      m.position.set(b.x, b.y, b.z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    if (p.type === "slab" || p.type === "curve") {
      const geo = p.type === "slab"
        ? platformGeometry(p.w, p.d, PLATFORM_THICKNESS, EDGE_RADIUS, TILE)
        : platformGeometry(((p.inner + p.outer) / 2) * (Math.PI / 2), p.outer - p.inner, PLATFORM_THICKNESS, EDGE_RADIUS, TILE, { rmid: (p.inner + p.outer) / 2 });
      const m = new THREE.Mesh(geo, mat.platform);
      m.receiveShadow = true;
      g.add(m);
    }
    buildRails(p, g, ENV);
    if (p.type === "spinner") {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(p.length, SPINNER_HEIGHT, SPINNER_WIDTH), SPINNER_MAT);
      bar.position.y = SPINNER_HEIGHT / 2;
      bar.castShadow = true;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, SPINNER_HEIGHT + 0.1, 12), mat.block);
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
  const { map, emissive } = ballTextures();
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 48, 24),
    new THREE.MeshStandardMaterial({
      map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0.55,
      roughness: 0.25, metalness: 0.1, envMap: ENV, envMapIntensity: 0.55,
    }),
  );
  m.castShadow = true;
  return m;
}
