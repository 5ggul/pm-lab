import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../docs/franchise-ssg-preview');
const cssPath = path.join(out, 'assets/site.css');
const snapshotPath = path.join(out, 'data-snapshot-v11-26.json');
const coreReportPath = path.join(out, 'v11-26-core-surfaces.json');
const START = '/* v11.28 screen diet */';
const END = '/* v11.28 screen diet end */';

const cssBlock = `${START}
details.v28-basis{margin:8px 0 18px;border:0;border-bottom:1px solid var(--line,#d7d6cf);background:transparent}details.v28-basis>summary{min-height:40px;display:flex;align-items:center;cursor:pointer;color:var(--muted,#6d6b65);font-size:12px;font-weight:700;list-style-position:inside}details.v28-basis>p{max-width:860px;margin:0;padding:0 0 12px;color:var(--muted,#6d6b65);font-size:13px;line-height:1.7}.v28-data-note{margin-top:0!important}.v28-range-data{margin-top:10px!important}.v25-method.v28-method{padding:0;border-bottom:1px solid var(--v25-line,#d7d6cf)}.v25-method.v28-method>summary{min-height:48px;display:flex;align-items:center;cursor:pointer;font-size:13px;font-weight:800}.v25-method.v28-method>div{padding:0 0 18px;max-width:920px}.v25-brand .source-box{margin:30px 0;padding:14px 0;border-left:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:transparent}.v25-brand .check-grid{display:block;border-top:1px solid #bdb5ab}.v25-brand .check-item,.v25-brand .check-item:nth-child(even){display:grid;grid-template-columns:minmax(150px,220px) minmax(0,1fr);gap:18px;padding:12px 0;border-left:0;border-bottom:1px solid var(--line)}.v25-brand .check-item strong{margin:0}.v25-brand .peer-links{grid-template-columns:1fr}.v25-brand .peer-links a,.v25-brand .peer-links a:last-child{display:grid;grid-template-columns:minmax(160px,240px) minmax(0,1fr);gap:18px;padding:12px 0;border-right:0}.v25-category .callout{border-radius:0;box-shadow:none}
@media(max-width:700px){.v25-brand .check-item,.v25-brand .check-item:nth-child(even),.v25-brand .peer-links a,.v25-brand .peer-links a:last-child{grid-template-columns:1fr;gap:4px}.v25-brand .check-item span,.v25-brand .peer-links span{font-size:12px}details.v28-basis>summary{min-height:44px}}
${END}`;

const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
const core = JSON.parse(await fs.readFile(coreReportPath, 'utf8'));
if (!Array.isArray(snapshot.brands) || snapshot.brands.length !== 136) throw new Error('trusted brand snapshot must contain 136 brands');
if (!snapshot.categories || Object.keys(snapshot.categories).length !== 20) throw new Error('category snapshot must contain 20 categories');
if (core.productionCandidateCount !== 184) throw new Error(`production candidate count changed before v11.28: ${core.productionCandidateCount}`);

let css = await fs.readFile(cssPath, 'utf8');
const oldCss = new RegExp(`${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}\\n?`, 'g');
css = css.replace(oldCss, '').trimEnd() + `\n\n${cssBlock}\n`;
await fs.writeFile(cssPath, css, 'utf8');

function sectionRange(html, id) {
  const idAt = html.indexOf(`id="${id}"`);
  if (idAt < 0) return null;
  const start = html.lastIndexOf('<section', idAt);
  const endAt = html.indexOf('</section>', idAt);
  if (start < 0 || endAt < 0) return null;
  return {start, end: endAt + 10, text: html.slice(start, endAt + 10)};
}

function replaceSection(html, id, transform) {
  const range = sectionRange(html, id);
  if (!range) return {html, found: false, changed: false};
  const next = transform(range.text);
  if (next === range.text) return {html, found: true, changed: false};
  return {html: html.slice(0, range.start) + next + html.slice(range.end), found: true, changed: true};
}

function collapseLeadParagraph(section) {
  const pStart = section.indexOf('<p>');
  if (pStart < 0) return section;
  const existing = section.indexOf('<details class="v28-basis"');
  if (existing >= 0 && existing < pStart) return section;
  const pEnd = section.indexOf('</p>', pStart);
  if (pEnd < 0) return section;
  const p = section.slice(pStart, pEnd + 4);
  return section.slice(0, pStart) + `<details class="v28-basis"><summary>기준</summary>${p}</details>` + section.slice(pEnd + 4);
}

function collapseMethod(html) {
  if (html.includes('class="v25-method v28-method"')) return {html, found: true, changed: false};
  const re = /<section class="v25-method"([^>]*)><h2>기준<\/h2>([\s\S]*?)<\/section>/;
  if (!re.test(html)) return {html, found: false, changed: false};
  return {html: html.replace(re, '<details class="v25-method v28-method"$1><summary>기준</summary><div>$2</div></details>'), found: true, changed: true};
}

let brandPages = 0;
let brandCoreSectionsFound = 0;
let brandCoreSectionsCollapsed = 0;
let operatorSectionsFound = 0;
let operatorSectionsCollapsed = 0;
let dataSentencesCollapsed = 0;
let duplicatePositionSummariesRemoved = 0;
let brandMetaLabelsShortened = 0;
let operatorHeadingsShortened = 0;

for (const brand of snapshot.brands) {
  const file = path.join(out, ...String(brand.route).split('/').filter(Boolean), 'index.html');
  let html = await fs.readFile(file, 'utf8');
  brandPages += 1;
  for (const [from, to] of [
    ['<b>공정위 공개 기준년도</b>', '<b>공정위 기준</b>'],
    ['<b>이전 비교 기준</b>', '<b>이전 기준</b>'],
    ['<b>데이터 갱신</b>', '<b>갱신</b>']
  ]) {
    if (html.includes(from)) { html = html.replace(from, to); brandMetaLabelsShortened += 1; }
  }
  if (html.includes('<h2>본사현재</h2>')) { html = html.replace('<h2>본사현재</h2>', '<h2>본사 개설비</h2>'); operatorHeadingsShortened += 1; }
  if (html.includes('>비용 항목 표 보기</summary>')) html = html.replace('>비용 항목 표 보기</summary>', '>비용항목</summary>');

  if (!html.includes('class="v28-basis v28-data-note"')) {
    const re = /<p class="v25-data-sentence">([\s\S]*?)<\/p>/;
    if (re.test(html)) {
      html = html.replace(re, '<details class="v28-basis v28-data-note"><summary>데이터</summary><p class="v25-data-sentence">$1</p></details>');
      dataSentencesCollapsed += 1;
    }
  }

  for (const id of ['cost', 'stores', 'benchmark', 'position', 'check']) {
    const result = replaceSection(html, id, collapseLeadParagraph);
    html = result.html;
    if (result.found) brandCoreSectionsFound += 1;
    if (result.changed) brandCoreSectionsCollapsed += 1;
  }
  const operatorResult = replaceSection(html, 'official-current-cost', collapseLeadParagraph);
  html = operatorResult.html;
  if (operatorResult.found) operatorSectionsFound += 1;
  if (operatorResult.changed) operatorSectionsCollapsed += 1;

  const beforeSummary = html;
  html = html.replace(/<p class="position-summary">[\s\S]*?<\/p>/g, '');
  if (html !== beforeSummary) duplicatePositionSummariesRemoved += 1;
  await fs.writeFile(file, html, 'utf8');
}

let categoryPages = 0;
let categoryDistributionSectionsFound = 0;
let categoryDistributionNotesCollapsed = 0;
let categoryRangeSectionsFound = 0;
let categoryRangeNotesCollapsed = 0;
let categoryWarningsRemoved = 0;
let categorySummariesCollapsed = 0;
for (const slug of Object.keys(snapshot.categories)) {
  const file = path.join(out, 'categories', slug, 'index.html');
  let html;
  try { html = await fs.readFile(file, 'utf8'); } catch { continue; }
  categoryPages += 1;
  html = html.replace('<h2>창업비용 분포</h2>', '<h2>비용분포</h2>');
  html = html.replace('>전체 수치 표로 보기</summary>', '>전체수치</summary>');

  let result = replaceSection(html, 'distribution', collapseLeadParagraph);
  html = result.html;
  if (result.found) categoryDistributionSectionsFound += 1;
  if (result.changed) categoryDistributionNotesCollapsed += 1;

  result = replaceSection(html, 'range', section => {
    const compact = section.replace(/<h2>[^<]*업종의 비용·규모 범위는 어느 정도인가요\?<\/h2>/, '<h2>업종범위</h2>');
    return collapseLeadParagraph(compact);
  });
  html = result.html;
  if (result.found) categoryRangeSectionsFound += 1;
  if (result.changed) categoryRangeNotesCollapsed += 1;

  const beforeSummary = html;
  html = html.replace(/<p class="range-summary">([\s\S]*?)<\/p>/g, '<details class="v28-basis v28-range-data"><summary>데이터</summary><p class="v28-range-summary">$1</p></details>');
  if (html !== beforeSummary) categorySummariesCollapsed += 1;
  const beforeWarning = html;
  html = html.replace(/<div class="callout warning"><strong>중앙값은 추천 점수가 아닙니다<\/strong><p>[\s\S]*?<\/p><\/div>/g, '');
  if (html !== beforeWarning) categoryWarningsRemoved += 1;
  await fs.writeFile(file, html, 'utf8');
}

const toolRoutes = [
  '/tools/', '/tools/startup-cost/', '/tools/disclosure-decoder/', '/tools/monthly-fixed-cost/',
  '/tools/monthly-profit-simulator/', '/tools/break-even/', '/tools/brand-filter/',
  '/tools/category-median/', '/tools/open-close-rate/'
];
let toolMethodSectionsFound = 0;
let toolMethodsCollapsed = 0;
for (const route of toolRoutes) {
  const file = path.join(out, ...route.split('/').filter(Boolean), 'index.html');
  let html;
  try { html = await fs.readFile(file, 'utf8'); } catch { continue; }
  const result = collapseMethod(html);
  if (result.found) toolMethodSectionsFound += 1;
  if (result.changed) {
    await fs.writeFile(file, result.html, 'utf8');
    toolMethodsCollapsed += 1;
  }
}

const report = {
  schemaVersion: 3,
  uiVersion: '11.28',
  generatedAt: new Date().toISOString(),
  snapshot: snapshot.snapshot_id,
  productionCandidateCount: core.productionCandidateCount,
  brandPages,
  brandCoreSectionsFound,
  brandCoreSectionsCollapsed,
  operatorSectionsFound,
  operatorSectionsCollapsed,
  dataSentencesCollapsed,
  duplicatePositionSummariesRemoved,
  brandMetaLabelsShortened,
  operatorHeadingsShortened,
  categoryPages,
  categoryDistributionSectionsFound,
  categoryDistributionNotesCollapsed,
  categoryRangeSectionsFound,
  categoryRangeNotesCollapsed,
  categoryWarningsRemoved,
  categorySummariesCollapsed,
  toolMethodSectionsFound,
  toolMethodsCollapsed,
  policy: 'PREVIEW_ONLY;VISIBLE_COPY_DIET;EXISTING_UNIQUE_DATA_TEXT_RETAINED_IN_DETAILS;NO_NEW_ROUTE;NO_CANDIDATE_CHANGE;NO_INDEX_CHANGE;NO_PRODUCTION_DEPLOY'
};
await fs.writeFile(path.join(out, 'v11-28-screen-diet.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify({v11_28ScreenDiet: 'PASS', ...report}, null, 2));