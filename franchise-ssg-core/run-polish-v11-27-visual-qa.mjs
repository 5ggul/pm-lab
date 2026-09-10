import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../docs/franchise-ssg-preview');
const cssPath = path.join(out, 'assets/site.css');
const coreReportPath = path.join(out, 'v11-26-core-surfaces.json');
const snapshotPath = path.join(out, 'data-snapshot-v11-26.json');

const START = '/* v11.27 visual QA */';
const END = '/* v11.27 visual QA end */';

const cssBlock = `${START}
.v26-area-picker,.v25-compare .v25-pickers{top:68px;z-index:22}
.basis-chip{border:0;border-radius:0;background:transparent;padding:0;color:var(--muted,#6b645c);font-variant-numeric:tabular-nums}
.v25-selected{gap:14px}.v25-selected span{border:0;border-bottom:1px solid var(--v25-ink);border-radius:0;padding:4px 0;background:transparent}
@media(max-width:720px){
  .category-scatter{min-width:0!important;width:100%!important;max-width:100%}.distribution-block{overflow:visible!important}.category-scatter text{font-size:20px}.category-scatter circle{r:7px}
  .v26-category-area .v26-area-row:nth-child(n+9){display:grid!important}
  .v26-rankings .v26-area-row{grid-template-columns:minmax(105px,1fr) minmax(80px,1.25fr) auto}.v26-rankings .v26-area-row>small{display:block;grid-column:1/-1;min-width:0;padding:0 0 7px 28px;font-size:10px}
  .v26-rankings .stack-mobile,.v25-brand .stack-mobile{display:table!important;width:100%;min-width:720px;border-collapse:separate;border-spacing:0;background:var(--paper)}
  .v25-brand .stack-mobile{min-width:520px}.v26-rankings .stack-mobile thead,.v25-brand .stack-mobile thead{display:table-header-group!important}.v26-rankings .stack-mobile tbody,.v25-brand .stack-mobile tbody{display:table-row-group!important}
  .v26-rankings .stack-mobile tr,.v25-brand .stack-mobile tr{display:table-row!important;margin:0;padding:0;border:0;background:transparent}.v26-rankings .stack-mobile th,.v26-rankings .stack-mobile td,.v25-brand .stack-mobile th,.v25-brand .stack-mobile td{display:table-cell!important;width:auto;padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}.v26-rankings .stack-mobile td::before,.v25-brand .stack-mobile td::before{content:none!important}
  .v25-brand .chart-data{overflow-x:auto;-webkit-overflow-scrolling:touch}
}
@media(max-width:560px){.v25-home .v25-ranks{grid-template-columns:1fr}.v25-home .v25-ranks>div+div{padding-top:14px;border-top:1px solid var(--v25-line)}.category-scatter text{font-size:24px}}
${END}`;

let css = await fs.readFile(cssPath, 'utf8');
const oldBlock = new RegExp(`${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, 'g');
css = css.replace(oldBlock, '').trimEnd() + `\n\n${cssBlock}\n`;
await fs.writeFile(cssPath, css, 'utf8');

const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
if (!Array.isArray(snapshot.brands) || snapshot.brands.length !== 136) {
  throw new Error(`trusted v11.26 brand snapshot invalid: ${Array.isArray(snapshot.brands) ? snapshot.brands.length : 'missing'}`);
}

let candidateBrands = 0;
let patchedBrands = 0;
let duplicateCostChartsRemoved = 0;
let tocLabelsFixed = 0;

for (const brand of snapshot.brands) {
  if (!brand?.route || !brand?.slug || !['A','B'].includes(brand.tier)) {
    throw new Error(`invalid trusted brand record: ${brand?.name || brand?.slug || 'unknown'}`);
  }
  const file = path.join(out, ...String(brand.route).split('/').filter(Boolean), 'index.html');
  const before = await fs.readFile(file, 'utf8');
  let html = before;
  candidateBrands += 1;

  if (html.includes('>본사현재</a>')) {
    html = html.replace('>본사현재</a>', '>본사 개설비</a>');
    tocLabelsFixed += 1;
  }

  const start = html.indexOf('<section class="block" id="cost">');
  if (start !== -1) {
    const end = html.indexOf('</section>', start);
    if (end !== -1) {
      const head = html.slice(0, start);
      let section = html.slice(start, end + 10);
      const tail = html.slice(end + 10);
      const withChart = section;
      section = section.replace(/<svg class="chart-svg"[\s\S]*?<\/svg>/, '');
      if (section !== withChart) duplicateCostChartsRemoved += 1;
      section = section.replace('>차트 수치 표로 보기</summary>', '>비용 항목 표 보기</summary>');
      html = head + section + tail;
    }
  }

  if (html !== before) {
    await fs.writeFile(file, html, 'utf8');
    patchedBrands += 1;
  }
}

const core = JSON.parse(await fs.readFile(coreReportPath, 'utf8'));
const report = {
  schemaVersion: 2,
  uiVersion: '11.27',
  generatedAt: new Date().toISOString(),
  snapshot: snapshot.snapshot_id,
  productionCandidateCount: core.productionCandidateCount,
  candidateBrands,
  patchedBrands,
  duplicateCostChartsRemoved,
  tocLabelsFixed,
  fixes: [
    'STICKY_CONTROLS_CLEAR_68PX_HEADER',
    'CATEGORY_SCATTER_RESPONSIVE_NOT_CLIPPED',
    'MOBILE_CATEGORY_PER_AREA_SHOWS_ALL_ROWS',
    'MOBILE_RANKING_TABLE_STAYS_TABLE_NOT_CARD_STACK',
    'BRAND_DATA_TABLES_STAY_FLAT_ON_MOBILE',
    'COMPARE_SELECTED_BRANDS_NOT_PILL_CHIPS',
    'HOME_MOBILE_RANK_COLUMNS_STACK_BELOW_560',
    'BRAND_DUPLICATE_COST_CHART_REMOVED'
  ],
  policy: 'PREVIEW_ONLY;NO_NEW_ROUTE;NO_CANDIDATE_SET_CHANGE;NO_INDEX_CHANGE;NO_PRODUCTION_DEPLOY'
};
await fs.writeFile(path.join(out, 'v11-27-visual-qa.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify({v11_27VisualQa:'PASS', ...report, fixes: report.fixes.length}, null, 2));
