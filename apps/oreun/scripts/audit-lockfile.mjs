import { readFile } from "node:fs/promises";

const lockUrl = new URL("../package-lock.json", import.meta.url);
const lock = JSON.parse(await readFile(lockUrl, "utf8"));

function packageName(path, meta) {
  if (meta?.name) return meta.name;
  const marker = "node_modules/";
  const index = path.lastIndexOf(marker);
  if (index < 0) return null;
  const tail = path.slice(index + marker.length);
  const parts = tail.split("/");
  return tail.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

const versions = {};
for (const [path, meta] of Object.entries(lock.packages ?? {})) {
  if (!path || !meta || typeof meta !== "object") continue;
  const name = packageName(path, meta);
  const version = meta.version;
  if (!name || typeof version !== "string" || !version) continue;
  (versions[name] ??= new Set()).add(version);
}

const payload = Object.fromEntries(
  Object.entries(versions).map(([name, set]) => [name, [...set].sort()]),
);

const response = await fetch(
  "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",
  {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "oreun-r1-lock-audit/1.0",
    },
    body: JSON.stringify(payload),
  },
);

if (!response.ok) {
  const text = await response.text();
  console.error(
    `Bulk Advisory endpoint failed: ${response.status} ${text.slice(0, 500)}`,
  );
  process.exit(2);
}

const report = await response.json();
const advisories = Object.entries(report).flatMap(([name, entries]) =>
  (Array.isArray(entries) ? entries : []).map((entry) => ({ name, ...entry })),
);
const blocking = advisories.filter((item) =>
  ["high", "critical"].includes(String(item.severity ?? "").toLowerCase()),
);

console.log(
  `Bulk Advisory audit checked ${Object.keys(payload).length} packages; ${advisories.length} advisories; ${blocking.length} high/critical.`,
);

if (blocking.length) {
  for (const item of blocking) {
    console.error(
      `[${String(item.severity).toUpperCase()}] ${item.name}: ${item.title ?? "advisory"} ${item.url ?? ""}`,
    );
  }
  process.exit(1);
}
