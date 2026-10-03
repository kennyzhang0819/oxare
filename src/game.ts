import * as THREE from "three";
import { Input } from "./input.ts";
import { BALL_RADIUS, GOAL_BEAM_H, moverAt, moverShift, type Level } from "./level.ts";
import { buildLevel, createScene, fitSun, makeBall, posePlank, turnBelts, type Built, type SceneEnv } from "./scene.ts";
import { STEP, createSim, type Sim } from "./sim.ts";
import { DEFAULT_TUNING, FIXED_KEYS, PLAYER_KEYS, TUNING, TUNING_RANGES, resetTuning, saveTuning, type TuningKey } from "./tuning.ts";
import { slider } from "./slider.ts";
import { clear, fmtTime, h } from "./ui.ts";
import type { Ctx, Mode } from "./main.ts";

const PROGRESS_KEY = "balling.progress";
type Progress = Record<string, { best: number }>;
export function loadProgress(): Progress {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}") as Progress; } catch { return {}; }
}

export interface PlayFrom { x: number; y: number; z: number; yaw: number }
// `admin` (played from the admin panel or the editor) adds the feel-tuning panel: a Tune button and T.
export interface GameOpts { onExit(): void; onNext?: () => void; onRetry(): void; from?: PlayFrom; admin?: boolean }

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
  private yaw = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private time = 0;
  private falls = 0;
  private done = false;
  private frames = 0;
  private hud: HTMLElement;
  private tunePanel: HTMLElement | null = null;
  private pauseMenu: HTMLElement | null = null;
  private onResize = () => this.resize();
  // Set when the game lets go of the mouse itself, so only the player's Esc out of the lock pauses.
  private released = false;
  private unlockedAt = -Infinity;
  private onLock = () => {
    if (document.pointerLockElement) return;
    this.unlockedAt = performance.now();
    if (this.released) { this.released = false; return; }
    if (!this.done && !this.pauseMenu) this.togglePause();
  };
  private onKey = (e: KeyboardEvent) => {
    // The Esc that ended a mouse lock has already paused.
    if (e.code === "Escape" && !this.done && performance.now() - this.unlockedAt > 300) this.togglePause();
    if (e.code === "KeyT" && this.opts.admin && !(e.target instanceof HTMLInputElement)) this.toggleTune();
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
    fitSun(this.sun, this.built);
    this.hud = h("div", { class: "hud" },
      h("span", { class: "spacer" }),
      opts.admin ? h("button", { class: "ghost", onclick: () => this.toggleTune() }, "Tune (T)") : null,
      h("button", { class: "ghost", onclick: () => { if (!this.done) this.togglePause(); } }, "Menu"),
    );
    ctx.overlay.append(this.hud);
    this.input.attach(ctx.canvas);
    this.input.lock();
    if (this.input.tiltOn) this.input.calibrate();
    addEventListener("resize", this.onResize);
    addEventListener("keydown", this.onKey);
    document.addEventListener("pointerlockchange", this.onLock);
    this.resize();
    void this.boot();
  }

  private async boot() {
    if (this.opts.from) this.yaw = this.opts.from.yaw;
    this.sim = await createSim(this.level, this.opts.from);
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
    const lookPx = this.input.takeLookPx();
    if (!this.done && !this.pauseMenu) {
      this.yaw -= this.input.steer * TUNING.yawRate * dt + lookPx * TUNING.mouseSens;
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
    turnBelts(this.built, sim.beltTravel - TUNING.beltSpeed * STEP * (1 - alpha));
    for (const s of sim.spinners) {
      const bar = this.built.spinnerBars.get(s.index);
      if (bar) bar.rotation.y = s.angle - s.speed * STEP * (1 - alpha);
    }
    // Moving platforms by their schedule at the same in-between moment the ball is drawn at.
    for (const m of sim.movers) {
      const g = this.built.movers.get(m.index);
      if (g) { const at = moverAt(m.piece, sim.time - STEP * (1 - alpha)); g.position.set(at.x, at.y, at.z); }
    }
    // What rides a moving platform goes with it (a crate or barrel is placed by its own body below).
    for (const [i, m] of sim.riders) {
      const g = this.built.pieceGroups[i], p = this.level.pieces[i];
      if (!g || !p || p.type === "crate" || p.type === "barrel") continue;
      const d = moverShift(m.piece, sim.time - STEP * (1 - alpha));
      g.position.set(p.x + d.x, p.y + d.y, p.z + d.z);
    }
    for (const c of sim.crates) {
      const g = this.built.crates.get(c.index);
      if (!g) continue;
      const t = c.body.translation(), q = c.body.rotation();
      g.position.set(t.x, t.y, t.z);
      g.quaternion.set(q.x, q.y, q.z, q.w);
    }
    for (const b of sim.bridges) {
      const planks = this.built.bridges.get(b.index), piece = this.built.pieceGroups[b.index];
      if (!planks || !piece) continue;
      b.planks.forEach((body, k) => { const pg = planks[k]; if (pg) posePlank(piece, pg, body.translation(), body.rotation()); });
    }
    for (const pl of sim.planks) {
      const panel = this.built.planks.get(pl.index), piece = this.built.pieceGroups[pl.index];
      if (panel && piece) posePlank(piece, panel, pl.body.translation(), pl.body.rotation());
    }
    if (!this.done) {
      if (p.y < sim.respawnY) this.fall();
      const goal = this.built.goal;
      if (goal) {
        const gp = this.level.pieces[goal.index]!;
        // Touching the beam anywhere along its height wins, airborne included.
        if (gp.type === "goal" && Math.hypot(p.x - gp.x, p.z - gp.z) < gp.r * 0.7 + BALL_RADIUS && p.y > gp.y - BALL_RADIUS && p.y < gp.y + GOAL_BEAM_H) this.finish();
      }
    }
    this.updateCamera();
    // The mirror refreshes every other frame: six extra scene passes at 60 Hz is the single
    // dearest thing in the loop, and a one-frame-old reflection on a rolling ball is invisible.
    if (this.frames++ % 2 === 0) this.ball.reflect(this.ctx.renderer, this.env);
    this.env.render(this.ctx.renderer, this.camera);
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
    this.camera.position.set(p.x + Math.sin(this.yaw) * TUNING.camDist, p.y + TUNING.camHeight, p.z + Math.cos(this.yaw) * TUNING.camDist);
    this.aim(p);
  }

  // Pitch the camera so the frame's bottom edge sits `camBallGap` ball heights below the
  // ball: the ball rides low in the view and the rest of the frame is scene and sky.
  private aim(p: THREE.Vector3) {
    const c = this.camera.position;
    const hx = p.x - c.x, hz = p.z - c.z, d = Math.hypot(hx, hz) || 1e-6;
    const floorY = p.y - BALL_RADIUS - TUNING.camBallGap * 2 * BALL_RADIUS;
    const pitch = Math.atan2(floorY - c.y, d) + (this.camera.fov * Math.PI) / 360;
    this.camera.lookAt(c.x + (hx / d) * Math.cos(pitch), c.y + Math.sin(pitch), c.z + (hz / d) * Math.cos(pitch));
  }

  private updateCamera() {
    const p = this.shown;
    // Locked to the ball, no easing: the ball holds one spot in the frame however it moves.
    this.camera.position.set(p.x + Math.sin(this.yaw) * TUNING.camDist, p.y + TUNING.camHeight, p.z + Math.cos(this.yaw) * TUNING.camDist);
    this.aim(p);
  }

  private fall() {
    this.falls++;
    this.sim!.respawn();
    this.savePrev();
  }

  private releaseMouse() {
    if (!document.pointerLockElement) return;
    this.released = true;
    document.exitPointerLock();
  }

  private finish() {
    this.done = true;
    this.releaseMouse();
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

  // The in-game menu pauses the run (the clock and physics stop): Resume, Restart, Settings (the
  // player's settings, with Back to the menu) and Quit.
  private togglePause() {
    // While playing the mouse stays locked (if that's on): closing the menu takes it again, and anything
    // that lets it go (Esc, leaving the window) opens the menu.
    if (this.pauseMenu) { this.pauseMenu.remove(); this.pauseMenu = null; this.input.lock(); return; }
    this.releaseMouse();
    const card = h("div", { class: "card pause" });
    const menu = () => card.replaceChildren(
      h("h2", {}, "Paused"),
      h("div", { class: "stack" },
        h("button", { onclick: () => this.togglePause() }, "Resume"),
        h("button", { class: "ghost", onclick: () => this.opts.onRetry() }, "Restart"),
        h("button", { class: "ghost", onclick: settings }, "Settings"),
        h("button", { class: "ghost", onclick: () => this.opts.onExit() }, "Quit"),
      ),
    );
    const settings = () => card.replaceChildren(
      h("h2", {}, "Settings"),
      playerSettings(),
      h("div", { class: "row" }, h("button", { class: "ghost", onclick: menu }, "Back")),
    );
    menu();
    this.pauseMenu = h("div", { class: "banner" }, card);
    this.ctx.overlay.append(this.pauseMenu);
  }

  private toggleTune() {
    if (this.tunePanel) { this.tunePanel.remove(); this.tunePanel = null; this.input.lock(); return; }
    this.releaseMouse();
    const out = h("textarea", { readOnly: true });
    const refresh = () => { out.value = JSON.stringify(TUNING, null, 1); };
    const rows = (Object.keys(TUNING) as TuningKey[]).filter((k) => !PLAYER_KEYS.includes(k) && !FIXED_KEYS.includes(k)).map((k) => {
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
    this.releaseMouse();
    document.removeEventListener("pointerlockchange", this.onLock);
    this.input.detach();
    removeEventListener("resize", this.onResize);
    removeEventListener("keydown", this.onKey);
    clear(this.ctx.overlay);
  }
}

// The player's own settings, shown in the pause menu and under Options on the home screen.
export function playerSettings(): HTMLElement {
  // Speeds read as a share of their default; camera distances in units.
  const row = (label: string, key: TuningKey, units = false) => {
    const [min, max, step] = TUNING_RANGES[key];
    const show = (v = TUNING[key]) => (units ? v.toFixed(2).replace(/\.?0+$/, "") : `${Math.round((v / DEFAULT_TUNING[key]) * 100)}%`);
    const val = h("span", {}, show());
    const range = slider({ min, max, step, value: TUNING[key], mark: DEFAULT_TUNING[key], label, text: show,
      onInput: (v) => { TUNING[key] = v; val.textContent = show(v); saveTuning(); } });
    return h("div", { class: "field" }, h("span", {}, label), val, range);
  };
  const lock = h("input", { type: "checkbox", checked: Input.mouseLockEnabled(), onchange: () => Input.setMouseLock(lock.checked) }) as HTMLInputElement;
  // Tilt steering: on asks for motion access where the device needs it; refused, it stays off.
  const note = h("div", { class: "hint" });
  const tilt = h("input", { type: "checkbox", checked: Input.tiltAvailable() && Input.tiltEnabled(), disabled: !Input.tiltAvailable(),
    onchange: async () => {
      note.textContent = "";
      if (!tilt.checked) { Input.disableTilt(); return; }
      if (!(await Input.requestTilt())) { tilt.checked = false; note.textContent = "Motion access was not allowed."; }
    } }) as HTMLInputElement;
  return h("div", { class: "settings" },
    row("Turn speed (keys)", "yawRate"),
    row("Mouse sensitivity", "mouseSens"),
    h("label", { class: "toggle", title: "On: click the game to capture the mouse, which then turns the camera as far as you like; Esc lets it go. Off: drag to turn" },
      h("span", {}, "Lock mouse to camera"), lock),
    row("Camera distance", "camDist", true),
    row("Camera height", "camHeight", true),
    h("label", { class: "toggle", title: "Steer and throttle by tilting a phone or tablet; the angle it is held at when switched on is level" }, h("span", {}, "Tilt to steer"), tilt),
    Input.tiltAvailable() ? note : h("div", { class: "hint" }, "Tilt needs a phone or tablet."),
  );
}
