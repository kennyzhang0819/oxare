import { validateLevel, type Level } from "../level.ts";

const mods = import.meta.glob("./*.json", { eager: true, import: "default" }) as Record<string, unknown>;

export const LEVELS: Level[] = Object.keys(mods).sort().map((k) => validateLevel(mods[k]));

// A saved level swaps into the live list in place, so the editor stays open after Save.
if (import.meta.hot) {
  import.meta.hot.accept((mod) => { if (mod) LEVELS.splice(0, LEVELS.length, ...(mod as unknown as { LEVELS: Level[] }).LEVELS); });
}
