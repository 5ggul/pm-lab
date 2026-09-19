import { chromium } from "playwright";

const base =
  process.env.R1_EDGE_PREVIEW_URL ||
  "https://galfwxoytdcndjihdnyg.supabase.co/functions/v1/r1-web-preview";

const browser = await chromium.launch({ headless: true });
const failures = [];

async function pageErrors(page, label) {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => {
    if (errors.length) failures.push(`${label}: ${errors.join(" | ")}`);
  };
}

const mobile = await browser.newPage({ viewport: { width: 390, height: 900 } });
const flushMobile = await pageErrors(mobile, "edge mobile");
let response = await mobile.goto(`${base}/`, { waitUntil: "networkidle" });
if (!response?.ok()) failures.push(`edge home HTTP ${response?.status()}`);
const robots = await mobile.locator('meta[name="robots"]').getAttribute("content");
if (!robots?.includes("noindex")) failures.push("edge preview noindex meta missing");
const overflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
);
if (overflow) failures.push("edge preview mobile horizontal overflow");
if ((await mobile.locator(".game-row").count()) < 20) {
  failures.push("edge preview catalog did not render 20+ games");
}
if ((await mobile.locator(".icon").count()) < 20) {
  failures.push("edge preview game icons missing");
}
await mobile.screenshot({ path: "qa-edge-home-390.png", fullPage: true });

await mobile.locator('input[name="q"]').fill("아스널");
await Promise.all([
  mobile.waitForURL((url) => url.pathname.endsWith("/game/arsenal")),
  mobile.locator(".search button").click(),
]);
if (!(await mobile.getByText(/플레이 중/).first().isVisible())) {
  failures.push("edge alias search did not reach Arsenal Game Hub");
}
flushMobile();
await mobile.close();

const rivals = await browser.newPage({ viewport: { width: 390, height: 900 } });
const flushRivals = await pageErrors(rivals, "edge rivals");
response = await rivals.goto(`${base}/game/rivals?range=168`, {
  waitUntil: "networkidle",
});
if (!response?.ok()) failures.push(`edge rivals HTTP ${response?.status()}`);
if (!(await rivals.getByRole("link", { name: /Roblox에서 플레이/ }).isVisible())) {
  failures.push("edge Play link missing");
}
const sourceText = await rivals.locator(".source").textContent();
if (!sourceText?.includes("KST")) failures.push("edge source KST missing");
await rivals.screenshot({ path: "qa-edge-rivals-390.png", fullPage: true });
flushRivals();
await rivals.close();

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
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const flush = await pageErrors(page, `edge ${path}`);
  const res = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  if (!res?.ok()) failures.push(`edge ${path} HTTP ${res?.status()}`);
  const xRobots = res?.headers()["x-robots-tag"] ?? "";
  if (!xRobots.includes("noindex")) failures.push(`edge ${path} X-Robots missing`);
  flush();
  await page.close();
}

const build = await (await browser.newPage()).request.get(`${base}/review-build.json`);
if (!build.ok()) failures.push(`edge review-build HTTP ${build.status()}`);
else {
  const json = await build.json();
  if (json.project !== "R1" || json.preview_noindex !== true) {
    failures.push("edge review-build payload mismatch");
  }
}

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const flushDesktop = await pageErrors(desktop, "edge desktop");
response = await desktop.goto(`${base}/games`, { waitUntil: "networkidle" });
if (!response?.ok()) failures.push(`edge games desktop HTTP ${response?.status()}`);
await desktop.screenshot({ path: "qa-edge-games-desktop.png", fullPage: true });
flushDesktop();
await desktop.close();

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Live Supabase Edge review Preview QA passed:", base);
