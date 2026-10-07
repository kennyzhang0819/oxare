import { useStore } from "../game/store.ts";
import { gatherAvailable, toolTier } from "../engine/sim.ts";
import { CountButtons, ItemChip, Locked, Section, fmtTime } from "./common.tsx";

export function Gather() {
  const g = useStore((s) => s.graph);
  const game = useStore((s) => s.game);
  const gather = useStore((s) => s.gather);
  const tier = toolTier(g, game);
  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1>Gather</h1>
        <span className="muted small">Tool tier {tier}. Pick a spot and a count; it keeps going while you plan.</span>
      </div>
      {g.content.skills.map((skill) => (
        <Section key={skill.id} title={<>{skill.icon} {skill.name}</>}>
          <div className="cards">
            {g.content.gatherNodes.filter((n) => n.skill === skill.id).map((node) => {
              const avail = gatherAvailable(g, game, node.id);
              const active = game.action?.kind === "gather" && game.action.node === node.id;
              return (
                <div key={node.id} className={"card" + (active ? " active" : "") + (avail.ok ? "" : " locked")}>
                  <div className="card-title">
                    <span className="icon">{node.icon ?? skill.icon}</span>
                    {node.name}
                    <span className="spacer" />
                    <span className="card-meta">{fmtTime(node.time)}</span>
                  </div>
                  <div className="chips">
                    {node.drops.map((d) => (
                      <span key={d.item} className="row" style={{ gap: 2 }}>
                        <ItemChip id={d.item} />
                        <span className="muted small">{d.min === d.max ? d.min : `${d.min}–${d.max}`}{d.chance < 1 ? ` @${Math.round(d.chance * 100)}%` : ""}</span>
                      </span>
                    ))}
                  </div>
                  {avail.ok ? <CountButtons onPick={(n) => gather(node.id, n)} /> : <Locked why={avail.why} />}
                </div>
              );
            })}
          </div>
        </Section>
      ))}
    </>
  );
}
