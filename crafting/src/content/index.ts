import type { Content } from "../engine/types.ts";
import items from "./items.json";
import recipes from "./recipes.json";
import stations from "./stations.json";
import techs from "./techs.json";
import gatherNodes from "./gather.json";
import enemies from "./enemies.json";
import meta from "./meta.json";

export const baseContent: Content = {
  items: items as unknown as Content["items"],
  recipes: recipes as unknown as Content["recipes"],
  stations: stations as unknown as Content["stations"],
  techs: techs as unknown as Content["techs"],
  gatherNodes: gatherNodes as unknown as Content["gatherNodes"],
  enemies: enemies as unknown as Content["enemies"],
  skills: meta.skills,
  startTechs: meta.startTechs,
  goals: meta.goals,
};
