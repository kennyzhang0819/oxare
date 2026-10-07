import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildGraph } from "../src/engine/graph.ts";
import { validate, summarize } from "../src/engine/validate.ts";
import { planGoal } from "../src/engine/plan.ts";
import type { Content } from "../src/engine/types.ts";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../src/content");
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const meta = read("meta.json");
const content: Content = {
  items: read("items.json"), recipes: read("recipes.json"), stations: read("stations.json"), techs: read("techs.json"),
  gatherNodes: read("gather.json"), enemies: read("enemies.json"), skills: meta.skills, startTechs: meta.startTechs, goals: meta.goals,
};

const t0 = performance.now();
const g = buildGraph(content);
const diags = validate(g);
const ms = (performance.now() - t0).toFixed(1);
for (const d of diags) console.log(`${d.severity.padEnd(5)} ${d.code.padEnd(16)} ${d.kind}:${d.id}  ${d.message}`);
const s = summarize(diags);
console.log(`\n${g.items.length} items, ${g.recipes.length} recipes, ${g.cycles.length} cycles, max depth ${Math.max(...g.depth)}; built+validated in ${ms}ms`);
console.log(`${s.errors} errors, ${s.warnings} warnings, ${s.infos} infos`);
for (const goal of content.goals ?? []) {
  const p = planGoal(g, {}, g.itemIndex.get(goal)!, 1);
  const raws = [...p.rawTotals].sort((a, b) => b[1] - a[1]).map(([i, n]) => `${g.items[i].name} ${n}`).join(", ");
  console.log(`goal ${goal}: ${p.nodes} plan nodes; raw: ${raws}`);
}
if (s.errors > 0) process.exit(1);
