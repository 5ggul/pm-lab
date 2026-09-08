import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {matchOfficialBrands} from './official-merge.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');

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
const matchByName=new Map(matched.matches.map(x=>[x.brand.name,x]));

const priorityNames=[
  '메가MGC커피','컴포즈커피','빽다방','이디야커피','더벤티','매머드커피',
  '교촌치킨','bhc치킨','BBQ치킨','굽네치킨','네네치킨','맘스터치','프랭크버거','롯데리아',
  '김가네','얌샘김밥','신전떡볶이','청년다방','한솥','본죽&비빔밥',
  '파리바게뜨','뚜레쥬르','배스킨라빈스','설빙','CU','GS25','세븐일레븐','이마트24',
  '역전할머니맥주','생활맥주'
];

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
function quality(name,hit){
  if(!hit)return {score:10,indexCandidate:false,reasons:['OFFICIAL_MATCH_MISSING']};
  const r=hit.record;
  let score=20; // name + catalog category
  const reasons=[];
  if(r.sourceUrl||r.source?.statsUrl||r.source?.costUrl)score+=10;else reasons.push('SOURCE_MISSING');
  if(r.referenceYear)score+=10;else reasons.push('REFERENCE_YEAR_MISSING');
  if(finite(r.startupCost10k))score+=15;else reasons.push('COST_MISSING');
  if(finite(r.stores))score+=15;else reasons.push('STORES_MISSING');
  if(finite(r.averageSales10k))score+=10;else reasons.push('SALES_MISSING');
  const components=r.costComponents||{};
  const componentCount=['franchiseFee10k','education10k','deposit10k','etc10k'].filter(k=>finite(components[k])).length;
  if(componentCount>=3)score+=5;else reasons.push('COST_COMPONENTS_THIN');
  const history=(r.storeHistory||[]).filter(x=>finite(x?.stores));
  if(history.length>=2)score+=10;else reasons.push('STORE_HISTORY_THIN');
  const oc=r.openClose||{};
  if(['newStores','ended','cancelled'].some(k=>finite(oc[k])))score+=5;else reasons.push('OPEN_CLOSE_MISSING');
  return {score,indexCandidate:score>=70,reasons,componentCount,storeHistoryYears:history.map(x=>x.year)};
}

const priority=priorityNames.map(name=>{
  const hit=matchByName.get(name)||null;
  const r=hit?.record||null;
  return {
    name,
    method:hit?.method||null,
    quality:quality(name,hit),
    official:r?{
      officialName:r.name||r.brandName||null,
      corp:r.corp||null,
      industryMajor:r.industryMajor||null,
      industryMid:r.industryMid||null,
      referenceYear:r.referenceYear??null,
      previousReferenceYear:r.previousReferenceYear??null,
      startupCost10k:finite(r.startupCost10k)?Number(r.startupCost10k):null,
      stores:finite(r.stores)?Number(r.stores):null,
      previousStores:finite(r.previousStores)?Number(r.previousStores):null,
      averageSales10k:finite(r.averageSales10k)?Number(r.averageSales10k):null,
      newStores:finite(r.newStores)?Number(r.newStores):null,
      contractEnd:finite(r.contractEnd)?Number(r.contractEnd):null,
      contractCancel:finite(r.contractCancel)?Number(r.contractCancel):null,
      storeHistory:r.storeHistory||[],
      costHistory:r.costHistory||[],
      costComponents:r.costComponents||{},
      sourceUrl:r.sourceUrl||null,
      source:r.source||null
    }:null
  };
});

const report={
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  snapshot:{status:official.status,referenceYear:official.referenceYear,records:official.records?.length||0,promotion:official.promotion||{}},
  coverage:{catalog:catalog.brands.length,matched:matched.matches.length,exact:matched.matches.filter(x=>x.method==='EXACT').length,alias:matched.matches.filter(x=>x.method==='ALIAS').length,unmatched:matched.unmatched.length,ambiguous:matched.ambiguous.length},
  priority:{count:priority.length,indexCandidates:priority.filter(x=>x.quality.indexCandidate).length,rows:priority},
  unmatchedCatalog:matched.unmatched,
  ambiguousCatalog:matched.ambiguous
};
await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'v10-data-audit.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v10DataAudit:'PASS',coverage:report.coverage,priorityCandidates:report.priority.indexCandidates},null,2));