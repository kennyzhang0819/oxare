const TILT_KEY = "balling.tilt";
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export class Input {
  steer = 0;
  throttle = 0;
  tiltOn = false;
  private keys = new Set<string>();
  private drag: { id: number; x: number; y: number } | null = null;
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
    const down = (e: PointerEvent) => { if (!this.drag) { this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); } };
    const move = (e: PointerEvent) => {
      if (this.drag?.id !== e.pointerId) return;
      this.steerPtr = clamp((e.clientX - this.drag.x) / 70);
      this.throttlePtr = clamp(-(e.clientY - this.drag.y) / 70);
    };
    const up = (e: PointerEvent) => { if (this.drag?.id === e.pointerId) { this.drag = null; this.steerPtr = 0; this.throttlePtr = 0; } };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    this.cleanup.push(() => { el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); });
    const orient = (e: DeviceOrientationEvent) => {
      if (!this.tiltOn || e.gamma == null || e.beta == null) return;
      this.tiltSteer = clamp(e.gamma / 30);
      this.tiltThrottle = clamp((this.neutralBeta - e.beta) / 25);
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
