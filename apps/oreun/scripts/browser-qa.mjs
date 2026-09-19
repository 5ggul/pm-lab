import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:3000";
const widths = [360, 375, 390, 430];
const browser = await chromium.launch({ headless: true });
const failures = [];

async function collectErrors(page, label) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => {
    if (errors.length) failures.push(`${label} console: ${errors.join(" | ")}`);
  };
}

async function checkWidth(width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const flush = await collectErrors(page, `${width}px`);

  const response = await page.goto(base, { waitUntil: "networkidle" });
  if (!response?.ok()) failures.push(`${width}px home HTTP ${response?.status()}`);

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  if (overflow) failures.push(`${width}px horizontal overflow`);

  const robotsMeta = await page.locator('meta[name="robots"]').getAttribute("content");
  if (!robotsMeta?.includes("noindex")) {
    failures.push(`${width}px preview noindex meta missing`);
  }

  const iconCount = await page.locator(".game-glyph img").count();
  if (iconCount < 1) failures.push(`${width}px real game icons missing`);

  flush();
  await page.screenshot({ path: `qa-home-${width}.png`, fullPage: true });
  await page.close();
}

for (const width of widths) await checkWidth(width);

const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
const flushFlow = await collectErrors(page, "game flow");
await page.goto(base, { waitUntil: "networkidle" });

const input = page.locator("main").getByPlaceholder(/게임 이름/);
await input.fill("라이벌즈");
await input.press("Enter");
await page.waitForURL((url) => url.pathname === "/game/rivals");

const gameSearch = page.locator("main").getByPlaceholder(/게임 이름/);
if (!(await gameSearch.isVisible())) failures.push("game hub main search missing");

if (!(await page.getByRole("link", { name: /Roblox에서 플레이/ }).isVisible())) {
  failures.push("play link missing");
}

const sourceText = await page.locator(".source-box").textContent();
if (!sourceText?.includes("KST")) failures.push("KST source timestamp missing");

const videoGameSchema = await page
  .locator('script[type="application/ld+json"]')
  .allTextContents();
if (!videoGameSchema.some((value) => value.includes('"VideoGame"'))) {
  failures.push("VideoGame structured data missing");
}

const seven = page.getByRole("button", { name: /7D/ });
if (await seven.isEnabled()) await seven.click();

const chartPath = await page.locator(".history-chart path").getAttribute("d");
const chartSegments = chartPath?.match(/M/g)?.length ?? 0;
if (chartSegments < 2) {
  failures.push("missing-row chart gap was bridged instead of split");
}

const ogResponse = await page.request.get(`${base}/game/rivals/opengraph-image`);
if (!ogResponse.ok()) failures.push(`OG image HTTP ${ogResponse.status()}`);
const ogType = ogResponse.headers()["content-type"] ?? "";
if (!ogType.includes("image/png")) failures.push("OG image content-type is not PNG");

await page.screenshot({ path: "qa-rivals-390.png", fullPage: true });
flushFlow();
await page.close();

const aliasPage = await browser.newPage({ viewport: { width: 390, height: 900 } });
const flushAlias = await collectErrors(aliasPage, "alias flow");
await aliasPage.goto(base, { waitUntil: "networkidle" });
const aliasInput = aliasPage.locator("main").getByPlaceholder(/게임 이름/);
await aliasInput.fill("아스널");
await aliasInput.press("Enter");
await aliasPage.waitForURL((url) => url.pathname === "/game/arsenal");
if (!(await aliasPage.getByRole("heading", { name: /Arsenal/ }).isVisible())) {
  failures.push("expanded catalog alias route failed");
}
flushAlias();
await aliasPage.close();

for (const path of [
  "/about",
  "/methodology",
  "/guidelines",
  "/privacy",
  "/youth",
  "/terms",
  "/disclaimer",
]) {
  const info = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const flushInfo = await collectErrors(info, path);
  const response = await info.goto(`${base}${path}`, {
    waitUntil: "networkidle",
  });
  if (!response?.ok()) failures.push(`${path} HTTP ${response?.status()}`);
  const disclaimer = await info
    .locator("footer")
    .getByText(/제휴 또는 공식 관계가 없는 독립 서비스/)
    .count();
  if (!disclaimer) failures.push(`${path} footer disclaimer missing`);
  const overflow = await info.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  if (overflow) failures.push(`${path} mobile horizontal overflow`);
  flushInfo();
  await info.close();
}

const robots = await (await browser.newPage()).request.get(`${base}/robots.txt`);
if (!robots.ok()) failures.push(`robots.txt HTTP ${robots.status()}`);
const robotsText = await robots.text();
if (!robotsText.includes("Disallow: /")) failures.push("preview robots global disallow missing");

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const flushDesktop = await collectErrors(desktop, "desktop");
await desktop.goto(`${base}/rising`, { waitUntil: "networkidle" });
await desktop.screenshot({ path: "qa-rising-desktop.png", fullPage: true });
flushDesktop();
await desktop.close();

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  "Browser QA passed:",
  widths.join(", "),
  "Game Hub, aliases, trust pages, noindex, structured data and OG image",
);
