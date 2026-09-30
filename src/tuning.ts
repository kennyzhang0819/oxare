export const TUNING = {
  gravity: 7,
  throttleForce: 9,
  maxSpeed: 5,
  linearDamping: 1.0,
  angularDamping: 0.8,
  yawRate: 2.2,
  camDist: 7,
  camHeight: 4.5,
  respawnY: -12,
};
export type Tuning = typeof TUNING;
export type TuningKey = keyof Tuning;

export const TUNING_RANGES: Record<TuningKey, [min: number, max: number, step: number]> = {
  gravity: [1, 25, 0.5],
  throttleForce: [1, 40, 0.5],
  maxSpeed: [1, 20, 0.25],
  linearDamping: [0, 4, 0.05],
  angularDamping: [0, 4, 0.05],
  yawRate: [0.5, 6, 0.1],
  camDist: [3, 16, 0.5],
  camHeight: [1, 12, 0.25],
  respawnY: [-40, -2, 1],
};

export const DEFAULT_TUNING: Tuning = { ...TUNING };
const KEY = "balling.tuning";

export function loadTuning(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Tuning>;
    for (const k of Object.keys(TUNING) as TuningKey[]) {
      const v = saved[k];
      if (typeof v === "number" && Number.isFinite(v)) TUNING[k] = v;
    }
  } catch { /* ignore */ }
}

export function saveTuning(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(TUNING));
}

export function resetTuning(): void {
  Object.assign(TUNING, DEFAULT_TUNING);
  saveTuning();
}
