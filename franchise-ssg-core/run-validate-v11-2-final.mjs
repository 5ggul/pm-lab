import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-validate-v11-1-final.mjs?v112=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const errors=[];

const home=await fs.readFile(path.join(out,'index.html'),'utf8');
for(const href of ['/tools/brand-filter/','/areas/']){
  if(home.includes(`/pm-lab/franchise-ssg-preview${href}`))errors.push(`home still promotes non-production shortcut ${href}`);
}
if(home.includes('/brands/paris-baguette/'))errors.push('home still features strict-gate-ineligible Paris Baguette');
for(const href of ['/tools/startup-cost/','/tools/monthly-profit-simulator/']){
  if(!home.includes(`/pm-lab/franchise-ssg-preview${href}`))errors.push(`home missing production-ready tool ${href}`);
}

const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
if(String(manifest.uiVersion)!=='11.2')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(!manifest.v11_2?.homePromotesProductionReadyToolsOnly)errors.push('manifest v11.2 home tool policy missing');

const report=JSON.parse(await fs.readFile(path.join(out,'v11-2-quality-report.json'),'utf8'));
if(report.uiVersion!=='11.2')errors.push('v11.2 quality report missing/wrong');
if(report.homePolicy?.syntheticAreaShortcut!==false)errors.push('synthetic area shortcut policy not false');
if((report.homePolicy?.promotedTools||[]).length!==2)errors.push('expected exactly two promoted production-ready tools');

const pkg=JSON.parse(await fs.readFile(path.join(here,'package.json'),'utf8'));
if(!String(pkg.scripts?.build||'').includes('run-generate-v11-2-final.mjs'))errors.push('package build does not use v11.2 generator');
if(!String(pkg.scripts?.build||'').includes('run-validate-v11-2-final.mjs'))errors.push('package build does not use v11.2 validator');

if(errors.length){
  console.error(JSON.stringify({v11_2Validation:'FAIL',errors},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_2Validation:'PASS',productionCandidates:report.productionCandidates,strictEligibleBrands:report.strictEligibleBrands},null,2));
