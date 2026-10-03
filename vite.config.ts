import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

// Dev-only: the editor's Save button POSTs a level here and it replaces src/levels/<id>.json;
// the admin panel's Delete POSTs {id} to /__level/delete, which removes that file; GET
// /__level/all returns every level as it is on disk right now, in file order. /__thumb/save writes a
// level's menu picture to public/thumbs/<id>.png and its key to public/thumbs/index.json.
const THUMBS = "public/thumbs", THUMB_INDEX = `${THUMBS}/index.json`;
const thumbIndex = (): Record<string, string> => (existsSync(THUMB_INDEX) ? (JSON.parse(readFileSync(THUMB_INDEX, "utf8")) as Record<string, string>) : {});
const writeThumbIndex = (index: Record<string, string>) =>
  writeFileSync(THUMB_INDEX, `${JSON.stringify(Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`);
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
            const level = JSON.parse(body) as { id: string; name: string; hidden?: boolean; thumb?: unknown; pieces: unknown[] };
            if (typeof level.id !== "string" || !/^[a-z0-9-]+$/.test(level.id)) throw new Error("level id must be lowercase letters, digits and dashes");
            if (typeof level.name !== "string" || !Array.isArray(level.pieces)) throw new Error("level needs a name and pieces");
            const file = `src/levels/${level.id}.json`;
            // One piece per line, spaced like the checked-in files, so a save is a readable diff.
            const lines = level.pieces.map((p, i) => `    ${JSON.stringify(p).replace(/,/g, ", ").replace(/:/g, ": ")}${i < level.pieces.length - 1 ? "," : ""}`);
            const thumb = level.thumb ? `  "thumb": ${JSON.stringify(level.thumb).replace(/,/g, ", ").replace(/:/g, ": ")},\n` : "";
            const hidden = level.hidden === true ? `  "hidden": true,\n` : "";
            writeFileSync(file, `{\n  "id": ${JSON.stringify(level.id)},\n  "name": ${JSON.stringify(level.name)},\n${hidden}${thumb}  "pieces": [\n${lines.join("\n")}\n  ]\n}\n`);
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ file }));
          } catch (err) {
            res.statusCode = 400;
            res.end(String(err instanceof Error ? err.message : err));
          }
        });
      });
      server.middlewares.use("/__thumb/save", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
        let body = "";
        req.on("data", (c: Buffer) => { body += c; });
        req.on("end", () => {
          try {
            const { id, key, png } = JSON.parse(body) as { id: string; key: string; png: string };
            if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) throw new Error("level id must be lowercase letters, digits and dashes");
            if (typeof key !== "string" || typeof png !== "string" || !png.startsWith("data:image/png;base64,")) throw new Error("needs a key and a PNG data URL");
            mkdirSync(THUMBS, { recursive: true });
            writeFileSync(`${THUMBS}/${id}.png`, Buffer.from(png.slice("data:image/png;base64,".length), "base64"));
            writeThumbIndex({ ...thumbIndex(), [id]: key });
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ file: `${THUMBS}/${id}.png` }));
          } catch (err) {
            res.statusCode = 400;
            res.end(String(err instanceof Error ? err.message : err));
          }
        });
      });
      server.middlewares.use("/__level/all", (_req, res) => {
        const files = readdirSync("src/levels").filter((f) => f.endsWith(".json")).sort();
        res.setHeader("content-type", "application/json");
        res.setHeader("cache-control", "no-store");
        res.end(`[${files.map((f) => readFileSync(`src/levels/${f}`, "utf8")).join(",")}]`);
      });
      server.middlewares.use("/__level/delete", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
        let body = "";
        req.on("data", (c: Buffer) => { body += c; });
        req.on("end", () => {
          try {
            const { id } = JSON.parse(body) as { id: string };
            if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) throw new Error("level id must be lowercase letters, digits and dashes");
            const file = `src/levels/${id}.json`;
            if (!existsSync(file)) throw new Error(`${file} does not exist`);
            unlinkSync(file);
            const index = thumbIndex();
            if (existsSync(`${THUMBS}/${id}.png`)) unlinkSync(`${THUMBS}/${id}.png`);
            if (id in index) { delete index[id]; writeThumbIndex(index); }
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
