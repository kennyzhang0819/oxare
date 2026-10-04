import { worldOf, type Level } from "./level.ts";
import { LEVELS } from "./levels/index.ts";

// What the player has done, kept in this browser by level id (docs/levels.md "Progress").
const KEY = "balling.apples";
interface Saved { cleared: string[]; golden: string[]; goldenOpen?: true }
let saved: Saved = { cleared: [], golden: [] };
try {
  const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
  if (s && Array.isArray(s.cleared) && Array.isArray(s.golden)) saved = s;
} catch { /* nothing kept */ }
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* this visit only */ } };

// Golden apples appear once the player clears this Basics level (B5), its number in the player's list.
export const GOLDEN_AFTER = 5;
const opener = () => LEVELS.filter((l) => !l.hidden && worldOf(l) === "basics")[GOLDEN_AFTER - 1];

export const isCleared = (l: Level): boolean => saved.cleared.includes(l.id);
export const hasGolden = (l: Level): boolean => saved.golden.includes(l.id);
export const goldenOpen = (): boolean => !!saved.goldenOpen;
export const levelHasGolden = (l: Level): boolean => l.pieces.some((p) => p.type === "apple" && p.golden);

// Records a clear (`golden`: its golden apples came home too); true when this clear is the one that
// makes golden apples appear.
export function recordClear(l: Level, golden: boolean): boolean {
  if (!saved.cleared.includes(l.id)) saved.cleared.push(l.id);
  if (golden && !saved.golden.includes(l.id)) saved.golden.push(l.id);
  const opens = !saved.goldenOpen && opener()?.id === l.id;
  if (opens) saved.goldenOpen = true;
  store();
  return opens;
}
