import { request as playwrightRequest } from "playwright";

const base =
  process.env.R1_EDGE_PREVIEW_URL ||
  "https://galfwxoytdcndjihdnyg.supabase.co/functions/v1/r1-web-preview";
const review =
  process.env.R1_GITHUB_PAGES_REVIEW_URL ||
  "https://5ggul.github.io/pm-lab/oreun-r1-review/";

const api = await playwrightRequest.newContext({
  extraHTTPHeaders: { "user-agent": "Oreun-R1-QA/1.0" },
});
const failures = [];

async function redirect(path, expectedHash) {
  const response = await api.get(base + path, {
    timeout: 20_000,
    maxRedirects: 0,
  });
  if (![301, 302, 307, 308].includes(response.status())) {
    failures.push("edge " + path + " redirect status " + response.status());
    return;
  }
  const location = response.headers()["location"] ?? "";
  if (location !== review + "#" + expectedHash) {
    failures.push("edge " + path + " redirect mismatch: " + location);
  }
}

await redirect("/", "home");
await redirect("/games", "games");
await redirect("/rising", "rising");
await redirect("/game/rivals", "game=rivals");
await redirect("/admin/release-candidate", "rc");

const robots = await api.get(base + "/robots.txt", { timeout: 20_000 });
if (!robots.ok()) failures.push("edge robots HTTP " + robots.status());
const robotsText = await robots.text();
if (!robotsText.includes("Disallow: /")) {
  failures.push("edge robots global disallow missing");
}
const robotsHeaders = robots.headers();
if (!(robotsHeaders["x-robots-tag"] ?? "").includes("noindex")) {
  failures.push("edge robots X-Robots missing");
}

const build = await api.get(base + "/review-build.json", { timeout: 20_000 });
if (!build.ok()) failures.push("edge review-build HTTP " + build.status());
else {
  const json = await build.json();
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
}

const page = await api.get(review, { timeout: 20_000 });
if (!page.ok()) failures.push("GitHub Pages review HTTP " + page.status());
else {
  const text = await page.text();
  const type = page.headers()["content-type"] ?? "";
  if (!type.includes("text/html")) failures.push("GitHub Pages review is not HTML");
  if (!text.includes("오름") || !text.includes("R1 REVIEW PREVIEW")) {
    failures.push("GitHub Pages review identity missing");
  }
  if (!text.includes('name="robots" content="noindex')) {
    failures.push("GitHub Pages review noindex meta missing");
  }
}

await api.dispose();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  "Live review redirect + GitHub Pages HTML contract QA passed:",
  review,
);
