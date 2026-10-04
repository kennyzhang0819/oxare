// Near fade: in the game's own view a prop or plant close to the camera turns see-through, by how close
// it is: solid from FADE.far out, down to FADE.min opacity at FADE.near and closer. It never goes
// entirely, and it fades as a whole (hideHullsAround in scene.ts, the plants' shaders in decor.ts), its
// ink outline faster so the inside-out hull never tints through. Platforms stay solid. The camera itself
// never moves. On only while NEAR_ON is set, so the ball's reflection, thumbnails and the editor draw
// everything solid. See docs/levels.md "Controls".
export const FADE = { near: 1, far: 3, min: 0.5 };
export const NEAR_ON = { value: 0 };

// How solid a thing `d` from the eye is drawn, and the same in GLSL for an expression `d`.
export function fadeAt(d: number): number {
  const t = Math.min(1, Math.max(0, (d - FADE.near) / (FADE.far - FADE.near)));
  return FADE.min + (1 - FADE.min) * t * t * (3 - 2 * t);
}
export const fadeGlsl = (d: string): string => `(${FADE.min.toFixed(2)} + ${(1 - FADE.min).toFixed(2)} * smoothstep(${FADE.near.toFixed(2)}, ${FADE.far.toFixed(2)}, ${d}))`;
// An outline fades much faster than its body, so at the body's least it is nearly gone.
export const INK_FADE = 4;
