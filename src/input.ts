import { TUNING } from "./tuning.ts";

const TILT_KEY = "balling.tilt";
const clamp = (v: number) => Math.max(-1, Math.min(1, v));
// Tilt steering is one setting for the whole app: switched in the settings, it takes effect at
// once in any attached Input (so from the pause menu too), and is remembered.
let tilt = false;
try { tilt = localStorage.getItem(TILT_KEY) === "1"; } catch { /* off */ }
// Mouse lock, one setting likewise (on unless switched off): a click on the game captures the mouse,
// which then turns the camera without ever reaching the screen's edge; Esc lets it go.
const LOCK_KEY = "balling.mouseLock";
// The most a locked mouse can honestly move in one event, in pixels; more is a glitch.
const MAX_LOCKED_STEP = 250;
let mouseLock = true;
try { mouseLock = localStorage.getItem(LOCK_KEY) !== "0"; } catch { /* on */ }
const live = new Set<Input>();

export class Input {
  steer = 0;
  throttle = 0;
  get tiltOn(): boolean { return tilt; }
  private keys = new Set<string>();
  private drag: { id: number; x: number; y: number; mouse: boolean } | null = null;
  private lookPx = 0;
  private tiltSteer = 0;
  private tiltThrottle = 0;
  private neutralBeta = 40;
  private cleanup: (() => void)[] = [];
  private el: HTMLElement | null = null;

  attach(el: HTMLElement): void {
    this.el = el;
    const on = <K extends keyof WindowEventMap>(k: K, fn: (e: WindowEventMap[K]) => void) => {
      addEventListener(k, fn);
      this.cleanup.push(() => removeEventListener(k, fn));
    };
    on("keydown", (e) => { if (!(e.target instanceof HTMLInputElement)) this.keys.add(e.code); });
    on("keyup", (e) => this.keys.delete(e.code));
    on("blur", () => this.keys.clear());
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse") this.lock();
      if (!this.drag) { this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, mouse: e.pointerType === "mouse" }; el.setPointerCapture(e.pointerId); }
    };
    // A mouse drag (any button) turns the camera, and so the heading, by the distance moved; a touch drag is a
    // virtual stick that keeps steering and throttling while held off centre.
    const move = (e: PointerEvent) => {
      // A locked mouse now and then reports a jump of hundreds of pixels in one event (a browser fault); drop it.
      if (document.pointerLockElement === el) { if (Math.abs(e.movementX) <= MAX_LOCKED_STEP) this.lookPx += e.movementX; return; }
      if (this.drag?.id !== e.pointerId) return;
      if (this.drag.mouse) { this.lookPx += e.clientX - this.drag.x; this.drag.x = e.clientX; return; }
      this.steerPtr = clamp((e.clientX - this.drag.x) / 70);
      this.throttlePtr = clamp(-(e.clientY - this.drag.y) / 70);
    };
    const up = (e: PointerEvent) => { if (this.drag?.id === e.pointerId) { this.drag = null; this.steerPtr = 0; this.throttlePtr = 0; } };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    const menu = (e: Event) => e.preventDefault();
    el.addEventListener("contextmenu", menu);
    this.cleanup.push(() => { el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); el.removeEventListener("contextmenu", menu); });
    const orient = (e: DeviceOrientationEvent) => {
      if (!tilt || e.gamma == null || e.beta == null) return;
      // Degrees of roll / pitch for full steer and full throttle.
      this.tiltSteer = clamp(e.gamma / TUNING.tiltRange);
      this.tiltThrottle = clamp((this.neutralBeta - e.beta) / TUNING.tiltPitchRange);
    };
    on("deviceorientation", orient);
    live.add(this);
  }
  private steerPtr = 0;
  private throttlePtr = 0;

  static tiltEnabled(): boolean { return tilt; }

  static mouseLockEnabled(): boolean { return mouseLock; }

  static setMouseLock(on: boolean): void {
    mouseLock = on;
    try { localStorage.setItem(LOCK_KEY, on ? "1" : "0"); } catch { /* this session only */ }
    if (!on && document.pointerLockElement) document.exitPointerLock();
  }

  // Captures the mouse, if mouse lock is on; call it from a click. It asks for the raw mouse (no OS
  // acceleration, which is where locked movement's sudden jumps come from) and takes a plain lock where
  // that is not offered. A refused lock (the browser waits a moment after Esc) leaves the drag to turn.
  lock(): void {
    if (!mouseLock || !this.el || document.pointerLockElement === this.el) return;
    const el = this.el, plain = () => { try { (el.requestPointerLock() as unknown as Promise<void> | undefined)?.catch(() => {}); } catch { /* drag instead */ } };
    try {
      const raw = (el as unknown as { requestPointerLock(o: { unadjustedMovement: boolean }): Promise<void> | undefined }).requestPointerLock({ unadjustedMovement: true });
      raw?.catch((e: unknown) => { if (e instanceof DOMException && e.name === "NotSupportedError") plain(); });
    } catch { plain(); }
  }

  static tiltAvailable(): boolean {
    return typeof DeviceOrientationEvent !== "undefined";
  }

  // Turns tilt steering on; iOS asks the player for motion access first (call it from a tap).
  // Whatever angle the device is held at next counts as no throttle.
  static async requestTilt(): Promise<boolean> {
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof D.requestPermission === "function") {
      try { if ((await D.requestPermission()) !== "granted") return false; } catch { return false; }
    }
    tilt = true;
    try { localStorage.setItem(TILT_KEY, "1"); } catch { /* this session only */ }
    for (const i of live) i.calibrate();
    return true;
  }

  static disableTilt(): void {
    tilt = false;
    try { localStorage.removeItem(TILT_KEY); } catch { /* this session only */ }
    for (const i of live) { i.tiltSteer = 0; i.tiltThrottle = 0; }
  }

  calibrate(): void {
    const once = (e: DeviceOrientationEvent) => { if (e.beta != null) this.neutralBeta = e.beta; };
    addEventListener("deviceorientation", once, { once: true });
  }

  // Mouse drag since the last call, in pixels; the caller turns it into yaw.
  takeLookPx(): number {
    const px = this.lookPx;
    this.lookPx = 0;
    return px;
  }

  update(): void {
    const k = this.keys;
    const ks = (k.has("ArrowRight") || k.has("KeyD") ? 1 : 0) - (k.has("ArrowLeft") || k.has("KeyA") ? 1 : 0);
    const kt = (k.has("ArrowUp") || k.has("KeyW") ? 1 : 0) - (k.has("ArrowDown") || k.has("KeyS") ? 1 : 0);
    this.steer = clamp(ks + this.steerPtr + this.tiltSteer);
    this.throttle = clamp(kt + this.throttlePtr + this.tiltThrottle);
  }

  detach(): void {
    live.delete(this);
    this.el = null;
    for (const c of this.cleanup) c();
    this.cleanup = [];
  }
}
