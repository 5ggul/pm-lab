const base = process.env.QA_BASE_URL || "http://127.0.0.1:3001";
const expectedSite =
  process.env.QA_EXPECTED_SITE_URL || "https://oreun-review.example.com";
const failures = [];

async function get(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    redirect: options.redirect ?? "follow",
  });
  return { response, text: await response.text() };
}

const home = await get("/");
if (!home.response.ok()) failures.push(`release home HTTP ${home.response.status}`);
if ((home.response.headers.get("x-robots-tag") ?? "").includes("noindex")) {
  failures.push("release home still has X-Robots-Tag noindex");
}
if (home.text.includes('name="robots" content="noindex')) {
  failures.push("release home still has noindex meta");
}
if (!home.text.includes(expectedSite)) {
  failures.push("release metadata does not use validated site origin");
}

const robots = await get("/robots.txt");
if (!robots.response.ok()) failures.push(`release robots HTTP ${robots.response.status}`);
if (!robots.text.includes("Allow: /")) failures.push("release robots allow missing");
if (!robots.text.includes("Disallow: /search")) failures.push("release robots search block missing");
if (!robots.text.includes("Disallow: /admin/")) failures.push("release robots admin block missing");
if (!robots.text.includes(`${expectedSite}/sitemap.xml`)) {
  failures.push("release robots sitemap origin mismatch");
}

const sitemap = await get("/sitemap.xml");
if (!sitemap.response.ok()) failures.push(`release sitemap HTTP ${sitemap.response.status}`);
if (!sitemap.text.includes("<url>")) failures.push("release sitemap is unexpectedly empty");
if (sitemap.text.includes("localhost")) failures.push("release sitemap leaked localhost origin");

for (const path of [
  "/admin/data-status",
  "/admin/launch-readiness",
  "/admin/community-analytics",
]) {
  const result = await fetch(`${base}${path}`, { redirect: "manual" });
  if (result.status !== 404) {
    failures.push(`${path} release diagnostic expected 404, got ${result.status}`);
  }
}

const build = await fetch(`${base}/review-build.json`, { redirect: "manual" });
if (build.status !== 404) {
  failures.push(`release review-build expected 404, got ${build.status}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  "Release guard QA passed: three-key index release, production robots/sitemap, diagnostic admin and review-build 404",
);
