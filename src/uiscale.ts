// The player's UI size: everything over the game (#overlay) is drawn at this scale, remembered in the browser.
const KEY = "rustbloom.uiScale";
export const UI_SCALE = { min: 0.7, max: 1.5, step: 0.05, default: 1 };

export function uiScale(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    if (v >= UI_SCALE.min && v <= UI_SCALE.max) return v;
  } catch { /* the default */ }
  return UI_SCALE.default;
}

export function applyUiScale(v = uiScale()): void {
  const overlay = document.getElementById("overlay");
  if (!overlay) return;
  overlay.style.zoom = v === 1 ? "" : String(v);
  overlay.style.setProperty("--ui", String(v));
}

export function setUiScale(v: number): void {
  try { localStorage.setItem(KEY, String(v)); } catch { /* this visit only */ }
  applyUiScale(v);
}
