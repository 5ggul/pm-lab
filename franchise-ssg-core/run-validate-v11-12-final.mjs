import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const report=JSON.parse(await fs.readFile(path.join(out,'v11-12-category-depth.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const cafe=await fs.readFile(path.join(out,'categories/cafe/index.html'),'utf8');
const education=await fs.readFile(path.join(out,'categories/education/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');

if(report.uiVersion!=='11.12')errors.push(`report uiVersion ${report.uiVersion}`);
if(manifest.uiVersion!=='11.12')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_12?.categoryQuartileDepth!==true)errors.push('categoryQuartileDepth flag missing');
if(manifest.v11_12?.storeMovementDepth!==true)errors.push('storeMovementDepth flag missing');
if(manifest.v11_12?.medianNeighborDepth!==true)errors.push('medianNeighborDepth flag missing');
if(manifest.v11_12?.categoryDatasetJsonLd!==true)errors.push('categoryDatasetJsonLd flag missing');
if(manifest.v11_12?.thinRiskRecovery!==true)errors.push('thinRiskRecovery flag missing');
if(report.targetCategoryCount<12)errors.push(`target category count unexpectedly low: ${report.targetCategoryCount}`);
if(report.recoveredCategoryCount!==report.targetCategoryCount)errors.push(`not all thin categories recovered: ${report.recoveredCategoryCount}/${report.targetCategoryCount}`);
if(report.remainingThinCategoryRoutes?.length)errors.push(`thin categories remain: ${report.remainingThinCategoryRoutes.map(x=>x.route).join(',')}`);
if(!Array.isArray(report.audits)||report.audits.length!==report.targetCategoryCount)errors.push(`audit coverage mismatch: ${report.audits?.length||0}/${report.targetCategoryCount}`);
for(const audit of report.audits||[]){
  if(audit.reasons?.length)errors.push(`${audit.route} audit failed: ${audit.reasons.join('|')}`);
  if(audit.visibleTextChars<1250)errors.push(`${audit.route} visible text ${audit.visibleTextChars}`);
  if(audit.h2<5)errors.push(`${audit.route} h2 ${audit.h2}`);
  if(audit.tables<4)errors.push(`${audit.route} tables ${audit.tables}`);
  if(audit.numericFacts<40)errors.push(`${audit.route} numeric facts ${audit.numericFacts}`);
}
const candidates=new Set((quality.indexPolicy?.productionCandidateUrls||[]).map(x=>x==='/'?'/':`/${String(x).replace(/^\/+|\/+$/g,'')}/`));
for(const route of report.recoveredRoutes||[]){if(!candidates.has(route))errors.push(`recovered route missing from production candidate set: ${route}`)}
for(const html of [cafe,education]){
  if(!html.includes('data-v11-12-category-depth="1"'))errors.push('category depth section missing');
  if(!html.includes('data-v11-12-store-movement="1"'))errors.push('store movement section missing');
  if(!html.includes('data-v11-12-median-neighbors="1"'))errors.push('median neighbor section missing');
  if(!html.includes('data-v11-12-category-dataset'))errors.push('category Dataset JSON-LD missing');
  if(!html.includes('공정위 가맹사업거래 비용 공개데이터'))errors.push('FTC cost source link missing');
  if(!html.includes('공정위 가맹점 현황 공개데이터'))errors.push('FTC store source link missing');
  if(!html.includes('noindex,nofollow,noarchive,nosnippet'))errors.push('preview noindex policy lost');
}
const datasetRaw=cafe.match(/<script type="application\/ld\+json" data-v11-12-category-dataset>([\s\S]*?)<\/script>/)?.[1];
if(!datasetRaw){errors.push('cafe category dataset payload missing')}else{
  try{
    const dataset=JSON.parse(datasetRaw);
    if(dataset['@type']!=='Dataset')errors.push(`cafe category structured type ${dataset['@type']}`);
    if(!Array.isArray(dataset.variableMeasured)||dataset.variableMeasured.length<5)errors.push('cafe category variableMeasured coverage too low');
    if(!Array.isArray(dataset.isBasedOn)||dataset.isBasedOn.length<2)errors.push('cafe category source basis missing');
    if(!String(dataset.description||'').includes('카페·커피'))errors.push('cafe category dataset description not specific');
  }catch(err){errors.push(`cafe category Dataset JSON parse failed: ${err.message}`)}
}
if(!css.includes('/* v11.12 category depth */'))errors.push('v11.12 category CSS missing');

if(errors.length){
  console.error(JSON.stringify({v11_12Validation:'FAIL',errors,summary:{target:report.targetCategoryCount,recovered:report.recoveredCategoryCount,candidates:report.productionCandidateCount}},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_12Validation:'PASS',targetCategories:report.targetCategoryCount,recoveredCategories:report.recoveredCategoryCount,productionCandidates:report.productionCandidateCount},null,2));
