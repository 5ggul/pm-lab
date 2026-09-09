import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {brandSlugFor} from './routing-v3.mjs';
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
const qualityPath=path.join(out,'v11-quality-report.json');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(qualityPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const matched=matchOfficialBrands(catalog.brands,official);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const numberOrNull=v=>finite(v)?Number(v):null;
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=n=>finite(n)?Number(n).toLocaleString('ko-KR'):'정보 없음';
const normalizeRoute=r=>r==='/'?'/':`/${String(r).replace(/^\/+|\/+$/g,'')}/`;
const brandRoute=brand=>normalizeRoute(`/brands/${brandSlugFor(brand.name,brand.slug)}/`);
const previousCandidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const candidateSet=new Set(previousCandidates);

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
function metricValue(hit,key){
  const record=hit?.record||{};
  const current=latestHistoryRow(record);
  if(key==='cost')return numberOrNull(record?.startupCost10k);
  if(key==='stores')return numberOrNull(current?.stores??record?.stores);
  if(key==='sales')return numberOrNull(record?.averageSales10k??current?.averageSales10k);
  return null;
}
function rankMetric(items,targetName,key,direction='desc'){
  const rows=items.map(hit=>({name:hit.brand.name,value:metricValue(hit,key)})).filter(row=>row.value!==null);
  rows.sort((a,b)=>direction==='asc'?(a.value-b.value||a.name.localeCompare(b.name,'ko')):(b.value-a.value||a.name.localeCompare(b.name,'ko')));
  let rank=0;let last=null;
  for(let i=0;i<rows.length;i++){
    if(i===0||rows[i].value!==last)rank=i+1;
    rows[i].rank=rank;
    last=rows[i].value;
  }
  const target=rows.find(row=>row.name===targetName);
  return target?{rank:target.rank,total:rows.length,value:target.value}:null;
}
function latestStoreDelta(record){
  const rows=cleanHistory(record).filter(row=>finite(row?.stores));
  if(rows.length<2)return null;
  const previous=rows.at(-2),current=rows.at(-1);
  const before=Number(previous.stores),after=Number(current.stores);
  return {fromYear:Number(previous.year),toYear:Number(current.year),before,after,delta:after-before,pct:before>0?((after-before)/before*100):null};
}
function rankRow(label,rank,unit,directionLabel){
  if(!rank)return '';
  return `<tr><td data-label="지표">${esc(label)}</td><td data-label="브랜드 값" class="num">${fmt(rank.value)}${unit}</td><td data-label="비교 표본" class="num">${fmt(rank.total)}개 브랜드</td><td data-label="업종 내 위치" class="num">${esc(directionLabel)} ${fmt(rank.rank)}위</td></tr>`;
}
function buildPositionSection(hit,categoryHits){
  const cost=rankMetric(categoryHits,hit.brand.name,'cost','asc');
  const stores=rankMetric(categoryHits,hit.brand.name,'stores','desc');
  const sales=rankMetric(categoryHits,hit.brand.name,'sales','desc');
  if([cost,stores,sales].filter(Boolean).length<2)return null;
  const categoryName=catalog.categories?.[hit.brand.categorySlug]?.name||hit.brand.category||'같은 업종';
  const rows=[rankRow('공개 창업비용',cost,'만원','낮은 순'),rankRow('가맹점 수',stores,'개','많은 순'),rankRow('평균매출 공개지표',sales,'만원','높은 순')].join('');
  const parts=[];
  if(cost)parts.push(`공개 창업비용은 낮은 순 ${cost.rank}/${cost.total}`);
  if(stores)parts.push(`가맹점 수는 많은 순 ${stores.rank}/${stores.total}`);
  if(sales)parts.push(`평균매출 공개지표는 높은 순 ${sales.rank}/${sales.total}`);
  const delta=latestStoreDelta(hit.record);
  const deltaText=delta?` 최근 확인 가능한 ${delta.fromYear}→${delta.toYear} 기준 가맹점 수 변화는 ${delta.delta>=0?'+':''}${fmt(delta.delta)}개${delta.pct===null?'':` (${delta.pct>=0?'+':''}${delta.pct.toFixed(1)}%)`}입니다.`:'';
  return {html:`<section class="block brand-position" id="position" data-v11-position="1"><h2>${esc(hit.brand.name)}는 ${esc(categoryName)} 안에서 어느 위치인가요?</h2><p>같은 카탈로그 업종에서 공정위 공식 레코드가 매칭되고 해당 지표가 확인되는 브랜드끼리만 비교합니다. 순위는 추천점수나 수익성 순위가 아닙니다.</p><div class="table-scroll"><table class="data-table stack-mobile position-table"><thead><tr><th>지표</th><th class="num">브랜드 값</th><th class="num">비교 표본</th><th class="num">업종 내 위치</th></tr></thead><tbody>${rows}</tbody></table></div><p class="position-summary">${esc(parts.join(' · '))}.${esc(deltaText)}</p><div class="chart-legend">비용은 낮은 순, 가맹점 수와 평균매출 공개지표는 높은 순으로 위치를 표시합니다. 지표의 높고 낮음만으로 창업 적합성이나 향후 성과를 판단하지 않습니다.</div></section>`,categoryName,cost,stores,sales,delta};
}
function datasetFor(hit,section,route){
  const record=hit.record||{};
  const history=cleanHistory(record).filter(row=>finite(row?.stores));
  const years=history.map(row=>Number(row.year)).filter(Number.isFinite);
  const referenceYear=numberOrNull(record?.referenceYear);
  const variables=[];
  const cost=metricValue(hit,'cost'),stores=metricValue(hit,'stores'),sales=metricValue(hit,'sales');
  if(cost!==null)variables.push({'@type':'PropertyValue',name:'공개 창업비용',value:cost,unitText:'만원'});
  if(stores!==null)variables.push({'@type':'PropertyValue',name:'가맹점 수',value:stores,unitText:'개'});
  if(sales!==null)variables.push({'@type':'PropertyValue',name:'평균매출 공개지표',value:sales,unitText:'만원'});
  if(section?.cost)variables.push({'@type':'PropertyValue',name:`${section.categoryName} 창업비용 낮은 순 위치`,value:section.cost.rank,unitText:`${section.cost.total}개 브랜드 중 순위`});
  if(section?.stores)variables.push({'@type':'PropertyValue',name:`${section.categoryName} 가맹점 수 많은 순 위치`,value:section.stores.rank,unitText:`${section.stores.total}개 브랜드 중 순위`});
  if(section?.sales)variables.push({'@type':'PropertyValue',name:`${section.categoryName} 평균매출 공개지표 높은 순 위치`,value:section.sales.rank,unitText:`${section.sales.total}개 브랜드 중 순위`});
  const minYear=years.length?Math.min(...years):referenceYear;
  const maxYear=years.length?Math.max(...years):referenceYear;
  return {'@context':'https://schema.org','@type':'Dataset','@id':`${SITE}${route}#dataset`,name:`${hit.brand.name} 창업비용·가맹점 공개 데이터`,description:`${hit.brand.name}의 공정위 공개 창업비용, 가맹점 수, 평균매출 공개지표와 ${section.categoryName} 업종 내 비교 위치를 정리한 데이터입니다.`,url:`${SITE}${route}`,dateModified:String(official.generatedAt||generatedAt).slice(0,10),...(minYear&&maxYear?{temporalCoverage:`${minYear}/${maxYear}`}:{ }),creator:{'@type':'Organization',name:'창업데이터랩',url:SITE},isBasedOn:[FTC_COST_SOURCE,FTC_STORE_SOURCE],measurementTechnique:'공정거래위원회 공개자료 정규화 및 동일 카탈로그 업종 내 비교',variableMeasured:variables};
}
function safeJson(value){return JSON.stringify(value).replace(/</g,'\\u003c')}

const byCategory=new Map();
for(const hit of matched.matches){const key=hit.brand.categorySlug||'unknown';const list=byCategory.get(key)||[];list.push(hit);byCategory.set(key,list)}
const enhancedRoutes=new Set();
const datasetRoutes=new Set();
const positionFindings=[];
for(const hit of matched.matches){
  const route=brandRoute(hit.brand);
  const slug=route.split('/').filter(Boolean).at(-1);
  const file=path.join(out,'brands',slug,'index.html');
  const section=buildPositionSection(hit,byCategory.get(hit.brand.categorySlug)||[]);
  if(!section)continue;
  let html=await fs.readFile(file,'utf8');
  html=html.replace(/<section class="block brand-position" id="position"[\s\S]*?<\/section>/,'');
  html=html.replace(/<script type="application\/ld\+json" data-v11-dataset>[\s\S]*?<\/script>/,'');
  if(!html.includes('href="#position"'))html=html.replace('<a href="#check">추가 확인</a>','<a href="#position">업종 내 위치</a><a href="#check">추가 확인</a>');
  const insertion='<section class="block" id="check">';
  if(!html.includes(insertion))continue;
  html=html.replace(insertion,`${section.html}${insertion}`);
  if(candidateSet.has(route)){
    html=html.replace('</head>',`<script type="application/ld+json" data-v11-dataset>${safeJson(datasetFor(hit,section,route))}</script></head>`);
    datasetRoutes.add(route);
  }
  await fs.writeFile(file,html,'utf8');
  enhancedRoutes.add(route);
  positionFindings.push({name:hit.brand.name,route,category:section.categoryName,costRank:section.cost?`${section.cost.rank}/${section.cost.total}`:null,storesRank:section.stores?`${section.stores.rank}/${section.stores.total}`:null,salesRank:section.sales?`${section.sales.rank}/${section.sales.total}`:null});
}

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
if(!css.includes('/* v11.11 content trust */')){
  css+=`\n/* v11.11 content trust */\n.brand-position .position-table{margin-top:16px}.brand-position .position-summary{margin:14px 0 0;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-weight:700;line-height:1.7}.brand-position .chart-legend{margin-top:10px}@media(max-width:720px){.brand-position .position-summary{font-size:14px}}\n`;
  await fs.writeFile(cssPath,css,'utf8');
}

function decodeEntities(text){return text.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")}
function visibleText(html){return decodeEntities(html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<svg\b[\s\S]*?<\/svg>/gi,' ').replace(/<\/(?:p|h1|h2|h3|li|tr|dd|dt|details|section)>/gi,'. ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}
function auditHtml(route,html){
  const text=visibleText(html),compact=text.replace(/\s/g,'');
  const h2=(html.match(/<h2\b/gi)||[]).length,tables=(html.match(/<table\b/gi)||[]).length,numericFacts=(text.match(/[+-]?\d[\d,]*(?:\.\d+)?\s*(?:만원|개|%|년|위)/g)||[]).length,externalLinks=(html.match(/href="https?:\/\/[^\"]+"/g)||[]).length;
  const kind=/^\/brands\/[^/]+\/$/.test(route)?'brand':/^\/categories\/[^/]+\/$/.test(route)?'category':/^\/compare\/[^/]+\/$/.test(route)?'compare':'other';
  const reasons=[];
  if(kind==='brand'){
    if(compact.length<1200)reasons.push('VISIBLE_TEXT_LT_1200');
    if(h2<6)reasons.push('H2_LT_6');
    if(numericFacts<12)reasons.push('NUMERIC_FACTS_LT_12');
    if(externalLinks<1)reasons.push('SOURCE_LINK_MISSING');
    if(!html.includes('data-v11-position="1"'))reasons.push('POSITION_SECTION_MISSING');
    if(!html.includes('data-v11-dataset'))reasons.push('DATASET_JSONLD_MISSING');
  }else if(kind==='category'){
    if(compact.length<900)reasons.push('VISIBLE_TEXT_LT_900');
    if(h2<3)reasons.push('H2_LT_3');
    if(numericFacts<10)reasons.push('NUMERIC_FACTS_LT_10');
    if(tables<1)reasons.push('TABLE_MISSING');
  }else if(kind==='compare'){
    if(compact.length<800)reasons.push('VISIBLE_TEXT_LT_800');
    if(h2<3)reasons.push('H2_LT_3');
    if(numericFacts<10)reasons.push('NUMERIC_FACTS_LT_10');
  }
  return {route,kind,visibleTextChars:compact.length,h2,tables,numericFacts,externalLinks,reasons};
}
function fileForRoute(route){if(route==='/')return path.join(out,'index.html');return path.join(out,...route.split('/').filter(Boolean),'index.html')}
const audits=[];
for(const route of previousCandidates){
  if(!/^\/(?:brands|categories|compare)\/[^/]+\/$/.test(route))continue;
  try{audits.push(auditHtml(route,await fs.readFile(fileForRoute(route),'utf8')))}catch{audits.push({route,kind:'missing',visibleTextChars:0,h2:0,tables:0,numericFacts:0,externalLinks:0,reasons:['HTML_MISSING']})}
}
const thinRiskCandidates=audits.filter(item=>item.reasons.length>0);
for(const item of thinRiskCandidates)candidateSet.delete(item.route);
const finalCandidates=[...candidateSet].sort();

const routeToBrand=new Map(matched.matches.map(hit=>[brandRoute(hit.brand),hit]));
const sentenceRows=[];
const sentenceFrequency=new Map();
for(const route of finalCandidates.filter(route=>/^\/brands\/[^/]+\/$/.test(route))){
  const hit=routeToBrand.get(route);if(!hit)continue;
  const html=await fs.readFile(fileForRoute(route),'utf8');
  const text=visibleText(html);
  const categoryName=catalog.categories?.[hit.brand.categorySlug]?.name||hit.brand.category||'';
  const sentences=text.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s.length>=24).map(sentence=>sentence.replaceAll(hit.brand.name,'{brand}').replaceAll(categoryName,'{category}').replace(/[+-]?\d[\d,.]*(?:%|만원|개|년|위)?/g,'{n}').replace(/\s+/g,' ').trim());
  const unique=[...new Set(sentences)];
  sentenceRows.push({route,name:hit.brand.name,sentences:unique});
  for(const sentence of unique)sentenceFrequency.set(sentence,(sentenceFrequency.get(sentence)||0)+1);
}
const uniqueness=sentenceRows.map(row=>{const total=row.sentences.length,uniqueCount=row.sentences.filter(sentence=>sentenceFrequency.get(sentence)===1).length;return {route:row.route,name:row.name,sentences:total,uniqueSentences:uniqueCount,uniqueSentenceRatio:total?Number((uniqueCount/total).toFixed(3)):0}});
const lowUniquenessBrands=uniqueness.filter(row=>row.uniqueSentenceRatio<0.15);

quality.indexPolicy={...(quality.indexPolicy||{}),productionCandidateUrls:finalCandidates};
quality.contentTrust={version:'11.11',generatedAt,policy:'INDEX_CANDIDATES_MUST_HAVE_SUBSTANTIVE_VISIBLE_DATA; BRAND_PAGES_ADD_DERIVED_CATEGORY_POSITION_AND_DATASET_JSONLD',previousCandidateCount:previousCandidates.length,productionCandidateCount:finalCandidates.length,removedThinRiskCandidates:thinRiskCandidates.length,enhancedBrandPages:enhancedRoutes.size,datasetCandidateBrandPages:datasetRoutes.size};
await fs.writeFile(qualityPath,JSON.stringify(quality,null,2),'utf8');

const htmlFiles=[];
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await walk(p);else if(p.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);
const routeForFile=file=>{const rel=path.relative(out,file).replace(/\\/g,'/');return rel==='index.html'?'/':normalizeRoute('/'+rel.replace(/\/index\.html$/,''))};
for(const file of htmlFiles){
  let html=await fs.readFile(file,'utf8');
  const route=routeForFile(file);
  const robots=PREVIEW?'noindex,nofollow,noarchive,nosnippet':(candidateSet.has(route)?'index,follow':'noindex,nofollow,noarchive,nosnippet');
  html=html.replace(/<meta name="robots" content="[^"]*">/,`<meta name="robots" content="${robots}">`).replace(/<meta name="googlebot" content="[^"]*">/,`<meta name="googlebot" content="${robots}">`).replace(/<meta name="bingbot" content="[^"]*">/,`<meta name="bingbot" content="${robots}">`);
  await fs.writeFile(file,html,'utf8');
}
const reviewDate=String(official.generatedAt||generatedAt).slice(0,10);
if(PREVIEW){
  await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n','utf8');
  await fs.writeFile(path.join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>','utf8');
}else{
  await fs.writeFile(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`,'utf8');
  const urls=finalCandidates.map(route=>`<url><loc>${SITE}${route==='/'?'':route}</loc><lastmod>${reviewDate}</lastmod></url>`).join('');
  await fs.writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,'utf8');
}

manifest.uiVersion='11.11';
manifest.v11_11={brandCategoryPosition:true,datasetJsonLd:true,contentDepthAudit:true,templateUniquenessAudit:true,enhancedBrandPages:enhancedRoutes.size,datasetCandidateBrandPages:datasetRoutes.size,thinRiskCandidates:thinRiskCandidates.length,lowUniquenessBrands:lowUniquenessBrands.length};
manifest.indexPolicy={...(manifest.indexPolicy||{}),productionCandidates:finalCandidates.length,productionCandidateUrls:finalCandidates};
manifest.environmentPolicy={...(manifest.environmentPolicy||{}),indexedHtml:PREVIEW?0:finalCandidates.length,noindexHtml:htmlFiles.length-(PREVIEW?0:finalCandidates.length),productionCandidateCount:finalCandidates.length,productionFailsIfCandidateNoindex:true};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

const finalCandidateBrandRoutes=finalCandidates.filter(route=>/^\/brands\/[^/]+\/$/.test(route));
const missingEnhancedCandidateBrands=finalCandidateBrandRoutes.filter(route=>!enhancedRoutes.has(route));
const missingDatasetCandidateBrands=finalCandidateBrandRoutes.filter(route=>!datasetRoutes.has(route));
const report={schemaVersion:1,generatedAt,uiVersion:'11.11',previewMode:PREVIEW,policy:'DERIVED_FACTS_ONLY; NO_SYNTHETIC_COPY; THIN_DATA_DETAIL_CANDIDATES_ARE_REMOVED_FROM_PRODUCTION_INDEX_SET',matchedBrands:matched.matches.length,enhancedBrandPages:enhancedRoutes.size,datasetCandidateBrandPages:datasetRoutes.size,previousCandidateCount:previousCandidates.length,productionCandidateCount:finalCandidates.length,removedThinRiskCandidates:thinRiskCandidates.map(x=>({route:x.route,kind:x.kind,reasons:x.reasons,visibleTextChars:x.visibleTextChars,h2:x.h2,tables:x.tables,numericFacts:x.numericFacts,externalLinks:x.externalLinks})),missingEnhancedCandidateBrands,missingDatasetCandidateBrands,contentAudits:audits,templateUniqueness:{candidateBrands:uniqueness.length,lowUniquenessThreshold:0.15,lowUniquenessBrands,brands:uniqueness},positionFindings,candidateUrls:finalCandidates};
await fs.writeFile(path.join(out,'v11-11-content-trust.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_11:'PASS',enhancedBrandPages:report.enhancedBrandPages,datasetCandidateBrandPages:report.datasetCandidateBrandPages,productionCandidates:report.productionCandidateCount,removedThinRiskCandidates:report.removedThinRiskCandidates.length,lowUniquenessBrands:report.templateUniqueness.lowUniquenessBrands.length},null,2));
