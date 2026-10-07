import { useStore } from "../game/store.ts";
import { enemyAvailable, playerAttack, playerDefense, bestEquip, PLAYER_SWING } from "../engine/sim.ts";
import { CountButtons, ItemChip, Locked, Progress, Section } from "./common.tsx";

export function Fight() {
  const g = useStore((s) => s.graph);
  const game = useStore((s) => s.game);
  const fight = useStore((s) => s.fight);
  const atk = playerAttack(g, game);
  const def = playerDefense(g, game);
  const weapon = bestEquip(g, game.inventory, "weapon");
  const armor = bestEquip(g, game.inventory, "armor");
  const regions = [...new Set(g.content.enemies.map((e) => e.region))];
  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1>Fight</h1>
        <span className="muted small">Monsters drop what the ground will not give you. Best gear in your bag is worn automatically.</span>
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">You</div>
        <Progress className="hp" value={game.player.hp} max={game.player.maxHp} label={`${Math.ceil(game.player.hp)} / ${game.player.maxHp} HP`} />
        <div className="row small">
          <span>⚔️ {atk} every {PLAYER_SWING}s</span>
          <span>🛡️ {def}</span>
          <span className="muted">weapon: {weapon ? <ItemChip id={weapon.id} /> : "fists"}</span>
          <span className="muted">armor: {armor ? <ItemChip id={armor.id} /> : "none"}</span>
        </div>
      </div>
      {regions.map((region) => (
        <Section key={region} title={region}>
          <div className="cards">
            {g.content.enemies.filter((e) => e.region === region).map((e) => {
              const avail = enemyAvailable(g, game, e.id);
              const active = game.action?.kind === "fight" && game.action.enemy === e.id;
              const dmgToEnemy = Math.max(1, atk - e.defense);
              const dmgToYou = Math.max(1, e.attack - def);
              const ttk = Math.ceil(e.hp / dmgToEnemy) * PLAYER_SWING;
              const taken = Math.floor(ttk / e.speed) * dmgToYou;
              return (
                <div key={e.id} className={"card" + (active ? " active" : "") + (avail.ok ? "" : " locked")}>
                  <div className="card-title">
                    <span className="icon">{e.icon ?? "👾"}</span>
                    {e.name} {e.boss && <span className="badge">boss</span>}
                    <span className="spacer" />
                    <span className="card-meta">{game.stats.kills[e.id] ?? 0} kills</span>
                  </div>
                  {active && game.action?.kind === "fight" && (
                    <Progress className="enemy" value={game.action.enemyHp} max={e.hp} label={`${Math.ceil(game.action.enemyHp)} / ${e.hp}`} />
                  )}
                  <div className="row small muted">
                    <span>❤️ {e.hp}</span><span>⚔️ {e.attack}/{e.speed}s</span><span>🛡️ {e.defense}</span>
                  </div>
                  <div className="small" style={{ color: taken >= game.player.maxHp ? "var(--bad)" : "var(--muted)" }}>
                    You deal {dmgToEnemy}, it deals {dmgToYou}. Expect to take ~{taken} dmg per kill.
                  </div>
                  <div className="chips">
                    {e.drops.map((d) => (
                      <span key={d.item} className="row" style={{ gap: 2 }}>
                        <ItemChip id={d.item} />
                        <span className="muted small">{d.min === d.max ? d.min : `${d.min}–${d.max}`}{d.chance < 1 ? ` @${Math.round(d.chance * 100)}%` : ""}</span>
                      </span>
                    ))}
                  </div>
                  {avail.ok ? <CountButtons onPick={(n) => fight(e.id, n)} disabled={game.player.hp <= 1} /> : <Locked why={avail.why} />}
                </div>
              );
            })}
          </div>
        </Section>
      ))}
    </>
  );
}
