import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-validate-v4.mjs?v5=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const read=async p=>fs.readFile(path.join(out,p,'index.html'),'utf8');
const exists=async p=>{try{await fs.stat(path.join(out,p));return true}catch{return false}};
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));

if(manifest.coverage.tools<9)throw new Error(`Expected at least 9 tools, got ${manifest.coverage.tools}`);
if(manifest.coverage.exploreHub!==1||manifest.coverage.categoryHub!==1||manifest.coverage.areaHub!==1)throw new Error('Exploration hub coverage incomplete');
if(manifest.coverage.themePages!==4)throw new Error(`Expected 4 objective theme pages, got ${manifest.coverage.themePages}`);
if(!manifest.productEnhancements?.brandFilterInteractive||!manifest.productEnhancements?.monthlyProfitSimulator)throw new Error('Interactive product enhancements missing');
if(manifest.productEnhancements?.recommendationRanking!==false)throw new Error('Recommendation ranking must remain disabled');

for(const p of ['explore','categories','areas','themes','tools/brand-filter','tools/monthly-profit-simulator','themes/public-cost-under-10000','themes/stores-500-plus','themes/store-count-increase','themes/service-business'])if(!(await exists(path.join(p,'index.html'))))throw new Error(`Missing v5 page: ${p}`);

const explore=await read('explore');
for(const href of ['/categories/','/themes/','/areas/','/tools/brand-filter/','/compare/','/tools/monthly-profit-simulator/'])if(!explore.includes(href))throw new Error(`Explore hub missing ${href}`);

const categories=await read('categories');
const categoryLinks=[...categories.matchAll(/\/rankings\/[a-z-]+\//g)].length;
if(categoryLinks<20)throw new Error(`Category hub below 20 category links: ${categoryLinks}`);

const areas=await read('areas');
const areaLinks=[...areas.matchAll(/\/areas\/(?:seoul|gyeonggi)-[a-z-]+\//g)].length;
if(areaLinks!==12)throw new Error(`Expected 12 area links, got ${areaLinks}`);

const filter=await read('tools/brand-filter');
const filterCards=[...filter.matchAll(/class="brand-card"[^>]*data-name=/g)].length;
if(filterCards!==manifest.coverage.priorityBrands)throw new Error(`Brand filter card coverage mismatch: ${filterCards}/${manifest.coverage.priorityBrands}`);
for(const marker of ['fCost','fStores','fGrowth','fSort','추천 순위가 아닙니다'])if(!filter.includes(marker))throw new Error(`Brand filter missing marker: ${marker}`);

const profit=await read('tools/monthly-profit-simulator');
for(const marker of ['pSales','pMaterial','pPlatform','pRoyalty','pLabor','pRent','손익분기 매출','결과가 양수여도 실제 수익이나 사업 성과를 보장하지 않습니다'])if(!profit.includes(marker))throw new Error(`Profit simulator missing marker: ${marker}`);

const tools=await read('tools');
if(!tools.includes('/tools/monthly-profit-simulator/'))throw new Error('Tools hub missing monthly profit simulator');

for(const slug of ['public-cost-under-10000','stores-500-plus','store-count-increase','service-business']){
 const html=await read(`themes/${slug}`);
 if(!html.includes('추천 순위가 아니'))throw new Error(`Theme ${slug} missing non-recommendation disclosure`);
 if(!html.includes('주의해서 볼 점'))throw new Error(`Theme ${slug} missing limitations`);
}

const allFiles=[];async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))allFiles.push(p)}}await walk(out);
let navCoverage=0;for(const f of allFiles){const h=await fs.readFile(f,'utf8');if(h.includes('/explore/">탐색</a>'))navCoverage++}
if(navCoverage<allFiles.length-2)throw new Error(`Explore navigation coverage low: ${navCoverage}/${allFiles.length}`);

console.log(JSON.stringify({v5Validation:'PASS',htmlPages:allFiles.length,brandFilterCards:filterCards,categoryLinks,areaLinks,themePages:manifest.coverage.themePages,tools:manifest.coverage.tools,exploreNavPages:navCoverage},null,2));
