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

function stripQueryAndHash(value) {
  return value.split('#')[0].split('?')[0];
}

function resolveLocalAsset(htmlFile, value) {
  const clean = stripQueryAndHash(value.trim());
  if (!clean || clean.startsWith('#') || /^(?:https?:)?\/\//i.test(clean) || /^(?:data|mailto|tel):/i.test(clean)) return null;

  const sitePrefix = '/pm-lab/interior-cost-preview/';
  if (clean.startsWith(sitePrefix)) {
    return path.join(siteRoot, clean.slice(sitePrefix.length));
  }

  if (clean.startsWith('/')) return null;
  return path.resolve(path.dirname(htmlFile), clean);
}

function collectAssetRefs(html) {
  const refs = [];
  const linkRe = /<link\b[^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*\bhref=["']([^"']+)["'][^>]*>|<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi;
  const scriptRe = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  const imgRe = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;

  for (const match of html.matchAll(linkRe)) refs.push({ kind: 'stylesheet', value: match[1] || match[2] });
  for (const match of html.matchAll(scriptRe)) refs.push({ kind: 'script', value: match[1] });
  for (const match of html.matchAll(imgRe)) refs.push({ kind: 'image', value: match[1] });
  return refs;
}

const allHtmlFiles = walkHtml(siteRoot);

// Homepage must stay consumer-facing. Release/QA vocabulary and audit routes are not public UI.
const homepagePath = path.join(siteRoot, 'index.html');
const homepage = read(homepagePath);
const bannedHomepagePatterns = [
  ['PRIMARY ANSWER', /PRIMARY\s+ANSWER/i],
  ['EVIDENCE TYPE', /EVIDENCE\s+TYPE/i],
  ['RELEASE CANDIDATE', /RELEASE\s+CANDIDATE/i],
  ['INDEX RELEASE', /INDEX\s+RELEASE/i],
  ['PREVIEW · NOINDEX', /PREVIEW\s*[·•-]?\s*NOINDEX/i],
  ['Actual index', /Actual\s+index/i],
  ['/data/search-snippets-v*', /\/data\/search-snippets-v/i],
  ['/data/mobile-audit-v*', /\/data\/mobile-audit-v/i],
  ['/data/citation-pack-v*', /\/data\/citation-pack-v/i],
  ['/data/production-diff-v*', /\/data\/production-diff-v/i],
  ['/data/answers-v*', /\/data\/answers-v/i],
  ['legacy release strip class', /v18-release-strip|v16-wave-strip/i],
];
for (const [label, pattern] of bannedHomepagePatterns) {
  if (pattern.test(homepage)) fail(`homepage regression: banned QA/release marker found: ${label}`);
}

// Every statically referenced local stylesheet/script/image must exist in the preview tree.
const missingAssetKeys = new Set();
let checkedAssetRefs = 0;
for (const file of allHtmlFiles) {
  const html = read(file);
  for (const ref of collectAssetRefs(html)) {
    const resolved = resolveLocalAsset(file, ref.value);
    if (!resolved) continue;
    checkedAssetRefs += 1;
    if (!resolved.startsWith(siteRoot + path.sep) && resolved !== siteRoot) {
      fail(`local asset escapes site root: ${rel(file)} -> ${ref.value}`);
      continue;
    }
    if (!fs.existsSync(resolved)) {
      const key = `${ref.kind}|${ref.value}`;
      if (!missingAssetKeys.has(key)) {
        missingAssetKeys.add(key);
        fail(`missing local ${ref.kind}: ${ref.value} (referenced by ${rel(file)})`);
      }
    }
  }
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
console.log('Homepage checked: no QA/release chrome markers');
console.log(`Local assets checked: ${checkedAssetRefs} stylesheet/script/image references`);
console.log(`Protected roots checked: ${protectedRoots.join(', ')}`);
console.log(`Matrix routes checked: ${matrixRouteCount} noindex routes canonicalized to five trade hubs`);
console.log('Production sitemap checked: protected routes excluded, core public routes present');
console.log('Robots templates checked: preview blocked, production crawlable');
if (notes.length) {
  console.log('Notes:');
  for (const note of notes) console.log(`- ${note}`);
}
