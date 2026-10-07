import { useMemo, useState } from "react";
import { useStore, recipeChoiceMap } from "../game/store.ts";
import { planGoal, type Plan, type PlanNode } from "../engine/plan.ts";
import { searchItems } from "../engine/graph.ts";
import { ItemChip, Progress, fmtN, recipeLabel } from "./common.tsx";

const STATUS: Record<PlanNode["status"], string> = { done: "✓", partial: "△", missing: "✗", raw: "•" };

export function Goals() {
  const g = useStore((s) => s.graph);
  const game = useStore((s) => s.game);
  const pin = useStore((s) => s.pin);
  const unpin = useStore((s) => s.unpin);
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchItems(g, q, 8), [g, q]);
  const choice = useMemo(() => recipeChoiceMap(g, game.recipeChoice), [g, game.recipeChoice]);

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1>Goals</h1>
        <span className="muted small">Pin something big. The tree shows every missing piece, recursively, against what you own.</span>
      </div>
      <div className="row" style={{ marginBottom: 16 }}>
        <input placeholder="search an item to pin…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280 }} />
        {hits.map((i) => (
          <button key={i} className="btn small" onClick={() => { pin(g.items[i].id, 1); setQ(""); }}>
            {g.items[i].icon} {g.items[i].name}
          </button>
        ))}
        {!q && (g.content.goals ?? []).filter((id) => !game.goals.some((x) => x.item === id)).map((id) => (
          <button key={id} className="btn small" onClick={() => pin(id, 1)}>pin {g.items[g.itemIndex.get(id)!].name}</button>
        ))}
      </div>
      {game.goals.length === 0 && <div className="muted">Nothing pinned.</div>}
      {game.goals.map((goal) => {
        const idx = g.itemIndex.get(goal.item);
        if (idx === undefined) return null;
        const plan = planGoal(g, game.inventory, idx, goal.qty, { recipeChoice: choice });
        return <GoalCard key={goal.item} plan={plan} qty={goal.qty} onQty={(n) => pin(goal.item, n)} onRemove={() => unpin(goal.item)} />;
      })}
    </>
  );
}

function GoalCard({ plan, qty, onQty, onRemove }: { plan: Plan; qty: number; onQty: (n: number) => void; onRemove: () => void }) {
  const g = useStore((s) => s.graph);
  const [expandAll, setExpandAll] = useState<boolean | null>(null);
  const [gen, setGen] = useState(0);
  const it = g.items[plan.root.item];
  const raws = [...plan.rawTotals.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">
        <span className="icon">{it.icon}</span>
        {it.name}
        <input type="number" min={1} value={qty} onChange={(e) => onQty(Math.max(1, Number(e.target.value) || 1))} style={{ width: 64 }} />
        <span className="spacer" />
        <span className="card-meta">{plan.nodes} nodes{plan.truncated ? ", truncated" : ""}</span>
        <button className="btn small" onClick={() => { setExpandAll(true); setGen(gen + 1); }}>expand all</button>
        <button className="btn small" onClick={() => { setExpandAll(false); setGen(gen + 1); }}>collapse</button>
        <button className="btn small" onClick={onRemove}>unpin</button>
      </div>
      <Progress className="goal" value={plan.progress} max={1} label={`${Math.round(plan.progress * 100)}% complete`} />
      <div className="tree" key={gen}>
        <TreeNode node={plan.root} depth={0} forceOpen={expandAll} />
      </div>
      {raws.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 6 }}>Still need to gather or loot</h3>
          <div className="chips">
            {raws.map(([i, n]) => (
              <ItemChip key={i} id={g.items[i].id} qty={n} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TreeNode({ node, depth, forceOpen }: { node: PlanNode; depth: number; forceOpen: boolean | null }) {
  const g = useStore((s) => s.graph);
  const select = useStore((s) => s.select);
  const chooseRecipe = useStore((s) => s.chooseRecipe);
  const [open, setOpen] = useState(forceOpen ?? depth < 1);
  const it = g.items[node.item];
  const producers = g.producers[node.item];
  const hasKids = node.children.length > 0;
  return (
    <div>
      <div className="tree-node">
        <button className="tree-toggle" onClick={() => setOpen(!open)} style={{ visibility: hasKids ? "visible" : "hidden" }}>
          {open ? "▾" : "▸"}
        </button>
        <span className={"tree-status " + node.status}>{STATUS[node.status]}</span>
        <button className="tree-name" onClick={() => select(it.id)}>{it.icon} {it.name}</button>
        {node.crafts > 0 && <span className="tree-craft">craft ×{node.crafts}</span>}
        {node.truncated && <span className="tree-craft">…</span>}
        {producers.length > 1 && node.deficit > 0 && (
          <select className="tree-alt" value={g.recipes[node.recipe].id} onChange={(e) => chooseRecipe(it.id, e.target.value === g.recipes[g.primary[node.item]].id ? null : e.target.value)}>
            {producers.map((ri) => (
              <option key={ri} value={g.recipes[ri].id}>{recipeLabel(g, ri)}</option>
            ))}
          </select>
        )}
        <span className="tree-qty" style={{ color: node.status === "done" ? "var(--ok)" : undefined }}>
          {fmtN(node.have)} / {fmtN(node.need)}
        </span>
      </div>
      {open && hasKids && (
        <div className="tree-children">
          {node.children.map((c, i) => (
            <TreeNode key={i} node={c} depth={depth + 1} forceOpen={forceOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
