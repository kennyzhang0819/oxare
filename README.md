# balling

A ball-rolling puzzle game in the sky, in the spirit of Aerox. TypeScript, Vite, Three.js, Rapier.

```
npm install
npm run dev      # http://localhost:5173
npm run check    # typecheck + headless physics check of every level
npm run build    # static bundle in dist/
```

## Controls

Aerox-style: left / right swings the camera around the ball, up / down rolls it toward or away from the camera.
Keyboard arrows or WASD, mouse drag to look around, touch drag as a virtual stick, or device tilt (enable it on the menu; iOS asks for permission).
In a level: `T` opens the feel-tuning panel (gravity, throttle, speed cap, damping, camera), `R` respawns, `Esc` returns to the menu.
Tuning values persist in the browser; the panel's Copy button gives them as JSON to paste into `src/tuning.ts`.

## Levels

Each level is a JSON file in `src/levels/`, picked up automatically and listed in file-name order. A level is a list of pieces:

| type      | fields                                   | notes |
|-----------|------------------------------------------|-------|
| `start`   | x y z                                    | one per level, ball spawns here |
| `goal`    | x y z r                                  | one per level, reaching the pad ends the level |
| `slab`    | x y z w d rot fences{n,e,s,w}            | flat platform, top surface at y, fences on local sides before rotation |
| `curve`   | x y z inner outer rot fences{inner,outer,a,b} | 90° annulus around (x, z), sweeping from local +x to local -z; `a` and `b` fence the two ends |
| `block`   | x y z w h d rot                          | obstacle sitting on a surface at y |
| `spinner` | x y z length speed                       | rotating bar, speed in rad/s |

`rot` is degrees about the vertical axis. Slabs and curves may touch along an edge but never overlap; the editor refuses moves that would make them, and `npm run check` rejects levels that do. Use the in-game editor (Edit on the menu) to lay a level out, then Export and drop the file into `src/levels/`.
