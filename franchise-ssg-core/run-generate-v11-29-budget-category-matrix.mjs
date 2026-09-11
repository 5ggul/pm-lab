import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const SITE=(process.env.SSG_SITE_URL??'https://5ggul.github.io/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const thresholds=[5000,7000,10000,15000,20000];
const thresholdLabel=new Map([[5000,'5천만원 이하'],[7000,'7천만원 이하'],[10000,'1억원 이하'],[15000,'1억5천만원 이하'],[20000,'2억원 이하']]);
const START_JS='/* v11.29 budget-category matrix */';
const END_JS='/* v11.29 budget-category matrix end */';
const START_CSS='/* v11.29 budget-category matrix */';
const END_CSS='/* v11.29 budget-category matrix end */';

const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
if(snap.uiVersion!=='11.26'||snap.brand_count!==136||snap.category_count!==20)throw new Error(`v11.29 snapshot gate ${snap.uiVersion}/${snap.brand_count}/${snap.category_count}`);
if(candidates.length!==184||!candidates.includes('/explore/'))throw new Error(`v11.29 candidate gate ${candidates.length}/${candidates.includes('/explore/')}`);

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`}
function esc(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function safeJson(v){return JSON.stringify(v).replace(/</g,'\\u003c')}
function sectionRange(html,id){const at=html.indexOf(`id="${id}"`);if(at<0)return null;const start=html.lastIndexOf('<section',at),endAt=html.indexOf('</section>',at);if(start<0||endAt<0)return null;return {start,end:endAt+10,text:html.slice(start,endAt+10)}}
function patchJsonScript(html,attr,fn){const re=new RegExp(`<script type="application/ld\\+json" ${attr}>([\\s\\S]*?)<\\/script>`);const m=html.match(re);if(!m)throw new Error(`JSON-LD script missing: ${attr}`);const data=JSON.parse(m[1]);const next=fn(data)||data;return html.replace(re,`<script type="application/ld+json" ${attr}>${safeJson(next)}</script>`)}

const categoryRows=Object.values(snap.categories||{}).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko'));
if(categoryRows.length!==20)throw new Error(`v11.29 category rows ${categoryRows.length}`);
const brandsByCategory=new Map(categoryRows.map(c=>[c.slug,[]]));
for(const b of snap.brands){if(brandsByCategory.has(b.categorySlug))brandsByCategory.get(b.categorySlug).push(b)}

const matrix=categoryRows.map(c=>{
  const brands=brandsByCategory.get(c.slug)||[];
  const counts=thresholds.map(limit=>brands.filter(b=>Number.isFinite(Number(b.cost))&&Number(b.cost)<=limit).length);
  if(brands.length!==Number(c.count))throw new Error(`v11.29 category count mismatch ${c.slug}: ${brands.length}/${c.count}`);
  return {slug:c.slug,name:c.name,total:brands.length,counts};
});
const totals=thresholds.map((limit,i)=>matrix.reduce((sum,row)=>sum+row.counts[i],0));
const expectedTotals=thresholds.map(limit=>snap.brands.filter(b=>Number.isFinite(Number(b.cost))&&Number(b.cost)<=limit).length);
if(totals.some((v,i)=>v!==expectedTotals[i]))throw new Error(`v11.29 threshold totals mismatch ${totals.join(',')}/${expectedTotals.join(',')}`);
if(matrix.reduce((sum,row)=>sum+row.total,0)!==136)throw new Error('v11.29 matrix total brands must be 136');

let interactiveCells=0;
const bodyRows=matrix.map(row=>{
  const cells=row.counts.map((count,i)=>{
    const limit=thresholds[i],label=thresholdLabel.get(limit);
    if(count>0){interactiveCells+=1;return `<td class="num" data-v29-count="${count}"><button type="button" class="v29-matrix-filter" data-v29-budget="${limit}" data-v29-cat="${esc(row.slug)}" aria-label="${esc(row.name)} ${esc(label)} ${count}개 보기">${count}</button></td>`}
    return `<td class="num" data-v29-count="0"><span>0</span></td>`;
  }).join('');
  return `<tr data-v29-cat-row data-v29-cat="${esc(row.slug)}" data-v29-total="${row.total}" data-v29-counts="${row.counts.join(',')}"><td>${esc(row.name)}</td><td class="num">${row.total}</td>${cells}</tr>`;
}).join('');
const foot=`<tr data-v29-total-row><th>전체</th><th class="num">136</th>${totals.map(v=>`<th class="num">${v}</th>`).join('')}</tr>`;
const section=`<section class="block v29-budget-matrix" id="budget-by-category" data-v29-budget-matrix="1"><div class="section-head"><h2>예산×업종</h2><span class="basis-chip">20×5</span></div><details class="v28-basis"><summary>기준</summary><p>각 셀은 해당 업종에서 공정위 공개 창업비용이 기준 이하인 Tier A/B 브랜드 수입니다. 실제 점포 총투자금 한도가 아닙니다.</p></details><div class="table-scroll"><table class="data-table" aria-label="업종별 예산 구간 브랜드 수"><thead><tr><th>업종</th><th class="num">전체</th>${thresholds.map(x=>`<th class="num">${esc(thresholdLabel.get(x).replace(' 이하',''))}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody><tfoot>${foot}</tfoot></table></div><p class="v29-matrix-note">숫자를 누르면 아래 필터에 예산과 업종을 함께 적용합니다.</p></section>`;

const explorePath=path.join(out,'explore/index.html');
let html=await fs.readFile(explorePath,'utf8');
const legacy=sectionRange(html,'category-under-100m');
const existing=sectionRange(html,'budget-by-category');
if(existing)html=html.slice(0,existing.start)+section+html.slice(existing.end);
else if(legacy)html=html.slice(0,legacy.start)+section+html.slice(legacy.end);
else throw new Error('v11.29 explore replacement target missing');
html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>프랜차이즈 창업비용 예산별 찾기 | 업종별 5천·7천·1억 비교</title>');
html=html.replace(/<meta name="description" content="[^"]*">/,'<meta name="description" content="신뢰 게이트를 통과한 136개 브랜드를 20개 업종×5개 예산 기준으로 교차 비교합니다. 5천만원·7천만원·1억원·1억5천만원·2억원 이하 후보 수를 확인하고 바로 필터링할 수 있습니다.">');
html=html.replace('data-v11-budget-explorer="1"','data-v11-budget-explorer="1" data-v29-budget-category="1"');
html=patchJsonScript(html,'data-v11-budget-dataset',d=>{
  d.name='프랜차이즈 창업비용 예산·업종 교차 데이터';
  d.description='Tier A/B 신뢰 게이트를 통과한 136개 브랜드를 20개 업종과 5개 공개 창업비용 기준으로 교차 집계한 데이터입니다.';
  d.url=`${SITE}/explore/`;
  d.variableMeasured=[
    ...thresholds.map((limit,i)=>({'@type':'PropertyValue',name:`공개 창업비용 ${limit}만원 이하 브랜드 수`,value:totals[i],unitText:'개 브랜드'})),
    {'@type':'PropertyValue',name:'업종 수',value:20,unitText:'개 업종'},
    {'@type':'PropertyValue',name:'예산×업종 교차 셀',value:100,unitText:'개 셀'}
  ];
  return d;
});
await fs.writeFile(explorePath,html,'utf8');

const appPath=path.join(out,'assets/app.js');
let app=await fs.readFile(appPath,'utf8');
app=app.replace(new RegExp(`${escapeRegExp(START_JS)}[\\s\\S]*?${escapeRegExp(END_JS)}\\n?`,'g'),'').trimEnd();
app+=`\n${START_JS}\n(()=>{document.addEventListener('click',e=>{const btn=e.target.closest('[data-v29-budget][data-v29-cat]');if(!btn)return;const form=document.querySelector('[data-budget-form]');if(!form)return;form.elements.budget.value=btn.dataset.v29Budget||'';form.elements.cat.value=btn.dataset.v29Cat||'';if(form.elements.stores)form.elements.stores.value='';if(form.elements.sales)form.elements.sales.value='';if(form.elements.sort)form.elements.sort.value='cost';form.elements.budget.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#finder')?.scrollIntoView({behavior:'smooth',block:'start'});});})();\n${END_JS}\n`;
await fs.writeFile(appPath,app,'utf8');

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
css=css.replace(new RegExp(`${escapeRegExp(START_CSS)}[\\s\\S]*?${escapeRegExp(END_CSS)}\\n?`,'g'),'').trimEnd();
css+=`\n\n${START_CSS}\n.v29-budget-matrix table{min-width:760px}.v29-budget-matrix th,.v29-budget-matrix td{white-space:nowrap}.v29-budget-matrix th:first-child,.v29-budget-matrix td:first-child{position:sticky;left:0;z-index:1;background:var(--surface,#fff)}.v29-matrix-filter{appearance:none;border:0;background:transparent;padding:2px 0;font:inherit;font-weight:750;text-decoration:underline;text-underline-offset:3px;cursor:pointer}.v29-matrix-filter:focus-visible{outline:2px solid currentColor;outline-offset:3px}.v29-budget-matrix tfoot th{border-top:2px solid currentColor}.v29-matrix-note{margin:10px 0 0;font-size:12px;color:var(--muted,#667085)}\n${END_CSS}\n`;
await fs.writeFile(cssPath,css,'utf8');

const report={
  schemaVersion:1,
  uiVersion:'11.29',
  generatedAt:new Date().toISOString(),
  snapshot:snap.snapshot_id,
  productionCandidateCount:candidates.length,
  trustedBrands:snap.brand_count,
  categoryCount:matrix.length,
  thresholds,
  thresholdTotals:totals,
  matrixCells:matrix.length*thresholds.length,
  interactiveCells,
  zeroCells:matrix.length*thresholds.length-interactiveCells,
  replacedLegacyOneBudgetSection:!existing&&Boolean(legacy),
  previewNoindex:/<meta name="robots" content="noindex,nofollow/.test(html),
  policy:'PREVIEW_ONLY;ONE_EXISTING_ROUTE;TRUSTED_SNAPSHOT_COUNTS_ONLY;NO_QUERY_LINK_FANOUT;NO_CANDIDATE_CHANGE;NO_INDEX_CHANGE;NO_PRODUCTION_DEPLOY'
};
await fs.writeFile(path.join(out,'v11-29-budget-category-matrix.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_29BudgetCategoryMatrix:'PASS',...report},null,2));

function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
