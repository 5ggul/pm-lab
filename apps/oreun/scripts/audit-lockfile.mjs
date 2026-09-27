import { writeFile } from "node:fs/promises";
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

async function fetchBulkAdvisories() {
  const delays = [0, 1500, 4000, 8000];
  let last = null;

  for (const delay of delays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));

    const response = await fetch(
      "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "user-agent": "oreun-r1-lock-audit/1.1",
        },
        body: JSON.stringify(payload),
      },
    );

    if (response.ok) return await response.json();

    const text = await response.text();
    last = { status: response.status, text };

    if (response.status < 500 && response.status !== 429) break;
    console.warn(
      `Bulk Advisory endpoint temporary failure ${response.status}; retrying.`,
    );
  }

  console.error(
    `Bulk Advisory endpoint failed after retries: ${last?.status ?? "unknown"} ${(last?.text ?? "").slice(0, 500)}`,
  );
  await writeFile(new URL("../audit-status.txt", import.meta.url), "unavailable\n");
  process.exit(2);
}

const report = await fetchBulkAdvisories();
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
  await writeFile(new URL("../audit-status.txt", import.meta.url), "vulnerable\n");
  for (const item of blocking) {
    console.error(
      `[${String(item.severity).toUpperCase()}] ${item.name}: ${item.title ?? "advisory"} ${item.url ?? ""}`,
    );
  }
  process.exit(1);
}

await writeFile(new URL("../audit-status.txt", import.meta.url), "clean\n");
