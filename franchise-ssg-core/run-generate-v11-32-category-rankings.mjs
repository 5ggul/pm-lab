import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const v31=JSON.parse(await fs.readFile(path.join(out,'v11-31-ranking-ux.json'),'utf8'));
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const SECTION_START='<!-- v11.32 category rankings -->';
const SECTION_END='<!-- v11.32 category rankings end -->';
const FAQ_START='<!-- v11.32 ranking faq -->';
const FAQ_END='<!-- v11.32 ranking faq end -->';
const CSS_START='/* v11.32 category rankings */';
const CSS_END='/* v11.32 category rankings end */';
const NAV_START='<!-- v11.31 ranking nav -->';
const NAV_END='<!-- v11.31 ranking nav end -->';

if(snap.uiVersion!=='11.26'||snap.brand_count!==136||snap.category_count!==20)throw new Error(`v11.32 snapshot gate ${snap.uiVersion}/${snap.brand_count}/${snap.category_count}`);
if(v31.uiVersion!=='11.31'||v31.metricCells!==80||v31.categoryCount!==20)throw new Error(`v11.32 v11.31 gate ${v31.uiVersion}/${v31.metricCells}/${v31.categoryCount}`);
if(candidates.length!==184||!candidates.includes('/rankings/'))throw new Error(`v11.32 candidate gate ${candidates.length}/${candidates.includes('/rankings/')}`);

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`}
function esc(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function safeJson(v){return JSON.stringify(v).replace(/</g,'\\u003c')}
function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function won(v){return finite(v)?`${Number(v).toLocaleString('ko-KR',{maximumFractionDigits:1})}만원`:'—'}
function count(v){return finite(v)?`${Number(v).toLocaleString('ko-KR',{maximumFractionDigits:1})}개`:'—'}
function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function stripBlock(text,start,end){return text.replace(new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`,'g'),'')}
function patchJsonScript(html,attr,fn){const re=new RegExp(`<script type="application/ld\\+json" ${attr}>([\\s\\S]*?)<\\/script>`);const m=html.match(re);if(!m)throw new Error(`JSON-LD script missing: ${attr}`);const data=JSON.parse(m[1]);const next=fn(data)||data;return html.replace(re,`<script type="application/ld+json" ${attr}>${safeJson(next)}</script>`)}

const categories=Object.values(snap.categories||{}).map(c=>({
  slug:c.slug,
  name:c.name,
  count:Number(c.count),
  cost:finite(c.cost?.median)?Number(c.cost.median):null,
  stores:finite(c.stores?.median)?Number(c.stores.median):null,
  sales:finite(c.sales?.median)?Number(c.sales.median):null,
  area:finite(c.salesPerArea?.median)?Number(c.salesPerArea.median):null
}));
if(categories.length!==20)throw new Error(`v11.32 categories ${categories.length}`);
for(const c of categories)for(const key of ['cost','stores','sales','area'])if(!finite(c[key]))throw new Error(`v11.32 missing ${key} median: ${c.slug}`);

const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
const rank=(key,dir)=>[...categories].sort((a,b)=>{
  const d=Number(a[key])-Number(b[key]);
  if(d!==0)return dir==='asc'?d:-d;
  return collator.compare(a.name,b.name);
});
const rankings={cost:rank('cost','asc'),stores:rank('stores','desc'),sales:rank('sales','desc'),area:rank('area','desc')};
const topN=5;
const configs={
  cost:{label:'비용',valueLabel:'중앙값',formatter:won,question:'프랜차이즈 창업비용 중앙값이 낮은 업종은?'},
  stores:{label:'가맹점',valueLabel:'중앙값',formatter:count,question:'가맹점 수 중앙값이 많은 프랜차이즈 업종은?'},
  sales:{label:'평균매출',valueLabel:'중앙값',formatter:won,question:'가맹점 평균매출 중앙값이 높은 프랜차이즈 업종은?'},
  area:{label:'3.3㎡',valueLabel:'중앙값',formatter:won,question:'3.3㎡당 평균매출 중앙값이 높은 프랜차이즈 업종은?'}
};

function metricTable(key){
  const cfg=configs[key];
  const rows=rankings[key].slice(0,topN).map((c,i)=>`<tr data-v32-row="${key}" data-v32-rank="${i+1}" data-v32-slug="${esc(c.slug)}" data-v32-value="${c[key]}"><td class="num">${i+1}</td><td><a href="${BASE}/categories/${esc(c.slug)}/">${esc(c.name)}</a></td><td class="num">${cfg.formatter(c[key])}</td></tr>`).join('');
  return `<div class="v32-rank" data-v32-metric="${key}"><div class="v32-rank-head"><h3>${cfg.label}</h3></div><table class="data-table" aria-label="${esc(cfg.label)} 업종 중앙값 순위"><thead><tr><th class="num">순위</th><th>업종</th><th class="num">${cfg.valueLabel}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function faqAnswer(key){
  const cfg=configs[key];
  const top=rankings[key].slice(0,3);
  return `${cfg.valueLabel} 기준으로 ${top.map(c=>`${c.name} ${cfg.formatter(c[key])}`).join(', ')} 순입니다. 공개자료 중앙값을 정렬한 값이며 개별 점포의 수익성이나 창업 추천을 뜻하지 않습니다.`;
}

const rankingPath=path.join(out,'rankings/index.html');
let html=await fs.readFile(rankingPath,'utf8');
if(!/<meta name="robots" content="noindex,nofollow/.test(html))throw new Error('v11.32 preview noindex gate failed');
if((html.match(/data-v30-category="/g)||[]).length!==20||(html.match(/data-v30-metric="/g)||[]).length!==80)throw new Error('v11.32 v11.30 metric DOM changed before patch');
if(!html.includes('data-v31-ranking-nav="1"')||!html.includes('data-v31-category-sort="1"'))throw new Error('v11.32 v11.31 interaction missing');

html=stripBlock(html,SECTION_START,SECTION_END);
html=stripBlock(html,FAQ_START,FAQ_END);

const nav=`${NAV_START}<nav class="v31-ranking-nav" aria-label="데이터 순위 바로가기" data-v31-ranking-nav="1"><a href="#category-leaders">업종순위</a><a href="#category-metrics">업종지표</a><a href="#per-area-ranking">3.3㎡당매출</a><a href="#cost-ranking">창업비용</a><a href="#store-ranking">가맹점</a><a href="#sales-ranking">평균매출</a></nav>${NAV_END}`;
const navRe=new RegExp(`${escapeRegExp(NAV_START)}[\\s\\S]*?${escapeRegExp(NAV_END)}`);
if(!navRe.test(html))throw new Error('v11.32 ranking nav block missing');
html=html.replace(navRe,nav);

const section=`${SECTION_START}<section class="block v32-category-leaders" id="category-leaders" data-v32-category-leaders="1"><div class="section-head"><h2>업종순위</h2><a href="#category-metrics">전체지표</a></div><details class="v28-basis"><summary>기준</summary><p>20개 업종의 신뢰 브랜드 공개값 중앙값을 사용합니다. 비용은 낮은 순, 가맹점·평균매출·3.3㎡당매출은 높은 순입니다. 중앙값 정렬은 개별 브랜드 추천이나 수익성 평가가 아닙니다.</p></details><div class="v32-rank-grid">${metricTable('cost')}${metricTable('stores')}${metricTable('sales')}${metricTable('area')}</div></section>${SECTION_END}`;
const categoryMetricsAt=html.indexOf('<section class="block v30-category-metrics');
if(categoryMetricsAt<0)throw new Error('v11.32 category metrics insertion target missing');
html=html.slice(0,categoryMetricsAt)+section+html.slice(categoryMetricsAt);

const faq={'@context':'https://schema.org','@type':'FAQPage',mainEntity:Object.keys(configs).map(key=>({'@type':'Question',name:configs[key].question,acceptedAnswer:{'@type':'Answer',text:faqAnswer(key)}}))};
if(!html.includes('</head>'))throw new Error('v11.32 head end missing');
html=html.replace('</head>',`${FAQ_START}<script type="application/ld+json" data-v32-ranking-faq>${safeJson(faq)}</script>${FAQ_END}</head>`);

html=patchJsonScript(html,'data-v11-ranking-dataset',d=>{
  d.variableMeasured=Array.isArray(d.variableMeasured)?d.variableMeasured:[];
  const names=['창업비용 중앙값 최저 업종','가맹점 중앙값 최대 업종','평균매출 중앙값 최대 업종','3.3㎡당매출 중앙값 최대 업종'];
  d.variableMeasured=d.variableMeasured.filter(x=>!names.includes(x?.name));
  const leaders=[rankings.cost[0],rankings.stores[0],rankings.sales[0],rankings.area[0]];
  d.variableMeasured.push(
    {'@type':'PropertyValue',name:names[0],value:`${leaders[0].name} · ${won(leaders[0].cost)}`},
    {'@type':'PropertyValue',name:names[1],value:`${leaders[1].name} · ${count(leaders[1].stores)}`},
    {'@type':'PropertyValue',name:names[2],value:`${leaders[2].name} · ${won(leaders[2].sales)}`},
    {'@type':'PropertyValue',name:names[3],value:`${leaders[3].name} · ${won(leaders[3].area)}`}
  );
  return d;
});
await fs.writeFile(rankingPath,html,'utf8');

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
css=stripBlock(css,CSS_START,CSS_END).trimEnd();
css+=`\n\n${CSS_START}\n.v32-rank-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-top:1px solid #bdb5ab;margin-top:14px}.v32-rank{min-width:0;padding:18px 22px 24px 0;border-bottom:1px solid var(--line)}.v32-rank:nth-child(even){padding-left:22px;border-left:1px solid var(--line)}.v32-rank-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.v32-rank h3{margin:0;font-size:17px}.v32-rank .data-table th,.v32-rank .data-table td{padding:9px 8px;font-size:13px}.v32-rank .data-table th:first-child,.v32-rank .data-table td:first-child{width:48px}.v32-rank .data-table th:last-child,.v32-rank .data-table td:last-child{width:110px}.v32-rank .data-table{background:transparent}.v32-category-leaders .v28-basis{margin-top:10px}\n@media(max-width:700px){.v32-rank-grid{grid-template-columns:1fr}.v32-rank,.v32-rank:nth-child(even){padding:16px 0 20px;border-left:0}.v32-rank .data-table th,.v32-rank .data-table td{padding:9px 6px}.v32-rank .data-table th:last-child,.v32-rank .data-table td:last-child{width:104px}}\n${CSS_END}\n`;
await fs.writeFile(cssPath,css,'utf8');

const report={
  schemaVersion:1,
  uiVersion:'11.32',
  generatedAt:new Date().toISOString(),
  snapshot:snap.snapshot_id,
  productionCandidateCount:candidates.length,
  trustedBrands:snap.brand_count,
  categoryCount:categories.length,
  rankingMetrics:['costMedianAsc','storesMedianDesc','salesMedianDesc','salesPerAreaMedianDesc'],
  visibleTopRows:topN,
  visibleRankingRows:topN*4,
  navigationTargets:['category-leaders','category-metrics','per-area-ranking','cost-ranking','store-ranking','sales-ranking'],
  faqCount:faq.mainEntity.length,
  leaders:{
    cost:{slug:rankings.cost[0].slug,name:rankings.cost[0].name,value:rankings.cost[0].cost},
    stores:{slug:rankings.stores[0].slug,name:rankings.stores[0].name,value:rankings.stores[0].stores},
    sales:{slug:rankings.sales[0].slug,name:rankings.sales[0].name,value:rankings.sales[0].sales},
    area:{slug:rankings.area[0].slug,name:rankings.area[0].name,value:rankings.area[0].area}
  },
  previewNoindex:/<meta name="robots" content="noindex,nofollow/.test(html),
  policy:'PREVIEW_ONLY;ONE_EXISTING_ROUTE;CATEGORY_MEDIANS_ONLY;SEARCH_INTENT_IN_STRUCTURED_DATA;NO_NEW_ROUTE;NO_QUERY_FANOUT;NO_CANDIDATE_CHANGE;NO_INDEX_CHANGE;NO_PRODUCTION_DEPLOY'
};
await fs.writeFile(path.join(out,'v11-32-category-rankings.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_32CategoryRankings:'PASS',...report},null,2));
