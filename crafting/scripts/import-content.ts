// Split an exported content.json bundle (from the in-game admin) back into src/content/*.json.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Content } from "../src/engine/types.ts";

const file = process.argv[2];
if (!file) {
  console.error("usage: npm run import-content -- path/to/content.json");
  process.exit(2);
}
const c = JSON.parse(readFileSync(file, "utf8")) as Content;
const dir = join(dirname(fileURLToPath(import.meta.url)), "../src/content");
const write = (name: string, data: unknown) => writeFileSync(join(dir, name), JSON.stringify(data, null, 2) + "\n");
write("items.json", c.items);
write("recipes.json", c.recipes);
write("stations.json", c.stations);
write("techs.json", c.techs);
write("gather.json", c.gatherNodes);
write("enemies.json", c.enemies);
write("meta.json", { skills: c.skills, startTechs: c.startTechs ?? [], goals: c.goals ?? [] });
console.log(`wrote ${c.items.length} items, ${c.recipes.length} recipes, ${c.stations.length} stations, ${c.techs.length} techs, ${c.gatherNodes.length} gather nodes, ${c.enemies.length} enemies`);
