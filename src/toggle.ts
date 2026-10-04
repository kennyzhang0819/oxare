import { h } from "./ui.ts";

export interface ToggleOpts {
  checked: boolean;
  label: string;
  onChange: (on: boolean) => void;
}

// An on/off switch in the slider's glass and navy. A button, so a click on its label text and Space or
// Enter with it focused flip it like a native checkbox.
export function toggle(o: ToggleOpts): HTMLElement {
  const el = h("button", { type: "button", class: "switch", role: "switch", "aria-label": o.label }, h("span", { class: "thumb" }));
  let on = o.checked;
  const set = (v: boolean) => {
    on = v;
    el.classList.toggle("on", v);
    el.setAttribute("aria-checked", String(v));
  };
  set(on);
  el.addEventListener("click", () => { set(!on); o.onChange(on); });
  return el;
}
