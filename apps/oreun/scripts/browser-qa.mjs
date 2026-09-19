import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:3000";
const widths = [360, 375, 390, 430];
const browser = await chromium.launch({ headless: true });
const failures = [];

async function checkWidth(width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(base, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  if (overflow) failures.push(`${width}px horizontal overflow`);
  if (errors.length) failures.push(`${width}px console: ${errors.join(" | ")}`);

  await page.screenshot({ path: `qa-home-${width}.png`, fullPage: true });
  await page.close();
}

for (const width of widths) await checkWidth(width);

const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
const flowErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") flowErrors.push(message.text());
});
page.on("pageerror", (error) => flowErrors.push(error.message));

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

const seven = page.getByRole("button", { name: /7D/ });
if (await seven.isEnabled()) await seven.click();

const chartPath = await page.locator(".history-chart path").getAttribute("d");
const chartSegments = chartPath?.match(/M/g)?.length ?? 0;
if (chartSegments < 2) {
  failures.push("missing-row chart gap was bridged instead of split");
}

await page.screenshot({ path: "qa-rivals-390.png", fullPage: true });
if (flowErrors.length) failures.push(`flow console: ${flowErrors.join(" | ")}`);
await page.close();

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const desktopErrors = [];
desktop.on("console", (message) => {
  if (message.type() === "error") desktopErrors.push(message.text());
});
desktop.on("pageerror", (error) => desktopErrors.push(error.message));
await desktop.goto(`${base}/rising`, { waitUntil: "networkidle" });
await desktop.screenshot({ path: "qa-rising-desktop.png", fullPage: true });
if (desktopErrors.length) {
  failures.push(`desktop console: ${desktopErrors.join(" | ")}`);
}
await desktop.close();

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Browser QA passed:", widths.join(", "), "and Game Hub flow");
