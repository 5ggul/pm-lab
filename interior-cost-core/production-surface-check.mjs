import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const siteRoot = path.resolve(repoRoot, process.argv[2] || 'docs/interior-cost-preview');
const sitemapPath = path.join(siteRoot, 'sitemap-production.xml');
const previewRobotsPath = path.join(siteRoot, 'robots.txt');
const productionRobotsPath = path.join(siteRoot, 'robots-production.txt');

const errors = [];
const notes = [];

function fail(message) {
  errors.push(message);
}

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    fail(`missing file: ${path.relative(repoRoot, file)}`);
    return '';
  }
}

function walkHtml(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtml(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(siteRoot, file).split(path.sep).join('/');
}

function hasNoindex(html) {
  return /<meta\s+[^>]*name=["'](?:robots|googlebot)["'][^>]*content=["'][^"']*noindex/i.test(html) ||
    /<meta\s+[^>]*content=["'][^"']*noindex[^"']*["'][^>]*name=["'](?:robots|googlebot)["']/i.test(html);
}

function canonicalHref(html) {
  return html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ||
    html.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1] || '';
}

const protectedRoots = [
  'region',
  'quote-batch',
  'quote-intake',
  'quote-market',
  'search',
  'compare',
];

for (const root of protectedRoots) {
  const files = walkHtml(path.join(siteRoot, root));
  if (!files.length) {
    notes.push(`protected root absent: ${root}`);
    continue;
  }
  for (const file of files) {
    const html = read(file);
    if (!hasNoindex(html)) fail(`protected route must stay noindex: ${rel(file)}`);
  }
}

const matrixRoot = path.join(siteRoot, 'interior-cost', 'matrix');
const matrixHub = path.join(matrixRoot, 'index.html');
if (fs.existsSync(matrixHub) && !hasNoindex(read(matrixHub))) {
  fail('matrix hub must stay noindex: interior-cost/matrix/index.html');
}

let matrixRouteCount = 0;
for (const file of walkHtml(matrixRoot)) {
  const relative = rel(file);
  if (relative === 'interior-cost/matrix/index.html') continue;

  const match = relative.match(/^interior-cost\/matrix\/(24|30|32|34|40)-pyeong\/(bathroom|carpentry|floor|insulation|wallpaper)\/index\.html$/);
  if (!match) {
    fail(`unexpected matrix route: ${relative}`);
    continue;
  }

  matrixRouteCount += 1;
  const [, , trade] = match;
  const html = read(file);
  if (!hasNoindex(html)) fail(`matrix route must stay noindex: ${relative}`);

  const expectedSuffix = `/cost/${trade}/`;
  const canonical = canonicalHref(html);
  if (!canonical.endsWith(expectedSuffix)) {
    fail(`matrix canonical must point to ${expectedSuffix}: ${relative} -> ${canonical || '(missing)'}`);
  }
}
if (matrixRouteCount !== 25) {
  fail(`expected exactly 25 retired pyeong×trade matrix routes, found ${matrixRouteCount}`);
}

const sitemap = read(sitemapPath);
const blockedSitemapFragments = [
  '/region/',
  '/interior-cost/matrix/',
  '/quote-batch/',
  '/quote-intake/',
  '/quote-market/',
  '/search/',
  '/compare/',
];
for (const fragment of blockedSitemapFragments) {
  if (sitemap.includes(fragment)) fail(`production sitemap exposes protected route: ${fragment}`);
}

const requiredPublicFragments = [
  '/quote-check/',
  '/quote-compare/',
  '/calculator/',
  '/interior-cost/24-pyeong/',
  '/interior-cost/30-pyeong/',
  '/interior-cost/32-pyeong/',
  '/interior-cost/34-pyeong/',
  '/interior-cost/40-pyeong/',
  '/cost/bathroom/',
  '/cost/carpentry/',
  '/cost/floor/',
  '/cost/insulation/',
  '/cost/wallpaper/',
];
for (const fragment of requiredPublicFragments) {
  if (!sitemap.includes(fragment)) fail(`production sitemap missing required public route: ${fragment}`);
}

const previewRobots = read(previewRobotsPath);
if (!/User-agent:\s*\*[\s\S]*Disallow:\s*\//i.test(previewRobots)) {
  fail('preview robots.txt must block crawling with Disallow: /');
}

const productionRobots = read(productionRobotsPath);
if (/Disallow:\s*\//i.test(productionRobots)) {
  fail('robots-production.txt must not globally block crawling');
}
if (!/Sitemap:/i.test(productionRobots)) {
  fail('robots-production.txt must declare a sitemap');
}

if (errors.length) {
  console.error('\nInterior production surface check: FAIL\n');
  for (const error of errors) console.error(`- ${error}`);
  if (notes.length) {
    console.error('\nNotes');
    for (const note of notes) console.error(`- ${note}`);
  }
  process.exit(1);
}

console.log('Interior production surface check: PASS');
console.log(`Protected roots checked: ${protectedRoots.join(', ')}`);
console.log(`Matrix routes checked: ${matrixRouteCount} noindex routes canonicalized to five trade hubs`);
console.log('Production sitemap checked: protected routes excluded, core public routes present');
console.log('Robots templates checked: preview blocked, production crawlable');
if (notes.length) {
  console.log('Notes:');
  for (const note of notes) console.log(`- ${note}`);
}
