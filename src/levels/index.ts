import { validateLevel, type Level } from "../level.ts";

const mods = import.meta.glob("./*.json", { eager: true, import: "default" }) as Record<string, unknown>;

export const LEVELS: Level[] = Object.keys(mods).sort().map((k) => validateLevel(mods[k]));
