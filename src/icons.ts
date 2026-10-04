// The apple marks the HUD, the level select and the level-complete card share: a red apple (the level
// cleared), a golden apple (its golden apple brought home too), and either one still to get, a faint outline.
const BODY = "M12 7c-2-1.6-6.5-1.4-7.6 2.6C3.3 13.7 6 21 9.3 21c1.2 0 1.7-.6 2.7-.6s1.5.6 2.7.6c3.3 0 6-7.3 4.9-11.4C18.5 5.6 14 5.4 12 7z";
const STEM = "M12 7.2c0-1.6.4-3 1.3-4", LEAF = "M13.2 4.6c1.5-1.4 3.6-1.5 4.8-.9-.9 1.5-3 2.3-4.8.9z";
const INK = "#3a2a22";
const drawn = (body: string, leaf: string, shine: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${BODY}" fill="${body}" stroke="${INK}" stroke-width="1.3"/><path d="M7.4 10.6c.5-1.4 1.6-2.1 2.7-2.2" stroke="${shine}" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="${STEM}" stroke="${INK}" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="${LEAF}" fill="${leaf}" stroke="${INK}" stroke-width="1.1"/></svg>`;
export const APPLE_ICON = drawn("#e8423a", "#5cbf4f", "#ff9a8a");
export const GOLDEN_ICON = drawn("#f6c234", "#9fd04f", "#fff4c2");
export const APPLE_EMPTY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${BODY}" fill="rgba(27,47,82,0.1)" stroke="rgba(27,47,82,0.42)" stroke-width="1.4" stroke-dasharray="2.2 1.8"/><path d="${STEM}" stroke="rgba(27,47,82,0.42)" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;
// A four-point sparkle, for the golden things.
export const SPARK_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5c.8 5.6 4.9 9.7 10.5 10.5-5.6.8-9.7 4.9-10.5 10.5-.8-5.6-4.9-9.7-10.5-10.5C7.1 11.2 11.2 7.1 12 1.5z" fill="#fff6cf" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;

// The marks for one level: its red apple, and its golden one where it has one to show.
export function appleMarks(cleared: boolean, golden: boolean | null): string {
  return `<span class="mark${cleared ? " got" : ""}" title="${cleared ? "Cleared" : "Not cleared yet"}">${cleared ? APPLE_ICON : APPLE_EMPTY}</span>`
    + (golden === null ? "" : `<span class="mark gold${golden ? " got" : ""}" title="${golden ? "Golden apple brought home" : "Golden apple not found yet"}">${golden ? GOLDEN_ICON : APPLE_EMPTY}</span>`);
}
