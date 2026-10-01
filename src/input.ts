import { TUNING } from "./tuning.ts";

const TILT_KEY = "balling.tilt";
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export class Input {
  steer = 0;
  throttle = 0;
  tiltOn = false;
  private keys = new Set<string>();
  private drag: { id: number; x: number; y: number; mouse: boolean } | null = null;
  private lookPx = 0;
  private tiltSteer = 0;
  private tiltThrottle = 0;
  private neutralBeta = 40;
  private cleanup: (() => void)[] = [];

  attach(el: HTMLElement): void {
    const on = <K extends keyof WindowEventMap>(k: K, fn: (e: WindowEventMap[K]) => void) => {
      addEventListener(k, fn);
      this.cleanup.push(() => removeEventListener(k, fn));
    };
    on("keydown", (e) => { if (!(e.target instanceof HTMLInputElement)) this.keys.add(e.code); });
    on("keyup", (e) => this.keys.delete(e.code));
    on("blur", () => this.keys.clear());
    const down = (e: PointerEvent) => {
      if (!this.drag) { this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, mouse: e.pointerType === "mouse" }; el.setPointerCapture(e.pointerId); }
    };
    // A mouse drag (any button) turns the camera, and so the heading, by the distance moved; a touch drag is a
    // virtual stick that keeps steering and throttling while held off centre.
    const move = (e: PointerEvent) => {
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
      if (!this.tiltOn || e.gamma == null || e.beta == null) return;
      // Degrees of roll / pitch for full steer and full throttle.
      this.tiltSteer = clamp(e.gamma / TUNING.tiltRange);
      this.tiltThrottle = clamp((this.neutralBeta - e.beta) / TUNING.tiltPitchRange);
    };
    on("deviceorientation", orient);
    if (localStorage.getItem(TILT_KEY) === "1") this.tiltOn = true;
  }
  private steerPtr = 0;
  private throttlePtr = 0;

  static tiltAvailable(): boolean {
    return typeof DeviceOrientationEvent !== "undefined";
  }

  static async requestTilt(): Promise<boolean> {
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof D.requestPermission === "function") {
      try { if ((await D.requestPermission()) !== "granted") return false; } catch { return false; }
    }
    localStorage.setItem(TILT_KEY, "1");
    return true;
  }

  static disableTilt(): void {
    localStorage.removeItem(TILT_KEY);
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
    for (const c of this.cleanup) c();
    this.cleanup = [];
  }
}
