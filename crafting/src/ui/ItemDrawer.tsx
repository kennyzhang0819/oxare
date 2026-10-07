import { useMemo } from "react";
import { useStore } from "../game/store.ts";
import { rawCostPerUnit } from "../engine/plan.ts";
import { ItemChip, fmtN, fmtTime } from "./common.tsx";

export function ItemDrawer() {
  const g = useStore((s) => s.graph);
  const id = useStore((s) => s.selectedItem);
  const select = useStore((s) => s.select);
  const pin = useStore((s) => s.pin);
  const setScreen = useStore((s) => s.setScreen);
  const have = useStore((s) => (id ? s.game.inventory[id] ?? 0 : 0));
  const idx = id ? g.itemIndex.get(id) : undefined;
  const cost = useMemo(() => (idx === undefined ? null : rawCostPerUnit(g, idx)), [g, idx]);
  if (id === null || idx === undefined) return null;
  const it = g.items[idx];
  const src = g.sources[idx];
  const consumers = g.consumers[idx];
  const techsUsing = g.content.techs.filter((t) => id in t.cost);
  const pinAndGo = () => { pin(id, 1); setScreen("goals"); select(null); };
  return (
    <>
      <div className="drawer-backdrop" onClick={() => select(null)} />
      <aside className="drawer">
        <h2>
          <span>{it.icon}</span> {it.name}
          <button className="btn small close" onClick={() => select(null)}>✕</button>
        </h2>
        {it.description && <div className="muted">{it.description}</div>}
        <dl className="kv">
          <dt>id</dt><dd><code>{it.id}</code></dd>
          <dt>category</dt><dd>{it.category}</dd>
          <dt>tier</dt><dd>{it.tier}</dd>
          <dt>owned</dt><dd>{fmtN(have)}</dd>
          <dt>depth</dt><dd>{g.depth[idx]}</dd>
          {it.equip && <><dt>equip</dt><dd>{it.equip.slot}{it.equip.attack ? ` ⚔️${it.equip.attack}` : ""}{it.equip.defense ? ` 🛡️${it.equip.defense}` : ""}{it.equip.hp ? ` ❤️${it.equip.hp}` : ""}{it.equip.toolTier ? ` tool tier ${it.equip.toolTier}` : ""}</dd></>}
        </dl>
        <div className="btn-row">
          <button className="btn primary" onClick={pinAndGo}>🎯 Pin as goal</button>
        </div>

        <div>
          <h3>Made by</h3>
          {src.recipes.length === 0 && <div className="muted small">No recipe.</div>}
          {src.recipes.map((ri) => {
            const r = g.recipes[ri];
            return (
              <div key={ri} className="recipe-row" style={{ gridTemplateColumns: "1fr" }}>
                <div className="row small muted">
                  <span>{g.stationIndex.get(r.station)?.icon} {g.stationIndex.get(r.station)?.name ?? r.station}</span>
                  <span>{fmtTime(r.time)}</span>
                  {r.unlock && <span>📜 {g.techIndex.get(r.unlock)?.name ?? r.unlock}</span>}
                  {r.tags?.includes("recycle") && <span>♻️</span>}
                </div>
                <div className="recipe-io">
                  {g.recipeInputs[ri].map((inp) => <ItemChip key={inp.item} id={g.items[inp.item].id} qty={inp.qty} showHave />)}
                  <span className="arrow">→</span>
                  {g.recipeOutputs[ri].map((o) => <ItemChip key={o.item} id={g.items[o.item].id} qty={o.qty} />)}
                </div>
              </div>
            );
          })}
        </div>

        {(src.gatherNodes.length > 0 || src.enemies.length > 0) && (
          <div>
            <h3>Found at</h3>
            <div className="small" style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
              {src.gatherNodes.map((gi) => {
                const n = g.content.gatherNodes[gi];
                const d = n.drops.find((x) => x.item === id)!;
                return <div key={n.id}>⛏️ {n.name}: {d.min}–{d.max} @{Math.round(d.chance * 100)}% every {fmtTime(n.time)}{n.toolTier ? ` (tool tier ${n.toolTier})` : ""}</div>;
              })}
              {src.enemies.map((ei) => {
                const e = g.content.enemies[ei];
                const d = e.drops.find((x) => x.item === id)!;
                return <div key={e.id}>⚔️ {e.name} ({e.region}): {d.min}–{d.max} @{Math.round(d.chance * 100)}%</div>;
              })}
            </div>
          </div>
        )}

        <div>
          <h3>Used by</h3>
          {consumers.length === 0 && techsUsing.length === 0 && <div className="muted small">Nothing yet.</div>}
          <div className="chips" style={{ marginTop: 6 }}>
            {consumers.map((ri) => g.recipeOutputs[ri].map((o) => <ItemChip key={`${ri}-${o.item}`} id={g.items[o.item].id} />))}
            {techsUsing.map((t) => <span key={t.id} className="chip">📜 {t.name}</span>)}
          </div>
        </div>

        {cost && !g.raw[idx] && (
          <div>
            <h3>Raw materials per unit</h3>
            <div className="chips" style={{ marginTop: 6 }}>
              {[...cost.entries()].sort((a, b) => b[1] - a[1]).map(([i, n]) => <ItemChip key={i} id={g.items[i].id} qty={Math.round(n * 100) / 100} />)}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
