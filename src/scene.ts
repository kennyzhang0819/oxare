import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { BALL_RADIUS, PLATFORM_THICKNESS, SPINNER_HEIGHT, SPINNER_WIDTH, pieceBoxes, pieceRot, type Level, type PartKind } from "./level.ts";
import { TILE, ballTexture, tileTexture } from "./textures.ts";
import { buildRails } from "./rails.ts";
import { platformGeometry } from "./platform.ts";

export const EDGE_RADIUS = 0.3;
export const PLATFORM_EDGE_RADIUS = 0.5;

export const SKY_TOP = 0x4f9dff;
export const SKY_HORIZON = 0xd8e8f6;
export const SUN_OFFSET = new THREE.Vector3(8, 14, 6);
export const SUN_DIR = SUN_OFFSET.clone().normalize();
export const OCEAN_Y = -45;
export const CLOUD_Y = 40;

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

export interface SceneEnv { scene: THREE.Scene; sun: THREE.DirectionalLight; tick(camera: THREE.Camera): void }

export function createScene(): SceneEnv {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_HORIZON);
  scene.fog = new THREE.FogExp2(SKY_HORIZON, 0.006);
  const sky = makeSky(), ocean = makeOcean();
  scene.add(sky, ocean);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7ea0c8, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.copy(SUN_OFFSET);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -24; c.right = 24; c.top = 24; c.bottom = -24; c.near = 1; c.far = 60;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  const t0 = performance.now();
  // Sky and sea ride along with the camera; their shaders work in world space so nothing swims.
  const tick = (camera: THREE.Camera) => {
    const t = (performance.now() - t0) / 1000;
    sky.position.copy(camera.position);
    (sky.material as THREE.ShaderMaterial).uniforms.time!.value = t;
    ocean.position.set(camera.position.x, OCEAN_Y, camera.position.z);
    (ocean.material as THREE.ShaderMaterial).uniforms.time!.value = t;
  };
  return { scene, sun, tick };
}

const NOISE_GLSL = `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
    return v;
  }`;

// Gradient dome with a cloud deck: each sky pixel's view ray is intersected with the plane
// y = CLOUD_Y and the coverage read from noise there, fading with distance to match the fog.
function makeSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(SKY_TOP) }, bottom: { value: new THREE.Color(SKY_HORIZON) },
      time: { value: 0 }, cloudY: { value: CLOUD_Y }, sunDir: { value: SUN_DIR },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top, bottom, sunDir; uniform float time, cloudY; varying vec3 vP;
      ${NOISE_GLSL}
      void main(){
        vec3 d = normalize(vP);
        vec3 col = mix(bottom, top, smoothstep(0.04, 0.7, d.y));
        float t = (cloudY - cameraPosition.y) / max(d.y, 1e-4);
        if (d.y > 0.0 && t > 0.0) {
          vec2 p = cameraPosition.xz + d.xz * t;
          vec2 q = p * 0.025 + vec2(time * 0.01, time * 0.004);
          float n = fbm(q);
          float cover = smoothstep(0.46, 0.7, n);
          float lit = fbm(q + sunDir.xz * 0.12);
          vec3 cloud = mix(vec3(0.70, 0.76, 0.86), vec3(1.0), smoothstep(0.35, 0.75, lit));
          float fade = exp(-t * 0.002);
          col = mix(col, cloud, cover * fade);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), mat);
  m.frustumCulled = false;
  return m;
}

// Endless sea: swell from a few directional waves plus noise ripples, sky fresnel, sun glint, foam.
function makeOcean(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 }, sunDir: { value: SUN_DIR },
      deep: { value: new THREE.Color(0x3f8fcf) }, shallow: { value: new THREE.Color(0x6fb6e6) }, sky: { value: new THREE.Color(0xc4dff3) },
    }]),
    vertexShader: `#include <fog_pars_vertex>
      varying vec3 vWorld;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `#include <fog_pars_fragment>
      uniform float time; uniform vec3 sunDir, deep, shallow, sky; varying vec3 vWorld;
      ${NOISE_GLSL}
      float swell(vec2 p, out vec2 g) {
        const vec2 D[4] = vec2[4](vec2(1.0, 0.3), vec2(-0.6, 1.0), vec2(0.8, -0.9), vec2(-1.0, -0.2));
        const float A[4] = float[4](0.55, 0.4, 0.25, 0.18);
        const float F[4] = float[4](0.11, 0.17, 0.26, 0.4);
        const float S[4] = float[4](0.25, 0.33, 0.45, 0.55);
        float h = 0.0; g = vec2(0.0);
        for (int i = 0; i < 4; i++) {
          vec2 d = normalize(D[i]);
          float ph = dot(d, p) * F[i] + time * S[i];
          h += A[i] * sin(ph);
          g += A[i] * F[i] * cos(ph) * d;
        }
        return h;
      }
      void main(){
        vec2 p = vWorld.xz;
        vec2 g; float h = swell(p, g);
        vec2 rp = p * 0.35 + vec2(time * 0.012, -time * 0.008);
        float e = 0.05;
        g += vec2(fbm(rp + vec2(e, 0.0)) - fbm(rp - vec2(e, 0.0)), fbm(rp + vec2(0.0, e)) - fbm(rp - vec2(0.0, e))) * 0.5;
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 col = mix(mix(deep, shallow, smoothstep(-1.2, 1.2, h)), sky, fres);
        float spec = pow(max(dot(n, normalize(sunDir + V)), 0.0), 140.0);
        col += vec3(1.0, 0.99, 0.95) * spec * 0.25;
        float foam = smoothstep(0.6, 0.8, fbm(p * 0.1 + time * 0.005)) * smoothstep(0.3, 1.0, h);
        col = mix(col, vec3(0.95, 0.98, 1.0), foam * 0.15);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = OCEAN_Y;
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
        ? platformGeometry(p.w, p.d, PLATFORM_THICKNESS, PLATFORM_EDGE_RADIUS, TILE)
        : platformGeometry(((p.inner + p.outer) / 2) * (Math.PI / 2), p.outer - p.inner, PLATFORM_THICKNESS, PLATFORM_EDGE_RADIUS, TILE, { rmid: (p.inner + p.outer) / 2 });
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

export interface Ball { mesh: THREE.Mesh; reflect(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void; dispose(): void }

// Lacquered ball mirroring the live scene: a cube camera at the ball re-renders the surroundings
// each frame into its environment map, so platforms, rails and sky slide across it as it rolls.
export function makeBall(): Ball {
  const target = new THREE.WebGLCubeRenderTarget(256);
  const cube = new THREE.CubeCamera(0.2, 400, target);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 48, 24),
    new THREE.MeshPhysicalMaterial({
      map: ballTexture(), roughness: 0.2, metalness: 1, envMap: target.texture, envMapIntensity: 1.1,
    }),
  );
  mesh.castShadow = true;
  return {
    mesh,
    reflect(renderer, scene) {
      cube.position.copy(mesh.position);
      mesh.visible = false;
      const auto = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false; // the six faces reuse the main view's shadow maps
      cube.update(renderer, scene);
      renderer.shadowMap.autoUpdate = auto;
      mesh.visible = true;
    },
    dispose() { target.dispose(); },
  };
}
