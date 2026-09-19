import { chromium, request as playwrightRequest } from "playwright";

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
  if (!text.includes("오름") || !text.includes("R1 PREVIEW")) {
    failures.push("GitHub Pages review identity missing");
  }
  if (!text.includes("game_enrichment") || !text.includes("미디어")) {
    failures.push("GitHub Pages media-rich data contract missing");
  }
  if (!text.includes('name="robots" content="noindex')) {
    failures.push("GitHub Pages review noindex meta missing");
  }
}

await api.dispose();

const browser = await chromium.launch({ headless: true });
const livePage = await browser.newPage({ viewport: { width: 390, height: 900 } });
const liveErrors = [];
livePage.on("console", (message) => {
  if (message.type() === "error") liveErrors.push(message.text());
});
livePage.on("pageerror", (error) => liveErrors.push(error.message));

const liveResponse = await livePage.goto(review + "#home", {
  waitUntil: "networkidle",
  timeout: 30_000,
});
if (!liveResponse?.ok()) {
  failures.push("GitHub Pages browser HTTP " + liveResponse?.status());
} else {
  await livePage.waitForSelector(".spot-main", { timeout: 20_000 });
  const homeCards = await livePage.locator(".game-card").count();
  if (homeCards < 8) failures.push("live review visual game cards missing");
  const loadedHero = await livePage
    .locator(".spot-main img")
    .evaluate((img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0)
    .catch(() => false);
  if (!loadedHero) failures.push("live review hero image did not load");

  await livePage.goto(review + "#game=rivals", {
    waitUntil: "networkidle",
    timeout: 30_000,
  });
  await livePage.waitForSelector(".detail-hero", { timeout: 20_000 });
  const mediaTiles = await livePage.locator(".media-tile").count();
  if (mediaTiles < 8) failures.push("RIVALS official media gallery too small");
  const videoTile = livePage.locator(".media-tile.video").first();
  if (!(await videoTile.isVisible().catch(() => false))) {
    failures.push("RIVALS official video tile missing");
  } else {
    await videoTile.click();
    await livePage.waitForSelector("#modal-content video", { timeout: 20_000 }).catch(() => {});
    const videoSrc = await livePage
      .locator("#modal-content video")
      .getAttribute("src")
      .catch(() => null);
    if (!videoSrc?.includes("rbxcdn.com")) {
      failures.push("RIVALS video resolver did not return Roblox CDN source");
    }
  }
}
if (liveErrors.length) {
  failures.push("GitHub Pages console: " + liveErrors.join(" | "));
}
await livePage.screenshot({ path: "qa-live-review-rivals-390.png", fullPage: true });
await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  "Live review redirect + GitHub Pages media/browser contract QA passed:",
  review,
);
