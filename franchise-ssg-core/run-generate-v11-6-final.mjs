import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {CURATED_COMPARE_NAMES} from './content.mjs';
import {brandSlugFor} from './routing-v3.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const BASE='/pm-lab/franchise-ssg-preview';
const SITE='https://5ggul.github.io/pm-lab/franchise-ssg-preview';

async function loadClassic(file,expr){const code=await fs.readFile(file,'utf8');const ctx={console};vm.createContext(ctx);vm.runInContext(`${code}\n;globalThis.__EXPORT__=${expr};`,ctx);return ctx.__EXPORT__}
const catalog=await loadClassic(path.join(repo,'docs/franchise-data-preview/data-final.js'),'{categories,brands}');
const htmlFiles=[];
async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);
const routeFor=file=>{const rel=path.relative(out,file).replace(/\\/g,'/');if(rel==='index.html')return '/';return '/'+rel.replace(/index\.html$/,'')};
const normalizeRoute=href=>{let s=href.slice(BASE.length).split('#')[0].split('?')[0]||'/';if(!s.startsWith('/'))s='/'+s;if(s!=='/'&&!/\.[a-z0-9]{1,8}$/i.test(s)&&!s.endsWith('/'))s+='/';return s};
const routeMap=new Map(htmlFiles.map(f=>[routeFor(f),f]));
const broken=[];const canonicalMissing=[];const canonicalOffsite=[];const noindexMissing=[];let internalLinksChecked=0;
for(const file of htmlFiles){
  const h=await fs.readFile(file,'utf8');const from=routeFor(file);
  if(!h.includes('noindex,nofollow,noarchive,nosnippet'))noindexMissing.push(from);
  const canonical=h.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1]||h.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i)?.[1]||null;
  if(!canonical)canonicalMissing.push(from);else if(!canonical.startsWith(SITE))canonicalOffsite.push({from,canonical});
  for(const m of h.matchAll(/href="([^"]+)"/g)){
    const href=m[1];if(!href.startsWith(BASE))continue;
    const target=normalizeRoute(href);if(target.startsWith('/assets/')||/\.(?:css|js|svg|png|jpg|jpeg|webp|json|xml|txt)$/i.test(target))continue;
    internalLinksChecked++;
    if(!routeMap.has(target))broken.push({from,href,target});
  }
}

const expectedBrandRoutes=catalog.brands.map(b=>`/brands/${brandSlugFor(b.name,b.slug)}/`);
const missingBrandRoutes=expectedBrandRoutes.filter(r=>!routeMap.has(r));
const expectedCategoryRoutes=Object.keys(catalog.categories).map(slug=>`/categories/${slug}/`);
const missingCategoryRoutes=expectedCategoryRoutes.filter(r=>!routeMap.has(r));
const expectedCompareRoutes=CURATED_COMPARE_NAMES.map(([a,b])=>{const av=catalog.brands.find(x=>x.name===a),bv=catalog.brands.find(x=>x.name===b);return av&&bv?`/compare/${brandSlugFor(av.name,av.slug)}-vs-${brandSlugFor(bv.name,bv.slug)}/`:null}).filter(Boolean);
const missingCompareRoutes=expectedCompareRoutes.filter(r=>!routeMap.has(r));
const productionTools=['/tools/startup-cost/','/tools/monthly-profit-simulator/','/tools/disclosure-decoder/'];
const missingToolRoutes=productionTools.filter(r=>!routeMap.has(r));

const report={
  schemaVersion:1,generatedAt:new Date().toISOString(),uiVersion:'11.6',
  htmlPages:htmlFiles.length,
  expectedBrands:catalog.brands.length,brandPagesFound:expectedBrandRoutes.length-missingBrandRoutes.length,missingBrandRoutes,
  expectedCategories:Object.keys(catalog.categories).length,categoryPagesFound:expectedCategoryRoutes.length-missingCategoryRoutes.length,missingCategoryRoutes,
  expectedCuratedCompares:expectedCompareRoutes.length,comparePagesFound:expectedCompareRoutes.length-missingCompareRoutes.length,missingCompareRoutes,
  productionTools:productionTools.length,missingToolRoutes,
  internalLinksChecked,brokenInternalLinks:broken,
  canonicalMissing,canonicalOffsite,previewNoindexMissing:noindexMissing
};
await fs.writeFile(path.join(out,'v11-6-route-integrity.json'),JSON.stringify(report,null,2),'utf8');
const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.uiVersion='11.6';
manifest.v11_6={fullStaticRouteAudit:true,htmlPages:report.htmlPages,brandPages:report.brandPagesFound,categoryPages:report.categoryPagesFound,curatedComparePages:report.comparePagesFound,productionTools:report.productionTools,internalLinksChecked:report.internalLinksChecked,brokenInternalLinks:report.brokenInternalLinks.length,canonicalMissing:report.canonicalMissing.length,previewNoindexMissing:report.previewNoindexMissing.length};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');
console.log(JSON.stringify({v11_6:'AUDITED',htmlPages:report.htmlPages,brands:report.brandPagesFound,categories:report.categoryPagesFound,compares:report.comparePagesFound,tools:report.productionTools,links:report.internalLinksChecked,broken:report.brokenInternalLinks.length,canonicalMissing:report.canonicalMissing.length,noindexMissing:report.previewNoindexMissing.length},null,2));
