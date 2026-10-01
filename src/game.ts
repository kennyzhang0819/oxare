import * as THREE from "three";
import { Input } from "./input.ts";
import { BALL_RADIUS, type Level } from "./level.ts";
import { SUN_DIR, SUN_OFFSET, buildLevel, createScene, makeBall, type Built, type SceneEnv } from "./scene.ts";
import { STEP, createSim, type Sim } from "./sim.ts";
import { TUNING, TUNING_RANGES, resetTuning, saveTuning, type TuningKey } from "./tuning.ts";
import { clear, fmtTime, h } from "./ui.ts";
import type { Ctx, Mode } from "./main.ts";

const PROGRESS_KEY = "balling.progress";
// Shadow-camera axes (three's lookAt with up = +Y), used to snap the light to whole shadow texels.
const SUN_RIGHT = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), SUN_DIR).normalize();
const SUN_UP = new THREE.Vector3().crossVectors(SUN_DIR, SUN_RIGHT);
type Progress = Record<string, { best: number }>;
export function loadProgress(): Progress {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}") as Progress; } catch { return {}; }
}

export interface GameOpts { onExit(): void; onNext?: () => void; onRetry(): void }

export class Game implements Mode {
  private scene: THREE.Scene;
  private sun: THREE.DirectionalLight;
  private env: SceneEnv;
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  private built: Built;
  private ball = makeBall();
  private input = new Input();
  private sim: Sim | null = null;
  // Pose before the latest physics step; the frame renders between it and the current pose.
  private prevPos = new THREE.Vector3();
  private prevRot = new THREE.Quaternion();
  private shown = new THREE.Vector3();
  private anchor = new THREE.Vector3(); // eased ball position the camera orbits
  private yaw = 0;
  private yawVel = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private time = 0;
  private falls = 0;
  private done = false;
  private hud: HTMLElement;
  private timeEl = h("span", { class: "pill" }, "0:00.00");
  private tunePanel: HTMLElement | null = null;
  private onResize = () => this.resize();
  private onKey = (e: KeyboardEvent) => {
    if (e.code === "Escape") this.opts.onExit();
    if (e.code === "KeyT" && !(e.target instanceof HTMLInputElement)) this.toggleTune();
    if (e.code === "KeyR" && !(e.target instanceof HTMLInputElement)) this.fall();
  };

  private ctx: Ctx;
  private level: Level;
  private opts: GameOpts;

  constructor(ctx: Ctx, level: Level, opts: GameOpts) {
    this.ctx = ctx;
    this.level = level;
    this.opts = opts;
    this.env = createScene();
    ({ scene: this.scene, sun: this.sun } = this.env);
    this.built = buildLevel(level, false);
    this.scene.add(this.built.group, this.ball.mesh);
    this.hud = h("div", { class: "hud" },
      h("button", { class: "ghost", onclick: () => opts.onExit() }, "Menu"),
      h("span", { class: "pill" }, level.name),
      this.timeEl,
      h("span", { class: "spacer" }),
      h("button", { class: "ghost", onclick: () => this.toggleTune() }, "Tune (T)"),
    );
    ctx.overlay.append(this.hud);
    this.input.attach(ctx.canvas);
    if (this.input.tiltOn) this.input.calibrate();
    addEventListener("resize", this.onResize);
    addEventListener("keydown", this.onKey);
    this.resize();
    void this.boot();
  }

  private async boot() {
    this.sim = await createSim(this.level);
    if (this.raf === -1) { this.sim.free(); return; }
    this.savePrev();
    this.snapCamera();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private resize() {
    const { canvas, renderer } = this.ctx;
    renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera.updateProjectionMatrix();
  }

  private forward(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  private frame = (now: number) => {
    const sim = this.sim!;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.input.update();
    if (!this.done) {
      // Turn rate chases the input with a short time constant: a brief tail after a key release or
      // drag, while the total rotation of a drag stays exactly its distance times mouseSens.
      const want = -this.input.steer * TUNING.yawRate - (this.input.takeYawPx() * TUNING.mouseSens) / Math.max(dt, 1e-3);
      this.yawVel += (want - this.yawVel) * (TUNING.yawEase > 0 ? 1 - Math.exp(-dt / TUNING.yawEase) : 1);
      this.yaw += this.yawVel * dt;
      this.acc += dt;
      this.time += dt;
      while (this.acc >= STEP) {
        this.savePrev();
        const f = this.forward();
        sim.step(this.input.throttle, f.x, f.z);
        this.acc -= STEP;
      }
    }
    // Frames run 0-3 physics steps each, so the raw post-step pose judders; blending back toward
    // the previous pose by the unconsumed fraction of a step moves the ball by exactly the frame's dt.
    const alpha = this.done ? 1 : this.acc / STEP;
    const p = sim.ball.translation();
    const r = sim.ball.rotation();
    this.shown.set(p.x, p.y, p.z).lerp(this.prevPos, 1 - alpha);
    this.ball.mesh.position.copy(this.shown);
    this.ball.mesh.quaternion.set(r.x, r.y, r.z, r.w).slerp(this.prevRot, 1 - alpha);
    for (const s of sim.spinners) {
      const bar = this.built.spinnerBars.get(s.index);
      if (bar) bar.rotation.y = s.angle - s.speed * STEP * (1 - alpha);
    }
    if (!this.done) {
      if (p.y < TUNING.respawnY) this.fall();
      const goal = this.built.goal;
      if (goal) {
        const gp = this.level.pieces[goal.index]!;
        if (gp.type === "goal" && Math.hypot(p.x - gp.x, p.z - gp.z) < gp.r && Math.abs(p.y - (gp.y + BALL_RADIUS)) < 0.6) this.finish();
      }
    }
    this.timeEl.textContent = fmtTime(this.time);
    this.updateCamera(dt);
    this.env.tick(this.camera);
    this.ball.reflect(this.ctx.renderer, this.scene);
    this.ctx.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.frame);
  };

  private savePrev() {
    const p = this.sim!.ball.translation();
    const r = this.sim!.ball.rotation();
    this.prevPos.set(p.x, p.y, p.z);
    this.prevRot.set(r.x, r.y, r.z, r.w);
  }

  private snapCamera() {
    const p = this.shown.set(this.prevPos.x, this.prevPos.y, this.prevPos.z);
    this.anchor.copy(p);
    this.camera.position.set(p.x + Math.sin(this.yaw) * TUNING.camDist, p.y + TUNING.camHeight, p.z + Math.cos(this.yaw) * TUNING.camDist);
    this.camera.lookAt(p.x, p.y, p.z);
  }

  private updateCamera(dt: number) {
    const p = this.shown;
    // Only the follow eases; the orbit angle is applied rigidly so the view stops the instant steering does.
    const o = this.anchor.lerp(p, 1 - Math.exp(-10 * dt));
    this.camera.position.set(o.x + Math.sin(this.yaw) * TUNING.camDist, o.y + TUNING.camHeight, o.z + Math.cos(this.yaw) * TUNING.camDist);
    this.camera.lookAt(p.x, p.y + 0.4, p.z);
    // The sun follows the ball; moving it by whole shadow texels keeps shadow edges from crawling.
    const sc = this.sun.shadow.camera;
    const texel = (sc.right - sc.left) / this.sun.shadow.mapSize.width;
    const a = p.dot(SUN_RIGHT), b = p.dot(SUN_UP);
    const t = this.sun.target.position.copy(p)
      .addScaledVector(SUN_RIGHT, Math.round(a / texel) * texel - a)
      .addScaledVector(SUN_UP, Math.round(b / texel) * texel - b);
    this.sun.position.copy(t).add(SUN_OFFSET);
  }

  private fall() {
    this.falls++;
    this.sim!.respawn();
    this.savePrev();
  }

  private finish() {
    this.done = true;
    const progress = loadProgress();
    const prev = progress[this.level.id]?.best;
    const best = prev == null || this.time < prev;
    if (best) { progress[this.level.id] = { best: this.time }; localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); }
    this.ctx.overlay.append(
      h("div", { class: "banner" },
        h("div", { class: "card" },
          h("h2", {}, "Level complete"),
          h("div", {}, `Time ${fmtTime(this.time)}${best ? " · new best" : ""}`),
          h("div", {}, `Falls ${this.falls}`),
          h("div", { class: "row" },
            h("button", { onclick: () => this.opts.onRetry() }, "Retry"),
            this.opts.onNext ? h("button", { onclick: () => this.opts.onNext!() }, "Next") : null,
            h("button", { class: "ghost", onclick: () => this.opts.onExit() }, "Menu"),
          ),
        ),
      ),
    );
  }

  private toggleTune() {
    if (this.tunePanel) { this.tunePanel.remove(); this.tunePanel = null; return; }
    const out = h("textarea", { readOnly: true });
    const refresh = () => { out.value = JSON.stringify(TUNING, null, 1); };
    const rows = (Object.keys(TUNING) as TuningKey[]).map((k) => {
      const [min, max, step] = TUNING_RANGES[k];
      const val = h("span", {}, String(TUNING[k]));
      const range = h("input", { type: "range", min, max, step, value: TUNING[k],
        oninput: () => { TUNING[k] = Number(range.value); val.textContent = range.value; saveTuning(); refresh(); } });
      return h("label", {}, h("span", {}, k), val, range);
    });
    refresh();
    this.tunePanel = h("div", { class: "tune" },
      ...rows,
      h("div", { class: "row" },
        h("button", { onclick: () => { resetTuning(); this.toggleTune(); this.toggleTune(); } }, "Reset"),
        h("button", { class: "ghost", onclick: () => navigator.clipboard?.writeText(out.value) }, "Copy"),
      ),
      out,
    );
    this.ctx.overlay.append(this.tunePanel);
  }

  dispose() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = -1;
    this.sim?.free();
    this.ball.dispose();
    this.input.detach();
    removeEventListener("resize", this.onResize);
    removeEventListener("keydown", this.onKey);
    clear(this.ctx.overlay);
  }
}
