import { useStore } from "../game/store.ts";
import { Section, fmtN } from "./common.tsx";

export function Inventory() {
  const g = useStore((s) => s.graph);
  const inv = useStore((s) => s.game.inventory);
  const select = useStore((s) => s.select);
  const entries = Object.entries(inv).filter(([, n]) => n > 0);
  const byCat = new Map<string, [string, number][]>();
  for (const e of entries) {
    const i = g.itemIndex.get(e[0]);
    const cat = i === undefined ? "unknown" : g.items[i].category;
    byCat.set(cat, [...(byCat.get(cat) ?? []), e]);
  }
  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1>Inventory</h1>
        <span className="muted small">{entries.length} kinds of thing. Storage is abstract; nothing to tidy.</span>
      </div>
      {entries.length === 0 && <div className="muted">Empty. Go gather something.</div>}
      {[...byCat.entries()].sort().map(([cat, list]) => (
        <Section key={cat} title={cat}>
          <div className="inv-grid">
            {list.sort((a, b) => a[0].localeCompare(b[0])).map(([id, n]) => {
              const i = g.itemIndex.get(id);
              const it = i === undefined ? undefined : g.items[i];
              return (
                <button key={id} className="inv-cell" onClick={() => select(id)}>
                  <span>{it?.icon ?? "▫️"}</span>
                  <span>{it?.name ?? id}</span>
                  <span className="count">{fmtN(n)}</span>
                </button>
              );
            })}
          </div>
        </Section>
      ))}
    </>
  );
}
