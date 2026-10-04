import { SPARK_ICON } from "./icons.ts";
import { h } from "./ui.ts";

// The shared popup (docs/colors.md "Dialogs"): a card over a dimmed screen with an emblem breaking its
// top edge, rays turning behind it in the dialog's `tone`, a title, a line or two and its buttons.
// Any button closes it after its own action; Enter presses the primary button, Esc closes it.
export type DialogTone = "moss" | "gold" | "steel" | "rust";
export interface DialogButton { label: string; primary?: boolean; onClick?: () => void }
export interface DialogOpts {
  title: string;
  body?: string | Node;
  // An SVG drawn in the emblem; without one the dialog has no emblem.
  icon?: string;
  tone?: DialogTone;
  buttons?: DialogButton[];
  // Esc closes it (calling onClose); off for a choice the player must make.
  dismissable?: boolean;
  onClose?: () => void;
}
export interface Dialog { el: HTMLElement; close(): void }

export function openDialog(parent: HTMLElement, opts: DialogOpts): Dialog {
  const buttons = opts.buttons ?? [{ label: "OK", primary: true }];
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    document.removeEventListener("keydown", onKey, true);
    back.classList.add("closing");
    setTimeout(() => back.remove(), 160);
    opts.onClose?.();
  };
  const press = (b: DialogButton) => { if (!open) return; b.onClick?.(); close(); };
  const onKey = (e: KeyboardEvent) => {
    if (!back.isConnected) { document.removeEventListener("keydown", onKey, true); return; }
    if (e.code === "Escape" && opts.dismissable !== false) { e.stopPropagation(); close(); }
    else if (e.code === "Enter" || e.code === "NumpadEnter") { const b = buttons.find((x) => x.primary); if (b) { e.preventDefault(); e.stopPropagation(); press(b); } }
  };
  const crest = opts.icon ? h("div", { class: "dialog-crest" },
    h("div", { class: "dialog-rays" }),
    h("div", { class: "dialog-emblem", innerHTML: opts.icon }),
    ...[0, 1, 2].map((k) => h("span", { class: `dialog-spark s${k}`, innerHTML: SPARK_ICON })),
  ) : null;
  const row = h("div", { class: "row" }, ...buttons.map((b) => h("button", { class: b.primary ? "" : "ghost", onclick: () => press(b) }, b.label)));
  const card = h("div", { class: `card dialog tone-${opts.tone ?? "moss"}${crest ? " crested" : ""}`, role: "dialog", "aria-modal": "true", "aria-label": opts.title },
    crest,
    h("h2", {}, opts.title),
    opts.body == null ? null : typeof opts.body === "string" ? h("p", {}, opts.body) : opts.body,
    row,
  );
  const back = h("div", { class: "dialog-back" }, card);
  parent.append(back);
  document.addEventListener("keydown", onKey, true);
  (row.querySelector("button:not(.ghost)") as HTMLButtonElement | null ?? row.querySelector("button"))?.focus({ preventScroll: true });
  return { el: back, close };
}
