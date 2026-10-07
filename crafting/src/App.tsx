import { useEffect } from "react";
import { useStore, startLoop, type Screen } from "./game/store.ts";
import { Gather } from "./ui/Gather.tsx";
import { Fight } from "./ui/Fight.tsx";
import { Craft } from "./ui/Craft.tsx";
import { Research } from "./ui/Research.tsx";
import { Goals } from "./ui/Goals.tsx";
import { Inventory } from "./ui/Inventory.tsx";
import { ItemDrawer } from "./ui/ItemDrawer.tsx";
import { Side } from "./ui/Side.tsx";
import { Admin } from "./admin/Admin.tsx";
import { fmtTime } from "./ui/common.tsx";

const NAV: { id: Screen; label: string; icon: string }[] = [
  { id: "gather", label: "Gather", icon: "⛏️" },
  { id: "fight", label: "Fight", icon: "⚔️" },
  { id: "craft", label: "Craft", icon: "🔨" },
  { id: "research", label: "Research", icon: "📜" },
  { id: "goals", label: "Goals", icon: "🎯" },
  { id: "inventory", label: "Inventory", icon: "🎒" },
  { id: "admin", label: "Admin", icon: "🛠️" },
];

export function App() {
  const screen = useStore((s) => s.screen);
  const setScreen = useStore((s) => s.setScreen);
  const offline = useStore((s) => s.offlineReport);
  const dismiss = useStore((s) => s.dismissOffline);
  const goals = useStore((s) => s.game.goals.length);
  const custom = useStore((s) => s.customContent);
  useEffect(() => startLoop(), []);

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">Crafting<span className="brand-sub">vertical slice</span></div>
        {NAV.map((n) => (
          <button key={n.id} className={"nav-btn" + (screen === n.id ? " active" : "")} onClick={() => setScreen(n.id)}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
            {n.id === "goals" && goals > 0 && <span className="badge">{goals}</span>}
            {n.id === "admin" && custom && <span className="badge warn">edited</span>}
          </button>
        ))}
      </nav>
      <main className="main">
        {offline !== null && (
          <div className="banner">
            Welcome back. {fmtTime(offline)} passed while you were away and your action kept running.
            <button onClick={dismiss}>ok</button>
          </div>
        )}
        {screen === "gather" && <Gather />}
        {screen === "fight" && <Fight />}
        {screen === "craft" && <Craft />}
        {screen === "research" && <Research />}
        {screen === "goals" && <Goals />}
        {screen === "inventory" && <Inventory />}
        {screen === "admin" && <Admin />}
      </main>
      <Side />
      <ItemDrawer />
    </div>
  );
}
