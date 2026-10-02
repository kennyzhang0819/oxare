import { validateLevel, type Level } from "../level.ts";

const mods = import.meta.glob("./*.json", { eager: true, import: "default" }) as Record<string, unknown>;

export const LEVELS: Level[] = Object.keys(mods).sort().map((k) => validateLevel(mods[k]));

// In dev, swaps the list for the level files as they are on disk now, so the menu and editor
// never start from an older copy. A deployed build keeps the bundled list.
export async function refreshLevels(): Promise<void> {
  if (!import.meta.env.DEV) return;
  try {
    const res = await fetch("/__level/all", { cache: "no-store" });
    if (res.ok) LEVELS.splice(0, LEVELS.length, ...((await res.json()) as unknown[]).map((l) => validateLevel(l)));
  } catch { /* keep the bundled list */ }
}

// A saved level swaps into the live list in place, so the editor stays open after Save.
if (import.meta.hot) {
  import.meta.hot.accept((mod) => { if (mod) LEVELS.splice(0, LEVELS.length, ...(mod as unknown as { LEVELS: Level[] }).LEVELS); });
}
