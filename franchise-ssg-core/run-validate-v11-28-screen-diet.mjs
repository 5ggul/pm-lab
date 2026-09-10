import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../docs/franchise-ssg-preview');
const fail = message => { throw new Error(message); };
const snapshot = JSON.parse(await fs.readFile(path.join(out, 'data-snapshot-v11-26.json'), 'utf8'));
const report = JSON.parse(await fs.readFile(path.join(out, 'v11-28-screen-diet.json'), 'utf8'));

if (report.uiVersion !== '11.28') fail('v11.28 report missing');
if (report.productionCandidateCount !== 184) fail(`candidate count changed: ${report.productionCandidateCount}`);
if (report.brandPages !== 136 || snapshot.brands.length !== 136) fail(`trusted brand count changed: ${report.brandPages}`);
if (!report.policy.includes('NO_INDEX_CHANGE') || !report.policy.includes('NO_PRODUCTION_DEPLOY')) fail('release guard missing');
if (report.dataSentencesCollapsed !== 136) fail(`data sentence collapse incomplete: ${report.dataSentencesCollapsed}`);
if (report.duplicatePositionSummariesRemoved !== 136) fail(`position summary cleanup incomplete: ${report.duplicatePositionSummariesRemoved}`);
if (report.brandMetaLabelsShortened !== 408) fail(`brand meta labels incomplete: ${report.brandMetaLabelsShortened}`);
if (report.brandHeadingsShortened < 5) fail(`operator headings unexpectedly low: ${report.brandHeadingsShortened}`);
if (report.brandSectionsCollapsed < 680) fail(`brand note collapse unexpectedly low: ${report.brandSectionsCollapsed}`);
if (report.categoryPages !== 20) fail(`category page count changed: ${report.categoryPages}`);
if (report.categoryNotesCollapsed < 40) fail(`category note collapse incomplete: ${report.categoryNotesCollapsed}`);
if (report.categoryWarningsRemoved < 16) fail(`category warning cleanup unexpectedly low: ${report.categoryWarningsRemoved}`);
if (report.categorySummariesRemoved < 16) fail(`category summary cleanup unexpectedly low: ${report.categorySummariesRemoved}`);
if (report.toolMethodsCollapsed < 1) fail('tool methodology was not collapsed');

const css = await fs.readFile(path.join(out, 'assets/site.css'), 'utf8');
const start = css.indexOf('/* v11.28 screen diet */');
const end = css.indexOf('/* v11.28 screen diet end */');
if (start < 0 || end < start) fail('v11.28 CSS block missing');
if (css.indexOf('/* v11.28 screen diet */', start + 1) !== -1) fail('duplicate v11.28 CSS block');
const v28css = css.slice(start, end);
for (const needle of [
  'details.v28-basis{',
  '.v25-method.v28-method{',
  '.v25-brand .source-box{',
  '.v25-brand .check-grid{display:block',
  '.v25-brand .peer-links{grid-template-columns:1fr}'
]) if (!v28css.includes(needle)) fail(`missing CSS diet rule: ${needle}`);

let checkedBrands = 0;
let collapsedSections = 0;
for (const brand of snapshot.brands) {
  const file = path.join(out, ...String(brand.route).split('/').filter(Boolean), 'index.html');
  const html = await fs.readFile(file, 'utf8');
  checkedBrands += 1;
  if (!html.includes('noindex,nofollow')) fail(`preview noindex missing: ${brand.route}`);
  for (const stale of [
    '<b>공정위 공개 기준년도</b>', '<b>이전 비교 기준</b>', '<b>데이터 갱신</b>',
    '<h2>본사현재</h2>', 'class="position-summary"', '>비용 항목 표 보기</summary>'
  ]) if (html.includes(stale)) fail(`stale visible copy on ${brand.route}: ${stale}`);
  for (const fresh of [
    '<b>공정위 기준</b>', '<b>이전 기준</b>', '<b>갱신</b>',
    'class="v28-basis v28-data-note"', '>비용항목</summary>'
  ]) if (!html.includes(fresh)) fail(`missing compact copy on ${brand.route}: ${fresh}`);
  for (const id of ['cost', 'stores', 'benchmark', 'position', 'check']) {
    const idAt = html.indexOf(`id="${id}"`);
    if (idAt < 0) fail(`missing section ${id}: ${brand.route}`);
    const startAt = html.lastIndexOf('<section', idAt);
    const endAt = html.indexOf('</section>', idAt);
    const section = html.slice(startAt, endAt + 10);
    if (!section.includes('<details class="v28-basis"><summary>기준</summary>')) fail(`visible explanatory lead remains in ${id}: ${brand.route}`);
    collapsedSections += 1;
  }
}
if (checkedBrands !== 136 || collapsedSections !== 680) fail(`brand validation mismatch: ${checkedBrands}/${collapsedSections}`);

for (const slug of Object.keys(snapshot.categories)) {
  const file = path.join(out, 'categories', slug, 'index.html');
  const html = await fs.readFile(file, 'utf8');
  if (!html.includes('noindex,nofollow')) fail(`category preview noindex missing: ${slug}`);
  if (html.includes('<h2>창업비용 분포</h2>')) fail(`stale category heading: ${slug}`);
  if (!html.includes('<h2>비용분포</h2>')) fail(`compact category heading missing: ${slug}`);
  if (html.includes('업종의 비용·규모 범위는 어느 정도인가요?')) fail(`question-style screen heading remains: ${slug}`);
  if (html.includes('class="range-summary"')) fail(`duplicate category range summary remains: ${slug}`);
  if (html.includes('중앙값은 추천 점수가 아닙니다')) fail(`duplicate category warning remains: ${slug}`);
  for (const id of ['distribution', 'range']) {
    const idAt = html.indexOf(`id="${id}"`);
    if (idAt < 0) fail(`missing category section ${id}: ${slug}`);
    const startAt = html.lastIndexOf('<section', idAt);
    const endAt = html.indexOf('</section>', idAt);
    const section = html.slice(startAt, endAt + 10);
    if (!section.includes('<details class="v28-basis"><summary>기준</summary>')) fail(`category explanatory lead remains in ${id}: ${slug}`);
  }
}

const tools = await fs.readFile(path.join(out, 'tools/index.html'), 'utf8');
if (!tools.includes('class="v25-method v28-method"') || !tools.includes('<summary>기준</summary>')) fail('tools methodology not collapsed');
if (!tools.includes('noindex,nofollow')) fail('tools preview noindex missing');

console.log(JSON.stringify({
  v11_28ScreenDietValidation: 'PASS',
  productionCandidates: report.productionCandidateCount,
  checkedBrands,
  collapsedBrandSections: collapsedSections,
  categoryPages: report.categoryPages,
  toolMethodsCollapsed: report.toolMethodsCollapsed,
  previewNoindex: true,
  productionDeployed: false
}, null, 2));