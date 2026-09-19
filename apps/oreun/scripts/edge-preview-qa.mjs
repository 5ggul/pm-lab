import { chromium } from "playwright";

const base =
  process.env.R1_EDGE_PREVIEW_URL ||
  "https://galfwxoytdcndjihdnyg.supabase.co/functions/v1/r1-web-preview";

const browser = await chromium.launch({ headless: true });
const failures = [];
const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
const request = context.request;

async function fetchHtml(path) {
  const response = await request.get(`${base}${path}`, {
    timeout: 20_000,
    headers: { "user-agent": "Oreun-R1-QA/1.0" },
  });
  if (!response.ok()) {
    failures.push(`edge ${path} HTTP ${response.status()}`);
    return { response, html: "" };
  }
  const type = response.headers()["content-type"] ?? "";
  if (!type.includes("text/html")) failures.push(`edge ${path} content-type ${type}`);
  return { response, html: await response.text() };
}

async function renderHtml(path, screenshot) {
  const { response, html } = await fetchHtml(path);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  if (html) {
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const meta = await page.locator('meta[name="robots"]').getAttribute("content", {
      timeout: 5_000,
    }).catch(() => null);
    if (!meta?.includes("noindex")) failures.push(`edge ${path} noindex meta missing`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    if (overflow) failures.push(`edge ${path} mobile horizontal overflow`);
    if (screenshot) await page.screenshot({ path: screenshot, fullPage: true });
  }
  const xRobots = response.headers()["x-robots-tag"] ?? "";
  if (!xRobots.includes("noindex")) failures.push(`edge ${path} X-Robots missing`);
  if (errors.length) failures.push(`edge ${path}: ${errors.join(" | ")}`);
  return { page, html };
}

const home = await renderHtml("/", "qa-edge-home-390.png");
if (home.html) {
  const gameRows = await home.page.locator(".game-row").count();
  if (gameRows < 20) failures.push("edge preview catalog did not render 20+ games");
  const icons = await home.page.locator(".icon").count();
  if (icons < 20) failures.push("edge preview icons missing");
}
await home.page.close();

const aliasResponse = await request.get(`${base}/search?q=${encodeURIComponent("아스널")}`, {
  timeout: 20_000,
  headers: { "user-agent": "Oreun-R1-QA/1.0" },
});
if (!aliasResponse.ok()) failures.push(`edge alias HTTP ${aliasResponse.status()}`);
if (!aliasResponse.url().endsWith("/game/arsenal")) {
  failures.push(`edge alias did not redirect to Arsenal: ${aliasResponse.url()}`);
}
const aliasHtml = await aliasResponse.text();
if (!aliasHtml.includes("Arsenal")) failures.push("edge alias final body missing Arsenal");

const rivals = await renderHtml("/game/rivals?range=168", "qa-edge-rivals-390.png");
if (rivals.html) {
  if ((await rivals.page.getByText(/Roblox에서 플레이/).count()) < 1) {
    failures.push("edge Play link missing");
  }
  const sourceText = await rivals.page.locator(".source").textContent().catch(() => "");
  if (!sourceText?.includes("KST")) failures.push("edge source KST missing");
}
await rivals.page.close();

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
]) {
  const rendered = await renderHtml(path);
  await rendered.page.close();
}

const build = await request.get(`${base}/review-build.json`, { timeout: 20_000 });
if (!build.ok()) failures.push(`edge review-build HTTP ${build.status()}`);
else {
  const json = await build.json();
  if (json.project !== "R1" || json.preview_noindex !== true) {
    failures.push("edge review-build payload mismatch");
  }
  if (!json.edge_deployment_id) failures.push("edge deployment identity missing");
}

const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const desktopResponse = await desktopContext.request.get(`${base}/games`, { timeout: 20_000 });
if (!desktopResponse.ok()) {
  failures.push(`edge games desktop HTTP ${desktopResponse.status()}`);
} else {
  const desktop = await desktopContext.newPage();
  await desktop.setContent(await desktopResponse.text(), { waitUntil: "domcontentloaded" });
  await desktop.screenshot({ path: "qa-edge-games-desktop.png", fullPage: true });
  await desktop.close();
}
await desktopContext.close();

await context.close();
await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Live hosted Supabase Edge review Preview QA passed:", base);
