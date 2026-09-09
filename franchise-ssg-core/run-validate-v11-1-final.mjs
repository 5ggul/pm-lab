import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-validate-v11-final.mjs?v111=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const errors=[];

const mega=await fs.readFile(path.join(out,'brands/mega-mgc-coffee/index.html'),'utf8');
const stores=mega.match(/<section class="block" id="stores">[\s\S]*?<\/section>/)?.[0]||'';
for(const year of ['2023','2024','2025'])if(!stores.includes(year))errors.push(`mega stores: missing ${year} history`);
if(!/신규점/.test(stores)||!/계약종료/.test(stores)||!/계약해지/.test(stores))errors.push('mega stores: open/end/cancel columns missing');
if(/2025년 공개 창업비용/.test(mega))errors.push('mega: ambiguous 2025-year startup cost wording remains');
if(!/공정위 기준년도 2025/.test(mega)&&!/공정위 공개 기준년도 2025/.test(mega))errors.push('mega: reference-year wording missing');

const files=[];
async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))files.push(p)}}
await walk(out);
for(const file of files){
  const h=await fs.readFile(file,'utf8');
  const rel=path.relative(out,file).replace(/\\/g,'/');
  if(/\d{4}년 공개 창업비용/.test(h))errors.push(`${rel}: ambiguous year/startup-cost phrase remains`);
}

const report=JSON.parse(await fs.readFile(path.join(out,'v11-1-quality-report.json'),'utf8'));
if(report.uiVersion!=='11.1')errors.push('v11.1 report: wrong uiVersion');
if(report.brandHistoryYearsDisplayed!==3)errors.push('v11.1 report: expected 3 displayed history years');
if(report.historyPagesPatched<1)errors.push('v11.1 report: no history pages patched');

if(errors.length){console.error(JSON.stringify({v11_1Validation:'FAIL',errors},null,2));process.exit(1)}
console.log(JSON.stringify({v11_1Validation:'PASS',html:files.length,historyPagesPatched:report.historyPagesPatched,productionCandidates:report.productionCandidates,strictEligibleBrands:report.strictEligibleBrands},null,2));
