import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-validate-v5.mjs?v6=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const read=async p=>fs.readFile(path.join(out,p,'index.html'),'utf8');
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));

if(manifest.coverage.areaCompare!==1)throw new Error('Area compare coverage missing');
if(!manifest.productEnhancements?.areaCompare||!manifest.productEnhancements?.areaMetricEnrichment)throw new Error('Area enhancements missing');
if(manifest.productEnhancements?.areaRecommendationScore!==false)throw new Error('Area recommendation score must remain disabled');
if(manifest.areaData?.availableAreas!==12)throw new Error(`Expected 12 available areas, got ${manifest.areaData?.availableAreas}`);

const hub=await read('areas');
for(const marker of ['data-area-hub-v6="1"','/areas/compare/','전체 업소 밀도','좋은 상권이라고 판단하지 않습니다'])if(!hub.includes(marker))throw new Error(`Area hub missing marker: ${marker}`);

const compare=await read('areas/compare');
for(const marker of ['data-area-compare-v6="1"','"@type":"WebApplication"','areaA','areaB','areaCategory','전체 업소 밀도 = 전체 업소 수 ÷ 행정구역 면적','어느 지역이 더 좋은지 판정하지 않습니다'])if(!compare.includes(marker))throw new Error(`Area compare missing marker: ${marker}`);

const areaRoot=path.join(out,'areas');
const dirs=(await fs.readdir(areaRoot,{withFileTypes:true})).filter(e=>e.isDirectory()&&e.name!=='compare');
if(dirs.length!==12)throw new Error(`Expected 12 area detail directories, got ${dirs.length}`);
let enriched=0;
for(const d of dirs){
 const h=await read(`areas/${d.name}`);
 for(const marker of ['data-area-v6="1"','지역 기본 지표','공급량이 큰 업종 6개','전체 업소 밀도','/areas/compare/?a=','/guides/store-density-is-not-sales/'])if(!h.includes(marker))throw new Error(`Area ${d.name} missing marker: ${marker}`);
 if(h.includes('trade-area-density'))throw new Error(`Area ${d.name} still links to removed density guide slug`);
 enriched++;
}

const all=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))all.push(p)}}await walk(out);
if(all.length<277)throw new Error(`Expected at least 277 HTML pages after area compare, got ${all.length}`);
for(const f of all){const h=await fs.readFile(f,'utf8');if(!h.includes('noindex,nofollow'))throw new Error(`Preview noindex missing: ${path.relative(out,f)}`)}

console.log(JSON.stringify({v6Validation:'PASS',htmlPages:all.length,areaDetails:enriched,areaCompare:true,recommendationScore:false},null,2));
