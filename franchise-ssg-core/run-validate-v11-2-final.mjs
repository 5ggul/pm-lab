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
const manifestVersion=Number(String(manifest.uiVersion).replace(/[^0-9.]/g,''));
if(!Number.isFinite(manifestVersion)||manifestVersion<11.2)errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(!manifest.v11_2?.homePromotesProductionReadyToolsOnly)errors.push('manifest v11.2 home tool policy missing');

const report=JSON.parse(await fs.readFile(path.join(out,'v11-2-quality-report.json'),'utf8'));
if(report.uiVersion!=='11.2')errors.push('v11.2 quality report missing/wrong');
if(report.homePolicy?.syntheticAreaShortcut!==false)errors.push('synthetic area shortcut policy not false');
if((report.homePolicy?.promotedTools||[]).length!==2)errors.push('expected exactly two promoted production-ready tools at v11.2 stage');

const requiredOperatorBrands={
  '메가MGC커피':{slug:'mega-mgc-coffee',host:'frien79plus.cafe24.com'},
  '이디야커피':{slug:'ediya-coffee',host:'www.ediya.com'},
  '교촌치킨':{slug:'kyochon-chicken',host:'www.kyochonfnb.com'},
  '더벤티':{slug:'the-venti',host:'www.theventi.co.kr'}
};
const operatorCosts=JSON.parse(await fs.readFile(path.join(here,'operator-opening-costs.json'),'utf8'));
for(const [name,meta] of Object.entries(requiredOperatorBrands)){
  const entry=operatorCosts.brands?.[name];
  if(!entry){errors.push(`operator opening cost missing ${name}`);continue}
  if(entry.checkedOn!=='2026-09-09')errors.push(`${name}: unexpected checkedOn ${entry.checkedOn}`);
  if(!entry.sourceUrl?.includes(meta.host))errors.push(`${name}: source must be franchisor domain`);
  if(!Array.isArray(entry.rows)||entry.rows.length<1)errors.push(`${name}: no directly published cost rows`);
  for(const row of entry.rows||[]){if(!Number.isFinite(Number(row.totalWon))||Number(row.totalWon)<=0)errors.push(`${name}: invalid published amount`)}
  const page=await fs.readFile(path.join(out,'brands',meta.slug,'index.html'),'utf8');
  if(!page.includes('id="official-current-cost"'))errors.push(`${name}: current franchisor cost block missing from detail page`);
  if(!page.includes(entry.sourceUrl))errors.push(`${name}: franchisor source link missing from detail page`);
}
if((report.operatorOpeningCostBrands||[]).length<4)errors.push('quality report operator opening-cost coverage below 4 brands');
for(const name of Object.keys(requiredOperatorBrands))if(!(report.operatorOpeningCostBrands||[]).includes(name))errors.push(`quality report missing operator brand ${name}`);

const pkg=JSON.parse(await fs.readFile(path.join(here,'package.json'),'utf8'));
const build=String(pkg.scripts?.build||'');
if(!build.includes('run-generate-v11-2-final.mjs')&&!build.includes('run-generate-v11-3-final.mjs'))errors.push('package build is older than v11.2 generator');
if(!build.includes('run-validate-v11-2-final.mjs')&&!build.includes('run-validate-v11-3-final.mjs'))errors.push('package build is older than v11.2 validator');

if(errors.length){
  console.error(JSON.stringify({v11_2Validation:'FAIL',errors},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_2Validation:'PASS',productionCandidates:report.productionCandidates,strictEligibleBrands:report.strictEligibleBrands,operatorOpeningCostCoverage:report.operatorOpeningCostCoverage},null,2));
