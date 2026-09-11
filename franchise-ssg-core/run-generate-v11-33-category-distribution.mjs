import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const v32=JSON.parse(await fs.readFile(path.join(out,'v11-32-category-rankings.json'),'utf8'));
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const SECTION_START='<!-- v11.32 category rankings -->';
const SECTION_END='<!-- v11.32 category rankings end -->';
const CSS_START='/* v11.33 category distribution */';
const CSS_END='/* v11.33 category distribution end */';

if(snap.uiVersion!=='11.26'||snap.brand_count!==136||snap.category_count!==20)throw new Error(`v11.33 snapshot gate ${snap.uiVersion}/${snap.brand_count}/${snap.category_count}`);
if(v32.uiVersion!=='11.32'||v32.visibleRankingRows!==20||v32.categoryCount!==20)throw new Error(`v11.33 v11.32 gate ${v32.uiVersion}/${v32.visibleRankingRows}/${v32.categoryCount}`);
if(candidates.length!==184||!candidates.includes('/rankings/'))throw new Error(`v11.33 candidate gate ${candidates.length}/${candidates.includes('/rankings/')}`);

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`}
function esc(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function won(v){return finite(v)?`${Number(v).toLocaleString('ko-KR',{maximumFractionDigits:1})}만원`:'—'}
function count(v){return finite(v)?`${Number(v).toLocaleString('ko-KR',{maximumFractionDigits:1})}개`:'—'}
function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function stripBlock(text,start,end){return text.replace(new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`,'g'),'')}
function stats(v){return {p25:Number(v?.p25),median:Number(v?.median),p75:Number(v?.p75)}}

const categories=Object.values(snap.categories||{}).map(c=>({
  slug:c.slug,
  name:c.name,
  count:Number(c.count),
  cost:stats(c.cost),
  stores:stats(c.stores),
  sales:stats(c.sales),
  area:stats(c.salesPerArea)
}));
if(categories.length!==20)throw new Error(`v11.33 categories ${categories.length}`);
for(const c of categories)for(const key of ['cost','stores','sales','area'])for(const part of ['p25','median','p75'])if(!finite(c[key]?.[part]))throw new Error(`v11.33 missing ${key}.${part}: ${c.slug}`);

const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
const rank=(key,dir)=>[...categories].sort((a,b)=>{
  const d=a[key].median-b[key].median;
  if(d!==0)return dir==='asc'?d:-d;
  return collator.compare(a.name,b.name);
});
const rankings={cost:rank('cost','asc'),stores:rank('stores','desc'),sales:rank('sales','desc'),area:rank('area','desc')};
const topN=5;
const configs={
  cost:{label:'비용',formatter:won},
  stores:{label:'가맹점',formatter:count},
  sales:{label:'평균매출',formatter:won},
  area:{label:'3.3㎡',formatter:won}
};

function domain(key){
  const vals=categories.flatMap(c=>[c[key].p25,c[key].p75]).filter(finite).map(Number);
  return {min:Math.min(...vals),max:Math.max(...vals)};
}
const domains=Object.fromEntries(Object.keys(configs).map(key=>[key,domain(key)]));
function pct(v,d){if(!finite(v)||!finite(d?.min)||!finite(d?.max)||d.max===d.min)return 50;return Math.max(0,Math.min(100,(Number(v)-d.min)/(d.max-d.min)*100))}
function rangeCell(c,key){
  const s=c[key],d=domains[key];
  const left=pct(s.p25,d),right=pct(s.p75,d),mid=pct(s.median,d);
  const width=Math.max(1,right-left);
  return `<div class="v33-range" aria-label="P25 ${esc(configs[key].formatter(s.p25))}, 중앙 ${esc(configs[key].formatter(s.median))}, P75 ${esc(configs[key].formatter(s.p75))}"><span class="v33-axis"></span><span class="v33-band" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></span><span class="v33-mid" style="left:${mid.toFixed(2)}%"></span></div>`;
}
function metricTable(key){
  const cfg=configs[key];
  const rows=rankings[key].slice(0,topN).map((c,i)=>`<tr data-v33-row="${key}" data-v33-rank="${i+1}" data-v33-slug="${esc(c.slug)}" data-v33-p25="${c[key].p25}" data-v33-median="${c[key].median}" data-v33-p75="${c[key].p75}"><td class="num">${i+1}</td><td><a href="${BASE}/categories/${esc(c.slug)}/">${esc(c.name)}</a></td><td class="num v33-p25">${cfg.formatter(c[key].p25)}</td><td class="num v33-median">${cfg.formatter(c[key].median)}</td><td class="num v33-p75">${cfg.formatter(c[key].p75)}</td><td class="v33-range-cell">${rangeCell(c,key)}</td></tr>`).join('');
  return `<div class="v32-rank v33-rank" data-v33-metric="${key}"><div class="v32-rank-head"><h3>${cfg.label}</h3></div><div class="v33-table-scroll"><table class="data-table v33-table" aria-label="${esc(cfg.label)} 업종 P25 중앙 P75 분포"><thead><tr><th class="num">순위</th><th>업종</th><th class="num">P25</th><th class="num">중앙</th><th class="num">P75</th><th>분포</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

const rankingPath=path.join(out,'rankings/index.html');
let html=await fs.readFile(rankingPath,'utf8');
if(!/<meta name="robots" content="noindex,nofollow/.test(html))throw new Error('v11.33 preview noindex gate failed');
if((html.match(/data-v30-category="/g)||[]).length!==20||(html.match(/data-v30-metric="/g)||[]).length!==80)throw new Error('v11.33 v11.30 metric DOM changed before patch');
if(!html.includes('data-v31-category-sort="1"')||!html.includes('data-v32-category-leaders="1"'))throw new Error('v11.33 prior ranking layers missing');

const sectionRe=new RegExp(`${escapeRegExp(SECTION_START)}[\\s\\S]*?${escapeRegExp(SECTION_END)}`);
if(!sectionRe.test(html))throw new Error('v11.33 v11.32 section missing');
const section=`${SECTION_START}<section class="block v32-category-leaders v33-category-distribution" id="category-leaders" data-v32-category-leaders="1" data-v33-category-distribution="1"><div class="section-head"><h2>업종순위</h2><a href="#category-metrics">전체지표</a></div><details class="v28-basis"><summary>기준</summary><p>20개 업종의 신뢰 브랜드 공개값을 업종별 P25·중앙·P75로 요약합니다. 비용은 중앙값 낮은 순, 가맹점·평균매출·3.3㎡당매출은 중앙값 높은 순입니다. 분포폭은 같은 지표의 20개 업종 범위 안에서 표시합니다.</p></details><div class="v32-rank-grid v33-rank-grid">${metricTable('cost')}${metricTable('stores')}${metricTable('sales')}${metricTable('area')}</div></section>${SECTION_END}`;
html=html.replace(sectionRe,section);
await fs.writeFile(rankingPath,html,'utf8');

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
css=stripBlock(css,CSS_START,CSS_END).trimEnd();
css+=`\n\n${CSS_START}\n.v33-rank{padding-right:18px}.v33-rank:nth-child(even){padding-left:18px}.v33-table-scroll{overflow-x:auto}.v33-table{min-width:620px}.v33-table th,.v33-table td{vertical-align:middle}.v33-table .v33-p25,.v33-table .v33-median,.v33-table .v33-p75{width:88px;white-space:nowrap}.v33-table .v33-median{font-weight:900;color:var(--text)}.v33-range-cell{width:150px}.v33-range{position:relative;width:126px;height:20px;margin-left:auto}.v33-axis{position:absolute;left:0;right:0;top:9px;height:1px;background:#d6d0c8}.v33-band{position:absolute;top:7px;height:5px;background:var(--text);border-radius:1px}.v33-mid{position:absolute;top:3px;width:2px;height:13px;background:var(--accent);transform:translateX(-1px)}\n@media(max-width:700px){.v33-rank,.v33-rank:nth-child(even){padding-left:0;padding-right:0}.v33-table-scroll{overflow:visible}.v33-table{min-width:0;width:100%}.v33-table th:nth-child(3),.v33-table td:nth-child(3),.v33-table th:nth-child(5),.v33-table td:nth-child(5){display:none}.v33-table .v33-median{width:92px}.v33-range-cell{width:112px}.v33-range{width:96px}.v33-table th,.v33-table td{padding:9px 5px;font-size:12px}.v33-table th:first-child,.v33-table td:first-child{width:34px}.v33-table th:nth-child(2),.v33-table td:nth-child(2){min-width:96px}}\n${CSS_END}\n`;
await fs.writeFile(cssPath,css,'utf8');

const report={
  schemaVersion:1,
  uiVersion:'11.33',
  generatedAt:new Date().toISOString(),
  snapshot:snap.snapshot_id,
  productionCandidateCount:candidates.length,
  trustedBrands:snap.brand_count,
  categoryCount:categories.length,
  distributionParts:['p25','median','p75'],
  rankingMetrics:['costMedianAsc','storesMedianDesc','salesMedianDesc','salesPerAreaMedianDesc'],
  visibleTopRows:topN,
  visibleDistributionRows:topN*4,
  distributionCells:topN*4*3,
  rangeBars:topN*4,
  mobileVisibleParts:['median','range'],
  v30MetricCellsPreserved:(html.match(/data-v30-metric="/g)||[]).length,
  previewNoindex:/<meta name="robots" content="noindex,nofollow/.test(html),
  policy:'PREVIEW_ONLY;ONE_EXISTING_ROUTE;CATEGORY_DISTRIBUTION_FROM_TRUSTED_SNAPSHOT;NO_NEW_ROUTE;NO_QUERY_FANOUT;NO_CANDIDATE_CHANGE;NO_INDEX_CHANGE;NO_PRODUCTION_DEPLOY'
};
await fs.writeFile(path.join(out,'v11-33-category-distribution.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_33CategoryDistribution:'PASS',...report},null,2));
