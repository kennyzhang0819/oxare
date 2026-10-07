import { useMemo, useState } from "react";
import { useStore } from "../game/store.ts";
import { validate, summarize, type Diagnostic, type Severity } from "../engine/validate.ts";
import { rawCostPerUnit } from "../engine/plan.ts";
import { searchItems } from "../engine/graph.ts";
import type { Content, Qty, Drop } from "../engine/types.ts";
import { fmtN } from "../ui/common.tsx";

type Kind = "items" | "recipes" | "stations" | "techs" | "gatherNodes" | "enemies";
const KINDS: { key: Kind; label: string; diag: Diagnostic["kind"] }[] = [
  { key: "items", label: "Items", diag: "item" },
  { key: "recipes", label: "Recipes", diag: "recipe" },
  { key: "stations", label: "Stations", diag: "station" },
  { key: "techs", label: "Techs", diag: "tech" },
  { key: "gatherNodes", label: "Gather", diag: "gather" },
  { key: "enemies", label: "Enemies", diag: "enemy" },
];

type Entity = Record<string, unknown> & { id: string };

const TEMPLATES: Record<Kind, Entity> = {
  items: { id: "new_item", name: "New Item", category: "material", tier: 0, icon: "▫️" },
  recipes: { id: "new_recipe", inputs: {}, outputs: {}, station: "workbench", time: 2 },
  stations: { id: "new_station", name: "New Station", tier: 0, icon: "🏠" },
  techs: { id: "new_tech", name: "New Tech", tier: 0, cost: {}, requires: [] },
  gatherNodes: { id: "new_node", name: "New Node", skill: "mining", time: 2, drops: [] },
  enemies: { id: "new_enemy", name: "New Enemy", region: "Forest", hp: 10, attack: 1, defense: 0, speed: 2, drops: [] },
};

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function coll(c: Content, kind: Kind): Entity[] {
  return (c as unknown as Record<Kind, Entity[]>)[kind];
}

export function Admin() {
  const content = useStore((s) => s.content);
  const graph = useStore((s) => s.graph);
  const setContent = useStore((s) => s.setContent);
  const resetContent = useStore((s) => s.resetContent);
  const custom = useStore((s) => s.customContent);
  const cheat = useStore((s) => s.cheat);
  const [kind, setKind] = useState<Kind>("items");
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");
  const [chain, setChain] = useState("");
  const [chainStation, setChainStation] = useState(content.stations[0]?.id ?? "");

  const diags = useMemo(() => validate(graph), [graph]);
  const sums = summarize(diags);
  const diagByKey = useMemo(() => {
    const m = new Map<string, Severity>();
    const rank: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
    for (const d of diags) {
      const k = `${d.kind}:${d.id}`;
      const cur = m.get(k);
      if (!cur || rank[d.severity] < rank[cur]) m.set(k, d.severity);
    }
    return m;
  }, [diags]);

  const kindMeta = KINDS.find((k) => k.key === kind)!;
  const list = coll(content, kind).filter((e) => !filter || e.id.includes(filter.toLowerCase()) || String(e.name ?? "").toLowerCase().includes(filter.toLowerCase()));
  const entity = selected ? coll(content, kind).find((e) => e.id === selected) ?? null : null;

  const commit = (next: Content) => setContent(next);

  const upsert = (e: Entity, originalId: string | null) => {
    const next = clone(content);
    const arr = coll(next, kind);
    const i = originalId ? arr.findIndex((x) => x.id === originalId) : -1;
    if (i >= 0) arr[i] = e;
    else arr.push(e);
    commit(next);
    setSelected(e.id);
  };
  const remove = (id: string) => {
    if (!confirm(`Delete ${kind.slice(0, -1)} "${id}"? References elsewhere will show as errors.`)) return;
    const next = clone(content);
    (next as unknown as Record<Kind, Entity[]>)[kind] = coll(next, kind).filter((x) => x.id !== id);
    commit(next);
    setSelected(null);
  };
  const create = () => {
    const t = clone(TEMPLATES[kind]);
    let n = 1;
    while (coll(content, kind).some((x) => x.id === t.id)) t.id = `${TEMPLATES[kind].id}_${n++}`;
    upsert(t, null);
  };
  const duplicate = () => {
    if (!entity) return;
    const t = clone(entity);
    let n = 2;
    while (coll(content, kind).some((x) => x.id === `${entity.id}_${n}`)) n++;
    t.id = `${entity.id}_${n}`;
    upsert(t, null);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "content.json";
    a.click();
  };
  const importJson = async (file: File) => {
    try {
      const c = JSON.parse(await file.text()) as Content;
      if (!Array.isArray(c.items) || !Array.isArray(c.recipes)) throw new Error("not a content bundle");
      commit(c);
    } catch (e) {
      alert(`Import failed: ${(e as Error).message}`);
    }
  };

  // "Copper Ore → Copper Concentrate → Copper Matte": creates missing items and 1:1 recipes between neighbours.
  const addChain = () => {
    const names = chain.split(/→|->|>/).map((s) => s.trim()).filter(Boolean);
    if (names.length < 2) return;
    const next = clone(content);
    const ids = names.map((n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
    ids.forEach((id, i) => {
      if (!next.items.some((x) => x.id === id)) next.items.push({ id, name: names[i], category: "material", tier: 0 });
    });
    for (let i = 1; i < ids.length; i++) {
      const rid = `${ids[i]}_from_${ids[i - 1]}`;
      if (!next.recipes.some((r) => r.id === rid)) next.recipes.push({ id: rid, inputs: { [ids[i - 1]]: 1 }, outputs: { [ids[i]]: 1 }, station: chainStation, time: 2 });
    }
    commit(next);
    setChain("");
    setKind("recipes");
  };

  const jump = (d: Diagnostic) => {
    const k = KINDS.find((x) => x.diag === d.kind);
    if (!k) return;
    setKind(k.key);
    setSelected(d.id);
  };

  const shown = diags.filter((d) => sevFilter === "all" || d.severity === sevFilter);

  return (
    <div className="admin">
      <div className="admin-col">
        <div className="row">
          <strong>Content</strong>
          <span className="spacer" />
          {custom && <span className="badge warn">local edits</span>}
        </div>
        <div className="btn-row">
          <button className="btn small" onClick={exportJson}>export</button>
          <label className="btn small">import<input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} /></label>
          <button className="btn small danger" disabled={!custom} onClick={() => { if (confirm("Discard local content edits and go back to the shipped files?")) { resetContent(); setSelected(null); } }}>reset</button>
        </div>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {KINDS.map((k) => (
            <button key={k.key} className={"tab" + (kind === k.key ? " active" : "")} style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => { setKind(k.key); setSelected(null); }}>
              {k.label} <span className="muted">{coll(content, k.key).length}</span>
            </button>
          ))}
        </div>
        <div className="row">
          <input placeholder="filter" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ flex: 1 }} />
          <button className="btn small primary" onClick={create}>+ new</button>
        </div>
        <div className="admin-list">
          {list.map((e) => {
            const sev = diagByKey.get(`${kindMeta.diag}:${e.id}`);
            return (
              <button key={e.id} className={"admin-item" + (selected === e.id ? " active" : "")} onClick={() => setSelected(e.id)}>
                <span className={"dot " + (sev ?? "")} />
                <span>{String(e.icon ?? "")} {String(e.name ?? e.id)}</span>
                <span className="spacer" />
                <code>{e.id}</code>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: "auto" }}>
          <h3>Quick chain</h3>
          <input value={chain} onChange={(e) => setChain(e.target.value)} placeholder="Copper Ore → Concentrate → Matte" style={{ width: "100%", marginTop: 6 }} />
          <div className="row" style={{ marginTop: 6 }}>
            <select value={chainStation} onChange={(e) => setChainStation(e.target.value)}>
              {content.stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button className="btn small" onClick={addChain}>add chain</button>
          </div>
        </div>
      </div>

      <div className="admin-col">
        {!entity && <div className="muted">Select something on the left, or create one. Edits save to this browser and apply to the running game immediately; export to put them in the repo.</div>}
        {entity && (
          <Editor key={`${kind}:${entity.id}`} kind={kind} entity={entity} content={content} onSave={(e) => upsert(e, entity.id)} onDelete={() => remove(entity.id)} onDuplicate={duplicate}
            diags={diags.filter((d) => d.kind === kindMeta.diag && d.id === entity.id)} onCheat={kind === "items" ? (n) => cheat(entity.id, n) : undefined} />
        )}
      </div>

      <div className="admin-col">
        <div className="row">
          <strong>Diagnostics</strong>
          <span className="spacer" />
          <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value as Severity | "all")}>
            <option value="all">all ({diags.length})</option>
            <option value="error">errors ({sums.errors})</option>
            <option value="warn">warnings ({sums.warnings})</option>
            <option value="info">info ({sums.infos})</option>
          </select>
        </div>
        <div className="stats-grid">
          <span className="muted">items</span><span>{graph.items.length}</span>
          <span className="muted">recipes</span><span>{graph.recipes.length}</span>
          <span className="muted">raw items</span><span>{graph.raw.filter(Boolean).length}</span>
          <span className="muted">cycles</span><span style={{ color: graph.cycles.length ? "var(--bad)" : undefined }}>{graph.cycles.length}</span>
          <span className="muted">max depth</span><span>{graph.depth.length ? Math.max(...graph.depth) : 0}</span>
          <span className="muted">unknown refs</span><span>{graph.unknownRefs.length}</span>
        </div>
        {shown.length === 0 && <div className="muted small">Clean.</div>}
        {shown.map((d, i) => (
          <div key={i} className={"diag " + d.severity}>
            <div><button onClick={() => jump(d)}>{d.kind}:{d.id}</button> <span className="muted">{d.code}</span></div>
            <div>{d.message}</div>
          </div>
        ))}
        {kind === "items" && entity && <ItemInspector id={entity.id} />}
      </div>
    </div>
  );
}

function ItemInspector({ id }: { id: string }) {
  const g = useStore((s) => s.graph);
  const idx = g.itemIndex.get(id);
  if (idx === undefined) return null;
  const cost = rawCostPerUnit(g, idx);
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
      <strong>Graph view</strong>
      <div className="stats-grid" style={{ marginTop: 6 }}>
        <span className="muted">depth</span><span>{g.depth[idx]}</span>
        <span className="muted">in cycle</span><span>{g.inCycle[idx] ? "yes" : "no"}</span>
        <span className="muted">made by</span><span>{g.producers[idx].map((r) => g.recipes[r].id).join(", ") || "—"}</span>
        <span className="muted">gathered at</span><span>{g.sources[idx].gatherNodes.map((n) => g.content.gatherNodes[n].id).join(", ") || "—"}</span>
        <span className="muted">dropped by</span><span>{g.sources[idx].enemies.map((n) => g.content.enemies[n].id).join(", ") || "—"}</span>
        <span className="muted">used by</span><span>{g.consumers[idx].map((r) => g.recipes[r].id).join(", ") || "—"}</span>
      </div>
      {!g.raw[idx] && (
        <div className="small" style={{ marginTop: 6 }}>
          <span className="muted">raw per unit: </span>
          {[...cost.entries()].sort((a, b) => b[1] - a[1]).map(([i, n]) => `${g.items[i].name} ${fmtN(Math.round(n * 100) / 100)}`).join(", ")}
        </div>
      )}
    </div>
  );
}

function Editor({ kind, entity, content, onSave, onDelete, onDuplicate, diags, onCheat }: {
  kind: Kind; entity: Entity; content: Content; onSave: (e: Entity) => void; onDelete: () => void; onDuplicate: () => void; diags: Diagnostic[]; onCheat?: (n: number) => void;
}) {
  const [draft, setDraft] = useState<Entity>(() => clone(entity));
  const [raw, setRaw] = useState(() => JSON.stringify(entity, null, 2));
  const [rawErr, setRawErr] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(entity);

  const setField = (k: string, v: unknown) => {
    const next = { ...draft, [k]: v };
    if (v === "" || v === undefined) delete next[k];
    setDraft(next);
    setRaw(JSON.stringify(next, null, 2));
  };
  const applyRaw = () => {
    try {
      const parsed = JSON.parse(raw) as Entity;
      if (typeof parsed.id !== "string") throw new Error("id must be a string");
      setDraft(parsed);
      setRawErr(null);
    } catch (e) {
      setRawErr((e as Error).message);
    }
  };
  const text = (k: string, label = k) => (
    <>
      <label>{label}</label>
      <input value={String(draft[k] ?? "")} onChange={(e) => setField(k, e.target.value)} />
    </>
  );
  const num = (k: string, label = k) => (
    <>
      <label>{label}</label>
      <input type="number" step="any" value={draft[k] === undefined ? "" : Number(draft[k])} onChange={(e) => setField(k, e.target.value === "" ? undefined : Number(e.target.value))} />
    </>
  );
  const pick = (k: string, options: { id: string; name?: string }[], label = k, allowNone = false) => (
    <>
      <label>{label}</label>
      <select value={String(draft[k] ?? "")} onChange={(e) => setField(k, e.target.value || undefined)}>
        {allowNone && <option value="">— none —</option>}
        {options.map((o) => <option key={o.id} value={o.id}>{o.name ?? o.id}</option>)}
      </select>
    </>
  );
  const qty = (k: string, label = k) => (
    <>
      <label>{label}</label>
      <QtyEditor value={(draft[k] as Qty) ?? {}} onChange={(v) => setField(k, v)} items={content.items} />
    </>
  );
  const drops = (k: string) => (
    <>
      <label>{k}</label>
      <DropsEditor value={(draft[k] as Drop[]) ?? []} onChange={(v) => setField(k, v)} items={content.items} />
    </>
  );

  return (
    <>
      <div className="row">
        <strong>{kind.slice(0, -1)}</strong> <code>{entity.id}</code>
        <span className="spacer" />
        <button className="btn small" onClick={onDuplicate}>duplicate</button>
        <button className="btn small danger" onClick={onDelete}>delete</button>
        <button className="btn small primary" disabled={!dirty} onClick={() => onSave(draft)}>save</button>
      </div>
      {diags.map((d, i) => <div key={i} className={"diag " + d.severity}>{d.message}</div>)}
      <div className="form">
        {text("id")}
        {kind !== "recipes" && text("name")}
        {kind === "recipes" && text("name", "name (optional)")}
        {(kind === "items" || kind === "stations" || kind === "techs") && num("tier")}
        {(kind === "items" || kind === "stations" || kind === "gatherNodes" || kind === "enemies") && text("icon")}
        {kind === "items" && text("category")}
        {kind === "items" && text("description")}
        {kind === "recipes" && qty("inputs")}
        {kind === "recipes" && qty("outputs")}
        {kind === "recipes" && pick("station", content.stations)}
        {(kind === "recipes" || kind === "gatherNodes") && num("time", "time (s)")}
        {(kind === "recipes" || kind === "stations" || kind === "gatherNodes" || kind === "enemies") && pick("unlock", content.techs, "unlock", true)}
        {kind === "recipes" && (
          <>
            <label>recycle</label>
            <input type="checkbox" checked={!!(draft.tags as string[] | undefined)?.includes("recycle")} onChange={(e) => setField("tags", e.target.checked ? ["recycle"] : undefined)} />
          </>
        )}
        {kind === "techs" && qty("cost")}
        {kind === "techs" && text("description")}
        {kind === "techs" && (
          <>
            <label>requires</label>
            <input value={((draft.requires as string[]) ?? []).join(", ")} onChange={(e) => setField("requires", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="tech ids, comma separated" />
          </>
        )}
        {kind === "gatherNodes" && pick("skill", content.skills)}
        {kind === "gatherNodes" && num("toolTier")}
        {(kind === "gatherNodes" || kind === "enemies") && drops("drops")}
        {kind === "enemies" && text("region")}
        {kind === "enemies" && num("hp")}
        {kind === "enemies" && num("attack")}
        {kind === "enemies" && num("defense")}
        {kind === "enemies" && num("speed", "speed (s per hit)")}
        {kind === "enemies" && (
          <>
            <label>boss</label>
            <input type="checkbox" checked={!!draft.boss} onChange={(e) => setField("boss", e.target.checked || undefined)} />
          </>
        )}
      </div>
      {onCheat && (
        <div className="row small muted">
          dev: <button className="btn small" onClick={() => onCheat(10)}>+10 to inventory</button><button className="btn small" onClick={() => onCheat(100)}>+100</button>
        </div>
      )}
      <div>
        <div className="row small muted" style={{ marginBottom: 4 }}>raw JSON (any field, including equip) <span className="spacer" /><button className="btn small" onClick={applyRaw}>apply</button></div>
        <textarea rows={14} style={{ width: "100%" }} value={raw} onChange={(e) => setRaw(e.target.value)} />
        {rawErr && <div className="diag error">{rawErr}</div>}
      </div>
    </>
  );
}

function ItemPicker({ value, onChange, items }: { value: string; onChange: (id: string) => void; items: Content["items"] }) {
  const g = useStore((s) => s.graph);
  const [q, setQ] = useState(value);
  const hits = q && q !== value ? searchItems(g, q, 6) : [];
  return (
    <span style={{ position: "relative", flex: 1, display: "flex" }}>
      <input list={undefined} value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => { if (items.some((i) => i.id === q)) onChange(q); }} placeholder="item id" style={{ flex: 1, minWidth: 0 }} />
      {hits.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 5, background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 6, display: "flex", flexDirection: "column" }}>
          {hits.map((i) => (
            <button key={i} className="admin-item" onMouseDown={() => { setQ(g.items[i].id); onChange(g.items[i].id); }}>{g.items[i].icon} {g.items[i].name} <code>{g.items[i].id}</code></button>
          ))}
        </div>
      )}
    </span>
  );
}

function QtyEditor({ value, onChange, items }: { value: Qty; onChange: (v: Qty) => void; items: Content["items"] }) {
  const entries = Object.entries(value);
  const set = (list: [string, number][]) => onChange(Object.fromEntries(list.filter(([k]) => k)));
  return (
    <div className="qty-editor">
      {entries.map(([id, n], i) => (
        <div key={i} className="qty-line">
          <ItemPicker value={id} items={items} onChange={(nid) => { const l = [...entries]; l[i] = [nid, n]; set(l); }} />
          <input className="n" type="number" min={1} value={n} onChange={(e) => { const l = [...entries]; l[i] = [id, Number(e.target.value)]; set(l); }} />
          <button className="btn small" onClick={() => set(entries.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange({ ...value, "": 1 })} disabled={"" in value}>+ ingredient</button>
    </div>
  );
}

function DropsEditor({ value, onChange, items }: { value: Drop[]; onChange: (v: Drop[]) => void; items: Content["items"] }) {
  const upd = (i: number, patch: Partial<Drop>) => onChange(value.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <div className="qty-editor">
      {value.map((d, i) => (
        <div key={i} className="qty-line">
          <ItemPicker value={d.item} items={items} onChange={(id) => upd(i, { item: id })} />
          <input className="n" type="number" title="min" value={d.min} onChange={(e) => upd(i, { min: Number(e.target.value) })} />
          <input className="n" type="number" title="max" value={d.max} onChange={(e) => upd(i, { max: Number(e.target.value) })} />
          <input className="n" type="number" step="0.05" min={0} max={1} title="chance" value={d.chance} onChange={(e) => upd(i, { chance: Number(e.target.value) })} />
          <button className="btn small" onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...value, { item: "", min: 1, max: 1, chance: 1 }])}>+ drop</button>
    </div>
  );
}
