import { chromium, request as playwrightRequest } from "playwright";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:3000";
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const widths = [360, 375, 390, 430, 768];
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

async function hasOverflow(page) {
  return await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

async function checkWidth(width) {
  const page = await browser.newPage({ viewport: { width, height: width >= 768 ? 1000 : 900 } });
  const flush = await collectErrors(page, `${width}px`);
  const requested = [];
  page.on("request", (req) => requested.push(req.url()));

  const response = await page.goto(base, { waitUntil: "networkidle" });
  if (!response?.ok()) failures.push(`${width}px home HTTP ${response?.status()}`);
  if (await hasOverflow(page)) failures.push(`${width}px horizontal overflow`);

  const robotsMeta = await page.locator('meta[name="robots"]').getAttribute("content");
  if (!robotsMeta?.includes("noindex")) failures.push(`${width}px preview noindex meta missing`);
  const xRobots = response?.headers()["x-robots-tag"] ?? "";
  if (!xRobots.includes("noindex")) failures.push(`${width}px preview X-Robots-Tag missing`);
  if (response?.headers()["x-content-type-options"] !== "nosniff") {
    failures.push(`${width}px nosniff header missing`);
  }
  if (response?.headers()["x-frame-options"] !== "DENY") {
    failures.push(`${width}px frame protection header missing`);
  }

  const imageCount = await page.locator(".visual-cover img, .spotlight-card img").count();
  if (imageCount < 3) failures.push(`${width}px image-first game cards missing`);

  if (width === 390) {
    if (!(await page.getByRole("heading", { name: "업데이트 감지" }).isVisible().catch(() => false))) {
      failures.push("home detected-update section missing");
    }
    const updateLinks = page.locator('a[href$="/updates"]');
    if ((await updateLinks.count()) < 1) {
      failures.push("home detected-update cards do not link to update timelines");
    }
    if (!(await page.getByRole("link", { name: /전체 기록/ }).isVisible().catch(() => false))) {
      failures.push("home global update radar link missing");
    }
  }

  const bodyText = (await page.locator("body").innerText()).toLowerCase();
  for (const forbidden of ["release candidate", "game_enrichment", "index_state", "data-ready"]) {
    if (bodyText.includes(forbidden)) failures.push(`${width}px internal jargon visible: ${forbidden}`);
  }

  if (width <= 430) {
    const navLinks = page.locator(".mobile-nav a");
    for (let i = 0; i < (await navLinks.count()); i++) {
      const box = await navLinks.nth(i).boundingBox();
      if (box && (box.height < 44 || box.width < 44)) {
        failures.push(`${width}px mobile nav target below 44px`);
        break;
      }
    }
  }

  const videoResolverBeforeClick = requested.filter((url) =>
    url.includes("/api/media/video") || url.includes("/functions/v1/r1-game-media"),
  );
  if (videoResolverBeforeClick.length) failures.push(`${width}px video resolver called before video click`);

  const firstPaintCdn = new Set(
    requested.filter((url) => url.includes("rbxcdn.com") && /\/768\/432\//.test(url)),
  );
  if (firstPaintCdn.size > 24) {
    failures.push(`${width}px too many 768x432 images requested on home: ${firstPaintCdn.size}`);
  }

  flush();
  await page.screenshot({ path: `qa-home-${width}.png`, fullPage: true });
  await page.close();
}

for (const width of widths) await checkWidth(width);

async function searchFlow(term, expectedPath, expectedHeading) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const flush = await collectErrors(page, `search ${term}`);
  await page.goto(base, { waitUntil: "networkidle" });
  const input = page.locator("main").getByPlaceholder(/게임 이름/).first();
  await input.fill(term);
  await input.press("Enter");
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 15_000 });
  if (!(await page.getByRole("heading", { name: expectedHeading, exact: true }).isVisible())) {
    failures.push(`search ${term} wrong destination`);
  }
  flush();
  await page.close();
}

await searchFlow("라이벌즈", "/game/rivals", "라이벌즈");
await searchFlow("RIVALS", "/game/rivals", "라이벌즈");
await searchFlow("아스널", "/game/arsenal", "Arsenal");
await searchFlow("DTI", "/game/dress-to-impress", "Dress To Impress");

const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
const flushFlow = await collectErrors(page, "RIVALS game flow");
const networkUrls = [];
page.on("request", (req) => networkUrls.push(req.url()));
await page.goto(`${base}/game/rivals`, { waitUntil: "networkidle" });

if (!(await page.getByRole("link", { name: /Roblox에서 플레이/ }).first().isVisible())) {
  failures.push("mobile play CTA missing");
}
if (!(await page.locator(".media-game-hero").isVisible())) failures.push("media game hero missing");
if ((await page.locator(".media-fact-strip > div").count()) < 5) failures.push("game facts strip incomplete");
if (!(await page.getByRole("heading", { name: "게임 한눈에" }).isVisible())) {
  failures.push("editorial game summary missing");
}
const editorialSummary = await page.locator(".game-editorial-summary").innerText();
if (editorialSummary.length < 180 || !editorialSummary.includes("듀얼 패드")) {
  failures.push("RIVALS verified Korean editorial summary is too thin or missing key official gameplay facts");
}
if ((await page.locator(".media-tile").count()) < 9) failures.push("RIVALS media gallery too small");

const resolverBefore = networkUrls.filter((url) => url.includes("/api/media/video")).length;
if (resolverBefore) failures.push("video resolver called before VIDEO click");

const imageTile = page.locator(".media-tile:not(.media-video)").first();
if (await imageTile.isVisible().catch(() => false)) {
  await imageTile.click();
  if (!(await page.locator(".media-modal").isVisible())) failures.push("image modal did not open");
  await page.keyboard.press("Escape");
  if (await page.locator(".media-modal").isVisible().catch(() => false)) failures.push("image modal ESC close failed");
}

const videoTile = page.locator(".media-video").first();
if (!(await videoTile.isVisible().catch(() => false))) {
  failures.push("RIVALS video tile missing");
} else {
  await videoTile.click();
  await page.waitForTimeout(1200);
  const resolverAfter = networkUrls.filter((url) => url.includes("/api/media/video")).length;
  if (resolverAfter <= resolverBefore) failures.push("video resolver not called after VIDEO click");
  const modalVisible = await page.locator(".media-modal").isVisible().catch(() => false);
  if (!modalVisible) failures.push("video modal did not open");
  const videoSource = await page.locator(".media-modal source").getAttribute("src").catch(() => null);
  const fallback = await page.getByText(/영상을 재생하지 못했습니다|영상을 불러오지 못했습니다/).isVisible().catch(() => false);
  if (!videoSource && !fallback) failures.push("video neither resolved nor showed fallback");
  const close = page.getByRole("button", { name: "닫기" });
  if (await close.isVisible().catch(() => false)) await close.click();
}

const chart = page.locator(".history-chart");
if (await chart.count()) {
  if (!(await page.locator(".chart-axis").isVisible())) failures.push("chart time axis missing");
  if (!(await page.locator(".chart-summary").isVisible())) failures.push("chart min/max/current summary missing");
  const rows = page.locator(".accessible-data tbody tr");
  for (let i = 0; i < (await rows.count()); i++) {
    const cells = rows.nth(i).locator("td");
    const coverage = await cells.nth(2).innerText();
    const used = await cells.nth(3).innerText();
    const match = coverage.match(/(\d+)%/);
    if (match && Number(match[1]) < 70 && used !== "제외") {
      failures.push("low-trust history point not excluded");
      break;
    }
  }
} else if (!(await page.getByText(/신뢰 가능한 관측 구간/).isVisible().catch(() => false))) {
  failures.push("chart neither rendered trusted data nor collecting state");
}

const videoGameSchema = await page.locator('script[type="application/ld+json"]').allTextContents();
if (!videoGameSchema.some((value) => value.includes('"VideoGame"'))) failures.push("VideoGame structured data missing");

const ogResponse = await page.request.get(`${base}/game/rivals/opengraph-image`);
if (!ogResponse.ok()) failures.push(`OG image HTTP ${ogResponse.status()}`);
if (!(ogResponse.headers()["content-type"] ?? "").includes("image/png")) failures.push("OG image content-type is not PNG");

await page.screenshot({ path: "qa-rivals-390.png", fullPage: true });
flushFlow();
await page.close();

const brookhavenPage = await browser.newPage({ viewport: { width: 390, height: 900 } });
const flushBrookhaven = await collectErrors(brookhavenPage, "Brookhaven restricted-provider recovery");
const brookhavenResponse = await brookhavenPage.goto(`${base}/game/brookhaven`, {
  waitUntil: "networkidle",
});
if (!brookhavenResponse?.ok()) {
  failures.push(`Brookhaven HTTP ${brookhavenResponse?.status()}`);
} else {
  if (!(await brookhavenPage.getByRole("heading", { name: "Brookhaven", exact: true }).isVisible())) {
    failures.push("Brookhaven heading missing");
  }
  const hero = brookhavenPage.locator(".media-game-hero-bg");
  if (!(await hero.isVisible().catch(() => false))) {
    failures.push("Brookhaven official hero missing");
  }
  const galleryCount = await brookhavenPage.locator(".media-tile").count();
  if (galleryCount < 5) {
    failures.push(`Brookhaven official gallery too small: ${galleryCount}`);
  }
  const body = await brookhavenPage.locator("body").innerText();
  if (body.includes("[TITLE UNAVAILABLE]") || body.includes("[UNKNOWN]")) {
    failures.push("Brookhaven restricted placeholder leaked into UI");
  }
  for (const phrase of ["기록합니다", "추적합니다", "수집 후보입니다", "현재 플레이 규모를 확인합니다"]) {
    if (body.includes(phrase)) {
      failures.push(`Brookhaven internal summary copy leaked into UI: ${phrase}`);
      break;
    }
  }
  if (body.includes("—명 플레이 중")) {
    failures.push("Brookhaven null player count rendered as dash-person");
  }
}
flushBrookhaven();
await brookhavenPage.screenshot({ path: "qa-brookhaven-390.png", fullPage: true });
await brookhavenPage.close();

const youtubePage = await browser.newPage({ viewport: { width: 390, height: 900 } });
const flushYoutube = await collectErrors(youtubePage, "Fisch YouTube media");
const youtubeRequests = [];
youtubePage.on("request", (req) => youtubeRequests.push(req.url()));
await youtubePage.goto(`${base}/game/fisch`, { waitUntil: "networkidle" });
const youtubeTile = youtubePage.locator(".media-video").first();
if (!(await youtubeTile.isVisible().catch(() => false))) {
  failures.push("Fisch official YouTube media tile missing");
} else {
  await youtubeTile.click();
  const iframe = youtubePage.locator(".media-youtube");
  if (!(await iframe.isVisible().catch(() => false))) {
    failures.push("Fisch YouTube media did not open privacy-enhanced embed");
  } else {
    const src = await iframe.getAttribute("src");
    if (!src?.includes("youtube-nocookie.com/embed/JVDAoUkOxac")) {
      failures.push("Fisch YouTube embed source mismatch");
    }
  }
  if (youtubeRequests.some((url) => url.includes("/api/media/video"))) {
    failures.push("YouTube media incorrectly called Roblox video resolver");
  }
  await youtubePage.keyboard.press("Escape");
}
flushYoutube();
await youtubePage.close();

const explore = await browser.newPage({ viewport: { width: 390, height: 900 } });
const flushExplore = await collectErrors(explore, "game explorer");
await explore.goto(`${base}/games`, { waitUntil: "networkidle" });
const genreSelect = explore.getByLabel("장르");
if (!(await genreSelect.isVisible())) {
  failures.push("genre filter missing");
} else {
  await genreSelect.selectOption({ label: "Shooter" }).catch(() => {});
  if ((await explore.locator(".explorer-card-wrap").count()) < 1) failures.push("Shooter filter returned no games");
}
const videoFilter = explore.getByRole("button", { name: /VIDEO/ });
if (await videoFilter.isVisible()) await videoFilter.click();
const sort = explore.getByLabel("정렬");
if (await sort.isVisible()) await sort.selectOption("updated");

await explore.reload({ waitUntil: "networkidle" });
const compareButtons = explore.getByRole("button", { name: "비교 +" });
if ((await compareButtons.count()) >= 2) {
  await compareButtons.nth(0).click();
  await compareButtons.nth(1).click();
  const compareLink = explore.getByRole("link", { name: /비교하기/ });
  await compareLink.click();
  await explore.waitForURL((url) => url.pathname === "/compare");
  if ((await explore.locator(".compare-game-head").count()) < 2) failures.push("comparison did not retain two games");
  if (!(await explore.getByText("24H 평균").isVisible())) failures.push("comparison historical row missing");
} else {
  failures.push("compare selection buttons missing");
}
flushExplore();
await explore.screenshot({ path: "qa-compare-390.png", fullPage: true });
await explore.close();

for (const path of [
  "/about",
  "/methodology",
  "/guidelines",
  "/privacy",
  "/contact",
  "/youth",
  "/terms",
  "/disclaimer",
]) {
  const info = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const flushInfo = await collectErrors(info, path);
  const response = await info.goto(`${base}${path}`, { waitUntil: "networkidle" });
  if (!response?.ok()) failures.push(`${path} HTTP ${response?.status()}`);
  if (await hasOverflow(info)) failures.push(`${path} mobile horizontal overflow`);
  const disclaimer = await info.locator("footer").getByText(/제휴 또는 공식 관계가 없는 독립 서비스/).count();
  if (!disclaimer) failures.push(`${path} footer disclaimer missing`);
  flushInfo();
  await info.close();
}

for (const [path, heading] of [
  ["/community", "게임 Q&A"],
  ["/game/rivals/questions", "라이벌즈 Q&A"],
  ["/game/rivals/party", "라이벌즈 파티 모집"],
  ["/game/rivals/updates", "라이벌즈 업데이트 기록"],
  ["/updates", "업데이트 감지"],
  ["/login", "계정"],
]) {
  const sub = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const flushSub = await collectErrors(sub, path);
  const response = await sub.goto(`${base}${path}`, { waitUntil: "networkidle" });
  if (!response?.ok()) failures.push(`${path} HTTP ${response?.status()}`);
  if (!(await sub.getByRole("heading", { name: heading, exact: true }).isVisible())) {
    failures.push(`${path} heading missing`);
  }
  if (await hasOverflow(sub)) failures.push(`${path} mobile horizontal overflow`);
  flushSub();
  await sub.close();
}

const updateRadarPage = await browser.newPage({ viewport: { width: 390, height: 900 } });
const flushUpdateRadar = await collectErrors(updateRadarPage, "update radar filters");
await updateRadarPage.goto(`${base}/updates`, { waitUntil: "networkidle" });
const radarGameSelect = updateRadarPage.getByLabel("게임");
const radarRangeSelect = updateRadarPage.getByLabel("기간");
if (!(await radarGameSelect.isVisible().catch(() => false))) {
  failures.push("update radar game filter missing");
}
if (!(await radarRangeSelect.isVisible().catch(() => false))) {
  failures.push("update radar range filter missing");
} else {
  await radarRangeSelect.selectOption("1");
  await updateRadarPage.waitForURL(
    (url) => url.pathname === "/updates" && url.searchParams.get("hours") === "1",
    { timeout: 15_000 },
  );
  if (await hasOverflow(updateRadarPage)) {
    failures.push("update radar filtered mobile horizontal overflow");
  }
  if ((await radarRangeSelect.inputValue()) !== "1") {
    failures.push("update radar range filter state did not persist");
  }
}
if ((await radarGameSelect.locator("option").count()) < 2) {
  failures.push("update radar game filter has no detected-game options");
}
flushUpdateRadar();
await updateRadarPage.screenshot({ path: "qa-updates-filter-390.png", fullPage: true });
await updateRadarPage.close();

const authRedirectPage = await browser.newPage({ viewport: { width: 390, height: 900 } });
for (const path of ["/me", "/notifications", "/admin/moderation", "/admin/content"]) {
  const response = await authRedirectPage.goto(`${base}${path}`, { waitUntil: "networkidle" });
  if (!response?.ok()) failures.push(`${path} auth redirect HTTP ${response?.status()}`);
  if (!authRedirectPage.url().includes("/login")) failures.push(`${path} did not redirect unauthenticated user to login`);
}
await authRedirectPage.close();

const api = await playwrightRequest.newContext();
const robots = await api.get(`${base}/robots.txt`);
if (!robots.ok()) failures.push(`robots.txt HTTP ${robots.status()}`);
if (!(await robots.text()).includes("Disallow: /")) failures.push("preview robots global disallow missing");

const sitemap = await api.get(`${base}/sitemap.xml`);
if (!sitemap.ok()) failures.push(`sitemap.xml HTTP ${sitemap.status()}`);
if ((await sitemap.text()).includes("<url>")) failures.push("preview sitemap must not publish URL entries");

for (const endpoint of ["/api/internal/collector/run", "/api/internal/community-analytics/run"]) {
  const response = await api.post(`${base}${endpoint}`);
  if (![401, 503].includes(response.status())) failures.push(`${endpoint} unauthenticated status ${response.status()}`);
}

for (const [query, expected] of [
  ["universeId=x&videoId=1", 400],
  ["universeId=-1&videoId=1", 400],
  ["universeId=6035872082&videoId=1", 404],
  ["universeId=994732206&videoId=99244789216819", 404],
]) {
  const response = await api.get(`${base}/api/media/video?${query}`);
  if (response.status() !== expected) failures.push(`media route ${query} expected ${expected}, got ${response.status()}`);
}

const validVideo = await api.get(
  `${base}/api/media/video?universeId=6035872082&videoId=99244789216819`,
);
if (validVideo.ok()) {
  const payload = await validVideo.json();
  if (!payload.url?.includes("rbxcdn.com")) failures.push("valid RIVALS video did not resolve to Roblox CDN");
} else {
  failures.push(`valid RIVALS video route HTTP ${validVideo.status()}`);
}

const reviewBuild = await api.get(`${base}/review-build.json`);
if (!reviewBuild.ok()) failures.push(`review-build HTTP ${reviewBuild.status()}`);
else {
  const json = await reviewBuild.json();
  if (json.project !== "R1" || json.preview_noindex !== true) failures.push("review-build identity mismatch");
  if (json.indexing_release_confirmed !== false) failures.push("preview release confirmation unexpectedly open");
}
await api.dispose();

if (supabaseUrl && publishableKey) {
  const publicApi = await playwrightRequest.newContext({
    extraHTTPHeaders: {
      apikey: publishableKey,
      "content-type": "application/json",
    },
  });
  for (const table of ["games", "game_aliases", "game_provider_state", "game_enrichment", "game_rollups_hourly"]) {
    const read = await publicApi.get(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`);
    if (!read.ok()) {
      failures.push(`${table} public read HTTP ${read.status()}`);
      continue;
    }

    const insert = await publicApi.post(`${supabaseUrl}/rest/v1/${table}`, {
      data: {},
      headers: { Prefer: "return=minimal" },
    });
    if (![401, 403].includes(insert.status())) {
      const body = await insert.text();
      failures.push(
        `${table} publishable INSERT was not denied: ${insert.status()} ${body.slice(0, 120)}`,
      );
    }

    const update = await publicApi.patch(
      `${supabaseUrl}/rest/v1/${table}?universe_id=eq.-9223372036854775808`,
      {
        data: { universe_id: "-9223372036854775808" },
        headers: { Prefer: "return=minimal" },
      },
    );
    if (![401, 403].includes(update.status())) {
      const body = await update.text();
      failures.push(
        `${table} publishable UPDATE was not denied: ${update.status()} ${body.slice(0, 120)}`,
      );
    }
  }
  await publicApi.dispose();
}

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const flushDesktop = await collectErrors(desktop, "1440px");
await desktop.goto(base, { waitUntil: "networkidle" });
if (await hasOverflow(desktop)) failures.push("1440px horizontal overflow");
await desktop.screenshot({ path: "qa-home-1440.png", fullPage: true });
await desktop.goto(`${base}/game/rivals`, { waitUntil: "networkidle" });
await desktop.screenshot({ path: "qa-rivals-1440.png", fullPage: true });
flushDesktop();
await desktop.close();

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  "Browser QA passed:",
  "360, 375, 390, 430, 768, 1440; search aliases; media modal; trusted history; game filters; compare; public mutation denial; resolver validation; noindex/release guards",
);
