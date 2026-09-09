import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {CURATED_COMPARE_NAMES} from './content.mjs';
import {brandSlugFor} from './routing-v3.mjs';
import {buildOfficialMergePlan,matchOfficialBrands,normalizeBrandName} from './official-merge.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const errors=[];

async function loadClassic(file,expr){
  const code=await fs.readFile(file,'utf8');
  const ctx={console};
  vm.createContext(ctx);
  vm.runInContext(`${code}\n;globalThis.__EXPORT__=${expr};`,ctx);
  return ctx.__EXPORT__;
}
const escReg=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const catalog=await loadClassic(path.join(repo,'docs/franchise-data-preview/data-final.js'),'{brands}');
const official=JSON.parse(await fs.readFile(path.join(repo,'data/franchise/official/brands-2025.json'),'utf8'));
const critical=[...new Set([...CURATED_COMPARE_NAMES.flat(),...catalog.brands.slice(0,12).map(b=>b.name)])];
const matched=matchOfficialBrands(catalog.brands,official);
const plan=buildOfficialMergePlan({catalogBrands:catalog.brands,officialDoc:official,criticalBrandNames:critical});
const byName=new Map(matched.matches.map(x=>[x.brand.name,x]));
const excludedByName=new Map(matched.resolvedExcluded.map(x=>[x.name,x]));

if(catalog.brands.length!==170)errors.push(`catalog brand count ${catalog.brands.length}`);
if(matched.matches.length!==149)errors.push(`matched expected 149, got ${matched.matches.length}`);
if(matched.resolvedExcluded.length!==21)errors.push(`reviewed excluded expected 21, got ${matched.resolvedExcluded.length}`);
if(matched.unmatched.length!==0)errors.push(`unresolved unmatched ${matched.unmatched.length}`);
if(matched.ambiguous.length!==0)errors.push(`unresolved ambiguous ${matched.ambiguous.length}`);
if(matched.matches.filter(x=>x.method==='EXACT').length!==115)errors.push('exact match count must be 115');
if(matched.matches.filter(x=>x.method==='ALIAS').length!==34)errors.push('alias match count must be 34');
if(plan.report.criticalMissingMetrics.length!==0)errors.push(`critical metric missing ${plan.report.criticalMissingMetrics.length}`);
if(!plan.active)errors.push(`official merge inactive: ${plan.report.activationBlockers.join(',')}`);

const reviewedMatches=[
  ['매머드커피','매머드커피mammothcoffee','매머드커피랩'],
  ['워시엔조이','워시엔조이멤버스','코리아런드리'],
  ['피자스쿨','피자스쿨','씨에이치컴퍼니']
];
for(const [catalogName,officialName,corp] of reviewedMatches){
  const hit=byName.get(catalogName);
  if(!hit){errors.push(`${catalogName}: reviewed match missing`);continue}
  if(normalizeBrandName(hit.record?.name||hit.record?.brandName)!==normalizeBrandName(officialName))errors.push(`${catalogName}: official name mismatch`);
  if(normalizeBrandName(hit.record?.corp)!==normalizeBrandName(corp))errors.push(`${catalogName}: corp mismatch ${hit.record?.corp||''}`);
}

const duplicate=excludedByName.get('마제소바백소정');
if(duplicate?.resolution?.status!=='DUPLICATE_CANONICAL'||duplicate?.resolution?.canonicalName!=='백소정')errors.push('마제소바백소정 duplicate resolution missing');
for(const name of ['윤선생','튼튼영어'])if(excludedByName.get(name)?.resolution?.status!=='UMBRELLA_MULTIPLE_DISCLOSURES')errors.push(`${name}: umbrella resolution missing`);

const directory=await fs.readFile(path.join(out,'brands/index.html'),'utf8');
for(const row of matched.resolvedExcluded){
  const brand=catalog.brands.find(b=>b.name===row.name);
  if(!brand){errors.push(`${row.name}: catalog row missing`);continue}
  const slug=brandSlugFor(brand.name,brand.slug);
  const detail=await fs.readFile(path.join(out,'brands',slug,'index.html'),'utf8');
  if(!detail.includes('noindex,nofollow,noarchive,nosnippet'))errors.push(`${row.name}: preview noindex missing`);
  if(!detail.includes('합성값이나 추정값으로 빈칸을 채우지 않습니다'))errors.push(`${row.name}: no-synthetic disclosure missing`);
  if((detail.match(/정보 없음/g)||[]).length<3)errors.push(`${row.name}: unresolved numeric fields are not visibly null`);
  const name=escReg(row.name.toLowerCase());
  const rowRe=new RegExp(`<tr[^>]*data-name="${name}"[^>]*data-cat="[^"]*"[^>]*data-cost=""[^>]*data-stores=""`);
  if(!rowRe.test(directory))errors.push(`${row.name}: directory still carries numeric fallback`);
}

for(const name of ['매머드커피','워시엔조이','피자스쿨']){
  const brand=catalog.brands.find(b=>b.name===name);
  const detail=await fs.readFile(path.join(out,'brands',brandSlugFor(brand.name,brand.slug),'index.html'),'utf8');
  if(detail.includes('공식 레코드와의 자동 매칭이 완료되지 않았습니다'))errors.push(`${name}: detail still marked unmatched`);
}

const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
if(manifest.uiVersion!=='11.5')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(Number(manifest.coverage?.officialMatchedBrands)!==149)errors.push('manifest matched count mismatch');
if(Number(manifest.coverage?.officialResolvedExcludedBrands)!==21)errors.push('manifest reviewed excluded count mismatch');
if(Number(manifest.coverage?.officialUnmatchedBrands)!==0||Number(manifest.coverage?.officialAmbiguousBrands)!==0)errors.push('manifest unresolved counts must be zero');
if(manifest.officialPresentation?.syntheticFallback!==false)errors.push('manifest syntheticFallback must be false');
if(manifest.productionGates?.officialMetricMergeReady!==true)errors.push('officialMetricMergeReady must be true');
if(Number(manifest.v11_5?.criticalMetricMissing)!==0)errors.push('manifest criticalMetricMissing must be zero');

const report=JSON.parse(await fs.readFile(path.join(out,'v11-5-data-resolution.json'),'utf8'));
if(report.matched!==149||report.reviewedExcluded!==21)errors.push('v11.5 report resolution counts mismatch');
if(report.unresolvedUnmatched!==0||report.unresolvedAmbiguous!==0)errors.push('v11.5 report unresolved counts must be zero');
if(report.officialMergeActive!==true||report.syntheticFallback!==false)errors.push('v11.5 report merge/fallback policy mismatch');

const pkg=JSON.parse(await fs.readFile(path.join(here,'package.json'),'utf8'));
if(!String(pkg.scripts?.build||'').includes('run-generate-v11-5-final.mjs'))errors.push('package build missing v11.5 generator');
if(!String(pkg.scripts?.build||'').includes('run-validate-v11-5-final.mjs'))errors.push('package build missing v11.5 validator');

if(errors.length){console.error(JSON.stringify({v11_5Validation:'FAIL',errors},null,2));process.exit(1)}
console.log(JSON.stringify({v11_5Validation:'PASS',matched:149,reviewedExcluded:21,unresolved:0,criticalMissing:0,syntheticFallback:false,officialMergeActive:true},null,2));
