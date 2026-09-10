import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../docs/franchise-ssg-preview');
const fail = message => { throw new Error(message); };
const snapshot = JSON.parse(await fs.readFile(path.join(out, 'data-snapshot-v11-26.json'), 'utf8'));
const report = JSON.parse(await fs.readFile(path.join(out, 'v11-28-screen-diet.json'), 'utf8'));

if (report.uiVersion !== '11.28' || report.schemaVersion !== 3) fail('v11.28 report missing or stale');
if (report.productionCandidateCount !== 184) fail(`candidate count changed: ${report.productionCandidateCount}`);
if (report.brandPages !== 136 || snapshot.brands.length !== 136) fail(`trusted brand count changed: ${report.brandPages}`);
if (!report.policy.includes('NO_INDEX_CHANGE') || !report.policy.includes('NO_PRODUCTION_DEPLOY')) fail('release guard missing');
if (!report.policy.includes('EXISTING_UNIQUE_DATA_TEXT_RETAINED_IN_DETAILS')) fail('category unique-text retention policy missing');
if (report.dataSentencesCollapsed !== 136) fail(`data sentence collapse incomplete: ${report.dataSentencesCollapsed}`);
if (report.duplicatePositionSummariesRemoved !== 136) fail(`position summary cleanup incomplete: ${report.duplicatePositionSummariesRemoved}`);
if (report.brandMetaLabelsShortened !== 408) fail(`brand meta labels incomplete: ${report.brandMetaLabelsShortened}`);
if (report.brandCoreSectionsFound !== 680 || report.brandCoreSectionsCollapsed !== report.brandCoreSectionsFound) fail(`brand core section cleanup mismatch: ${report.brandCoreSectionsCollapsed}/${report.brandCoreSectionsFound}`);
if (report.operatorSectionsFound !== report.operatorSectionsCollapsed) fail(`operator section cleanup mismatch: ${report.operatorSectionsCollapsed}/${report.operatorSectionsFound}`);
if (report.operatorHeadingsShortened !== report.operatorSectionsFound) fail(`operator heading cleanup mismatch: ${report.operatorHeadingsShortened}/${report.operatorSectionsFound}`);
if (report.categoryPages !== 20) fail(`category page count changed: ${report.categoryPages}`);
if (report.categoryDistributionSectionsFound !== report.categoryDistributionNotesCollapsed) fail(`category distribution cleanup mismatch: ${report.categoryDistributionNotesCollapsed}/${report.categoryDistributionSectionsFound}`);
if (report.categoryRangeSectionsFound !== report.categoryRangeNotesCollapsed) fail(`category range cleanup mismatch: ${report.categoryRangeNotesCollapsed}/${report.categoryRangeSectionsFound}`);
if (report.categorySummariesCollapsed !== report.categoryRangeSectionsFound) fail(`category range data-summary mismatch: ${report.categorySummariesCollapsed}/${report.categoryRangeSectionsFound}`);
if (report.categoryWarningsRemoved !== report.categoryPages) fail(`category warning cleanup mismatch: ${report.categoryWarningsRemoved}/${report.categoryPages}`);
if (report.toolMethodSectionsFound !== report.toolMethodsCollapsed || report.toolMethodSectionsFound < 1) fail(`tool methodology cleanup mismatch: ${report.toolMethodsCollapsed}/${report.toolMethodSectionsFound}`);

const css = await fs.readFile(path.join(out, 'assets/site.css'), 'utf8');
const start = css.indexOf('/* v11.28 screen diet */');
const end = css.indexOf('/* v11.28 screen diet end */');
if (start < 0 || end < start) fail('v11.28 CSS block missing');
if (css.indexOf('/* v11.28 screen diet */', start + 1) !== -1) fail('duplicate v11.28 CSS block');
const v28css = css.slice(start, end);
for (const needle of [
  'details.v28-basis{',
  '.v28-range-data{margin-top:10px!important}',
  '.v25-method.v28-method{',
  '.v25-brand .source-box{',
  '.v25-brand .check-grid{display:block',
  '.v25-brand .peer-links{grid-template-columns:1fr}'
]) if (!v28css.includes(needle)) fail(`missing CSS diet rule: ${needle}`);

let checkedBrands = 0;
let checkedCoreSections = 0;
let checkedOperatorSections = 0;
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
    checkedCoreSections += 1;
  }
  const operatorAt = html.indexOf('id="official-current-cost"');
  if (operatorAt >= 0) {
    const startAt = html.lastIndexOf('<section', operatorAt);
    const endAt = html.indexOf('</section>', operatorAt);
    const section = html.slice(startAt, endAt + 10);
    if (!section.includes('<h2>본사 개설비</h2>')) fail(`operator heading not compact: ${brand.route}`);
    if (!section.includes('<details class="v28-basis"><summary>기준</summary>')) fail(`operator lead remains visible: ${brand.route}`);
    checkedOperatorSections += 1;
  }
}
if (checkedBrands !== 136 || checkedCoreSections !== 680) fail(`brand validation mismatch: ${checkedBrands}/${checkedCoreSections}`);
if (checkedOperatorSections !== report.operatorSectionsFound) fail(`operator validation mismatch: ${checkedOperatorSections}/${report.operatorSectionsFound}`);

let checkedCategoryDistribution = 0;
let checkedCategoryRange = 0;
let checkedCategoryData = 0;
for (const slug of Object.keys(snapshot.categories)) {
  const file = path.join(out, 'categories', slug, 'index.html');
  const html = await fs.readFile(file, 'utf8');
  if (!html.includes('noindex,nofollow')) fail(`category preview noindex missing: ${slug}`);
  if (html.includes('<h2>창업비용 분포</h2>')) fail(`stale category heading: ${slug}`);
  if (html.includes('업종의 비용·규모 범위는 어느 정도인가요?')) fail(`question-style screen heading remains: ${slug}`);
  if (html.includes('<p class="range-summary">')) fail(`bare category range summary remains: ${slug}`);
  if (html.includes('중앙값은 추천 점수가 아닙니다')) fail(`duplicate category warning remains: ${slug}`);

  for (const [id, compactHeading] of [['distribution', '<h2>비용분포</h2>'], ['range', '<h2>업종범위</h2>']]) {
    const idAt = html.indexOf(`id="${id}"`);
    if (idAt < 0) continue;
    const startAt = html.lastIndexOf('<section', idAt);
    const endAt = html.indexOf('</section>', idAt);
    const section = html.slice(startAt, endAt + 10);
    if (!section.includes(compactHeading)) fail(`compact category heading missing in ${id}: ${slug}`);
    if (!section.includes('<details class="v28-basis"><summary>기준</summary>')) fail(`category explanatory lead remains in ${id}: ${slug}`);
    if (id === 'distribution') {
      checkedCategoryDistribution += 1;
    } else {
      checkedCategoryRange += 1;
      if (!section.includes('<details class="v28-basis v28-range-data"><summary>데이터</summary><p class="v28-range-summary">')) fail(`collapsed category data summary missing: ${slug}`);
      checkedCategoryData += 1;
    }
  }
}
if (checkedCategoryDistribution !== report.categoryDistributionSectionsFound) fail(`distribution validation mismatch: ${checkedCategoryDistribution}/${report.categoryDistributionSectionsFound}`);
if (checkedCategoryRange !== report.categoryRangeSectionsFound) fail(`range validation mismatch: ${checkedCategoryRange}/${report.categoryRangeSectionsFound}`);
if (checkedCategoryData !== report.categorySummariesCollapsed) fail(`category data validation mismatch: ${checkedCategoryData}/${report.categorySummariesCollapsed}`);

const tools = await fs.readFile(path.join(out, 'tools/index.html'), 'utf8');
if (!tools.includes('class="v25-method v28-method"') || !tools.includes('<summary>기준</summary>')) fail('tools methodology not collapsed');
if (!tools.includes('noindex,nofollow')) fail('tools preview noindex missing');

console.log(JSON.stringify({
  v11_28ScreenDietValidation: 'PASS',
  productionCandidates: report.productionCandidateCount,
  checkedBrands,
  checkedCoreSections,
  checkedOperatorSections,
  categoryDistributionSections: checkedCategoryDistribution,
  categoryRangeSections: checkedCategoryRange,
  categoryDataSummaries: checkedCategoryData,
  toolMethodsCollapsed: report.toolMethodsCollapsed,
  previewNoindex: true,
  productionDeployed: false
}, null, 2));