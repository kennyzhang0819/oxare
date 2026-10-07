import { useStore } from "../game/store.ts";
import { Progress, fmtTime } from "./common.tsx";
import { PLAYER_SWING } from "../engine/sim.ts";

export function Side() {
  const g = useStore((s) => s.graph);
  const game = useStore((s) => s.game);
  const stopAction = useStore((s) => s.stopAction);
  const reset = useStore((s) => s.reset);
  const a = game.action;
  let title = "Idle";
  let progress: { value: number; max: number } | null = null;
  let detail = "";
  if (a?.kind === "gather") {
    const n = g.gatherIndex.get(a.node);
    title = `⛏️ ${n?.name ?? a.node}`;
    progress = { value: a.progress, max: n?.time ?? 1 };
    detail = Number.isFinite(a.remaining) ? `${a.remaining} left` : "continuous";
  } else if (a?.kind === "craft") {
    const ri = g.recipeIndex.get(a.recipe);
    const r = ri === undefined ? undefined : g.recipes[ri];
    title = `🔨 ${r?.name ?? (ri !== undefined ? g.recipeOutputs[ri].map((o) => g.items[o.item].name).join(", ") : a.recipe)}`;
    progress = { value: a.progress, max: r?.time ?? 1 };
    detail = Number.isFinite(a.remaining) ? `${a.remaining} left` : "continuous";
  } else if (a?.kind === "fight") {
    const e = g.enemyIndex.get(a.enemy);
    title = `⚔️ ${e?.name ?? a.enemy}`;
    progress = { value: a.enemyHp, max: e?.hp ?? 1 };
    detail = `swing in ${fmtTime(Math.max(0, PLAYER_SWING - a.playerTimer))}`;
  }
  return (
    <aside className="side">
      <div>
        <h3>Now</h3>
        <div className="card" style={{ marginTop: 6 }}>
          <div className="card-title">{title}<span className="spacer" />{a && <button className="btn small" onClick={stopAction}>stop</button>}</div>
          {progress && <Progress className={a?.kind === "fight" ? "enemy" : ""} value={progress.value} max={progress.max} label={detail} />}
          <Progress className="hp" value={game.player.hp} max={game.player.maxHp} label={`${Math.ceil(game.player.hp)} / ${game.player.maxHp} HP`} />
        </div>
      </div>
      <div>
        <h3>Log</h3>
        <div className="log" style={{ marginTop: 6 }}>
          {[...game.log].reverse().map((l, i) => (
            <div key={game.log.length - i} className={"log-line " + l.kind}>{l.text}</div>
          ))}
          {game.log.length === 0 && <div className="muted small">Nothing happened yet.</div>}
        </div>
      </div>
      <div style={{ marginTop: "auto" }} className="small muted">
        <div className="stat"><span>play time</span><span>{fmtTime(game.stats.playTime)}</span></div>
        <div className="stat"><span>deaths</span><span>{game.stats.deaths}</span></div>
        <button className="btn small danger" style={{ marginTop: 8 }} onClick={() => { if (confirm("Wipe this save?")) reset(); }}>new game</button>
      </div>
    </aside>
  );
}
