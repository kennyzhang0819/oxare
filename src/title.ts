import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CAP_HEIGHT, GLYPHS } from "./title-glyphs.ts";

// Look ported from the physicalturing hero (drei MeshTransmissionMaterial). Its logo is REF units tall
// in world space; lengths below are scaled from that to the cap height so the glass reads the same.
const REF = 7.5;
const U = CAP_HEIGHT / REF;
const TRACKING = 90;
const DEPTH = 0.128 * CAP_HEIGHT, BEVEL_T = 0.051 * CAP_HEIGHT, BEVEL_S = 0.042 * CAP_HEIGHT;
const GLASS = {
  thickness: 0.3 * U, roughness: 0.01, ior: 1.28, chromaticAberration: 0.45, distortion: 0.4, distortionScale: 0.6 / U,
  temporalDistortion: 0.14, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 0.25, iridescenceIOR: 1.35, envMapIntensity: 0.9,
};
const SAMPLES = 8;
const DIST = 10;
const BASE_TILT_X = 0.1;
const FLOAT_SPEED = 1.4, FLOAT_ROT = 0.25, FLOAT_LIFT = 0.8, FLOAT_RANGE = 0.2;

let studio: THREE.Texture | null = null;

// Mostly dark room with thin bright strips: flat faces stay clear and only the bevels catch streaks.
// Built as seen from the camera; update() turns it with the view.
function studioEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  if (studio) return studio;
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x000000);
  const strip = (w: number, h: number, pos: [number, number, number], color: number, intensity: number, roll?: number) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide, toneMapped: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(...pos);
    if (roll === undefined) m.lookAt(0, 0, 0);
    else m.rotation.z = roll;
    room.add(m);
  };
  strip(10, 0.8, [0, 6, 4], 0xffffff, 2.6);
  strip(7, 0.7, [-7, 0, 3.5], 0xffffff, 1.8, Math.PI / 2);
  strip(6, 0.6, [7, -3, 4], 0xcfe0f4, 1.5);
  strip(9, 0.35, [5, 5, 5], 0xffffff, 2.6);
  strip(16, 1.2, [0, 1, -8], 0xe6f0ff, 1.3);
  strip(8, 4, [0, 8, 1], 0xffffff, 0.4);
  const pmrem = new THREE.PMREMGenerator(renderer);
  studio = pmrem.fromScene(room, 0, 0.1, 1000, { size: 256 }).texture;
  pmrem.dispose();
  room.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  return studio;
}

const NOISE = /* glsl */ `
uniform float uTime;
varying vec3 vLocalPos;
vec3 random3(vec3 c) {
  float j = 4096.0 * sin(dot(c, vec3(17.0, 59.4, 15.0)));
  vec3 r;
  r.z = fract(512.0 * j); j *= .125;
  r.x = fract(512.0 * j); j *= .125;
  r.y = fract(512.0 * j);
  return r - 0.5;
}
float snoise(vec3 p) {
  vec3 s = floor(p + dot(p, vec3(0.3333333)));
  vec3 x = p - s + dot(s, vec3(0.1666667));
  vec3 e = step(vec3(0.0), x - x.yzx);
  vec3 i1 = e * (1.0 - e.zxy);
  vec3 i2 = 1.0 - e.zxy * (1.0 - e);
  vec3 x1 = x - i1 + 0.1666667, x2 = x - i2 + 0.3333333, x3 = x - 1.0 + 0.5;
  vec4 w = max(0.6 - vec4(dot(x, x), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  vec4 d = vec4(dot(random3(s), x), dot(random3(s + i1), x1), dot(random3(s + i2), x2), dot(random3(s + 1.0), x3));
  w *= w; w *= w;
  return dot(d * w, vec4(52.0));
}
float snoiseFractal(vec3 m) {
  return 0.5333333 * snoise(m) + 0.2666667 * snoise(2.0 * m) + 0.1333333 * snoise(4.0 * m) + 0.0666667 * snoise(8.0 * m);
}
`;

// three's transmission with drei's extras: a writhing noise normal (the liquid) and a per-channel IOR
// spread over several thickness samples (the soap-film fringe on the edges).
const TRANSMISSION = /* glsl */ `
#ifdef USE_TRANSMISSION
  material.transmission = transmission;
  material.transmissionAlpha = 1.0;
  material.thickness = thickness;
  material.attenuationDistance = attenuationDistance;
  material.attenuationColor = attenuationColor;
  vec3 pos = vWorldPosition;
  vec3 v = normalize(cameraPosition - pos);
  vec3 n = transformNormalByInverseViewMatrix(normal, viewMatrix);
  vec3 tOff = vec3(uTime, -uTime, -uTime) * ${GLASS.temporalDistortion.toFixed(4)};
  vec3 q = vLocalPos * ${GLASS.distortionScale.toFixed(6)};
  vec3 dn = ${GLASS.distortion.toFixed(4)} * vec3(snoiseFractal(q + tOff), snoiseFractal(q.zxy - tOff), snoiseFractal(q.yxz + tOff));
  vec3 sn = normalize(n + dn);
  float smear = material.thickness * pow(max(material.roughness, 1e-4), 0.33);
  vec3 acc = vec3(0.0);
  float alpha = 0.0;
  for (float i = 0.0; i < ${SAMPLES}.0; i++) {
    float prog = (i + 0.5) / ${SAMPLES}.0;
    float th = material.thickness + smear * prog;
    float ab = ${GLASS.chromaticAberration.toFixed(4)} * prog;
    vec4 r = getIBLVolumeRefraction(sn, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
      pos, modelMatrix, viewMatrix, projectionMatrix, 0.0, material.ior, th, material.attenuationColor, material.attenuationDistance);
    vec4 g = getIBLVolumeRefraction(sn, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
      pos, modelMatrix, viewMatrix, projectionMatrix, 0.0, material.ior * (1.0 + ab), th, material.attenuationColor, material.attenuationDistance);
    vec4 b = getIBLVolumeRefraction(sn, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
      pos, modelMatrix, viewMatrix, projectionMatrix, 0.0, material.ior * (1.0 + 2.0 * ab), th, material.attenuationColor, material.attenuationDistance);
    acc += vec3(r.r, g.g, b.b);
    alpha += r.a;
  }
  acc /= ${SAMPLES}.0;
  material.transmissionAlpha = mix(material.transmissionAlpha, alpha / ${SAMPLES}.0, material.transmission);
  totalDiffuse = mix(totalDiffuse, acc, material.transmission);
#endif
`;

function glassMaterial(env: THREE.Texture, time: { value: number }): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transmission: 1, thickness: GLASS.thickness, roughness: GLASS.roughness, ior: GLASS.ior,
    clearcoat: GLASS.clearcoat, clearcoatRoughness: GLASS.clearcoatRoughness,
    iridescence: GLASS.iridescence, iridescenceIOR: GLASS.iridescenceIOR,
    envMap: env, envMapIntensity: GLASS.envMapIntensity, side: THREE.DoubleSide, fog: false,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = "varying vec3 vLocalPos;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocalPos = position;");
    shader.fragmentShader = NOISE + shader.fragmentShader.replace("#include <transmission_fragment>", TRANSMISSION);
  };
  mat.customProgramCacheKey = () => "glass-title";
  return mat;
}

function wordGeometry(word: string): THREE.BufferGeometry {
  const loader = new SVGLoader();
  const parts: THREE.BufferGeometry[] = [];
  let x = 0;
  for (const ch of word.toUpperCase()) {
    const g = GLYPHS[ch];
    if (!g) { x += 400; continue; }
    const { paths } = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${g.d}"/></svg>`);
    const shapes = paths.flatMap((p) => SVGLoader.createShapes(p));
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL_T, bevelSize: BEVEL_S, bevelSegments: 6, curveSegments: 10, steps: 1,
    });
    geo.translate(x, 0, 0);
    parts.push(geo);
    x += g.advance + TRACKING;
  }
  const geo = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  // SVG y points down: a half-turn on x stands the word up without mirroring its winding.
  geo.rotateX(Math.PI);
  geo.center();
  return geo;
}

// The menu title as a slab of clear liquid glass refracting the live sky and sea behind it.
// It rides on the camera and is laid over `slot`, an element that keeps its place in the page layout.
export class GlassTitle {
  private mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  private pivot = new THREE.Group();
  private float = new THREE.Group();
  private time = { value: 0 };
  private width: number;
  private camera: THREE.PerspectiveCamera;
  private slot: HTMLElement;
  private euler = new THREE.Euler();
  private quat = new THREE.Quaternion();
  private sweep = new THREE.Quaternion();
  private yAxis = new THREE.Vector3(0, 1, 0);

  constructor(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, slot: HTMLElement, word: string) {
    this.camera = camera;
    this.slot = slot;
    const geo = wordGeometry(word);
    geo.computeBoundingBox();
    this.width = geo.boundingBox!.max.x - geo.boundingBox!.min.x;
    this.mesh = new THREE.Mesh(geo, glassMaterial(studioEnv(renderer), this.time));
    this.float.add(this.mesh);
    this.pivot.add(this.float);
    this.pivot.rotation.x = BASE_TILT_X;
    camera.add(this.pivot);
  }

  update(t: number) {
    this.time.value = t;
    const r = this.slot.getBoundingClientRect();
    const perPx = (2 * DIST * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / innerHeight;
    const s = Math.min(r.height * perPx * 0.72 / CAP_HEIGHT, innerWidth * 0.84 * perPx / this.width);
    this.mesh.scale.setScalar(s);
    this.pivot.position.set((r.left + r.width / 2 - innerWidth / 2) * perPx, -(r.top + r.height / 2 - innerHeight / 2) * perPx, -DIST);
    // drei <Float>: a slow bob and sway, lift sized to the title like the reference.
    const ft = t * FLOAT_SPEED / 4;
    this.float.rotation.set(Math.cos(ft) / 8 * FLOAT_ROT, Math.sin(ft) / 8 * FLOAT_ROT, Math.sin(ft) / 20 * FLOAT_ROT);
    this.float.position.y = THREE.MathUtils.clamp(Math.sin(ft) / 10 * FLOAT_LIFT, -FLOAT_RANGE, FLOAT_RANGE) * s * U;
    // three negates envMapRotation's angles before use, so hand it the negated inverse view turn,
    // plus a slow sway that drags the strip glare back and forth across the bevels.
    this.sweep.setFromAxisAngle(this.yAxis, Math.sin(t * 0.35) * 0.3);
    this.euler.setFromQuaternion(this.quat.copy(this.camera.quaternion).invert().premultiply(this.sweep));
    this.mesh.material.envMapRotation.set(-this.euler.x, -this.euler.y, -this.euler.z, this.euler.order);
  }

  dispose() {
    this.camera.remove(this.pivot);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
