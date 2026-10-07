import type { ReactNode } from "react";
import { useStore } from "../game/store.ts";
import type { ItemId, Qty } from "../engine/types.ts";
import { FOREVER } from "../engine/sim.ts";
import type { Graph } from "../engine/graph.ts";

export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec)) return "∞";
  if (sec < 60) return `${sec.toFixed(sec < 10 ? 1 : 0)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function fmtN(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

export function ItemChip({ id, qty, showHave }: { id: ItemId; qty?: number; showHave?: boolean }) {
  const g = useStore((s) => s.graph);
  const have = useStore((s) => s.game.inventory[id] ?? 0);
  const select = useStore((s) => s.select);
  const i = g.itemIndex.get(id);
  const it = i === undefined ? undefined : g.items[i];
  const short = qty !== undefined && have < qty;
  return (
    <button className={"chip" + (showHave ? (short ? " short" : " ok") : "")} onClick={() => select(id)} title={it?.description ?? id}>
      <span className="chip-icon">{it?.icon ?? "▫️"}</span>
      <span className="chip-name">{it?.name ?? id}</span>
      {qty !== undefined && (
        <span className="chip-qty">{showHave ? `${fmtN(have)}/${fmtN(qty)}` : `×${fmtN(qty)}`}</span>
      )}
    </button>
  );
}

export function QtyList({ qty, showHave }: { qty: Qty; showHave?: boolean }) {
  return (
    <div className="chips">
      {Object.entries(qty).map(([id, n]) => (
        <ItemChip key={id} id={id} qty={n} showHave={showHave} />
      ))}
    </div>
  );
}

export function Progress({ value, max, label, className }: { value: number; max: number; label?: ReactNode; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={"progress " + (className ?? "")}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
      {label !== undefined && <span className="progress-label">{label}</span>}
    </div>
  );
}

export function CountButtons({ onPick, disabled, max }: { onPick: (n: number) => void; disabled?: boolean; max?: number }) {
  const opts: [string, number][] = [["×1", 1], ["×10", 10], ["×100", 100]];
  if (max !== undefined) opts.push([`max ${max}`, max]);
  opts.push(["∞", FOREVER]);
  return (
    <div className="btn-row">
      {opts.map(([label, n]) => (
        <button key={label} className="btn" disabled={disabled || (max !== undefined && n !== FOREVER && n > max) || n === 0} onClick={() => onPick(n)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Locked({ why }: { why?: string }) {
  return <span className="locked">🔒 {why}</span>;
}

export function Section({ title, children, right }: { title: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="section">
      <header className="section-head">
        <h2>{title}</h2>
        {right}
      </header>
      {children}
    </section>
  );
}

export function recipeLabel(g: Graph, ri: number): string {
  const r = g.recipes[ri];
  if (r.name) return r.name;
  return "from " + g.recipeInputs[ri].map((i) => g.items[i.item].name).join(" + ");
}
