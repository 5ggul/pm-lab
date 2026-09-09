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
const matched=matchOfficialBrands(catalog.brands,official);
const baseline=JSON.parse(await fs.readFile(path.join(out,'v11-12-category-depth.json'),'utf8'));
const qualityPath=path.join(out,'v11-quality-report.json');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(qualityPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const baselineCandidates=(baseline.candidateUrls||[]).map(normalizeRoute);
const candidateSet=new Set(baselineCandidates);
const previousBrandCandidates=new Set(baselineCandidates.filter(isBrandRoute));

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const num=v=>finite(v)?Number(v):null;
function normalizeRoute(r){return r==='/'?'/':`/${String(r).replace(/^\/+|\/+$/g,'')}/`}
function isBrandRoute(route){return /^\/brands\/[^/]+\/$/.test(route)}
function cleanHistory(record){
  return sanitizeOfficialStoreHistory(record?.storeHistory||[])
    .filter(row=>finite(row?.year))
    .sort((a,b)=>Number(a.year)-Number(b.year));
}
function currentRow(record){
  const rows=cleanHistory(record);
  const ref=num(record?.referenceYear);
  return rows.find(row=>Number(row.year)===ref)||rows.at(-1)||null;
}
function sourceReady(record){return Boolean(record?.sourceUrl||record?.source?.statsUrl||record?.source?.costUrl||record?.source?.url)}
function costComponents(record){
  const c=record?.costComponents||{};
  return {
    franchiseFee10k:num(c.franchiseFee10k??record?.startupFee10k),
    education10k:num(c.education10k??record?.startupEducation10k),
    deposit10k:num(c.deposit10k??record?.startupDeposit10k),
    etc10k:num(c.etc10k??record?.startupEtc10k)
  };
}
function brandMetrics(hit){
  const record=hit.record||{};
  const row=currentRow(record);
  return {
    cost:num(record.startupCost10k),
    stores:num(record.stores??row?.stores),
    sales:num(record.averageSales10k??row?.averageSales10k)
  };
}
function latestOpenClose(record){
  const row=currentRow(record)||{};
  const oc=record?.openClose||{};
  return {
    newStores:num(record?.newStores??oc.newStores??row.newStores),
    ended:num(record?.contractEnd??oc.ended??row.contractEnd??row.ended),
    cancelled:num(record?.contractCancel??oc.cancelled??row.contractCancel??row.cancelled)
  };
}
function brandRoute(hit){return normalizeRoute(`/brands/${brandSlugFor(hit.brand.name,hit.brand.slug)}/`)}
function eligibility(hit){
  const record=hit.record||{};
  const reasons=[];
  if(!sourceReady(record))reasons.push('SOURCE_MISSING');
  if(!num(record.referenceYear))reasons.push('REFERENCE_YEAR_MISSING');
  const metrics=brandMetrics(hit);
  if(metrics.cost===null)reasons.push('COST_MISSING');
  if(metrics.stores===null)reasons.push('STORES_MISSING');
  if(metrics.sales===null)reasons.push('SALES_MISSING');
  const components=costComponents(record);
  if(Object.values(components).some(v=>v===null))reasons.push('COST_COMPONENTS_INCOMPLETE');
  const history=cleanHistory(record).filter(row=>finite(row?.stores));
  if(history.length<3)reasons.push('STORE_HISTORY_LT_3');
  const oc=latestOpenClose(record);
  if(Object.values(oc).some(v=>v===null))reasons.push('OPEN_CLOSE_INCOMPLETE');
  return {name:hit.brand.name,route:brandRoute(hit),eligible:reasons.length===0,reasons,method:hit.method,historyYears:history.map(row=>Number(row.year)),componentCount:Object.values(components).filter(v=>v!==null).length,metrics,openClose:oc};
}

const eligibilityRows=matched.matches.map(eligibility);
for(const row of eligibilityRows){if(row.eligible)candidateSet.add(row.route);else candidateSet.delete(row.route)}

const byCategory=new Map();
for(const hit of matched.matches){const slug=hit.brand.categorySlug||'unknown';const list=byCategory.get(slug)||[];list.push(hit);byCategory.set(slug,list)}
function rankMetric(items,targetName,key,direction='desc'){
  const rows=items.map(hit=>({name:hit.brand.name,value:brandMetrics(hit)[key]})).filter(row=>row.value!==null);
  rows.sort((a,b)=>direction==='asc'?(a.value-b.value||a.name.localeCompare(b.name,'ko')):(b.value-a.value||a.name.localeCompare(b.name,'ko')));
  let rank=0,last=null;
  for(let i=0;i<rows.length;i++){if(i===0||rows[i].value!==last)rank=i+1;rows[i].rank=rank;last=rows[i].value}
  const target=rows.find(row=>row.name===targetName);
  return target?{rank:target.rank,total:rows.length,value:target.value}:null;
}
function datasetFor(hit,route){
  const record=hit.record||{};
  const metrics=brandMetrics(hit);
  const history=cleanHistory(record).filter(row=>finite(row?.stores));
  const years=history.map(row=>Number(row.year)).filter(Number.isFinite);
  const categoryHits=byCategory.get(hit.brand.categorySlug)||[];
  const categoryName=catalog.categories?.[hit.brand.categorySlug]?.name||hit.brand.category||'같은 업종';
  const costRank=rankMetric(categoryHits,hit.brand.name,'cost','asc');
  const storesRank=rankMetric(categoryHits,hit.brand.name,'stores','desc');
  const salesRank=rankMetric(categoryHits,hit.brand.name,'sales','desc');
  const variables=[];
  if(metrics.cost!==null)variables.push({'@type':'PropertyValue',name:'공개 창업비용',value:metrics.cost,unitText:'만원'});
  if(metrics.stores!==null)variables.push({'@type':'PropertyValue',name:'가맹점 수',value:metrics.stores,unitText:'개'});
  if(metrics.sales!==null)variables.push({'@type':'PropertyValue',name:'평균매출 공개지표',value:metrics.sales,unitText:'만원'});
  if(costRank)variables.push({'@type':'PropertyValue',name:`${categoryName} 창업비용 낮은 순 위치`,value:costRank.rank,unitText:`${costRank.total}개 브랜드 중 순위`});
  if(storesRank)variables.push({'@type':'PropertyValue',name:`${categoryName} 가맹점 수 많은 순 위치`,value:storesRank.rank,unitText:`${storesRank.total}개 브랜드 중 순위`});
  if(salesRank)variables.push({'@type':'PropertyValue',name:`${categoryName} 평균매출 공개지표 높은 순 위치`,value:salesRank.rank,unitText:`${salesRank.total}개 브랜드 중 순위`});
  const minYear=years.length?Math.min(...years):num(record.referenceYear);
  const maxYear=years.length?Math.max(...years):num(record.referenceYear);
  return {'@context':'https://schema.org','@type':'Dataset','@id':`${SITE}${route}#dataset`,name:`${hit.brand.name} 창업비용·가맹점 공개 데이터`,description:`${hit.brand.name}의 공정위 공개 창업비용, 가맹점 수, 평균매출 공개지표와 ${categoryName} 업종 내 비교 위치를 정리한 데이터입니다.`,url:`${SITE}${route}`,dateModified:String(official.generatedAt||generatedAt).slice(0,10),...(minYear&&maxYear?{temporalCoverage:`${minYear}/${maxYear}`}:{ }),creator:{'@type':'Organization',name:'창업데이터랩',url:SITE},isBasedOn:[FTC_COST_SOURCE,FTC_STORE_SOURCE],measurementTechnique:'공정거래위원회 공개자료 정규화 및 동일 카탈로그 업종 내 비교',variableMeasured:variables};
}
function safeJson(value){return JSON.stringify(value).replace(/</g,'\\u003c')}
function fileForRoute(route){return path.join(out,...route.split('/').filter(Boolean),'index.html')}
const datasetCandidateRoutes=[];
for(const hit of matched.matches){
  const route=brandRoute(hit);
  const file=fileForRoute(route);
  let html=await fs.readFile(file,'utf8');
  html=html.replace(/<script type="application\/ld\+json" data-v11-dataset>[\s\S]*?<\/script>/,'');
  if(candidateSet.has(route)){
    html=html.replace('</head>',`<script type="application/ld+json" data-v11-dataset>${safeJson(datasetFor(hit,route))}</script></head>`);
    datasetCandidateRoutes.push(route);
  }
  await fs.writeFile(file,html,'utf8');
}

function decodeEntities(text){return text.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")}
function visibleText(html){return decodeEntities(html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<svg\b[\s\S]*?<\/svg>/gi,' ').replace(/<\/(?:p|h1|h2|h3|li|tr|dd|dt|details|section)>/gi,'. ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}
function auditBrand(route,html){
  const text=visibleText(html),compact=text.replace(/\s/g,'');
  const h2=(html.match(/<h2\b/gi)||[]).length;
  const tables=(html.match(/<table\b/gi)||[]).length;
  const numericFacts=(text.match(/[+-]?\d[\d,]*(?:\.\d+)?\s*(?:만원|개|%|년|위)/g)||[]).length;
  const externalLinks=(html.match(/href="https?:\/\/[^\"]+"/g)||[]).length;
  const reasons=[];
  if(compact.length<1200)reasons.push('VISIBLE_TEXT_LT_1200');
  if(h2<6)reasons.push('H2_LT_6');
  if(numericFacts<12)reasons.push('NUMERIC_FACTS_LT_12');
  if(externalLinks<1)reasons.push('SOURCE_LINK_MISSING');
  if(tables<2)reasons.push('TABLES_LT_2');
  if(!html.includes('data-v11-position="1"'))reasons.push('POSITION_SECTION_MISSING');
  if(!html.includes('data-v11-dataset'))reasons.push('DATASET_JSONLD_MISSING');
  return {route,visibleTextChars:compact.length,h2,tables,numericFacts,externalLinks,reasons};
}
const brandAudits=[];
for(const route of [...candidateSet].filter(isBrandRoute)){
  try{brandAudits.push(auditBrand(route,await fs.readFile(fileForRoute(route),'utf8')))}catch{brandAudits.push({route,reasons:['HTML_MISSING']})}
}
const remainingCandidateBrandRisks=brandAudits.filter(row=>row.reasons.length>0);
for(const row of remainingCandidateBrandRisks)candidateSet.delete(row.route);
for(const row of remainingCandidateBrandRisks){
  const file=fileForRoute(row.route);
  try{let html=await fs.readFile(file,'utf8');html=html.replace(/<script type="application\/ld\+json" data-v11-dataset>[\s\S]*?<\/script>/,'');await fs.writeFile(file,html,'utf8')}catch{}
}

const finalCandidates=[...candidateSet].sort();
const finalBrandCandidates=finalCandidates.filter(isBrandRoute);
const addedBrandRoutes=finalBrandCandidates.filter(route=>!previousBrandCandidates.has(route));
const removedBrandRoutes=[...previousBrandCandidates].filter(route=>!candidateSet.has(route));
const missingDatasetCandidateBrands=[];
for(const route of finalBrandCandidates){const html=await fs.readFile(fileForRoute(route),'utf8');if(!html.includes('data-v11-dataset'))missingDatasetCandidateBrands.push(route)}

quality.indexPolicy={...(quality.indexPolicy||{}),productionCandidateUrls:finalCandidates};
quality.contentTrust={...(quality.contentTrust||{}),version:'11.13',generatedAt,allOfficialMatchedBrandGate:true,officialMatchedBrands:matched.matches.length,dataEligibleBrands:eligibilityRows.filter(row=>row.eligible).length,productionBrandCandidates:finalBrandCandidates.length,addedBrandCandidates:addedBrandRoutes.length,remainingCandidateBrandRisks:remainingCandidateBrandRisks.length};
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

const reasonCounts={};
for(const row of eligibilityRows.filter(row=>!row.eligible))for(const reason of row.reasons)reasonCounts[reason]=(reasonCounts[reason]||0)+1;
manifest.uiVersion='11.13';
manifest.v11_13={allOfficialMatchedBrandGate:true,officialMatchedBrands:matched.matches.length,dataEligibleBrands:eligibilityRows.filter(row=>row.eligible).length,previousBrandCandidates:previousBrandCandidates.size,productionBrandCandidates:finalBrandCandidates.length,addedBrandCandidates:addedBrandRoutes.length,removedBrandCandidates:removedBrandRoutes.length,remainingCandidateBrandRisks:remainingCandidateBrandRisks.length};
manifest.indexPolicy={...(manifest.indexPolicy||{}),brandCandidates:finalBrandCandidates.length,productionCandidates:finalCandidates.length,productionCandidateUrls:finalCandidates};
manifest.environmentPolicy={...(manifest.environmentPolicy||{}),indexedHtml:PREVIEW?0:finalCandidates.length,noindexHtml:htmlFiles.length-(PREVIEW?0:finalCandidates.length),productionCandidateCount:finalCandidates.length,productionFailsIfCandidateNoindex:true};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

const report={schemaVersion:1,generatedAt,uiVersion:'11.13',previewMode:PREVIEW,policy:'ALL_149_OFFICIAL_MATCHED_BRANDS_USE_THE_SAME_DATA_AND_VISIBLE_CONTENT_GATE_BEFORE_PRODUCTION_INDEX_CANDIDACY',officialMatchedBrands:matched.matches.length,previousCandidateCount:baselineCandidates.length,productionCandidateCount:finalCandidates.length,previousBrandCandidates:previousBrandCandidates.size,dataEligibleBrands:eligibilityRows.filter(row=>row.eligible).length,productionBrandCandidates:finalBrandCandidates.length,addedBrandRoutes,removedBrandRoutes,missingDatasetCandidateBrands,remainingCandidateBrandRisks,reasonCounts,eligibility:eligibilityRows,brandAudits,candidateUrls:finalCandidates};
await fs.writeFile(path.join(out,'v11-13-brand-expansion.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_13:'PASS',officialMatchedBrands:report.officialMatchedBrands,dataEligibleBrands:report.dataEligibleBrands,productionBrandCandidates:report.productionBrandCandidates,addedBrandCandidates:report.addedBrandRoutes.length,productionCandidates:report.productionCandidateCount,remainingCandidateBrandRisks:report.remainingCandidateBrandRisks.length},null,2));
