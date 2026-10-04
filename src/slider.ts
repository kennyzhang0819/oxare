import { h } from "./ui.ts";

export interface SliderOpts {
  min: number;
  max: number;
  step: number;
  value: number;
  label: string;
  // A notch on the track, e.g. the default.
  mark?: number;
  text?: (v: number) => string;
  onInput: (v: number) => void;
  // Once the value is let go: the drag released, or a key press.
  onChange?: (v: number) => void;
}

export function slider(o: SliderOpts): HTMLElement {
  const { min, max, step } = o;
  const decimals = (String(step).split(".")[1] ?? "").length;
  const frac = (v: number) => (v - min) / (max - min);
  const snap = (v: number) => Number(Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step)).toFixed(decimals));

  const el = h("div", { class: "slider", role: "slider", tabIndex: 0, "aria-label": o.label, "aria-valuemin": min, "aria-valuemax": max },
    h("span", { class: "track" }, h("span", { class: "fill" })),
    o.mark != null && h("span", { class: "mark", style: `--m: ${frac(o.mark)}` }),
    h("span", { class: "thumb" }),
  );

  let value = NaN;
  const set = (v: number) => {
    v = snap(v);
    if (v === value) return;
    value = v;
    el.style.setProperty("--f", String(frac(v)));
    el.setAttribute("aria-valuenow", String(v));
    if (o.text) el.setAttribute("aria-valuetext", o.text(v));
  };
  const input = (v: number) => {
    const before = value;
    set(v);
    if (value !== before) o.onInput(value);
  };
  set(o.value);

  // Matches the thumb's CSS size: the thumb's centre runs from d/2 to width - d/2.
  const fromX = (x: number) => {
    const r = el.getBoundingClientRect(), d = el.querySelector<HTMLElement>(".thumb")!.offsetWidth;
    return min + Math.min(1, Math.max(0, (x - r.left - d / 2) / Math.max(1, r.width - d))) * (max - min);
  };
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    el.focus();
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");
    input(fromX(e.clientX));
  });
  el.addEventListener("pointermove", (e) => { if (el.hasPointerCapture(e.pointerId)) input(fromX(e.clientX)); });
  const end = (e: PointerEvent) => {
    if (!el.classList.contains("dragging")) return;
    el.classList.remove("dragging");
    if (e.type === "pointerup") o.onChange?.(value);
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("keydown", (e) => {
    const big = Math.max(step, (max - min) / 10);
    const to: Record<string, number> = {
      ArrowLeft: value - step, ArrowDown: value - step, ArrowRight: value + step, ArrowUp: value + step,
      PageDown: value - big, PageUp: value + big, Home: min, End: max,
    };
    if (!(e.key in to)) return;
    e.preventDefault();
    e.stopPropagation();
    input(to[e.key]!);
    o.onChange?.(value);
  });
  return el;
}
