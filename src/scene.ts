import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { BALL_RADIUS, BARRIER_D, BARRIER_H, BARRIER_W, BRIDGE_PLANK_T, PLANK_T, START_PAD_H, START_PAD_R, BLOCKADE_D, BLOCKADE_H, BLOCKADE_W, GOAL_BEAM_H, PILLAR_H, PILLAR_R, PLATFORM_EDGE_DROP, PLATFORM_EDGE_INSET, PLATFORM_THICKNESS, SPINNER_HEIGHT, SPINNER_WIDTH, bridgeChain, holesOn, pieceBoxes, pieceRot, rampHeight, rotXZ, type Bridge, type Level, type XZ } from "./level.ts";
import { TILE, ballTextures, edgeTextures, structTextures, tileTexture } from "./textures.ts";
import { buildRails } from "./rails.ts";
import { platformGeometry } from "./platform.ts";

export const EDGE_RADIUS = 0.3;
const HOLE_LIP = 0.35;

export const SKY_TOP = 0x448fec;
export const SKY_HORIZON = 0xafcde9;
export const SUN_OFFSET = new THREE.Vector3(8, 14, 6);
export const SUN_DIR = SUN_OFFSET.clone().normalize();
export const OCEAN_Y = -45;
export const CLOUD_Y = 40;

let MAT: Record<"platform" | "block" | "edge" | "rim", THREE.MeshStandardMaterial> | null = null;
const LIP = { inset: PLATFORM_EDGE_INSET, drop: PLATFORM_EDGE_DROP };
let STRUCT: Record<"body" | "top" | "panel" | "pillar" | "glow" | "crate" | "disc" | "padTop" | "padCentre" | "padSkirt" | "barrierPanel" | "grille" | "plank" | "plankGlow" | "hinge", THREE.MeshStandardMaterial> | null = null;
let ENV: THREE.Texture | null = null;

export function initMaterials(renderer: THREE.WebGLRenderer): void {
  if (MAT) return;
  const tiles = tileTexture(renderer.capabilities.getMaxAnisotropy());
  const edge = edgeTextures();
  MAT = {
    platform: new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.85 }),
    block: new THREE.MeshStandardMaterial({ map: tiles, color: 0x8a97a6, roughness: 0.8 }),
    edge: new THREE.MeshStandardMaterial({ map: edge.map, emissiveMap: edge.glow, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.6 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xf1f4f7, roughness: 0.35, metalness: 0.05 }),
  };
  const st = structTextures();
  STRUCT = {
    body: new THREE.MeshStandardMaterial({ color: 0xe9eef3, roughness: 0.45, metalness: 0.05 }),
    top: new THREE.MeshStandardMaterial({ color: 0x7c8690, roughness: 0.7 }),
    panel: new THREE.MeshStandardMaterial({ map: st.panel, emissiveMap: st.panelGlow, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.5 }),
    pillar: new THREE.MeshStandardMaterial({ map: st.pillar, roughness: 0.5, metalness: 0.05 }),
    glow: new THREE.MeshStandardMaterial({ color: 0x2fe6ff, emissive: 0x2fe6ff, emissiveIntensity: 0.9, roughness: 0.4 }),
    crate: new THREE.MeshStandardMaterial({ map: st.crate, emissiveMap: st.crateGlow, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.6 }),
    disc: new THREE.MeshStandardMaterial({ map: st.goalDisc, color: 0xffffff, roughness: 0.7 }),
    padTop: new THREE.MeshStandardMaterial({ map: st.padTop, emissiveMap: st.padGlow, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.5 }),
    padCentre: new THREE.MeshStandardMaterial({ map: st.padCentre, roughness: 0.6 }),
    padSkirt: new THREE.MeshStandardMaterial({ map: st.padSkirt, roughness: 0.7 }),
    barrierPanel: new THREE.MeshStandardMaterial({ map: st.barrierPanel, emissiveMap: st.barrierGlow, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.55 }),
    grille: new THREE.MeshStandardMaterial({ map: st.grille, roughness: 0.7 }),
    plank: new THREE.MeshStandardMaterial({ map: tiles, color: 0xbac3cb, roughness: 0.85 }),
    plankGlow: new THREE.MeshStandardMaterial({ color: 0x3fe87a, emissive: 0x3fe87a, emissiveIntensity: 0.8, roughness: 0.4 }),
    hinge: new THREE.MeshStandardMaterial({ color: 0x4a535d, roughness: 0.5, metalness: 0.3 }),
  };
  const pmrem = new THREE.PMREMGenerator(renderer);
  ENV = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}

function buildBlockade(g: THREE.Group) {
  const st = STRUCT!;
  const W = BLOCKADE_W, H = BLOCKADE_H, D = BLOCKADE_D;
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, 0.18), st.body);
  body.position.y = H / 2;
  body.castShadow = body.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.BoxGeometry(W - 0.7, 0.05, D - 0.7), st.top);
  top.position.y = H + 0.01;
  g.add(body, top);
  const sides: [x: number, z: number, yaw: number, len: number][] = [
    [0, D / 2, 0, W], [0, -D / 2, Math.PI, W], [W / 2, 0, Math.PI / 2, D], [-W / 2, 0, -Math.PI / 2, D],
  ];
  for (const [x, z, yaw, len] of sides) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.3, H - 0.4), st.panel);
    m.position.set(x + Math.sin(yaw) * 0.012, H / 2, z + Math.cos(yaw) * 0.012);
    m.rotation.y = yaw;
    g.add(m);
  }
}

// Four inward-facing walls carrying the edge strip, under a raised lip that straddles the rim.
function buildHole(g: THREE.Group, w: number, d: number) {
  const mat = MAT!, st = STRUCT!;
  const sides: [x: number, z: number, yaw: number, len: number][] = [
    [0, d / 2, Math.PI, w], [0, -d / 2, 0, w], [w / 2, 0, -Math.PI / 2, d], [-w / 2, 0, Math.PI / 2, d],
  ];
  for (const [x, z, yaw, len] of sides) {
    const geo = new THREE.PlaneGeometry(len, PLATFORM_THICKNESS);
    const uv = geo.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * len) / TILE);
    const wall = new THREE.Mesh(geo, mat.edge);
    wall.position.set(x, -PLATFORM_THICKNESS / 2, z);
    wall.rotation.y = yaw;
    g.add(wall);
    const lip = new THREE.Mesh(new RoundedBoxGeometry(len + HOLE_LIP, 0.12, HOLE_LIP, 2, 0.05), st.body);
    lip.position.set(x, 0.06, z);
    lip.rotation.y = yaw;
    lip.castShadow = true;
    g.add(lip);
  }
}

// Slatted column with a domed cap and a glowing base ring.
// Barrier: a rounded white pod on two legs with a cyan band along its bottom, a recessed
// instrument panel on each long face and a louvred grille on each end. The pod is half a
// cell shorter than the collider at each end, so the prop reads smaller than it blocks.
// Every detail is a box standing proud of the body, never a plane lying on it.
function buildBarrier(g: THREE.Group) {
  const st = STRUCT!;
  const LEG = 0.16, W = BARRIER_W - 1, D = BARRIER_D, H = BARRIER_H - LEG - 0.02, y0 = LEG;
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, 0.2), st.body);
  body.position.y = y0 + H / 2;
  body.castShadow = body.receiveShadow = true;
  const band = new THREE.Mesh(new RoundedBoxGeometry(W - 0.2, 0.1, D + 0.05, 2, 0.04), st.glow);
  band.position.y = y0 + 0.12;
  g.add(body, band);
  // The panel sits in the upper half of the pod, leaving a plain white band above the glow strip.
  const panelGeo = new THREE.BoxGeometry(W * 0.6, H * 0.4, 0.08);
  for (const z of [D / 2 - 0.01, -(D / 2 - 0.01)]) {
    const m = new THREE.Mesh(panelGeo, [st.top, st.top, st.top, st.top, st.barrierPanel, st.barrierPanel]);
    m.position.set(0, y0 + H * 0.64, z);
    g.add(m);
  }
  const grilleGeo = new THREE.BoxGeometry(0.08, H * 0.4, D * 0.55);
  for (const x of [W / 2, -W / 2]) {
    const m = new THREE.Mesh(grilleGeo, st.grille);
    m.position.set(x, y0 + H * 0.64, 0);
    g.add(m);
  }
  const legGeo = new THREE.CylinderGeometry(0.12, 0.12, LEG + 0.1, 16);
  for (const x of [W / 2 - 0.85, -(W / 2 - 0.85)]) {
    const leg = new THREE.Mesh(legGeo, st.body);
    leg.position.set(x, (LEG + 0.1) / 2, 0);
    leg.castShadow = true;
    g.add(leg);
  }
}

// Start pad: a low chamfered disc with a ribbed skirt, lit ring, and a raised centre of rings.
function buildStartPad(g: THREE.Group) {
  const st = STRUCT!;
  const R = START_PAD_R, H = START_PAD_H;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.08, R, H, 48), [st.padSkirt, st.padTop, st.top]);
  base.position.y = H / 2;
  base.castShadow = base.receiveShadow = true;
  const centre = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.56, R * 0.58, 0.05, 48), [st.top, st.padCentre, st.top]);
  centre.position.y = H + 0.025;
  centre.receiveShadow = true;
  g.add(base, centre);
}

// Hanging bridge: each plank is a tiled slat with a green light strip round its rim and a hinge
// barrel across its near end, so a barrel sits in every gap; the far anchor carries the last one.
// Plank groups are returned in chain order for the physics to pose each frame; a fixed mount
// bracket at each end stays with the piece.
function buildBridge(g: THREE.Group, p: Bridge): THREE.Group[] {
  const st = STRUCT!;
  const chain = bridgeChain(p);
  const T = BRIDGE_PLANK_T, W = p.w, STRIP = 0.12, LIP = 0.03;
  const barrel = () => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, W - 0.5, 10), st.hinge);
    m.rotation.z = Math.PI / 2;
    m.castShadow = true;
    return m;
  };
  const frameGeo = rimFrame(W + 0.04, chain.planks[0]!.len + 0.04, STRIP + 0.02, LIP);
  frameGeo.rotateX(-Math.PI / 2);
  const out: THREE.Group[] = [];
  for (const pl of chain.planks) {
    const pg = new THREE.Group();
    pg.position.set(0, pl.y, pl.z);
    pg.rotation.x = (pl.tilt * Math.PI) / 180;
    const body = new THREE.Mesh(roundedBox(W, T, pl.len, 0.04), st.plank);
    body.castShadow = body.receiveShadow = true;
    const rim = new THREE.Mesh(frameGeo, st.plankGlow);
    rim.position.y = T / 2;
    const b = barrel();
    b.position.z = chain.seg / 2;
    pg.add(body, rim, b);
    g.add(pg);
    out.push(pg);
  }
  const ends = [chain.hinges[0]!, chain.hinges[chain.hinges.length - 1]!];
  ends.forEach((h, i) => {
    if (i === 1) { const b = barrel(); b.position.set(0, h.y, h.z); g.add(b); }
    // Two mount lugs reaching back into the platform wall, one near each side of the hinge.
    const dir = i === 0 ? 1 : -1;
    for (const x of [W / 2 - 0.45, -(W / 2 - 0.45)]) {
      const lug = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.26, 0.4, 2, 0.04), st.hinge);
      lug.position.set(x, h.y, h.z + dir * 0.12);
      lug.castShadow = true;
      g.add(lug);
    }
  });
  return out;
}

// Rectangular light strip `strip` wide, lying in the XY plane and standing `lip` proud of it.
function rimFrame(w: number, h: number, strip: number, lip: number): THREE.BufferGeometry {
  const frame = new THREE.Shape();
  frame.moveTo(-w / 2, -h / 2); frame.lineTo(w / 2, -h / 2); frame.lineTo(w / 2, h / 2); frame.lineTo(-w / 2, h / 2);
  const hole = new THREE.Path();
  hole.moveTo(-w / 2 + strip, -h / 2 + strip); hole.lineTo(-w / 2 + strip, h / 2 - strip); hole.lineTo(w / 2 - strip, h / 2 - strip); hole.lineTo(w / 2 - strip, -h / 2 + strip);
  frame.holes.push(hole);
  return new THREE.ExtrudeGeometry(frame, { depth: lip, bevelEnabled: false });
}

// Knock-down plank: a tall tiled panel with a green rim on both faces, standing in a pair of
// hinge brackets with lit tops. The panel group pivots on the piece origin and is returned for
// the physics to pose; the brackets stay put.
function buildPlank(g: THREE.Group, w: number, h: number): THREE.Group {
  const st = STRUCT!;
  const panel = new THREE.Group();
  panel.position.y = h / 2;
  const body = new THREE.Mesh(roundedBox(w, h, PLANK_T, 0.06), st.plank);
  body.castShadow = body.receiveShadow = true;
  panel.add(body);
  const rim = rimFrame(w - 0.3, h - 0.3, 0.1, 0.02);
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(rim, st.plankGlow);
    m.position.z = side * PLANK_T / 2;
    if (side < 0) m.rotation.y = Math.PI;
    panel.add(m);
  }
  g.add(panel);
  for (const x of [w / 2 - 0.3, -(w / 2 - 0.3)]) {
    const bracket = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.26, PLANK_T + 0.36, 2, 0.05), st.hinge);
    bracket.position.set(x, 0.13, 0);
    bracket.castShadow = true;
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.14), st.plankGlow);
    light.position.set(x, 0.27, PLANK_T / 2 + 0.1);
    g.add(bracket, light);
  }
  return panel;
}

// Pushable crate: one textured cube, placed by the physics body each frame.
function buildCrate(g: THREE.Group, s: number) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(s, s, s, 3, 0.08), STRUCT!.crate);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
}

const BEAM_MAT = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  uniforms: { height: { value: GOAL_BEAM_H }, time: { value: 0 } },
  vertexShader: `varying float vY; varying vec3 vN, vV;
    void main(){ vY = position.y; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
      gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: `uniform float height, time; varying float vY; varying vec3 vN, vV;
    void main(){
      // Bright at the disc, thinning quickly with height.
      float t = clamp(vY / height, 0.0, 1.0);
      float fade = pow(1.0 - t, 3.0);
      float rim = abs(dot(vN, vV));
      float a = fade * (0.035 + 0.2 * pow(rim, 1.5));
      vec3 col = mix(vec3(0.18, 0.85, 1.0), vec3(0.8, 1.0, 1.0), rim * 0.6);
      gl_FragColor = vec4(col * a, a);
      #include <colorspace_fragment>
    }`,
});

// Goal: a spoked disc with a cyan ring and a tall beam of light fading upward.
function buildGoal(g: THREE.Group, r: number) {
  const st = STRUCT!;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.1, 40), [st.top, st.disc, st.top]);
  disc.position.y = 0.05;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.06, 0.07, 10, 48), st.glow);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, GOAL_BEAM_H, 32, 1, true), BEAM_MAT);
  beam.position.y = GOAL_BEAM_H / 2;
  beam.frustumCulled = false;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, GOAL_BEAM_H, 16, 1, true), BEAM_MAT);
  core.position.y = GOAL_BEAM_H / 2;
  g.add(disc, ring, beam, core);
}

function buildPillar(g: THREE.Group) {
  const st = STRUCT!;
  const R = PILLAR_R, H = PILLAR_H, capH = 0.3;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H - capH, 32), st.pillar);
  body.position.y = (H - capH) / 2;
  body.castShadow = body.receiveShadow = true;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.05, R + 0.05, 0.12, 32), st.body);
  collar.position.y = H - capH + 0.06;
  collar.castShadow = true;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R + 0.05, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), st.body);
  dome.scale.y = (capH - 0.12) / (R + 0.05);
  dome.position.y = H - capH + 0.12;
  dome.castShadow = true;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.04, R + 0.04, 0.12, 32), st.glow);
  ring.position.y = 0.06;
  g.add(body, collar, dome, ring);
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
const START_MAT = new THREE.MeshBasicMaterial({ color: 0xffd23f, wireframe: true });

export interface SceneEnv { scene: THREE.Scene; sun: THREE.DirectionalLight; tick(camera: THREE.Camera): void }

export function createScene(): SceneEnv {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_HORIZON);
  scene.fog = new THREE.FogExp2(SKY_HORIZON, 0.0035);
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
  sun.shadow.normalBias = 0.03; // the shadow map re-renders as the sun tracks the ball; this keeps shallow faces from shimmering
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

// Endless sea: slow noise ripples, sky fresnel, a soft sun glint, and the shadows of the
// cloud deck drifting over it (same field the sky draws, sampled straight below).
function makeOcean(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 }, sunDir: { value: SUN_DIR },
      deep: { value: new THREE.Color(0x2a6cb0) }, shallow: { value: new THREE.Color(0x3a80c4) }, sky: { value: new THREE.Color(0x8fb8e0) },
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
      void main(){
        vec2 p = vWorld.xz;
        vec2 rp = p * 0.35 + vec2(time * 0.012, -time * 0.008);
        float e = 0.05;
        vec2 g = vec2(fbm(rp + vec2(e, 0.0)) - fbm(rp - vec2(e, 0.0)), fbm(rp + vec2(0.0, e)) - fbm(rp - vec2(0.0, e))) * 0.25;
        float tone = fbm(p * 0.03 + vec2(time * 0.006, -time * 0.004));
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 col = mix(mix(deep, shallow, smoothstep(0.3, 0.7, tone)), sky, fres);
        float spec = pow(max(dot(n, normalize(sunDir + V)), 0.0), 140.0);
        col += vec3(1.0, 0.99, 0.95) * spec * 0.12;
        vec2 q = p * 0.025 + vec2(time * 0.01, time * 0.004);
        float cover = smoothstep(0.46, 0.7, fbm(q));
        col *= 1.0 - 0.16 * cover;
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
  crates: Map<number, THREE.Group>;
  // Plank groups per bridge piece, in chain order, local to the piece group.
  bridges: Map<number, THREE.Group[]>;
  // The swinging panel of each knock-down plank, local to the piece group.
  planks: Map<number, THREE.Group>;
  goal: { index: number; mesh: THREE.Object3D } | null;
}

const UP = new THREE.Vector3(0, 1, 0);
// Pose a bridge plank from its physics body: the plank group lives under the piece group, which
// only yaws and translates, so the world pose is pulled back into the piece's local frame.
export function posePlank(piece: THREE.Group, plank: THREE.Group, t: { x: number; y: number; z: number }, q: { x: number; y: number; z: number; w: number }): void {
  plank.position.set(t.x, t.y, t.z).sub(piece.position).applyAxisAngle(UP, -piece.rotation.y);
  plank.quaternion.set(q.x, q.y, q.z, q.w).premultiply(piece.quaternion.clone().invert());
}

export function buildLevel(level: Level, editor: boolean): Built {
  if (!MAT) throw new Error("initMaterials first");
  const mat = MAT;
  const group = new THREE.Group();
  const pieceGroups: THREE.Group[] = [];
  const spinnerBars = new Map<number, THREE.Mesh>();
  const crates = new Map<number, THREE.Group>();
  const bridges = new Map<number, THREE.Group[]>();
  const planks = new Map<number, THREE.Group>();
  let goal: Built["goal"] = null;

  level.pieces.forEach((p, index) => {
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    g.rotation.order = "YXZ"; // tilt about the piece's own x axis, then yaw
    g.rotation.y = (pieceRot(p) * Math.PI) / 180;
    if (p.type === "slab") g.rotation.x = (p.tilt * Math.PI) / 180;
    g.userData.pieceIndex = index;
    if (p.type === "blockade") buildBlockade(g);
    if (p.type === "barrier") buildBarrier(g);
    if (p.type === "pillar") buildPillar(g);
    if (p.type === "crate") { buildCrate(g, p.s); g.position.y += p.s / 2 + 0.02; crates.set(index, g); }
    if (p.type === "bridge") bridges.set(index, buildBridge(g, p));
    if (p.type === "plank") planks.set(index, buildPlank(g, p.w, p.h));
    for (const b of pieceBoxes(p)) {
      if (b.kind !== "block" || p.type === "blockade" || p.type === "barrier") continue; // these props draw themselves; the box is only their collider
      const m = new THREE.Mesh(roundedBox(b.w, b.h, b.d, EDGE_RADIUS), mat.block);
      m.position.set(b.x, b.y, b.z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    if (p.type === "slab" || p.type === "curve") {
      const rot = pieceRot(p);
      const cuts: XZ[][] = holesOn(level, p).map((h) => h.map((v) => { const o = rotXZ(v[0] - p.x, v[1] - p.z, -rot); return [o.x, o.z] as XZ; }));
      const geo = p.type === "slab"
        ? platformGeometry(p.w, p.d, PLATFORM_THICKNESS, LIP, TILE, undefined, undefined, cuts)
        : platformGeometry(((p.inner + p.outer) / 2) * (Math.PI / 2), p.outer - p.inner, PLATFORM_THICKNESS, LIP, TILE, { rmid: (p.inner + p.outer) / 2 });
      const m = new THREE.Mesh(geo, [mat.platform, mat.edge, mat.rim]);
      m.receiveShadow = true;
      g.add(m);
    }
    if (p.type === "hole") buildHole(g, p.w, p.d);
    if (p.type === "ramp") {
      const geo = platformGeometry(p.d, p.w, PLATFORM_THICKNESS, LIP, TILE, undefined, (t) => rampHeight(p, t));
      geo.rotateY(Math.PI / 2);
      const m = new THREE.Mesh(geo, [mat.platform, mat.edge, mat.rim]);
      m.receiveShadow = true;
      m.castShadow = true;
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
      buildGoal(g, p.r);
      goal = { index, mesh: g };
    }
    if (p.type === "start") {
      buildStartPad(g);
      if (editor) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 12, 8), START_MAT);
        m.position.y = START_PAD_H + BALL_RADIUS;
        g.add(m);
      }
    }
    group.add(g);
    pieceGroups.push(g);
  });

  return { group, pieceGroups, spinnerBars, crates, bridges, planks, goal };
}

let BAD_MAT: THREE.MeshStandardMaterial | null = null;
// Editor: paint the platforms at `bad` indices red and restore the rest, so an overlap reads at a glance.
export function markOverlapping(built: Built, bad: Set<number>) {
  if (!MAT) return;
  BAD_MAT ??= new THREE.MeshStandardMaterial({ map: MAT.platform.map, color: 0xe0392b, emissive: 0x5a0a05, roughness: 0.85 });
  built.pieceGroups.forEach((g, i) => {
    for (const o of g.children) {
      if (!(o instanceof THREE.Mesh) || !Array.isArray(o.material)) continue;
      const m = o.material as THREE.Material[];
      if (m[0] === MAT!.platform || m[0] === BAD_MAT) m[0] = bad.has(i) ? BAD_MAT! : MAT!.platform;
    }
  });
}

export interface Ball { mesh: THREE.Mesh; reflect(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void; dispose(): void }

// Lacquered ball mirroring the live scene: a cube camera at the ball re-renders the surroundings
// each frame into its environment map, so platforms, rails and sky slide across it as it rolls.
export function makeBall(): Ball {
  const maps = ballTextures();
  const target = new THREE.WebGLCubeRenderTarget(256);
  const cube = new THREE.CubeCamera(0.2, 400, target);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 48, 24),
    new THREE.MeshPhysicalMaterial({
      map: maps.map, roughnessMap: maps.roughness, roughness: 1, metalness: 1,
      emissiveMap: maps.emissive, emissive: 0xffffff, emissiveIntensity: 1.1,
      envMap: target.texture, envMapIntensity: 1.2, clearcoat: 0.6, clearcoatRoughness: 0.15,
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
