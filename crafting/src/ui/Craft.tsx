import { useState } from "react";
import { useStore } from "../game/store.ts";
import { recipeAvailable, techUnlocked } from "../engine/sim.ts";
import { maxCrafts } from "../engine/plan.ts";
import { CountButtons, ItemChip, Locked, Progress, fmtTime } from "./common.tsx";

export function Craft() {
  const g = useStore((s) => s.graph);
  const game = useStore((s) => s.game);
  const craft = useStore((s) => s.craft);
  const [station, setStation] = useState(g.content.stations[0]?.id ?? "");
  const [onlyCraftable, setOnlyCraftable] = useState(false);
  const recipes = g.recipes.map((r, ri) => ({ r, ri })).filter((x) => x.r.station === station);

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1>Craft</h1>
        <span className="muted small">Click any ingredient to see where it comes from, or pin it as a goal.</span>
      </div>
      <div className="tabs">
        {g.content.stations.map((s) => {
          const open = techUnlocked(game, s.unlock);
          return (
            <button key={s.id} className={"tab" + (station === s.id ? " active" : "") + (open ? "" : " locked")} onClick={() => setStation(s.id)}>
              {s.icon} {s.name}{!open && " 🔒"}
            </button>
          );
        })}
        <label className="row small muted" style={{ marginLeft: "auto" }}>
          <input type="checkbox" checked={onlyCraftable} onChange={(e) => setOnlyCraftable(e.target.checked)} /> craftable only
        </label>
      </div>
      {recipes.length === 0 && <div className="muted">No recipes here.</div>}
      {recipes.map(({ r, ri }) => {
        const avail = recipeAvailable(g, game, ri);
        const max = maxCrafts(g, ri, game.inventory);
        if (onlyCraftable && (!avail.ok || max === 0)) return null;
        const active = game.action?.kind === "craft" && game.action.recipe === r.id;
        const name = r.name ?? g.recipeOutputs[ri].map((o) => g.items[o.item].name).join(" + ");
        return (
          <div key={r.id} className={"recipe-row" + (active ? " active" : "")}>
            <div>
              <div className="row" style={{ marginBottom: 6 }}>
                <strong>{name}</strong>
                <span className="muted small">{fmtTime(r.time)}</span>
                {r.tags?.includes("recycle") && <span className="muted small">♻️ recycle</span>}
                {active && game.action?.kind === "craft" && (
                  <span className="muted small">{Number.isFinite(game.action.remaining) ? `${game.action.remaining} left` : "continuous"}</span>
                )}
              </div>
              <div className="recipe-io">
                {g.recipeInputs[ri].map((inp) => (
                  <ItemChip key={inp.item} id={g.items[inp.item].id} qty={inp.qty} showHave />
                ))}
                <span className="arrow">→</span>
                {g.recipeOutputs[ri].map((o) => (
                  <ItemChip key={o.item} id={g.items[o.item].id} qty={o.qty} />
                ))}
              </div>
              {active && game.action?.kind === "craft" && (
                <Progress value={game.action.progress} max={r.time} className="" />
              )}
            </div>
            <div>
              {avail.ok ? <CountButtons onPick={(n) => craft(r.id, n)} max={max} /> : <Locked why={avail.why} />}
            </div>
          </div>
        );
      })}
    </>
  );
}
