import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const report=JSON.parse(await fs.readFile(path.join(out,'v11-13-brand-expansion.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));

if(report.uiVersion!=='11.13')errors.push(`report uiVersion ${report.uiVersion}`);
if(manifest.uiVersion!=='11.13')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_13?.allOfficialMatchedBrandGate!==true)errors.push('allOfficialMatchedBrandGate flag missing');
if(report.officialMatchedBrands!==149)errors.push(`official matched brand count ${report.officialMatchedBrands}`);
if(report.previousBrandCandidates<20)errors.push(`previous brand candidates unexpectedly low: ${report.previousBrandCandidates}`);
if(report.productionBrandCandidates<=report.previousBrandCandidates)errors.push(`brand candidate set did not expand: ${report.productionBrandCandidates}/${report.previousBrandCandidates}`);
if(report.addedBrandRoutes.length!==report.productionBrandCandidates-report.previousBrandCandidates+report.removedBrandRoutes.length)errors.push('brand candidate delta math mismatch');
if(report.removedBrandRoutes.length)errors.push(`previous strict brand candidates were removed: ${report.removedBrandRoutes.join(',')}`);
if(report.remainingCandidateBrandRisks.length)errors.push(`candidate brand content risks remain: ${report.remainingCandidateBrandRisks.map(x=>x.route+':'+x.reasons.join('|')).join(',')}`);
if(report.missingDatasetCandidateBrands.length)errors.push(`candidate brand Dataset missing: ${report.missingDatasetCandidateBrands.join(',')}`);
if(report.productionCandidateCount<=report.previousCandidateCount)errors.push(`total candidate set did not expand: ${report.productionCandidateCount}/${report.previousCandidateCount}`);
if(report.dataEligibleBrands<report.productionBrandCandidates)errors.push(`production brands exceed data eligible count: ${report.productionBrandCandidates}/${report.dataEligibleBrands}`);
const finalCandidates=new Set(quality.indexPolicy?.productionCandidateUrls||[]);
for(const route of report.candidateUrls||[])if(!finalCandidates.has(route))errors.push(`quality candidate mismatch: ${route}`);
for(const route of report.addedBrandRoutes.slice(0,5)){
  const file=path.join(out,...route.split('/').filter(Boolean),'index.html');
  const html=await fs.readFile(file,'utf8');
  if(!html.includes('data-v11-position="1"'))errors.push(`new candidate position section missing: ${route}`);
  const raw=html.match(/<script type="application\/ld\+json" data-v11-dataset>([\s\S]*?)<\/script>/)?.[1];
  if(!raw){errors.push(`new candidate Dataset missing: ${route}`);continue}
  try{
    const data=JSON.parse(raw);
    if(data['@type']!=='Dataset')errors.push(`new candidate Dataset type invalid: ${route}`);
    if(!Array.isArray(data.variableMeasured)||data.variableMeasured.length<4)errors.push(`new candidate Dataset variables too thin: ${route}`);
    if(!Array.isArray(data.isBasedOn)||data.isBasedOn.length<2)errors.push(`new candidate sources missing: ${route}`);
  }catch(err){errors.push(`new candidate Dataset parse failed ${route}: ${err.message}`)}
}
const reasonTotal=Object.values(report.reasonCounts||{}).reduce((a,b)=>a+Number(b||0),0);
if(reasonTotal===0&&report.dataEligibleBrands<report.officialMatchedBrands)errors.push('ineligible brands exist but reasonCounts is empty');

if(errors.length){
  console.error(JSON.stringify({v11_13Validation:'FAIL',errors,summary:{officialMatchedBrands:report.officialMatchedBrands,dataEligibleBrands:report.dataEligibleBrands,productionBrandCandidates:report.productionBrandCandidates,addedBrandCandidates:report.addedBrandRoutes.length,productionCandidateCount:report.productionCandidateCount}},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_13Validation:'PASS',officialMatchedBrands:report.officialMatchedBrands,dataEligibleBrands:report.dataEligibleBrands,productionBrandCandidates:report.productionBrandCandidates,addedBrandCandidates:report.addedBrandRoutes.length,productionCandidates:report.productionCandidateCount},null,2));
