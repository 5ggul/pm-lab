import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const report=JSON.parse(await fs.readFile(path.join(out,'v11-11-content-trust.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const compose=await fs.readFile(path.join(out,'brands/compose-coffee/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');

if(report.uiVersion!=='11.11')errors.push(`report uiVersion ${report.uiVersion}`);
if(manifest.uiVersion!=='11.11')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_11?.brandCategoryPosition!==true)errors.push('brandCategoryPosition flag missing');
if(manifest.v11_11?.datasetJsonLd!==true)errors.push('datasetJsonLd flag missing');
if(manifest.v11_11?.contentDepthAudit!==true)errors.push('contentDepthAudit flag missing');
if(manifest.v11_11?.templateUniquenessAudit!==true)errors.push('templateUniquenessAudit flag missing');
if(report.enhancedBrandPages<100)errors.push(`enhanced brand coverage too low: ${report.enhancedBrandPages}`);
if(report.datasetCandidateBrandPages<15)errors.push(`candidate dataset coverage too low: ${report.datasetCandidateBrandPages}`);
if(report.productionCandidateCount<30)errors.push(`production candidate count unexpectedly low: ${report.productionCandidateCount}`);
if(report.missingEnhancedCandidateBrands?.length)errors.push(`candidate brands without position section: ${report.missingEnhancedCandidateBrands.join(',')}`);
if(report.missingDatasetCandidateBrands?.length)errors.push(`candidate brands without Dataset JSON-LD: ${report.missingDatasetCandidateBrands.join(',')}`);
const finalCandidates=new Set(quality.indexPolicy?.productionCandidateUrls||[]);
for(const item of report.removedThinRiskCandidates||[]){if(finalCandidates.has(item.route))errors.push(`thin-risk route still index candidate: ${item.route}`)}
if(!compose.includes('id="position" data-v11-position="1"'))errors.push('compose position section missing');
if(!compose.includes('낮은 순')||!compose.includes('많은 순'))errors.push('compose neutral category rank labels missing');
if(!compose.includes('data-v11-dataset'))errors.push('compose Dataset JSON-LD missing');
const datasetRaw=compose.match(/<script type="application\/ld\+json" data-v11-dataset>([\s\S]*?)<\/script>/)?.[1];
if(!datasetRaw){errors.push('compose Dataset JSON-LD payload missing')}else{
  try{
    const dataset=JSON.parse(datasetRaw);
    if(dataset['@type']!=='Dataset')errors.push(`compose structured type ${dataset['@type']}`);
    if(!Array.isArray(dataset.variableMeasured)||dataset.variableMeasured.length<4)errors.push('compose variableMeasured coverage too low');
    if(!Array.isArray(dataset.isBasedOn)||dataset.isBasedOn.length<2)errors.push('compose isBasedOn sources missing');
    if(!String(dataset.description||'').includes('컴포즈커피'))errors.push('compose dataset description not brand specific');
  }catch(err){errors.push(`compose Dataset JSON parse failed: ${err.message}`)}
}
if(!css.includes('/* v11.11 content trust */'))errors.push('v11.11 content trust CSS missing');
if(!Array.isArray(report.contentAudits)||report.contentAudits.length<20)errors.push(`content audit coverage too low: ${report.contentAudits?.length||0}`);
if(!report.templateUniqueness||!Array.isArray(report.templateUniqueness.brands))errors.push('template uniqueness report missing');

if(errors.length){
  console.error(JSON.stringify({v11_11Validation:'FAIL',errors,reportSummary:{enhancedBrandPages:report.enhancedBrandPages,datasetCandidateBrandPages:report.datasetCandidateBrandPages,productionCandidateCount:report.productionCandidateCount,removedThinRiskCandidates:report.removedThinRiskCandidates?.length}},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_11Validation:'PASS',enhancedBrandPages:report.enhancedBrandPages,datasetCandidateBrandPages:report.datasetCandidateBrandPages,productionCandidates:report.productionCandidateCount,removedThinRiskCandidates:report.removedThinRiskCandidates.length,lowUniquenessBrands:report.templateUniqueness.lowUniquenessBrands.length},null,2));
