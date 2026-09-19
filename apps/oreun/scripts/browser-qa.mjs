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
  const xRobots = response?.headers()["x-robots-tag"] ?? "";
  if (!xRobots.includes("noindex")) {
    failures.push(`${width}px preview X-Robots-Tag missing`);
  }
  if (response?.headers()["x-content-type-options"] !== "nosniff") {
    failures.push(`${width}px nosniff header missing`);
  }
  if (response?.headers()["x-frame-options"] !== "DENY") {
    failures.push(`${width}px frame protection header missing`);
  }

  const imageCount = await page.locator(".visual-cover img, .spotlight-card img").count();
  if (imageCount < 3) failures.push(`${width}px image-first game cards missing`);

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

if (!(await page.getByRole("link", { name: /Roblox에서 플레이/ }).isVisible())) {
  failures.push("play link missing");
}
if (!(await page.locator(".media-game-hero").isVisible())) {
  failures.push("media game hero missing");
}
if ((await page.locator(".media-fact-strip .fact, .media-fact-strip > div").count()) < 5) {
  failures.push("game facts strip incomplete");
}
if (!(await page.getByText(/Roblox 공개 API/).isVisible())) {
  failures.push("Roblox public API provenance missing");
}

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
if (!(await aliasPage.getByRole("heading", { name: "Arsenal", exact: true }).isVisible())) {
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

for (const [path, heading] of [
  ["/community", "게임 Q&A"],
  ["/game/rivals/questions", "라이벌즈 Q&A"],
  ["/login", "계정"],
]) {
  const community = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const flushCommunity = await collectErrors(community, path);
  const response = await community.goto(`${base}${path}`, {
    waitUntil: "networkidle",
  });
  if (!response?.ok()) failures.push(`${path} HTTP ${response?.status()}`);
  if (!(await community.getByRole("heading", { name: heading }).isVisible())) {
    failures.push(`${path} heading missing`);
  }
  const robotsMeta = await community
    .locator('meta[name="robots"]')
    .getAttribute("content");
  if (!robotsMeta?.includes("noindex")) {
    failures.push(`${path} noindex meta missing`);
  }
  const overflow = await community.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  if (overflow) failures.push(`${path} mobile horizontal overflow`);
  flushCommunity();
  await community.screenshot({
    path: `qa-${path.replaceAll("/", "-").replace(/^-+/, "") || "community"}-390.png`,
    fullPage: true,
  });
  await community.close();
}

for (const [path, heading] of [
  ["/game/rivals/codes", "라이벌즈 코드"],
  ["/game/rivals/guides", "라이벌즈 공략·가이드"],
  ["/game/rivals/updates", "라이벌즈 업데이트 기록"],
]) {
  const contentPage = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const flushContent = await collectErrors(contentPage, path);
  const response = await contentPage.goto(`${base}${path}`, {
    waitUntil: "networkidle",
  });
  if (!response?.ok()) failures.push(`${path} HTTP ${response?.status()}`);
  if (!(await contentPage.getByRole("heading", { name: heading, exact: true }).isVisible())) {
    failures.push(`${path} heading missing`);
  }
  const robotsMeta = await contentPage
    .locator('meta[name="robots"]')
    .getAttribute("content");
  if (!robotsMeta?.includes("noindex")) {
    failures.push(`${path} noindex meta missing`);
  }
  const overflow = await contentPage.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  if (overflow) failures.push(`${path} mobile horizontal overflow`);
  flushContent();
  await contentPage.close();
}

for (const [path, heading] of [
  ["/game/rivals/party", "라이벌즈 파티 모집"],
]) {
  const partyPage = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const flushParty = await collectErrors(partyPage, path);
  const response = await partyPage.goto(`${base}${path}`, {
    waitUntil: "networkidle",
  });
  if (!response?.ok()) failures.push(`${path} HTTP ${response?.status()}`);
  if (!(await partyPage.getByRole("heading", { name: heading, exact: true }).isVisible())) {
    failures.push(`${path} heading missing`);
  }
  const robotsMeta = await partyPage
    .locator('meta[name="robots"]')
    .getAttribute("content");
  if (!robotsMeta?.includes("noindex")) {
    failures.push(`${path} noindex meta missing`);
  }
  const overflow = await partyPage.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  if (overflow) failures.push(`${path} mobile horizontal overflow`);
  if (!(await partyPage.getByText(/외부 연락처 없이 모집/).isVisible())) {
    failures.push(`${path} safety boundary missing`);
  }
  flushParty();
  await partyPage.close();
}

const analyticsPage = await browser.newPage({ viewport: { width: 390, height: 900 } });
const flushAnalytics = await collectErrors(analyticsPage, "community analytics admin");
const analyticsResponse = await analyticsPage.goto(`${base}/admin/community-analytics`, {
  waitUntil: "networkidle",
});
if (!analyticsResponse?.ok()) {
  failures.push(`/admin/community-analytics HTTP ${analyticsResponse?.status()}`);
}
if (
  !(await analyticsPage
    .getByRole("heading", { name: "Community Analytics · 내부 Preview", exact: true })
    .isVisible())
) {
  failures.push("/admin/community-analytics heading missing");
}
const analyticsRobots = await analyticsPage
  .locator('meta[name="robots"]')
  .getAttribute("content");
if (!analyticsRobots?.includes("noindex")) {
  failures.push("/admin/community-analytics noindex meta missing");
}
if (
  !(await analyticsPage.getByText(/기본 OFF/).first().isVisible())
) {
  failures.push("/admin/community-analytics fail-closed flag copy missing");
}
const analyticsOverflow = await analyticsPage.evaluate(
  () =>
    document.documentElement.scrollWidth >
    document.documentElement.clientWidth,
);
if (analyticsOverflow) {
  failures.push("/admin/community-analytics mobile horizontal overflow");
}
flushAnalytics();
await analyticsPage.close();

const authRedirectPage = await browser.newPage({ viewport: { width: 390, height: 900 } });
for (const path of ["/me", "/notifications", "/admin/moderation", "/admin/content"]) {
  const response = await authRedirectPage.goto(`${base}${path}`, {
    waitUntil: "networkidle",
  });
  if (!response?.ok()) failures.push(`${path} auth redirect HTTP ${response?.status()}`);
  if (authRedirectPage.url().includes("/login") === false) {
    failures.push(`${path} did not redirect unauthenticated user to login`);
  }
}
await authRedirectPage.close();

const apiPage = await browser.newPage();
const robots = await apiPage.request.get(`${base}/robots.txt`);
if (!robots.ok()) failures.push(`robots.txt HTTP ${robots.status()}`);
const robotsText = await robots.text();
if (!robotsText.includes("Disallow: /")) failures.push("preview robots global disallow missing");

const sitemap = await apiPage.request.get(`${base}/sitemap.xml`);
if (!sitemap.ok()) failures.push(`sitemap.xml HTTP ${sitemap.status()}`);
const sitemapText = await sitemap.text();
if (sitemapText.includes("<url>")) {
  failures.push("preview sitemap must not publish URL entries");
}

for (const endpoint of [
  "/api/internal/collector/run",
  "/api/internal/community-analytics/run",
]) {
  const response = await apiPage.request.post(`${base}${endpoint}`);
  if (![401, 503].includes(response.status())) {
    failures.push(`${endpoint} unauthenticated status ${response.status()}`);
  }
}

const reviewBuild = await apiPage.request.get(`${base}/review-build.json`);
if (!reviewBuild.ok()) failures.push(`review-build HTTP ${reviewBuild.status()}`);
else {
  const reviewJson = await reviewBuild.json();
  if (reviewJson.project !== "R1") failures.push("review-build project mismatch");
  if (reviewJson.preview_noindex !== true) failures.push("review-build noindex mismatch");
  if (reviewJson.indexing_release_confirmed !== false) {
    failures.push("preview release confirmation latch unexpectedly open");
  }
  if (reviewJson.release_candidate !== true) {
    failures.push("review-build release candidate marker missing");
  }
}
await apiPage.close();

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
  "image-first home, media game hub, aliases, trust pages, Sprint 02 community/account, Sprint 03 verified content, Sprint 04 party routes, Sprint 05 analytics admin, empty preview sitemap, internal API auth, noindex headers, structured data and OG image",
);
