import { worldOf, type Level } from "./level.ts";
import { LEVELS } from "./levels/index.ts";

// What the player has done, kept in this browser by level id (docs/levels.md "Progress").
const KEY = "balling.apples";
interface Saved { cleared: string[]; golden: string[]; goldenOpen?: true; seen: string[] }
let saved: Saved = { cleared: [], golden: [], seen: [] };
try {
  const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
  // Saves from before `seen` already showed the golden apple popup if golden apples had appeared.
  if (s && Array.isArray(s.cleared) && Array.isArray(s.golden)) saved = { ...s, seen: Array.isArray(s.seen) ? s.seen : s.goldenOpen ? ["golden"] : [] };
} catch { /* nothing kept */ }
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* this visit only */ } };

// Golden apples appear once the player clears this Basics level (B5), its number in the player's list.
export const GOLDEN_AFTER = 5;
const basics = () => LEVELS.filter((l) => !l.hidden && worldOf(l) === "basics");
export const isFirstLevel = (l: Level): boolean => basics()[0]?.id === l.id;
export const isGoldenOpener = (l: Level): boolean => basics()[GOLDEN_AFTER - 1]?.id === l.id;

export const isCleared = (l: Level): boolean => saved.cleared.includes(l.id);
export const hasGolden = (l: Level): boolean => saved.golden.includes(l.id);
export const goldenOpen = (): boolean => !!saved.goldenOpen;

// Records a clear (`golden`: its golden apples came home too); clearing the opener makes golden apples appear.
export function recordClear(l: Level, golden: boolean): void {
  if (!saved.cleared.includes(l.id)) saved.cleared.push(l.id);
  if (golden && !saved.golden.includes(l.id)) saved.golden.push(l.id);
  if (isGoldenOpener(l)) saved.goldenOpen = true;
  store();
}

// The story popups shown once each, by id ("intro", "powered", "golden"); Other settings can show them all again.
export const seenDialog = (id: string): boolean => saved.seen.includes(id);
export function markSeen(id: string): void {
  if (!saved.seen.includes(id)) { saved.seen.push(id); store(); }
}
export function replayDialogs(): void {
  saved.seen = [];
  store();
}
