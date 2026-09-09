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
const SITE=(process.env.SSG_SITE_URL??'https://5ggul.github.io/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const generatedAt=new Date().toISOString();

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
const catalogByName=new Map(catalog.brands.map(x=>[x.name,x]));
const qualityPath=path.join(out,'v11-quality-report.json');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(qualityPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const normalizeRoute=r=>r==='/'?'/':`/${String(r).replace(/^\/+|\/+$/g,'')}/`;
const routeForBrand=name=>normalizeRoute(`/brands/${brandSlugFor(name,catalogByName.get(name)?.slug)}/`);

const beforeStrict=new Map((quality.strictBrands||[]).map(x=>[x.name,x]));
const strictAudit=(quality.strictBrands||[]).map(previous=>{
  const hit=hitByName.get(previous.name);
  const clean=hit?sanitizeOfficialStoreHistory(hit.record?.storeHistory||[]):[];
  const history=clean.filter(x=>finite(x?.stores)&&finite(x?.year)).sort((a,b)=>Number(a.year)-Number(b.year));
  const reasons=(previous.reasons||[]).filter(reason=>reason!=='STORE_HISTORY_LT_3');
  if(history.length<3)reasons.push('STORE_HISTORY_LT_3');
  return {
    ...previous,
    eligible:reasons.length===0,
    reasons,
    historyYears:history.map(x=>Number(x.year))
  };
});
quality.strictBrands=strictAudit;
quality.qualityPolicy={
  ...(quality.qualityPolicy||{}),
  brand:'required-field gate using sanitized official store history; zero-filled placeholder rows do not satisfy history coverage'
};

const strictEligibleNames=new Set(strictAudit.filter(x=>x.eligible).map(x=>x.name));
const strictBrandRoutes=new Set([...strictEligibleNames].map(routeForBrand));
const previousCandidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const previousCandidateSet=new Set(previousCandidates);
const candidateSet=new Set(previousCandidates);

// Rebuild priority-brand eligibility from the same sanitized history used by the visible chart.
for(const audit of strictAudit){
  const route=routeForBrand(audit.name);
  if(audit.eligible)candidateSet.add(route);else candidateSet.delete(route);
}

// Detail comparison pages inherit the strict gate from both participating brands.
const previousCompareDetails=previousCandidates.filter(route=>route.startsWith('/compare/')&&route!=='/compare/');
for(const route of previousCompareDetails)candidateSet.delete(route);
const compareCandidates=[];
for(const route of previousCompareDetails){
  const body=route.slice('/compare/'.length,-1);
  const split=body.indexOf('-vs-');
  if(split<1)continue;
  const left=normalizeRoute(`/brands/${body.slice(0,split)}/`);
  const right=normalizeRoute(`/brands/${body.slice(split+4)}/`);
  if(strictBrandRoutes.has(left)&&strictBrandRoutes.has(right)){
    candidateSet.add(route);
    compareCandidates.push(route);
  }
}

const finalCandidates=[...candidateSet].sort();
quality.indexPolicy={...(quality.indexPolicy||{}),productionCandidateUrls:finalCandidates};
quality.indexTrust={
  version:'11.8',
  generatedAt,
  policy:'VISIBLE_SANITIZED_HISTORY_EQUALS_INDEX_ELIGIBILITY_HISTORY',
  strictEligibleBrands:strictBrandRoutes.size,
  compareCandidates:compareCandidates.length
};
await fs.writeFile(qualityPath,JSON.stringify(quality,null,2),'utf8');

const files=[];
async function walk(dir){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory())await walk(p);else if(p.endsWith('.html'))files.push(p);
  }
}
await walk(out);
const routeForFile=file=>{
  const rel=path.relative(out,file).replace(/\\/g,'/');
  return rel==='index.html'?'/':normalizeRoute('/'+rel.replace(/\/index\.html$/,''));
};
for(const file of files){
  let html=await fs.readFile(file,'utf8');
  const route=routeForFile(file);
  const robots=PREVIEW?'noindex,nofollow,noarchive,nosnippet':(candidateSet.has(route)?'index,follow':'noindex,nofollow,noarchive,nosnippet');
  html=html
    .replace(/<meta name="robots" content="[^"]*">/,`<meta name="robots" content="${robots}">`)
    .replace(/<meta name="googlebot" content="[^"]*">/,`<meta name="googlebot" content="${robots}">`)
    .replace(/<meta name="bingbot" content="[^"]*">/,`<meta name="bingbot" content="${robots}">`);
  await fs.writeFile(file,html,'utf8');
}

const reviewDate=String(official.generatedAt||generatedAt).slice(0,10);
if(PREVIEW){
  await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n','utf8');
  await fs.writeFile(path.join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>','utf8');
}else{
  await fs.writeFile(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`,'utf8');
  const urls=finalCandidates.map(route=>`<url><loc>${SITE}${route==='/'?'':route}</loc><lastmod>${reviewDate}</lastmod></url>`).join('');
  await fs.writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,'utf8');
}

const adjustments=strictAudit.map(after=>{
  const before=beforeStrict.get(after.name)||{};
  return {
    name:after.name,
    beforeEligible:Boolean(before.eligible),
    afterEligible:Boolean(after.eligible),
    beforeHistoryYears:Array.isArray(before.historyYears)?before.historyYears:[],
    afterHistoryYears:after.historyYears,
    reasons:after.reasons
  };
}).filter(x=>x.beforeEligible!==x.afterEligible||JSON.stringify(x.beforeHistoryYears)!==JSON.stringify(x.afterHistoryYears));
const removedCandidateRoutes=previousCandidates.filter(route=>!candidateSet.has(route));
const addedCandidateRoutes=finalCandidates.filter(route=>!previousCandidateSet.has(route));

manifest.uiVersion='11.8';
manifest.v11_8={
  sanitizedHistoryIndexGate:true,
  strictBrandCandidates:strictBrandRoutes.size,
  compareCandidates:compareCandidates.length,
  removedCandidateRoutes:removedCandidateRoutes.length,
  addedCandidateRoutes:addedCandidateRoutes.length
};
manifest.indexPolicy={
  ...(manifest.indexPolicy||{}),
  brandCandidates:strictBrandRoutes.size,
  compareCandidates:compareCandidates.length,
  productionCandidates:finalCandidates.length,
  productionCandidateUrls:finalCandidates
};
manifest.environmentPolicy={
  ...(manifest.environmentPolicy||{}),
  indexedHtml:PREVIEW?0:finalCandidates.length,
  noindexHtml:files.length-(PREVIEW?0:finalCandidates.length),
  productionCandidateCount:finalCandidates.length,
  productionFailsIfCandidateNoindex:true
};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

const report={
  schemaVersion:1,
  generatedAt,
  uiVersion:'11.8',
  previewMode:PREVIEW,
  policy:'VISIBLE_SANITIZED_HISTORY_EQUALS_INDEX_ELIGIBILITY_HISTORY',
  matchedBrands:matched.matches.length,
  strictEligibleBrands:strictBrandRoutes.size,
  compareCandidates:compareCandidates.length,
  previousCandidateCount:previousCandidates.length,
  productionCandidateCount:finalCandidates.length,
  adjustments,
  removedCandidateRoutes,
  addedCandidateRoutes,
  candidateUrls:finalCandidates
};
await fs.writeFile(path.join(out,'v11-8-index-trust.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_8:'PASS',strictEligibleBrands:report.strictEligibleBrands,compareCandidates:report.compareCandidates,productionCandidates:report.productionCandidateCount,adjustments:report.adjustments.length,removedCandidates:report.removedCandidateRoutes.length},null,2));
