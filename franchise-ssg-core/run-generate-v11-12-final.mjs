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

async function loadClassic(file,expr){const code=await fs.readFile(file,'utf8');const ctx={console};vm.createContext(ctx);vm.runInContext(`${code}\n;globalThis.__EXPORT__=${expr};`,ctx);return ctx.__EXPORT__}
const catalog=await loadClassic(path.join(repo,'docs/franchise-data-preview/data-final.js'),'{categories,brands}');
const official=JSON.parse(await fs.readFile(path.join(repo,'data/franchise/official/brands-2025.json'),'utf8'));
const matched=matchOfficialBrands(catalog.brands,official);
const qualityPath=path.join(out,'v11-quality-report.json');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(qualityPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const baseline=JSON.parse(await fs.readFile(path.join(out,'v11-8-index-trust.json'),'utf8'));
const baselineCandidates=(baseline.candidateUrls||[]).map(normalizeRoute);
const baselineSet=new Set(baselineCandidates);
const candidateSet=new Set(baselineCandidates);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const num=v=>finite(v)?Number(v):null;
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=n=>finite(n)?Number(n).toLocaleString('ko-KR'):'정보 없음';
const won=n=>finite(n)?`${Math.round(Number(n)).toLocaleString('ko-KR')}만원`:'정보 없음';
function normalizeRoute(r){return r==='/'?'/':`/${String(r).replace(/^\/+|\/+$/g,'')}/`}
function cleanHistory(record){return sanitizeOfficialStoreHistory(record?.storeHistory||[]).filter(row=>finite(row?.year)).sort((a,b)=>Number(a.year)-Number(b.year))}
function currentStores(record){const history=cleanHistory(record);const ref=num(record?.referenceYear);const current=history.find(row=>Number(row.year)===ref)||history.at(-1)||null;return num(current?.stores??record?.stores)}
function averageSales(record){const history=cleanHistory(record);const ref=num(record?.referenceYear);const current=history.find(row=>Number(row.year)===ref)||history.at(-1)||null;return num(record?.averageSales10k??current?.averageSales10k)}
function brandRoute(hit){return normalizeRoute(`/brands/${brandSlugFor(hit.brand.name,hit.brand.slug)}/`)}
function extreme(rows,key,dir){const values=rows.map(hit=>({hit,value:key==='cost'?num(hit.record?.startupCost10k):key==='stores'?currentStores(hit.record):averageSales(hit.record)})).filter(x=>x.value!==null);values.sort((a,b)=>dir==='min'?a.value-b.value:b.value-a.value);return values[0]||null}
function valueRange(rows,key){const values=rows.map(hit=>key==='cost'?num(hit.record?.startupCost10k):key==='stores'?currentStores(hit.record):averageSales(hit.record)).filter(v=>v!==null).sort((a,b)=>a-b);return values.length?{min:values[0],max:values.at(-1),count:values.length}:null}
function metricRow(label,item,unit,note){if(!item)return '';const href=`/pm-lab/franchise-ssg-preview${brandRoute(item.hit)}`;return `<tr><td data-label="비교 항목">${esc(label)}</td><td data-label="브랜드"><a href="${esc(href)}">${esc(item.hit.brand.name)}</a></td><td data-label="공개값" class="num">${fmt(item.value)}${unit}</td><td data-label="해석">${esc(note)}</td></tr>`}
function categorySection(slug,rows){
  const label=catalog.categories?.[slug]?.name||slug;
  const lowCost=extreme(rows,'cost','min'),highCost=extreme(rows,'cost','max'),maxStores=extreme(rows,'stores','max'),maxSales=extreme(rows,'sales','max');
  const costRange=valueRange(rows,'cost'),storeRange=valueRange(rows,'stores'),salesRange=valueRange(rows,'sales');
  if(!costRange||!storeRange)return null;
  const table=[metricRow('공개 창업비용 최저',lowCost,'만원','비용이 낮다는 사실만으로 추천을 뜻하지 않음'),metricRow('공개 창업비용 최고',highCost,'만원','점포 면적·포함 항목 차이를 원문에서 확인'),metricRow('가맹점 수 최대',maxStores,'개','브랜드 규모 지표이며 개별 점포 수익과 다름'),metricRow('평균매출 공개지표 최대',maxSales,'만원','매출 공개값이며 순이익이 아님')].join('');
  const salesText=salesRange?` 평균매출 공개지표는 ${won(salesRange.min)}~${won(salesRange.max)} 범위입니다.`:'';
  return {html:`<section class="block category-range" id="range" data-v11-category-range="1"><h2>${esc(label)} 업종의 비용·규모 범위는 어느 정도인가요?</h2><p>카탈로그 안에서 공정위 공식 레코드가 매칭되고 해당 지표가 확인되는 브랜드를 같은 기준으로 비교합니다. 아래 극단값은 추천·수익성 순위가 아니라 표본의 범위를 확인하기 위한 값입니다.</p><div class="table-scroll"><table class="data-table stack-mobile range-table"><thead><tr><th>비교 항목</th><th>브랜드</th><th class="num">공개값</th><th>해석</th></tr></thead><tbody>${table}</tbody></table></div><p class="range-summary">공개 창업비용은 ${won(costRange.min)}~${won(costRange.max)}, 가맹점 수는 ${fmt(storeRange.min)}개~${fmt(storeRange.max)}개 범위입니다.${salesText}</p><div class="chart-legend">브랜드별 공개합계의 포함 항목·면적 기준이 다를 수 있으므로 실제 계약 판단 전 정보공개서 원문과 가맹본부 최신 안내를 함께 확인해야 합니다.</div></section>`,label,lowCost,highCost,maxStores,maxSales,costRange,storeRange,salesRange};
}
function safeJson(v){return JSON.stringify(v).replace(/</g,'\\u003c')}
function categoryDataset(slug,section,route,rows){const variables=[{'@type':'PropertyValue',name:'공식 매칭 비교 표본',value:rows.length,unitText:'개 브랜드'},{'@type':'PropertyValue',name:'공개 창업비용 최저',value:section.costRange.min,unitText:'만원'},{'@type':'PropertyValue',name:'공개 창업비용 최고',value:section.costRange.max,unitText:'만원'},{'@type':'PropertyValue',name:'가맹점 수 최소',value:section.storeRange.min,unitText:'개'},{'@type':'PropertyValue',name:'가맹점 수 최대',value:section.storeRange.max,unitText:'개'}];if(section.salesRange){variables.push({'@type':'PropertyValue',name:'평균매출 공개지표 최저',value:section.salesRange.min,unitText:'만원'},{'@type':'PropertyValue',name:'평균매출 공개지표 최고',value:section.salesRange.max,unitText:'만원'})}return {'@context':'https://schema.org','@type':'Dataset','@id':`${SITE}${route}#dataset`,name:`${section.label} 프랜차이즈 창업비용·가맹점 비교 데이터`,description:`${section.label} 공식 매칭 브랜드의 창업비용, 가맹점 수, 평균매출 공개지표 범위를 비교한 데이터입니다.`,url:`${SITE}${route}`,dateModified:String(official.generatedAt||generatedAt).slice(0,10),creator:{'@type':'Organization',name:'창업데이터랩',url:SITE},isBasedOn:[FTC_COST_SOURCE,FTC_STORE_SOURCE],measurementTechnique:'공정거래위원회 공개자료 정규화 및 동일 카탈로그 업종 비교',variableMeasured:variables}}

const byCategory=new Map();
for(const hit of matched.matches){const slug=hit.brand.categorySlug;const list=byCategory.get(slug)||[];list.push(hit);byCategory.set(slug,list)}
const enhanced=[];const datasetRoutes=[];
for(const [slug,rows] of byCategory){
  if(rows.length<5)continue;
  const route=normalizeRoute(`/categories/${slug}/`);
  const file=path.join(out,'categories',slug,'index.html');
  const section=categorySection(slug,rows);if(!section)continue;
  let html=await fs.readFile(file,'utf8');
  html=html.replace(/<section class="block category-range" id="range"[\s\S]*?<\/section>/,'').replace(/<script type="application\/ld\+json" data-v11-category-dataset>[\s\S]*?<\/script>/,'');
  const close=html.lastIndexOf('</div></main>');
  if(close<0)continue;
  html=html.slice(0,close)+section.html+html.slice(close);
  if(baselineSet.has(route)){html=html.replace('</head>',`<script type="application/ld+json" data-v11-category-dataset>${safeJson(categoryDataset(slug,section,route,rows))}</script></head>`);datasetRoutes.push(route)}
  await fs.writeFile(file,html,'utf8');
  enhanced.push({slug,route,label:section.label,sample:rows.length,costMin:section.costRange.min,costMax:section.costRange.max,storesMin:section.storeRange.min,storesMax:section.storeRange.max});
}

const cssPath=path.join(out,'assets/site.css');let css=await fs.readFile(cssPath,'utf8');if(!css.includes('/* v11.12 category depth */')){css+=`\n/* v11.12 category depth */\n.category-range .range-table{margin-top:16px}.category-range .range-summary{margin:14px 0 0;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-weight:700;line-height:1.7}.category-range td:last-child{max-width:320px}@media(max-width:720px){.category-range .range-summary{font-size:14px}.category-range td:last-child{max-width:none}}\n`;await fs.writeFile(cssPath,css,'utf8')}

function decodeEntities(text){return text.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")}
function visibleText(html){return decodeEntities(html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<svg\b[\s\S]*?<\/svg>/gi,' ').replace(/<\/(?:p|h1|h2|h3|li|tr|dd|dt|details|section)>/gi,'. ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}
function auditHtml(route,html){const text=visibleText(html),compact=text.replace(/\s/g,'');const h2=(html.match(/<h2\b/gi)||[]).length,tables=(html.match(/<table\b/gi)||[]).length,numericFacts=(text.match(/[+-]?\d[\d,]*(?:\.\d+)?\s*(?:만원|개|%|년|위)/g)||[]).length,externalLinks=(html.match(/href="https?:\/\/[^\"]+"/g)||[]).length;const kind=/^\/brands\/[^/]+\/$/.test(route)?'brand':/^\/categories\/[^/]+\/$/.test(route)?'category':/^\/compare\/[^/]+\/$/.test(route)?'compare':'other';const reasons=[];if(kind==='brand'){if(compact.length<1200)reasons.push('VISIBLE_TEXT_LT_1200');if(h2<6)reasons.push('H2_LT_6');if(numericFacts<12)reasons.push('NUMERIC_FACTS_LT_12');if(externalLinks<1)reasons.push('SOURCE_LINK_MISSING');if(!html.includes('data-v11-position="1"'))reasons.push('POSITION_SECTION_MISSING');if(!html.includes('data-v11-dataset'))reasons.push('DATASET_JSONLD_MISSING')}else if(kind==='category'){if(compact.length<900)reasons.push('VISIBLE_TEXT_LT_900');if(h2<3)reasons.push('H2_LT_3');if(numericFacts<10)reasons.push('NUMERIC_FACTS_LT_10');if(tables<1)reasons.push('TABLE_MISSING');if(!html.includes('data-v11-category-range="1"'))reasons.push('RANGE_SECTION_MISSING');if(!html.includes('data-v11-category-dataset'))reasons.push('CATEGORY_DATASET_JSONLD_MISSING')}else if(kind==='compare'){if(compact.length<800)reasons.push('VISIBLE_TEXT_LT_800');if(h2<3)reasons.push('H2_LT_3');if(numericFacts<10)reasons.push('NUMERIC_FACTS_LT_10')}return {route,kind,visibleTextChars:compact.length,h2,tables,numericFacts,externalLinks,reasons}}
function fileForRoute(route){if(route==='/')return path.join(out,'index.html');return path.join(out,...route.split('/').filter(Boolean),'index.html')}
const audits=[];for(const route of baselineCandidates){if(!/^\/(?:brands|categories|compare)\/[^/]+\/$/.test(route))continue;try{audits.push(auditHtml(route,await fs.readFile(fileForRoute(route),'utf8')))}catch{audits.push({route,kind:'missing',reasons:['HTML_MISSING']})}}
const remainingThinRisks=audits.filter(x=>x.reasons?.length);for(const item of remainingThinRisks)candidateSet.delete(item.route);const finalCandidates=[...candidateSet].sort();

quality.indexPolicy={...(quality.indexPolicy||{}),productionCandidateUrls:finalCandidates};quality.contentTrust={...(quality.contentTrust||{}),version:'11.12',generatedAt,categoryDepth:true,baselineCandidateCount:baselineCandidates.length,productionCandidateCount:finalCandidates.length,remainingThinRisks:remainingThinRisks.length,categoryDatasetCandidates:datasetRoutes.length};await fs.writeFile(qualityPath,JSON.stringify(quality,null,2),'utf8');

const htmlFiles=[];async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await walk(p);else if(p.endsWith('.html'))htmlFiles.push(p)}}await walk(out);const routeForFile=file=>{const rel=path.relative(out,file).replace(/\\/g,'/');return rel==='index.html'?'/':normalizeRoute('/'+rel.replace(/\/index\.html$/,''))};for(const file of htmlFiles){let html=await fs.readFile(file,'utf8');const route=routeForFile(file),robots=PREVIEW?'noindex,nofollow,noarchive,nosnippet':(candidateSet.has(route)?'index,follow':'noindex,nofollow,noarchive,nosnippet');html=html.replace(/<meta name="robots" content="[^"]*">/,`<meta name="robots" content="${robots}">`).replace(/<meta name="googlebot" content="[^"]*">/,`<meta name="googlebot" content="${robots}">`).replace(/<meta name="bingbot" content="[^"]*">/,`<meta name="bingbot" content="${robots}">`);await fs.writeFile(file,html,'utf8')}
const reviewDate=String(official.generatedAt||generatedAt).slice(0,10);if(PREVIEW){await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n','utf8');await fs.writeFile(path.join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>','utf8')}else{await fs.writeFile(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`,'utf8');const urls=finalCandidates.map(route=>`<url><loc>${SITE}${route==='/'?'':route}</loc><lastmod>${reviewDate}</lastmod></url>`).join('');await fs.writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,'utf8')}

const baselineCategoryRoutes=baselineCandidates.filter(route=>/^\/categories\/[^/]+\/$/.test(route));const finalCategoryRoutes=finalCandidates.filter(route=>/^\/categories\/[^/]+\/$/.test(route));manifest.uiVersion='11.12';manifest.v11_12={categoryRangeSection:true,categoryDatasetJsonLd:true,baselineCategoryCandidates:baselineCategoryRoutes.length,restoredCategoryCandidates:finalCategoryRoutes.length,enhancedCategoryPages:enhanced.length,remainingThinRisks:remainingThinRisks.length};manifest.indexPolicy={...(manifest.indexPolicy||{}),productionCandidates:finalCandidates.length,productionCandidateUrls:finalCandidates};manifest.environmentPolicy={...(manifest.environmentPolicy||{}),indexedHtml:PREVIEW?0:finalCandidates.length,noindexHtml:htmlFiles.length-(PREVIEW?0:finalCandidates.length),productionCandidateCount:finalCandidates.length,productionFailsIfCandidateNoindex:true};await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');
const report={schemaVersion:1,generatedAt,uiVersion:'11.12',previewMode:PREVIEW,policy:'CATEGORY_PAGES_USE_OFFICIAL_MATCHED_EXTREMES_AND_RANGES; NO_FILLER_COPY',baselineCandidateCount:baselineCandidates.length,productionCandidateCount:finalCandidates.length,baselineCategoryCandidates:baselineCategoryRoutes.length,restoredCategoryCandidates:finalCategoryRoutes.length,enhancedCategoryPages:enhanced.length,categoryDatasetCandidates:datasetRoutes.length,remainingThinRisks,audits,enhanced,candidateUrls:finalCandidates};await fs.writeFile(path.join(out,'v11-12-category-depth.json'),JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify({v11_12:'PASS',baselineCandidates:report.baselineCandidateCount,productionCandidates:report.productionCandidateCount,baselineCategoryCandidates:report.baselineCategoryCandidates,restoredCategoryCandidates:report.restoredCategoryCandidates,remainingThinRisks:report.remainingThinRisks.length},null,2));
