import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const START='/* v11.30 category metric table */';
const END='/* v11.30 category metric table end */';

if(snap.uiVersion!=='11.26'||snap.brand_count!==136||snap.category_count!==20)throw new Error(`v11.30 snapshot gate ${snap.uiVersion}/${snap.brand_count}/${snap.category_count}`);
if(candidates.length!==184||!candidates.includes('/rankings/'))throw new Error(`v11.30 candidate gate ${candidates.length}/${candidates.includes('/rankings/')}`);

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`}
function esc(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function safeJson(v){return JSON.stringify(v).replace(/</g,'\\u003c')}
function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function won(v){return finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}만원`:'—'}
function num(v){return finite(v)?Math.round(Number(v)).toLocaleString('ko-KR'):'—'}
function extreme(rows,key,mode,{positiveOnly=false}={}){
  const valid=rows.filter(row=>finite(row?.[key])&&(!positiveOnly||Number(row[key])>0));
  if(!valid.length)return {value:null,brands:[]};
  const values=valid.map(row=>Number(row[key]));
  const target=mode==='min'?Math.min(...values):Math.max(...values);
  const brands=valid.filter(row=>Number(row[key])===target).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko'));
  return {value:target,brands};
}
function links(brands){return brands.map(b=>`<a href="${BASE}${b.route}">${esc(b.name)}</a>`).join('<span aria-hidden="true"> · </span>')}
function metricCell(metric,result,formatter){
  const routes=result.brands.map(b=>normalizeRoute(b.route)).join(',');
  return `<td data-v30-metric="${metric}" data-v30-value="${finite(result.value)?result.value:''}" data-v30-routes="${esc(routes)}"><span class="v30-brand-links">${links(result.brands)||'—'}</span><strong>${formatter(result.value)}</strong></td>`;
}
function patchJsonScript(html,attr,fn){const re=new RegExp(`<script type="application/ld\\+json" ${attr}>([\\s\\S]*?)<\\/script>`);const m=html.match(re);if(!m)throw new Error(`JSON-LD script missing: ${attr}`);const data=JSON.parse(m[1]);const next=fn(data)||data;return html.replace(re,`<script type="application/ld+json" ${attr}>${safeJson(next)}</script>`)}
function sectionRange(html,id){const at=html.indexOf(`id="${id}"`);if(at<0)return null;const start=html.lastIndexOf('<section',at),endAt=html.indexOf('</section>',at);if(start<0||endAt<0)return null;return {start,end:endAt+10,text:html.slice(start,endAt+10)}}
function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}

const categories=Object.values(snap.categories||{}).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko'));
if(categories.length!==20)throw new Error(`v11.30 category rows ${categories.length}`);
const byCategory=new Map(categories.map(c=>[c.slug,[]]));
for(const brand of snap.brands){if(byCategory.has(brand.categorySlug))byCategory.get(brand.categorySlug).push(brand)}

let tiedMetricCells=0;
let missingMetricCells=0;
const rows=categories.map(c=>{
  const brands=byCategory.get(c.slug)||[];
  if(brands.length!==Number(c.count))throw new Error(`v11.30 category count mismatch ${c.slug}: ${brands.length}/${c.count}`);
  const cost=extreme(brands,'cost','min');
  const stores=extreme(brands,'stores','max');
  const sales=extreme(brands,'sales','max');
  const area=extreme(brands,'salesPerArea','max',{positiveOnly:true});
  const metrics={cost,stores,sales,area};
  for(const result of Object.values(metrics)){if(result.brands.length>1)tiedMetricCells+=1;if(!result.brands.length)missingMetricCells+=1}
  const attr=(name,result)=>`data-v30-${name}-value="${finite(result.value)?result.value:''}" data-v30-${name}-routes="${esc(result.brands.map(b=>normalizeRoute(b.route)).join(','))}"`;
  return `<tr data-v30-category="${esc(c.slug)}" data-v30-count="${brands.length}" ${attr('cost',cost)} ${attr('stores',stores)} ${attr('sales',sales)} ${attr('area',area)}><td><a href="${BASE}/categories/${esc(c.slug)}/">${esc(c.name)}</a></td><td class="num">${brands.length}</td>${metricCell('cost',cost,won)}${metricCell('stores',stores,v=>finite(v)?`${num(v)}개`:'—')}${metricCell('sales',sales,won)}${metricCell('area',area,won)}</tr>`;
}).join('');

const section=`<section class="block v30-category-metrics" id="category-metrics" data-v30-category-metrics="1"><div class="section-head"><h2>업종지표</h2><span class="basis-chip">20업종</span></div><details class="v28-basis"><summary>기준</summary><p>비용은 업종 내 최저 공개 창업비용, 가맹점·평균매출·3.3㎡당매출은 업종 내 최대 공개값입니다. 같은 값이 둘 이상이면 모두 표시합니다. 정렬 결과는 추천이나 수익성 평가가 아닙니다.</p></details><div class="table-scroll"><table class="data-table" aria-label="업종별 공개지표 최저·최대 비교"><thead><tr><th>업종</th><th class="num">브랜드</th><th>비용최저</th><th>가맹점최대</th><th>평균매출최대</th><th>3.3㎡최대</th></tr></thead><tbody>${rows}</tbody></table></div><p class="v30-note">공정위 공개값 정렬 · 추천 아님</p></section>`;

const rankingPath=path.join(out,'rankings/index.html');
let html=await fs.readFile(rankingPath,'utf8');
const existing=sectionRange(html,'category-metrics');
if(existing)html=html.slice(0,existing.start)+section+html.slice(existing.end);
else {
  const marker='<section class="block v26-ranking" id="per-area-ranking"';
  const at=html.indexOf(marker);
  if(at<0)throw new Error('v11.30 ranking insertion target missing');
  html=html.slice(0,at)+section+html.slice(at);
}
html=html.replace(/<meta name="description" content="[^"]*">/,'<meta name="description" content="신뢰 게이트를 통과한 136개 프랜차이즈의 전체 정렬과 20개 업종별 비용최저·가맹점최대·평균매출최대·3.3㎡당매출최대를 비교합니다. 추천 순위가 아닙니다.">');
html=html.replace('data-v11-ranking-hub="1"','data-v11-ranking-hub="1" data-v30-category-metrics="1"');
html=patchJsonScript(html,'data-v11-ranking-dataset',d=>{
  d.name='프랜차이즈 전체·업종별 공개지표 정렬 데이터';
  d.description='Tier A/B 신뢰 게이트를 통과한 136개 브랜드의 전체 정렬과 20개 업종별 비용최저·가맹점최대·평균매출최대·3.3㎡당매출최대를 비교한 데이터입니다.';
  d.variableMeasured=Array.isArray(d.variableMeasured)?d.variableMeasured:[];
  d.variableMeasured=d.variableMeasured.filter(x=>!['업종별 지표 행','업종별 비교 지표'].includes(x?.name));
  d.variableMeasured.push({'@type':'PropertyValue',name:'업종별 지표 행',value:20,unitText:'개 업종'},{'@type':'PropertyValue',name:'업종별 비교 지표',value:4,unitText:'개 지표'});
  return d;
});
await fs.writeFile(rankingPath,html,'utf8');

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
css=css.replace(new RegExp(`${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}\\n?`,'g'),'').trimEnd();
css+=`\n\n${START}\n.v30-category-metrics table{min-width:1080px}.v30-category-metrics th,.v30-category-metrics td{vertical-align:top}.v30-category-metrics th:first-child,.v30-category-metrics td:first-child{position:sticky;left:0;z-index:1;background:var(--surface,#fff)}.v30-category-metrics td[data-v30-metric]{min-width:180px}.v30-category-metrics td[data-v30-metric] strong{display:block;margin-top:4px;font-variant-numeric:tabular-nums}.v30-brand-links{display:block;white-space:normal;line-height:1.45}.v30-brand-links a{font-weight:700}.v30-note{margin:10px 0 0;font-size:12px;color:var(--muted,#667085)}\n@media(max-width:700px){.v30-category-metrics table{min-width:980px}.v30-category-metrics th,.v30-category-metrics td{padding-top:10px;padding-bottom:10px}.v30-category-metrics th:first-child,.v30-category-metrics td:first-child{min-width:112px}}\n${END}\n`;
await fs.writeFile(cssPath,css,'utf8');

const report={
  schemaVersion:1,
  uiVersion:'11.30',
  generatedAt:new Date().toISOString(),
  snapshot:snap.snapshot_id,
  productionCandidateCount:candidates.length,
  trustedBrands:snap.brand_count,
  categoryCount:categories.length,
  metrics:['costMin','storesMax','salesMax','salesPerAreaMax'],
  metricCells:categories.length*4,
  tiedMetricCells,
  missingMetricCells,
  previewNoindex:/<meta name="robots" content="noindex,nofollow/.test(html),
  policy:'PREVIEW_ONLY;ONE_EXISTING_ROUTE;TRUSTED_SNAPSHOT_EXTREMES_ONLY;TIES_PRESERVED;NO_RECOMMENDATION_SCORE;NO_NEW_ROUTE;NO_CANDIDATE_CHANGE;NO_INDEX_CHANGE;NO_PRODUCTION_DEPLOY'
};
await fs.writeFile(path.join(out,'v11-30-category-metric-table.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_30CategoryMetricTable:'PASS',...report},null,2));
