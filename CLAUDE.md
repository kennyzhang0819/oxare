# balling

Ball-rolling sky puzzle game. TypeScript + Vite + Three.js + Rapier. No engine, no editor files, no image assets: levels are JSON, art is procedural geometry.

- `npm run check` on every change: typecheck plus a headless Rapier run of every level in `src/levels/`.
- `src/level.ts` is the level schema and the single source of each piece's local-space parts (`pieceBoxes`, `pieceSectors`). `sim.ts` (physics) and `scene.ts` (rendering) both consume it; add a piece type there first and both sides follow.
- `sim.ts` must stay free of `three` and DOM so `scripts/check.ts` can run it in Node.
- The physics floor is ONE welded trimesh (`floor.ts`) with Rapier's internal-edge fix; separate cuboids per platform make the ball hop at every seam. Seams weld only where snapped vertices coincide, so keep piece edges on the 0.5 grid. `check.ts` asserts the ball stays flat across seams and curves.
- Feel tunables live in `src/tuning.ts` and are editable live in-game (`T`). The user judges feel by playing; do not "fix" the numbers without being asked.
- Controls are Aerox-style: steer input rotates the camera yaw, throttle pushes along the camera forward. Keep it that way.
- Modes (`menu.ts`, `game.ts`, `editor.ts`) own their DOM under `#overlay` and clear it in `dispose()`.
- Comments: only where a future reader would otherwise get it wrong. README documents the level format.
