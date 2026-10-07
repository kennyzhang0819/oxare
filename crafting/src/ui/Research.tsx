import { useStore } from "../game/store.ts";
import { techAvailable } from "../engine/sim.ts";
import { QtyList, Section } from "./common.tsx";

export function Research() {
  const g = useStore((s) => s.graph);
  const game = useStore((s) => s.game);
  const research = useStore((s) => s.research);
  const tiers = [...new Set(g.content.techs.map((t) => t.tier))].sort((a, b) => a - b);
  const unlocks = (id: string) => ({
    stations: g.content.stations.filter((s) => s.unlock === id).map((s) => s.name),
    recipes: g.content.recipes.filter((r) => r.unlock === id).length,
    enemies: g.content.enemies.filter((e) => e.unlock === id).map((e) => e.name),
    nodes: g.content.gatherNodes.filter((n) => n.unlock === id).map((n) => n.name),
  });
  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1>Research</h1>
        <span className="muted small">Pay materials once, unlock forever.</span>
      </div>
      {tiers.map((tier) => (
        <Section key={tier} title={`Tier ${tier}`}>
          <div className="cards">
            {g.content.techs.filter((t) => t.tier === tier).map((t) => {
              const done = game.techs.includes(t.id);
              const avail = techAvailable(g, game, t.id);
              const u = unlocks(t.id);
              return (
                <div key={t.id} className={"card" + (done ? " active" : "")}>
                  <div className="card-title">
                    {done ? "✅" : "📜"} {t.name}
                  </div>
                  {t.description && <div className="small muted">{t.description}</div>}
                  <div className="small">
                    {u.stations.length > 0 && <div>🏠 {u.stations.join(", ")}</div>}
                    {u.recipes > 0 && <div>📋 {u.recipes} recipes</div>}
                    {u.enemies.length > 0 && <div>👾 {u.enemies.join(", ")}</div>}
                    {u.nodes.length > 0 && <div>⛏️ {u.nodes.join(", ")}</div>}
                  </div>
                  {t.requires && t.requires.length > 0 && (
                    <div className="small muted">needs {t.requires.map((r) => g.techIndex.get(r)?.name ?? r).join(", ")}</div>
                  )}
                  {!done && <QtyList qty={t.cost} showHave />}
                  {!done && (
                    <button className="btn primary" disabled={!avail.ok} onClick={() => research(t.id)} title={avail.why}>
                      {avail.ok ? "Research" : avail.why}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      ))}
    </>
  );
}
