import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const SITE=(process.env.SSG_SITE_URL??'https://5ggul.github.io/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const FTC_COST_SOURCE='https://www.data.go.kr/data/15110265/openapi.do';
const FTC_STORE_SOURCE='https://www.data.go.kr/data/15110241/openapi.do';
const generatedAt=new Date().toISOString();
const report13=JSON.parse(await fs.readFile(path.join(out,'v11-13-brand-expansion.json'),'utf8'));
const official=JSON.parse(await fs.readFile(path.join(repo,'data/franchise/official/brands-2025.json'),'utf8'));
const qualityPath=path.join(out,'v11-quality-report.json');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(qualityPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const candidateSet=new Set((report13.candidateUrls||[]).map(normalizeRoute));
const previousBrandCandidates=new Set((report13.candidateUrls||[]).map(normalizeRoute).filter(isBrandRoute));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
function normalizeRoute(r){return r==='/'?'/':`/${String(r).replace(/^\/+|\/+$/g,'')}/`}
function isBrandRoute(route){return /^\/brands\/[^/]+\/$/.test(route)}
function fileForRoute(route){return path.join(out,...route.split('/').filter(Boolean),'index.html')}
function isTierB(row){
  const years=(row.historyYears||[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  return row?.eligible===false&&Array.isArray(row.reasons)&&row.reasons.length===1&&row.reasons[0]==='STORE_HISTORY_LT_3'&&years.length===2&&years[1]-years[0]===1&&row.componentCount===4&&Object.values(row.metrics||{}).every(finite)&&Object.values(row.openClose||{}).every(finite);
}
const tierA=(report13.eligibility||[]).filter(row=>row.eligible===true);
const tierB=(report13.eligibility||[]).filter(isTierB);
const tierC=(report13.eligibility||[]).filter(row=>!row.eligible&&!isTierB(row));
for(const row of tierB)candidateSet.add(normalizeRoute(row.route));

function safeJson(value){return JSON.stringify(value).replace(/</g,'\\u003c')}
function datasetFor(row){
  const years=row.historyYears.map(Number).sort((a,b)=>a-b);
  const m=row.metrics||{},oc=row.openClose||{};
  return {'@context':'https://schema.org','@type':'Dataset','@id':`${SITE}${row.route}#dataset`,name:`${row.name} 창업비용·가맹점 공개 데이터`,description:`${row.name}의 공정위 공개 창업비용, 가맹점 수, 평균매출 공개지표와 실제 값으로 확인되는 연속 ${years.length}개 기준년도 점포 이력을 정리한 데이터입니다.`,url:`${SITE}${row.route}`,dateModified:String(official.generatedAt||generatedAt).slice(0,10),temporalCoverage:`${years[0]}/${years.at(-1)}`,creator:{'@type':'Organization',name:'창업데이터랩',url:SITE},isBasedOn:[FTC_COST_SOURCE,FTC_STORE_SOURCE],measurementTechnique:'공정거래위원회 공개자료 정규화; 전 항목 0으로 채워진 빈 점포 이력은 실제 0으로 단정하지 않고 제외',variableMeasured:[{'@type':'PropertyValue',name:'공개 창업비용',value:Number(m.cost),unitText:'만원'},{'@type':'PropertyValue',name:'가맹점 수',value:Number(m.stores),unitText:'개'},{'@type':'PropertyValue',name:'평균매출 공개지표',value:Number(m.sales),unitText:'만원'},{'@type':'PropertyValue',name:'신규점',value:Number(oc.newStores),unitText:'개'},{'@type':'PropertyValue',name:'계약종료',value:Number(oc.ended),unitText:'개'},{'@type':'PropertyValue',name:'계약해지',value:Number(oc.cancelled),unitText:'개'}]};
}

const tierBPatched=[];
for(const row of tierB){
  const route=normalizeRoute(row.route);
  const file=fileForRoute(route);
  let html=await fs.readFile(file,'utf8');
  html=html.replace(/<script type="application\/ld\+json" data-v11-dataset>[\s\S]*?<\/script>/,'');
  html=html.replace(/\sdata-v11-history-tier="[AB]"/,'');
  html=html.replace('<main id="main"', '<main id="main" data-v11-history-tier="B"');
  const note='<p class="history-coverage-note" data-v11-tier-b-note="1"><strong>점포 이력 범위</strong> 공정위 공개자료에서 실제 값으로 확인되는 연속 2개 기준년도만 사용합니다. 점포·신규·종료·해지 값이 모두 0으로 채워진 빈 이력은 실제 0으로 단정하지 않고 제외합니다.</p>';
  if(!html.includes('data-v11-tier-b-note="1"'))html=html.replace('<div class="source-box">',`<div class="source-box">${note}`);
  html=html.replace('</head>',`<script type="application/ld+json" data-v11-dataset>${safeJson(datasetFor(row))}</script></head>`);
  await fs.writeFile(file,html,'utf8');
  tierBPatched.push(route);
}

for(const row of tierA){
  const route=normalizeRoute(row.route);if(!candidateSet.has(route))continue;
  const file=fileForRoute(route);
  let html=await fs.readFile(file,'utf8');
  html=html.replace(/\sdata-v11-history-tier="[AB]"/,'');
  html=html.replace('<main id="main"','<main id="main" data-v11-history-tier="A"');
  await fs.writeFile(file,html,'utf8');
}

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
if(!css.includes('/* v11.14 history tiers */')){
  css+=`\n/* v11.14 history tiers */\n.history-coverage-note{margin:0 0 12px;padding:10px 12px;border-left:3px solid #8B847C;background:#F6F3ED;line-height:1.65}.history-coverage-note strong{margin-right:6px}\n`;
  await fs.writeFile(cssPath,css,'utf8');
}

function decodeEntities(text){return text.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")}
function visibleText(html){return decodeEntities(html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<svg\b[\s\S]*?<\/svg>/gi,' ').replace(/<\/(?:p|h1|h2|h3|li|tr|dd|dt|details|section)>/gi,'. ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}
function auditBrand(route,html,tier){const text=visibleText(html),compact=text.replace(/\s/g,'');const h2=(html.match(/<h2\b/gi)||[]).length,tables=(html.match(/<table\b/gi)||[]).length,numericFacts=(text.match(/[+-]?\d[\d,]*(?:\.\d+)?\s*(?:만원|개|%|년|위)/g)||[]).length,externalLinks=(html.match(/href="https?:\/\/[^\"]+"/g)||[]).length;const reasons=[];if(compact.length<1200)reasons.push('VISIBLE_TEXT_LT_1200');if(h2<6)reasons.push('H2_LT_6');if(numericFacts<12)reasons.push('NUMERIC_FACTS_LT_12');if(externalLinks<1)reasons.push('SOURCE_LINK_MISSING');if(tables<2)reasons.push('TABLES_LT_2');if(!html.includes('data-v11-position="1"'))reasons.push('POSITION_SECTION_MISSING');if(!html.includes('data-v11-dataset'))reasons.push('DATASET_JSONLD_MISSING');if(tier==='B'&&!html.includes('data-v11-tier-b-note="1"'))reasons.push('TIER_B_DISCLOSURE_MISSING');return {route,tier,visibleTextChars:compact.length,h2,tables,numericFacts,externalLinks,reasons}}
const tierByRoute=new Map([...tierA.map(row=>[normalizeRoute(row.route),'A']),...tierB.map(row=>[normalizeRoute(row.route),'B'])]);
const brandAudits=[];
for(const route of [...candidateSet].filter(isBrandRoute)){try{brandAudits.push(auditBrand(route,await fs.readFile(fileForRoute(route),'utf8'),tierByRoute.get(route)||null))}catch{brandAudits.push({route,tier:tierByRoute.get(route)||null,reasons:['HTML_MISSING']})}}
const remainingBrandRisks=brandAudits.filter(row=>row.reasons.length);
for(const row of remainingBrandRisks)candidateSet.delete(row.route);
const finalCandidates=[...candidateSet].sort();
const finalBrandCandidates=finalCandidates.filter(isBrandRoute);
const addedTierBRoutes=tierBPatched.filter(route=>candidateSet.has(route)&&!previousBrandCandidates.has(route));
const missingDatasetCandidateBrands=[];for(const route of finalBrandCandidates){const html=await fs.readFile(fileForRoute(route),'utf8');if(!html.includes('data-v11-dataset'))missingDatasetCandidateBrands.push(route)}

quality.indexPolicy={...(quality.indexPolicy||{}),productionCandidateUrls:finalCandidates};
quality.contentTrust={...(quality.contentTrust||{}),version:'11.14',generatedAt,historyTierPolicy:true,tierABrands:tierA.length,tierBBrands:addedTierBRoutes.length,tierCBrands:tierC.length,productionBrandCandidates:finalBrandCandidates.length,remainingBrandRisks:remainingBrandRisks.length};
await fs.writeFile(qualityPath,JSON.stringify(quality,null,2),'utf8');

const htmlFiles=[];async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await walk(p);else if(p.endsWith('.html'))htmlFiles.push(p)}}await walk(out);const routeForFile=file=>{const rel=path.relative(out,file).replace(/\\/g,'/');return rel==='index.html'?'/':normalizeRoute('/'+rel.replace(/\/index\.html$/,''))};for(const file of htmlFiles){let html=await fs.readFile(file,'utf8');const route=routeForFile(file),robots=PREVIEW?'noindex,nofollow,noarchive,nosnippet':(candidateSet.has(route)?'index,follow':'noindex,nofollow,noarchive,nosnippet');html=html.replace(/<meta name="robots" content="[^"]*">/,`<meta name="robots" content="${robots}">`).replace(/<meta name="googlebot" content="[^"]*">/,`<meta name="googlebot" content="${robots}">`).replace(/<meta name="bingbot" content="[^"]*">/,`<meta name="bingbot" content="${robots}">`);await fs.writeFile(file,html,'utf8')}
const reviewDate=String(official.generatedAt||generatedAt).slice(0,10);if(PREVIEW){await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n','utf8');await fs.writeFile(path.join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>','utf8')}else{await fs.writeFile(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`,'utf8');const urls=finalCandidates.map(route=>`<url><loc>${SITE}${route==='/'?'':route}</loc><lastmod>${reviewDate}</lastmod></url>`).join('');await fs.writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,'utf8')}

manifest.uiVersion='11.14';manifest.v11_14={historyTierPolicy:true,tierARequirement:'SANITIZED_HISTORY_GTE_3',tierBRequirement:'CONSECUTIVE_SANITIZED_HISTORY_EQ_2_PLUS_ALL_OTHER_DATA_GATES',tierABrands:tierA.length,tierBBrands:addedTierBRoutes.length,tierCBrands:tierC.length,productionBrandCandidates:finalBrandCandidates.length,remainingBrandRisks:remainingBrandRisks.length};manifest.indexPolicy={...(manifest.indexPolicy||{}),brandCandidates:finalBrandCandidates.length,productionCandidates:finalCandidates.length,productionCandidateUrls:finalCandidates};manifest.environmentPolicy={...(manifest.environmentPolicy||{}),indexedHtml:PREVIEW?0:finalCandidates.length,noindexHtml:htmlFiles.length-(PREVIEW?0:finalCandidates.length),productionCandidateCount:finalCandidates.length,productionFailsIfCandidateNoindex:true};await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');
const report={schemaVersion:1,generatedAt,uiVersion:'11.14',previewMode:PREVIEW,policy:'TIER_A_SANITIZED_HISTORY_GTE_3; TIER_B_EXACTLY_2_CONSECUTIVE_SANITIZED_YEARS_WITH_ALL_OTHER_DATA_AND_CONTENT_GATES; TIER_C_REMAINS_NOINDEX',previousCandidateCount:report13.productionCandidateCount,productionCandidateCount:finalCandidates.length,previousBrandCandidates:report13.productionBrandCandidates,tierABrands:tierA.length,tierBEligible:tierB.length,tierBProduction:addedTierBRoutes.length,tierCBrands:tierC.length,productionBrandCandidates:finalBrandCandidates.length,addedTierBRoutes,remainingBrandRisks,missingDatasetCandidateBrands,tierC,tierBAudit:brandAudits.filter(row=>row.tier==='B'),candidateUrls:finalCandidates};await fs.writeFile(path.join(out,'v11-14-history-tiers.json'),JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify({v11_14:'PASS',tierA:report.tierABrands,tierBEligible:report.tierBEligible,tierBProduction:report.tierBProduction,tierC:report.tierCBrands,productionBrandCandidates:report.productionBrandCandidates,productionCandidates:report.productionCandidateCount,remainingBrandRisks:report.remainingBrandRisks.length},null,2));
