import { Input } from "./input.ts";
import { cloneLevel, type Level } from "./level.ts";
import { LEVELS } from "./levels/index.ts";
import { loadDraft } from "./editor.ts";
import { loadProgress } from "./game.ts";
import { clear, fmtTime, h } from "./ui.ts";
import type { Ctx, Mode } from "./main.ts";

export interface MenuOpts { onPlay(index: number): void; onEdit(level: Level): void }

export class Menu implements Mode {
  private ctx: Ctx;

  constructor(ctx: Ctx, opts: MenuOpts) {
    this.ctx = ctx;
    const progress = loadProgress();
    const draft = loadDraft();
    const tiltBtn = h("button", { class: "ghost" });
    const setTilt = () => { tiltBtn.textContent = localStorage.getItem("balling.tilt") === "1" ? "Tilt: on" : "Tilt: off"; };
    tiltBtn.onclick = async () => {
      if (localStorage.getItem("balling.tilt") === "1") Input.disableTilt();
      else if (!(await Input.requestTilt())) alert("Tilt not available on this device.");
      setTilt();
    };
    setTilt();
    ctx.overlay.append(
      h("div", { class: "menu" },
        h("h1", {}, "BALLING"),
        h("div", { class: "sub" }, "roll through the sky"),
        h("div", { class: "levels" },
          ...LEVELS.map((l, i) => h("div", { class: "level-row" },
            h("span", { class: "name" }, `${i + 1}. ${l.name}`),
            h("span", { class: "best" }, progress[l.id] ? fmtTime(progress[l.id]!.best) : ""),
            h("button", { onclick: () => opts.onPlay(i) }, "Play"),
            h("button", { class: "ghost", onclick: () => opts.onEdit(cloneLevel(l)) }, "Edit"),
          )),
          draft ? h("div", { class: "level-row" },
            h("span", { class: "name" }, `Draft: ${draft.name}`),
            h("button", { onclick: () => opts.onEdit(draft) }, "Open editor"),
          ) : h("div", { class: "level-row" },
            h("span", { class: "name" }, "New level"),
            h("button", { onclick: () => opts.onEdit(cloneLevel(LEVELS[0]!)) }, "Open editor"),
          ),
        ),
        h("div", { class: "row" }, Input.tiltAvailable() ? tiltBtn : null),
        h("div", { class: "hint" }, "Left / right steers the camera around the ball; up / down rolls it forward and back. Keyboard: arrows or WASD. Touch: drag. Press T in a level to tune the feel, R to respawn."),
      ),
    );
  }
  dispose() { clear(this.ctx.overlay); }
}
