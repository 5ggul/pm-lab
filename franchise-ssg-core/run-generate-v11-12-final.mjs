import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {matchOfficialBrands} from './official-merge.mjs';
import {sanitizeOfficialStoreHistory} from './official-history.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const SITE=(process.env.SSG_SITE_URL??'https://5ggul.github.io/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const FTC_COST_SOURCE='https://www.data.go.kr/data/15110265/openapi.do';
const FTC_STORE_SOURCE='https://www.data.go.kr/data/15110241/openapi.do';
const generatedAt=new Date().toISOString();

async function loadClassic(file,expr){
  const code=await fs.readFile(file,'utf8');
  const ctx={console};
  vm.createContext(ctx);
  vm.runInContext(`${code}\n;globalThis.__EXPORT__=${expr};`,ctx);
  return ctx.__EXPORT__;
}

const catalog=await loadClassic(path.join(repo,'docs/franchise-data-preview/data-final.js'),'{categories,brands}');
const official=JSON.parse(await fs.readFile(path.join(repo,'data/franchise/official/brands-2025.json'),'utf8'));
const v111=JSON.parse(await fs.readFile(path.join(out,'v11-11-content-trust.json'),'utf8'));
const qualityPath=path.join(out,'v11-quality-report.json');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(qualityPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const matched=matchOfficialBrands(catalog.brands,official);

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const numberOrNull=v=>finite(v)?Number(v):null;
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=n=>finite(n)?Number(n).toLocaleString('ko-KR'):'정보 없음';
const pct=n=>finite(n)?`${Number(n)>=0?'+':''}${Number(n).toFixed(1)}%`:'정보 없음';
const normalizeRoute=r=>r==='/'?'/':`/${String(r).replace(/^\/+|\/+$/g,'')}/`;
const categoryRoute=slug=>normalizeRoute(`/categories/${slug}/`);
const targetRoutes=new Set((v111.removedThinRiskCandidates||[]).filter(x=>x.kind==='category').map(x=>normalizeRoute(x.route)));

function quantile(values,q){
  const arr=values.filter(finite).map(Number).sort((a,b)=>a-b);
  if(!arr.length)return null;
  if(arr.length===1)return arr[0];
  const pos=(arr.length-1)*q;
  const lo=Math.floor(pos),hi=Math.ceil(pos);
  if(lo===hi)return arr[lo];
  return arr[lo]+(arr[hi]-arr[lo])*(pos-lo);
}
function cleanHistory(record){
  return sanitizeOfficialStoreHistory(record?.storeHistory||[])
    .filter(row=>finite(row?.year))
    .sort((a,b)=>Number(a.year)-Number(b.year));
}
function latestHistoryRow(record){
  const rows=cleanHistory(record);
  const ref=numberOrNull(record?.referenceYear);
  return rows.find(row=>Number(row.year)===ref)||rows.at(-1)||null;
}
function latestStoreDelta(hit){
  const rows=cleanHistory(hit?.record).filter(row=>finite(row?.stores));
  if(rows.length<2)return null;
  const previous=rows.at(-2),current=rows.at(-1);
  const before=Number(previous.stores),after=Number(current.stores);
  return {name:hit.brand.name,fromYear:Number(previous.year),toYear:Number(current.year),before,after,delta:after-before,pct:before>0?((after-before)/before*100):null};
}
function metric(hit,key){
  const record=hit?.record||{};
  const current=latestHistoryRow(record)||{};
  if(key==='cost')return numberOrNull(record.startupCost10k);
  if(key==='stores')return numberOrNull(current.stores??record.stores);
  if(key==='sales')return numberOrNull(record.averageSales10k??current.averageSales10k);
  return null;
}
function nearest(items,key,target,count=3){
  return items
    .map(hit=>({hit,value:metric(hit,key)}))
    .filter(row=>row.value!==null)
    .sort((a,b)=>Math.abs(a.value-target)-Math.abs(b.value-target)||a.hit.brand.name.localeCompare(b.hit.brand.name,'ko'))
    .slice(0,count);
}
function bandRows(costs,q1,median,q3){
  const bands=[
    {label:'25% 지점 이하',test:v=>v<=q1,range:`${fmt(q1)}만원 이하`},
    {label:'25~50% 구간',test:v=>v>q1&&v<=median,range:`${fmt(q1)}~${fmt(median)}만원`},
    {label:'50~75% 구간',test:v=>v>median&&v<=q3,range:`${fmt(median)}~${fmt(q3)}만원`},
    {label:'75% 지점 초과',test:v=>v>q3,range:`${fmt(q3)}만원 초과`}
  ];
  return bands.map(b=>({...b,count:costs.filter(b.test).length}));
}
function sourceLinks(){
  return `<div class="category-source-strip"><span>원자료</span><a href="${FTC_COST_SOURCE}" rel="noopener">공정위 가맹사업거래 비용 공개데이터</a><a href="${FTC_STORE_SOURCE}" rel="noopener">공정위 가맹점 현황 공개데이터</a></div>`;
}
function datasetFor(slug,name,stats){
  const variables=[
    {'@type':'PropertyValue',name:'공식 매칭 브랜드 수',value:stats.sample,unitText:'개'},
    {'@type':'PropertyValue',name:'공개 창업비용 25% 지점',value:Math.round(stats.q1),unitText:'만원'},
    {'@type':'PropertyValue',name:'공개 창업비용 중앙값',value:Math.round(stats.median),unitText:'만원'},
    {'@type':'PropertyValue',name:'공개 창업비용 75% 지점',value:Math.round(stats.q3),unitText:'만원'}
  ];
  if(stats.storeMedian!==null)variables.push({'@type':'PropertyValue',name:'가맹점 수 중앙값',value:Math.round(stats.storeMedian),unitText:'개'});
  if(stats.salesMedian!==null)variables.push({'@type':'PropertyValue',name:'평균매출 공개지표 중앙값',value:Math.round(stats.salesMedian),unitText:'만원'});
  return {'@context':'https://schema.org','@type':'Dataset','@id':`${SITE}${categoryRoute(slug)}#category-dataset`,name:`${name} 프랜차이즈 창업비용·가맹점 비교 데이터`,description:`${name} 공식 매칭 브랜드의 공개 창업비용 사분위, 가맹점 수, 점포 변화와 평균매출 공개지표를 비교한 파생 데이터입니다.`,url:`${SITE}${categoryRoute(slug)}`,dateModified:String(official.generatedAt||generatedAt).slice(0,10),creator:{'@type':'Organization',name:'창업데이터랩',url:SITE},isBasedOn:[FTC_COST_SOURCE,FTC_STORE_SOURCE],measurementTechnique:'공정거래위원회 공개자료 정규화 후 동일 카탈로그 업종 내 중앙값·사분위·최근 점포변화 계산',variableMeasured:variables};
}
function safeJson(value){return JSON.stringify(value).replace(/</g,'\\u003c')}

const byCategory=new Map();
for(const hit of matched.matches){
  const slug=hit.brand.categorySlug;
  if(!slug)continue;
  const list=byCategory.get(slug)||[];
  list.push(hit);
  byCategory.set(slug,list);
}

function decodeEntities(text){return text.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")}
function visibleText(html){return decodeEntities(html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<svg\b[\s\S]*?<\/svg>/gi,' ').replace(/<\/(?:p|h1|h2|h3|li|tr|dd|dt|details|section)>/gi,'. ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}
function auditCategory(route,html){
  const text=visibleText(html),compact=text.replace(/\s/g,'');
  const h2=(html.match(/<h2\b/gi)||[]).length;
  const tables=(html.match(/<table\b/gi)||[]).length;
  const numericFacts=(text.match(/[+-]?\d[\d,]*(?:\.\d+)?\s*(?:만원|개|%|년|위)/g)||[]).length;
  const externalLinks=(html.match(/href="https?:\/\/[^\"]+"/g)||[]).length;
  const reasons=[];
  if(compact.length<1250)reasons.push('VISIBLE_TEXT_LT_1250');
  if(h2<5)reasons.push('H2_LT_5');
  if(tables<4)reasons.push('TABLES_LT_4');
  if(numericFacts<40)reasons.push('NUMERIC_FACTS_LT_40');
  if(externalLinks<2)reasons.push('SOURCE_LINKS_LT_2');
  if(!html.includes('data-v11-12-category-depth="1"'))reasons.push('CATEGORY_DEPTH_MISSING');
  if(!html.includes('data-v11-12-store-movement="1"'))reasons.push('STORE_MOVEMENT_MISSING');
  if(!html.includes('data-v11-12-median-neighbors="1"'))reasons.push('MEDIAN_NEIGHBORS_MISSING');
  if(!html.includes('data-v11-12-category-dataset'))reasons.push('CATEGORY_DATASET_JSONLD_MISSING');
  return {route,visibleTextChars:compact.length,h2,tables,numericFacts,externalLinks,reasons};
}

const audits=[];
const recovered=[];
for(const route of targetRoutes){
  const slug=route.split('/').filter(Boolean).at(-1);
  const meta=catalog.categories?.[slug];
  const hits=byCategory.get(slug)||[];
  const file=path.join(out,'categories',slug,'index.html');
  if(!meta||hits.length<3)continue;
  const costs=hits.map(h=>metric(h,'cost')).filter(v=>v!==null);
  if(costs.length<3)continue;
  const stores=hits.map(h=>metric(h,'stores')).filter(v=>v!==null);
  const sales=hits.map(h=>metric(h,'sales')).filter(v=>v!==null);
  const q1=quantile(costs,.25),median=quantile(costs,.5),q3=quantile(costs,.75);
  const storeMedian=quantile(stores,.5),salesMedian=quantile(sales,.5);
  const bands=bandRows(costs,q1,median,q3);
  const deltas=hits.map(latestStoreDelta).filter(Boolean).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)||b.delta-a.delta).slice(0,6);
  const nearCost=nearest(hits,'cost',median,3);
  const nearStores=storeMedian===null?[]:nearest(hits,'stores',storeMedian,3);
  const stats={sample:hits.length,q1,median,q3,storeMedian,salesMedian};

  const bandTable=bands.map(row=>`<tr><td>${esc(row.label)}</td><td class="num">${esc(row.range)}</td><td class="num">${fmt(row.count)}개</td></tr>`).join('');
  const deltaTable=deltas.map(row=>`<tr><td>${esc(row.name)}</td><td class="num">${fmt(row.fromYear)}→${fmt(row.toYear)}</td><td class="num">${fmt(row.before)}개</td><td class="num">${fmt(row.after)}개</td><td class="num ${row.delta>0?'positive':row.delta<0?'negative':''}">${row.delta>=0?'+':''}${fmt(row.delta)}개${row.pct===null?'':` · ${pct(row.pct)}`}</td></tr>`).join('');
  const nearRows=Math.max(nearCost.length,nearStores.length);
  const nearTable=Array.from({length:nearRows},(_,i)=>{
    const c=nearCost[i],s=nearStores[i];
    return `<tr><td>${c?esc(c.hit.brand.name):'—'}</td><td class="num">${c?`${fmt(c.value)}만원`:'—'}</td><td>${s?esc(s.hit.brand.name):'—'}</td><td class="num">${s?`${fmt(s.value)}개`:'—'}</td></tr>`;
  }).join('');

  const section=`<section class="block category-depth" id="category-depth" data-v11-12-category-depth="1"><h2>${esc(meta.name)} 비용 구간을 어떻게 나눠 볼 수 있나요?</h2><p>공식 레코드가 매칭된 ${fmt(hits.length)}개 브랜드 기준으로 공개 창업비용 25% 지점은 ${fmt(q1)}만원, 중앙값은 ${fmt(median)}만원, 75% 지점은 ${fmt(q3)}만원입니다. 비용이 확인된 브랜드만 포함하며 임대보증금·권리금·별도 공사처럼 정보공개서 밖의 금액은 합산하지 않습니다.</p><div class="table-scroll"><table class="data-table compact-table"><thead><tr><th>비용 구간</th><th class="num">기준</th><th class="num">브랜드 수</th></tr></thead><tbody>${bandTable}</tbody></table></div></section><section class="block category-depth" id="store-movement" data-v11-12-store-movement="1"><h2>${esc(meta.name)} 가맹점 수는 최근 어떻게 움직였나요?</h2><p>${storeMedian===null?'가맹점 수 중앙값은 공개자료가 충분한 브랜드만 계산합니다.':`가맹점 수 중앙값은 ${fmt(storeMedian)}개입니다.`} 아래 표는 최근 두 기준연도가 모두 확인되는 브랜드 중 변화 폭이 큰 순서로 최대 6개만 표시합니다. 증가는 성장성 보장, 감소는 사업성 악화를 뜻하지 않습니다.</p>${deltas.length?`<div class="table-scroll"><table class="data-table compact-table"><thead><tr><th>브랜드</th><th class="num">기준연도</th><th class="num">이전</th><th class="num">최근</th><th class="num">변화</th></tr></thead><tbody>${deltaTable}</tbody></table></div>`:'<p class="data-note">최근 두 기준연도가 함께 확인되는 브랜드가 부족해 점포 변화표를 만들지 않았습니다.</p>'}</section><section class="block category-depth" id="median-neighbors" data-v11-12-median-neighbors="1"><h2>${esc(meta.name)}에서 중앙값과 가까운 브랜드는 어디인가요?</h2><p>극단적으로 높거나 낮은 브랜드만 보는 편향을 줄이기 위해 업종 중앙값에 가까운 브랜드를 함께 표시합니다. 평균매출 공개지표 중앙값${salesMedian===null?'은 확인 가능한 표본만 사용합니다.':`은 ${fmt(salesMedian)}만원입니다.`}</p><div class="table-scroll"><table class="data-table compact-table"><thead><tr><th>비용 중앙값 근접</th><th class="num">공개 창업비용</th><th>가맹점 중앙값 근접</th><th class="num">가맹점 수</th></tr></thead><tbody>${nearTable}</tbody></table></div>${sourceLinks()}</section>`;

  let html=await fs.readFile(file,'utf8');
  html=html.replace(/<section class="block category-depth" id="category-depth"[\s\S]*?<\/section>\s*<section class="block category-depth" id="store-movement"[\s\S]*?<\/section>\s*<section class="block category-depth" id="median-neighbors"[\s\S]*?<\/section>/,'');
  html=html.replace(/<script type="application\/ld\+json" data-v11-12-category-dataset>[\s\S]*?<\/script>/,'');
  html=html.replace('</head>',`<script type="application/ld+json" data-v11-12-category-dataset>${safeJson(datasetFor(slug,meta.name,stats))}</script></head>`);
  html=html.replace('</main>',`${section}</main>`);
  await fs.writeFile(file,html,'utf8');
  const audit=auditCategory(route,html);
  audits.push(audit);
  if(!audit.reasons.length)recovered.push(route);
}

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
if(!css.includes('/* v11.12 category depth */')){
  css+=`\n/* v11.12 category depth */\n.category-depth{scroll-margin-top:96px}.category-depth .compact-table{margin-top:14px}.category-source-strip{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:16px;padding-top:12px;border-top:1px solid var(--line);font-size:13px}.category-source-strip span{font-weight:800}.category-source-strip a{text-decoration:underline;text-underline-offset:3px}@media(max-width:720px){.category-depth>p{font-size:14px;line-height:1.72}.category-source-strip{gap:8px 12px}}\n`;
  await fs.writeFile(cssPath,css,'utf8');
}

const currentCandidates=new Set((quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute));
for(const route of recovered)currentCandidates.add(route);
quality.indexPolicy=quality.indexPolicy||{};
quality.indexPolicy.productionCandidateUrls=[...currentCandidates].sort();
quality.indexPolicy.v11_12={categoryDepthRecovered:recovered.length,targetCategoryCount:targetRoutes.size,rule:'RECOVER_ONLY_PREVIOUS_THIN_RISK_CATEGORY_ROUTES_AFTER_DERIVED_DATA_DEPTH_AUDIT'};
quality.generatedAt=generatedAt;
await fs.writeFile(qualityPath,JSON.stringify(quality,null,2)+'\n','utf8');

manifest.uiVersion='11.12';
manifest.generatedAt=generatedAt;
manifest.v11_12={categoryQuartileDepth:true,storeMovementDepth:true,medianNeighborDepth:true,categoryDatasetJsonLd:true,thinRiskRecovery:true,previewNoindex:PREVIEW};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');

const report={schemaVersion:1,generatedAt,uiVersion:'11.12',previewMode:PREVIEW,policy:'DERIVED_FACTS_ONLY; RECOVER_ONLY_V11_11_THIN_CATEGORY_TARGETS; NO_SYNTHETIC_CATEGORY_COPY',targetCategoryCount:targetRoutes.size,recoveredCategoryCount:recovered.length,recoveredRoutes:recovered,remainingThinCategoryRoutes:audits.filter(x=>x.reasons.length).map(x=>({route:x.route,reasons:x.reasons})),productionCandidateCount:quality.indexPolicy.productionCandidateUrls.length,audits};
await fs.writeFile(path.join(out,'v11-12-category-depth.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({v11_12:'generated',...report},null,2));
