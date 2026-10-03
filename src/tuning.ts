export const TUNING = {
  gravity: 5,
  throttleForce: 8.5,
  // Share of a slope's pull against the push cancelled while the ball is pushed up it; the sideways pull stays.
  climbAssist: 0.4,
  maxSpeed: 8,
  linearDamping: 0.8,
  angularDamping: 0.8,
  yawRate: 1.8,
  tiltRange: 10,
  tiltPitchRange: 10,
  mouseSens: 0.0025,
  camDist: 4,
  camHeight: 2,
  camBallGap: 0.9,
  // Share of the ball's weight a steep wall can carry while the ball is pressed against it in the air.
  wallGrip: 1,
  // Gravity on movable props (crates, bridge planks, knock-down planks) as a fraction of the ball's.
  propGravity: 0.5,
  // Stools and sliding kickers: their mass (the ball's is 1), then, once the ball has let go, a drag against
  // their speed (per second) plus a steady friction (units/s²) that stops them dead.
  slideMass: 0.75,
  slideDrag: 0.3,
  slideFriction: 0.4,
  // Crates and barrels: linear and angular damping, so a barrel stops rolling.
  propDamping: 0.8,
  // Bumper: the ball leaves at this share of the speed it hit with, and never slower than bumperKick.
  bumperBounce: 0.8,
  bumperKick: 2,
  // Magnet: its pull, fading to nothing at its reach (compare throttleForce), but never more than
  // magnetHold of throttleForce, so full throttle away always escapes.
  magnetForce: 21,
  magnetHold: 0.8,
  // Treadmill: how fast its rods' tops run, and so how fast a ball left on it rides along.
  beltSpeed: 3,
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
  camDist: [3, 7, 0.25],
  camHeight: [1, 4, 0.25],
  camBallGap: [0, 3, 0.1],
  wallGrip: [0, 1, 0.05],
  propGravity: [0.1, 2, 0.05],
  slideMass: [0.1, 3, 0.05],
  slideDrag: [0, 10, 0.25],
  slideFriction: [0, 15, 0.25],
  propDamping: [0, 5, 0.1],
  bumperBounce: [0, 2, 0.05],
  bumperKick: [0, 15, 0.5],
  magnetForce: [0, 30, 0.5],
  magnetHold: [0, 0.9, 0.05],
  beltSpeed: [0, 25, 0.5],
};

export const DEFAULT_TUNING: Tuning = { ...TUNING };
// The player's own settings (Options and the pause menu), kept out of the tune panel and its Reset.
export const PLAYER_KEYS: TuningKey[] = ["yawRate", "mouseSens", "camDist", "camHeight"];
// Settled values: not in the tune panel and never read back from the browser, so they are what the code says.
export const FIXED_KEYS: TuningKey[] = ["bumperBounce", "bumperKick", "magnetForce", "magnetHold"];
const KEY = "balling.tuning";

export function loadTuning(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Tuning>;
    for (const k of Object.keys(TUNING) as TuningKey[]) {
      if (FIXED_KEYS.includes(k)) continue;
      const v = saved[k];
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const [lo, hi] = TUNING_RANGES[k];
      TUNING[k] = PLAYER_KEYS.includes(k) ? Math.max(lo, Math.min(hi, v)) : v;
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
  for (const k of Object.keys(TUNING) as TuningKey[]) if (!PLAYER_KEYS.includes(k)) TUNING[k] = DEFAULT_TUNING[k];
  saveTuning();
}
