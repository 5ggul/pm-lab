import { gunzipSync } from "node:zlib";
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
const dir = "tools/r1-payload";
const payload = readdirSync(dir).filter(x => x.endsWith(".txt")).sort().map(x => readFileSync(join(dir,x), "utf8").trim()).join("");
const files = JSON.parse(gunzipSync(Buffer.from(payload, "base64")).toString("utf8"));
for (const [path, content] of Object.entries(files)) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content, "utf8"); }
console.log("R1 Oreun bootstrap wrote " + Object.keys(files).length + " files");
