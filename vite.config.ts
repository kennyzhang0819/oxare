import { writeFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

// Dev-only: the editor's Save button POSTs a level here and it replaces src/levels/<id>.json.
function levelSaver(): Plugin {
  return {
    name: "level-saver",
    configureServer(server) {
      server.middlewares.use("/__level/save", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
        let body = "";
        req.on("data", (c: Buffer) => { body += c; });
        req.on("end", () => {
          try {
            const level = JSON.parse(body) as { id: string; name: string; pieces: unknown[] };
            if (typeof level.id !== "string" || !/^[a-z0-9-]+$/.test(level.id)) throw new Error("level id must be lowercase letters, digits and dashes");
            if (typeof level.name !== "string" || !Array.isArray(level.pieces)) throw new Error("level needs a name and pieces");
            const file = `src/levels/${level.id}.json`;
            // One piece per line, spaced like the checked-in files, so a save is a readable diff.
            const lines = level.pieces.map((p, i) => `    ${JSON.stringify(p).replace(/,/g, ", ").replace(/:/g, ": ")}${i < level.pieces.length - 1 ? "," : ""}`);
            writeFileSync(file, `{\n  "id": ${JSON.stringify(level.id)},\n  "name": ${JSON.stringify(level.name)},\n  "pieces": [\n${lines.join("\n")}\n  ]\n}\n`);
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ file }));
          } catch (err) {
            res.statusCode = 400;
            res.end(String(err instanceof Error ? err.message : err));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: "./",
  build: { target: "es2022" },
  plugins: [levelSaver()],
});
