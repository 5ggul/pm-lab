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
const errors=[];

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
const hitByName=new Map(matched.matches.map(x=>[x.brand.name,x]));
const brandByName=new Map(catalog.brands.map(x=>[x.name,x]));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-8-index-trust.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const normalizeRoute=r=>r==='/'?'/':`/${String(r).replace(/^\/+|\/+$/g,'')}/`;
const routeForBrand=name=>normalizeRoute(`/brands/${brandSlugFor(name,brandByName.get(name)?.slug)}/`);
const candidates=new Set((quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute));
const strict=new Map((quality.strictBrands||[]).map(x=>[x.name,x]));

if(report.uiVersion!=='11.8')errors.push(`index trust report uiVersion ${report.uiVersion}`);
if(manifest.uiVersion!=='11.8')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(report.policy!=='VISIBLE_SANITIZED_HISTORY_EQUALS_INDEX_ELIGIBILITY_HISTORY')errors.push('index trust policy mismatch');
if(Number(report.productionCandidateCount)!==candidates.size)errors.push('report/candidate count mismatch');
if(Number(manifest.indexPolicy?.productionCandidates)!==candidates.size)errors.push('manifest/candidate count mismatch');
if(Number(manifest.v11_8?.strictBrandCandidates)!==Number(report.strictEligibleBrands))errors.push('strict brand count mismatch');
if(Number(manifest.v11_8?.compareCandidates)!==Number(report.compareCandidates))errors.push('compare count mismatch');
for(const route of report.removedCandidateRoutes||[])if(candidates.has(normalizeRoute(route)))errors.push(`removed candidate still present: ${route}`);

const eligibleBrandRoutes=new Set();
for(const [name,audit] of strict){
  const hit=hitByName.get(name);
  const clean=hit?sanitizeOfficialStoreHistory(hit.record?.storeHistory||[]):[];
  const years=clean.filter(x=>finite(x?.stores)&&finite(x?.year)).sort((a,b)=>Number(a.year)-Number(b.year)).map(x=>Number(x.year));
  if(JSON.stringify(years)!==JSON.stringify(audit.historyYears||[]))errors.push(`${name}: quality history years differ from sanitized visible history`);
  if(years.length<3){
    if(audit.eligible)errors.push(`${name}: eligible with fewer than 3 sanitized history years`);
    if(!(audit.reasons||[]).includes('STORE_HISTORY_LT_3'))errors.push(`${name}: missing STORE_HISTORY_LT_3 reason`);
    if(candidates.has(routeForBrand(name)))errors.push(`${name}: brand route remains a production candidate with short sanitized history`);
  }
  if(audit.eligible){
    const route=routeForBrand(name);
    eligibleBrandRoutes.add(route);
    if(!candidates.has(route))errors.push(`${name}: eligible strict brand route missing from candidates`);
  }
}

for(const route of candidates){
  if(!route.startsWith('/compare/')||route==='/compare/')continue;
  const body=route.slice('/compare/'.length,-1);
  const split=body.indexOf('-vs-');
  if(split<1){errors.push(`unparseable compare candidate: ${route}`);continue}
  const left=normalizeRoute(`/brands/${body.slice(0,split)}/`);
  const right=normalizeRoute(`/brands/${body.slice(split+4)}/`);
  if(!eligibleBrandRoutes.has(left)||!eligibleBrandRoutes.has(right))errors.push(`compare candidate has ineligible side: ${route}`);
}

if(PREVIEW){
  const files=[];
  async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await walk(p);else if(p.endsWith('.html'))files.push(p)}}
  await walk(out);
  for(const file of files){
    const html=await fs.readFile(file,'utf8');
    if(!/<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">/.test(html))errors.push(`${path.relative(out,file)}: preview robots gate changed`);
  }
  const sitemap=await fs.readFile(path.join(out,'sitemap.xml'),'utf8');
  if(/<url>/.test(sitemap))errors.push('preview sitemap must remain empty');
}

if(errors.length){
  console.error(JSON.stringify({v11_8Validation:'FAIL',errors,report},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_8Validation:'PASS',strictEligibleBrands:report.strictEligibleBrands,compareCandidates:report.compareCandidates,productionCandidates:report.productionCandidateCount,removedCandidates:(report.removedCandidateRoutes||[]).length,adjustments:(report.adjustments||[]).length},null,2));
