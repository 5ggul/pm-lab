import { request as playwrightRequest } from "playwright";

const base =
  process.env.R1_EDGE_PREVIEW_URL ||
  "https://galfwxoytdcndjihdnyg.supabase.co/functions/v1/r1-web-preview";

const api = await playwrightRequest.newContext({
  extraHTTPHeaders: { "user-agent": "Oreun-R1-QA/1.0" },
});
const failures = [];

async function get(path, { html = true } = {}) {
  const response = await api.get(`${base}${path}`, { timeout: 20_000 });
  if (!response.ok()) {
    failures.push(`edge ${path} HTTP ${response.status()}`);
    return { response, text: "" };
  }
  const headers = response.headers();
  const xRobots = headers["x-robots-tag"] ?? "";
  if (!xRobots.includes("noindex")) {
    failures.push(`edge ${path} X-Robots missing`);
  }
  if (headers["x-content-type-options"] !== "nosniff") {
    failures.push(`edge ${path} nosniff header missing`);
  }
  if (headers["x-frame-options"] !== "DENY") {
    failures.push(`edge ${path} frame protection header missing`);
  }
  const text = await response.text();
  if (html) {
    if (!text.toLowerCase().startsWith("<!doctype html>")) {
      failures.push(`edge ${path} HTML body missing`);
    }
    if (!text.includes('name="robots" content="noindex')) {
      failures.push(`edge ${path} noindex meta missing`);
    }
  }
  return { response, text };
}

const home = await get("/");
const homeRows = (home.text.match(/class="game-row"/g) ?? []).length;
if (homeRows !== 12) {
  failures.push(`edge home expected 12 featured rows, found ${homeRows}`);
}
const homeIcons = (home.text.match(/class="icon(?:\s|")/g) ?? []).length;
if (homeIcons !== homeRows) {
  failures.push(`edge home icon/glyph count ${homeIcons} != rows ${homeRows}`);
}
if (!home.text.includes("지금 어떤 게임이")) failures.push("edge home hero missing");
if (!home.text.includes("Catalog 26개")) failures.push("edge home catalog count missing");

const games = await get("/games");
const catalogRows = (games.text.match(/class="game-row"/g) ?? []).length;
if (catalogRows < 26) failures.push(`edge full catalog rows only ${catalogRows}`);
const catalogIcons = (games.text.match(/class="icon(?:\s|")/g) ?? []).length;
if (catalogIcons !== catalogRows) {
  failures.push(`edge full catalog icon/glyph count ${catalogIcons} != rows ${catalogRows}`);
}

const alias = await api.get(
  `${base}/search?q=${encodeURIComponent("아스널")}`,
  { timeout: 20_000 },
);
if (!alias.ok()) failures.push(`edge alias HTTP ${alias.status()}`);
if (!alias.url().endsWith("/game/arsenal")) {
  failures.push(`edge alias final URL mismatch: ${alias.url()}`);
}
const aliasText = await alias.text();
if (!aliasText.includes("Arsenal")) failures.push("edge alias body missing Arsenal");

const rivals = await get("/game/rivals?range=168");
if (!rivals.text.includes("Roblox에서 플레이")) failures.push("edge Play link missing");
if (!rivals.text.includes("KST")) failures.push("edge source KST missing");
if (!rivals.text.includes("플레이 인원 기록")) failures.push("edge historical section missing");

for (const path of [
  "/about",
  "/methodology",
  "/guidelines",
  "/privacy",
  "/youth",
  "/terms",
  "/disclaimer",
  "/admin/data-status",
  "/admin/launch-readiness",
  "/admin/community-analytics",
  "/admin/release-candidate",
]) {
  const result = await get(path);
  if (!result.text.includes("본 서비스는 Roblox Corporation과 제휴")) {
    failures.push(`edge ${path} disclaimer missing`);
  }
}

const robots = await get("/robots.txt", { html: false });
if (!robots.text.includes("Disallow: /")) failures.push("edge robots global disallow missing");

const build = await get("/review-build.json", { html: false });
try {
  const json = JSON.parse(build.text);
  if (json.project !== "R1" || json.preview_noindex !== true) {
    failures.push("edge review-build payload mismatch");
  }
  if (!json.edge_deployment_id) failures.push("edge deployment identity missing");
  if (json.community_analytics_version !== "sprint05") {
    failures.push("edge Sprint 05 analytics metadata missing");
  }
  if (json.release_candidate !== true) {
    failures.push("edge release candidate marker missing");
  }
  if (json.indexing_release_confirmed !== false) {
    failures.push("edge release lock unexpectedly open");
  }
} catch {
  failures.push("edge review-build invalid JSON");
}

await api.dispose();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Live Supabase Edge review endpoint contract QA passed:", base);
