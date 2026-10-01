export const TUNING = {
  gravity: 5,
  throttleForce: 8,
  // Share of a slope's backward pull cancelled while the ball is pushed up it (ramps, kickers, tubes).
  climbAssist: 0.2,
  maxSpeed: 10,
  linearDamping: 0.8,
  angularDamping: 0.8,
  yawRate: 1.8,
  tiltRange: 10,
  tiltPitchRange: 10,
  mouseSens: 0.0025,
  yawEase: 0.08,
  camDist: 4,
  camHeight: 2,
  camBallGap: 0.9,
  respawnY: -12,
  // Gravity on movable props (crates, bridge planks, knock-down planks) as a fraction of the ball's.
  propGravity: 0.7,
};
export type Tuning = typeof TUNING;
export type TuningKey = keyof Tuning;

export const TUNING_RANGES: Record<TuningKey, [min: number, max: number, step: number]> = {
  gravity: [1, 25, 0.5],
  throttleForce: [1, 40, 0.5],
  climbAssist: [0, 1, 0.05],
  maxSpeed: [1, 20, 0.25],
  linearDamping: [0, 4, 0.05],
  angularDamping: [0, 4, 0.05],
  yawRate: [0.5, 6, 0.1],
  tiltRange: [5, 45, 1],
  tiltPitchRange: [5, 45, 1],
  mouseSens: [0.0005, 0.01, 0.0005],
  yawEase: [0, 0.5, 0.01],
  camDist: [3, 16, 0.5],
  camHeight: [1, 12, 0.25],
  camBallGap: [0, 3, 0.1],
  respawnY: [-40, -2, 1],
  propGravity: [0.1, 2, 0.05],
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

// Only values that differ from the defaults are stored, so a new default reaches untouched dials.
export function saveTuning(): void {
  if (typeof localStorage === "undefined") return;
  const diff: Partial<Tuning> = {};
  for (const k of Object.keys(TUNING) as TuningKey[]) if (TUNING[k] !== DEFAULT_TUNING[k]) diff[k] = TUNING[k];
  localStorage.setItem(KEY, JSON.stringify(diff));
}

export function resetTuning(): void {
  Object.assign(TUNING, DEFAULT_TUNING);
  saveTuning();
}
