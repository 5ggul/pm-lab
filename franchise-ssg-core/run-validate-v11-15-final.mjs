import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const report=JSON.parse(await fs.readFile(path.join(out,'v11-15-tool-trust.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const filter=await fs.readFile(path.join(out,'tools/brand-filter/index.html'),'utf8');
const categoryMedian=await fs.readFile(path.join(out,'tools/category-median/index.html'),'utf8');
const fixed=await fs.readFile(path.join(out,'tools/monthly-fixed-cost/index.html'),'utf8');
const breakEven=await fs.readFile(path.join(out,'tools/break-even/index.html'),'utf8');
const openClose=await fs.readFile(path.join(out,'tools/open-close-rate/index.html'),'utf8');
const density=await fs.readFile(path.join(out,'tools/store-density/index.html'),'utf8');
const app=await fs.readFile(path.join(out,'assets/app.js'),'utf8');

const normalizeRoute=r=>r==='/'?'/':`/${String(r).replace(/^\/+|\/+$/g,'')}/`;
const candidates=new Set((quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute));
const approved=(report.approvedToolRoutes||[]).map(normalizeRoute);
const blocked=(report.blockedToolRoutes||[]).map(normalizeRoute);

if(report.uiVersion!=='11.15')errors.push(`report uiVersion ${report.uiVersion}`);
if(manifest.uiVersion!=='11.15')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_15?.toolTrustPolicy!==true)errors.push('toolTrustPolicy flag missing');
if(manifest.v11_15?.missingValueNullSemantics!==true)errors.push('missingValueNullSemantics flag missing');
if(report.officialMatchedBrands<100)errors.push(`official matched brands unexpectedly low: ${report.officialMatchedBrands}`);
if(report.categoryMedianOptions<80)errors.push(`category median option coverage too low: ${report.categoryMedianOptions}`);
if(report.categoryMedianCategories<10)errors.push(`category median category coverage too low: ${report.categoryMedianCategories}`);
if(report.brandFilterMissingCostCards<1)errors.push('brand-filter missing cost repair did not run');
if(report.brandFilterMissingStoreCards<1)errors.push('brand-filter missing store repair did not run');
if(approved.length!==8)errors.push(`approved tool count ${approved.length}`);
if(blocked.length!==1||blocked[0]!=='/tools/store-density/')errors.push(`blocked tool policy invalid: ${blocked.join(',')}`);
for(const route of approved)if(!candidates.has(route))errors.push(`approved tool missing from production candidates: ${route}`);
for(const route of blocked)if(candidates.has(route))errors.push(`blocked tool leaked into production candidates: ${route}`);

if(!filter.includes('data-v11-15-missing-safe="1"'))errors.push('brand-filter missing-safe marker absent');
if(filter.includes('정보 없음개'))errors.push('brand-filter still renders 정보 없음개');
if(!filter.includes("if(v==null||String(v).trim()==='')return null"))errors.push('brand-filter blank-safe parser missing');
const cards=filter.match(/<article class="brand-card"[\s\S]*?<\/article>/g)||[];
let missingCost=0,missingStores=0;
for(const card of cards){
  if(/<dt>공개비용<\/dt><dd>정보 없음<\/dd>/.test(card)){missingCost++;if(!/data-cost=""/.test(card))errors.push('missing-cost card does not use blank machine value')}
  if(/<dt>가맹점<\/dt><dd>정보 없음<\/dd>/.test(card)){missingStores++;if(!/data-stores=""/.test(card))errors.push('missing-store card does not use blank machine value')}
}
if(missingCost!==report.brandFilterMissingCostCards)errors.push(`missing cost audit mismatch ${missingCost}/${report.brandFilterMissingCostCards}`);
if(missingStores!==report.brandFilterMissingStoreCards)errors.push(`missing store audit mismatch ${missingStores}/${report.brandFilterMissingStoreCards}`);
const parseNullable=v=>{if(v==null||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
if(parseNullable('')!==null||parseNullable('   ')!==null||parseNullable(null)!==null)errors.push('validator nullable semantics failed');
if(parseNullable('0')!==0)errors.push('validator cannot preserve explicit zero');
const passesMaxCost=(raw,max)=>{const n=parseNullable(raw);return n!==null&&n<=max};
if(passesMaxCost('',10000)!==false)errors.push('missing cost incorrectly passes max-cost filter semantics');
if(passesMaxCost('9000',10000)!==true)errors.push('valid cost unexpectedly fails max-cost filter semantics');

if(!categoryMedian.includes('data-tool="category-median-v11"'))errors.push('category-median interactive form missing');
if(!categoryMedian.includes('data-v11-15-real-tool="1"'))errors.push('category-median real-tool marker missing');
if(categoryMedian.includes('<div class="tool-static">'))errors.push('category-median still static');
const optionCount=(categoryMedian.match(/<option value="\/brands\//g)||[]).length;
if(optionCount!==report.categoryMedianOptions)errors.push(`category median option count mismatch ${optionCount}/${report.categoryMedianOptions}`);
for(const marker of ['data-cm-cost','data-cm-median','data-cm-diff','data-cm-sample','data-cm-brand-link'])if(!categoryMedian.includes(marker))errors.push(`category-median output marker missing: ${marker}`);
if(!categoryMedian.includes('공정위 가맹사업거래 비용 공개데이터'))errors.push('category-median official source link missing');

if(!fixed.includes('data-tool="monthly-fixed-cost-v11"'))errors.push('monthly-fixed-cost interactive form missing');
if(!fixed.includes('data-v11-15-real-tool="1"'))errors.push('monthly-fixed-cost real-tool marker missing');
if(fixed.includes('<div class="tool-static">'))errors.push('monthly-fixed-cost still static');
for(const field of ['rent','management','labor','loan','insurance','pos','other','reserveMonths'])if(!fixed.includes(`name="${field}"`))errors.push(`monthly-fixed-cost field missing: ${field}`);
for(const marker of ['data-fixed-monthly','data-fixed-reserve','data-v11-15-input-note="monthly-fixed"'])if(!fixed.includes(marker))errors.push(`monthly-fixed-cost output/note missing: ${marker}`);

if(!breakEven.includes('data-tool="break-even"')||!breakEven.includes('data-result'))errors.push('break-even functional markers missing');
if(!openClose.includes('data-tool="open-close"')||!openClose.includes('data-result'))errors.push('open-close functional markers missing');
if(!density.includes('<div class="tool-static">'))errors.push('store-density unexpectedly changed without real local data');
if(!app.includes('/* v11.15 tool trust */'))errors.push('v11.15 app handler marker missing');
if(!app.includes('form[data-tool="category-median-v11"]'))errors.push('category-median JS handler missing');
if(!app.includes('form[data-tool="monthly-fixed-cost-v11"]'))errors.push('monthly-fixed-cost JS handler missing');

for(const [name,html] of [['brand-filter',filter],['category-median',categoryMedian],['monthly-fixed-cost',fixed],['break-even',breakEven],['open-close-rate',openClose],['store-density',density]]){
  if(!html.includes('noindex,nofollow,noarchive,nosnippet'))errors.push(`${name} preview noindex policy lost`);
}
const robots=await fs.readFile(path.join(out,'robots.txt'),'utf8');
if(report.previewMode&&robots.trim()!=='User-agent: *\nDisallow: /')errors.push('preview robots.txt does not block crawling');

if(errors.length){
  console.error(JSON.stringify({v11_15Validation:'FAIL',errors,summary:{approvedTools:approved.length,blockedTools:blocked.length,categoryMedianOptions:report.categoryMedianOptions,missingCostCards:missingCost,missingStoreCards:missingStores}},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_15Validation:'PASS',approvedTools:approved.length,blockedTools:blocked.length,categoryMedianOptions:report.categoryMedianOptions,categoryMedianCategories:report.categoryMedianCategories,missingCostCardsRepaired:missingCost,missingStoreCardsRepaired:missingStores,productionCandidates:report.productionCandidateCount},null,2));
