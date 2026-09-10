import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../docs/franchise-ssg-preview');
const fail = message => { throw new Error(message); };

const report = JSON.parse(await fs.readFile(path.join(out, 'v11-27-visual-qa.json'), 'utf8'));
const snapshot = JSON.parse(await fs.readFile(path.join(out, 'data-snapshot-v11-26.json'), 'utf8'));
if (report.uiVersion !== '11.27') fail('v11.27 report missing');
if (report.productionCandidateCount !== 184) fail(`candidate count changed: ${report.productionCandidateCount}`);
if (!Array.isArray(snapshot.brands) || snapshot.brands.length !== 136) fail('trusted snapshot brand list invalid');
if (report.candidateBrands !== snapshot.brands.length) fail(`trusted brand count changed: ${report.candidateBrands}`);
if (report.snapshot !== snapshot.snapshot_id) fail('snapshot id mismatch');
if (!report.policy.includes('NO_INDEX_CHANGE') || !report.policy.includes('NO_PRODUCTION_DEPLOY')) fail('release guard missing');

const css = await fs.readFile(path.join(out, 'assets/site.css'), 'utf8');
const start = css.indexOf('/* v11.27 visual QA */');
const end = css.indexOf('/* v11.27 visual QA end */');
if (start < 0 || end < start) fail('v11.27 CSS block missing');
if (css.indexOf('/* v11.27 visual QA */', start + 1) !== -1) fail('duplicate v11.27 CSS block');
const v27 = css.slice(start, end);
for (const needle of [
  '.v26-area-picker,.v25-compare .v25-pickers{top:68px',
  '.category-scatter{min-width:0!important;width:100%!important;max-width:100%}',
  '.v26-category-area .v26-area-row:nth-child(n+9){display:grid!important}',
  '.v26-rankings .stack-mobile,.v25-brand .stack-mobile{display:table!important',
  '.v25-selected span{border:0;border-bottom:1px solid var(--v25-ink);border-radius:0',
  '.v25-home .v25-ranks{grid-template-columns:1fr}'
]) if (!v27.includes(needle)) fail(`missing visual fix: ${needle}`);

const rankings = await fs.readFile(path.join(out, 'rankings/index.html'), 'utf8');
const compare = await fs.readFile(path.join(out, 'compare/index.html'), 'utf8');
const home = await fs.readFile(path.join(out, 'index.html'), 'utf8');
for (const [route, html] of [['/', home], ['/rankings/', rankings], ['/compare/', compare]]) {
  if (!html.includes('noindex,nofollow')) fail(`${route} preview noindex missing`);
}
if (!rankings.includes('class="v26-rankings"')) fail('rankings v11.26 surface missing');
if (!compare.includes('class="v25-compare"')) fail('compare v11.25 surface missing');

let checkedBrands = 0;
let costSections = 0;
for (const brand of snapshot.brands) {
  if (!brand?.route || !brand?.slug || !['A','B'].includes(brand.tier)) fail(`invalid trusted brand record: ${brand?.name || 'unknown'}`);
  const brandFile = path.join(out, ...String(brand.route).split('/').filter(Boolean), 'index.html');
  const html = await fs.readFile(brandFile, 'utf8');
  checkedBrands += 1;
  if (!html.includes('noindex,nofollow')) fail(`preview noindex missing: ${brand.slug}`);
  if (html.includes('>본사현재</a>')) fail(`stale TOC label: ${brand.slug}`);
  const sectionStart = html.indexOf('<section class="block" id="cost">');
  if (sectionStart !== -1) {
    const sectionEnd = html.indexOf('</section>', sectionStart);
    const section = html.slice(sectionStart, sectionEnd + 10);
    costSections += 1;
    if (section.includes('<svg class="chart-svg"')) fail(`duplicate detail cost chart remains: ${brand.slug}`);
    if (section.includes('차트 수치 표로 보기')) fail(`stale cost-table label: ${brand.slug}`);
  }
}
if (checkedBrands !== 136) fail(`checked brand count mismatch: ${checkedBrands}`);
if (costSections < 120) fail(`unexpectedly few cost sections: ${costSections}`);

console.log(JSON.stringify({
  v11_27VisualQaValidation: 'PASS',
  productionCandidates: report.productionCandidateCount,
  checkedBrands,
  costSections,
  cssFixes: report.fixes.length,
  previewNoindex: true,
  productionDeployed: false
}, null, 2));
