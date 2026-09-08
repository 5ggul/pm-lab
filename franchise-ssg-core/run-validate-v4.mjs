import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {buildOfficialMergePlan} from './official-merge.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const sourcePath=path.join(here,'validate-v2.mjs');
const runtimePath=path.join(here,'.validate-v4-runtime.mjs');
let source=await fs.readFile(sourcePath,'utf8');
source=source.replace("if(manifest.coverage.priorityBrands!==42)throw new Error(`Expected 42 priority brands, got ${manifest.coverage.priorityBrands}`);","if(manifest.coverage.priorityBrands<170)throw new Error(`Expected at least 170 brand pages, got ${manifest.coverage.priorityBrands}`);");
source=source.replace("if(manifest.coverage.descriptiveBrandSlugs!==42)throw new Error('Descriptive brand slug coverage incomplete');","if(manifest.coverage.descriptiveBrandSlugs!==manifest.coverage.priorityBrands)throw new Error('Descriptive brand slug coverage incomplete');");
source=source.replace("if(brandDirs.length!==42)throw new Error(`Expected 42 brand directories, got ${brandDirs.length}`);","if(brandDirs.length!==manifest.coverage.priorityBrands)throw new Error(`Brand directory coverage mismatch: ${brandDirs.length} / ${manifest.coverage.priorityBrands}`);");
source=source.replace("if(manifest.coverage.guides<15||manifest.coverage.tools<8||manifest.coverage.compareHub!==1)throw new Error('Coverage below target');","if(manifest.coverage.guides<15||manifest.coverage.tools<8||manifest.coverage.compareHub!==1||manifest.coverage.rankings<20)throw new Error('Coverage below target');");
source=source.replace("if(toolDirs.length!==8)throw new Error(`Expected 8 tools, got ${toolDirs.length}`);","if(toolDirs.length<8)throw new Error(`Expected at least 8 tools, got ${toolDirs.length}`);");
source=source.replace("if(manifest.productionGates.officialMetricMergeReady!==false)throw new Error('Official metric merge gate should remain false until implemented');","if(manifest.productionGates.officialMetricMergeReady!==true)throw new Error('Official metric merge engine must be ready');");
source += `\nconst manifestV4=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));\nconst brandsIndex=await fs.readFile(path.join(out,'brands','index.html'),'utf8');\nif(!brandsIndex.includes('프랜차이즈 브랜드 '+manifestV4.coverage.priorityBrands+'개'))throw new Error('Brand index count copy mismatch');\nconst startup=await fs.readFile(path.join(out,'tools','startup-cost','index.html'),'utf8');\nconst brandOptions=[...startup.matchAll(/<option value=\"[^\"]+\" data-cost=/g)].length;\nif(brandOptions!==manifestV4.coverage.priorityBrands)throw new Error('Startup-cost brand selector coverage mismatch: '+brandOptions+' / '+manifestV4.coverage.priorityBrands);\nconst report=JSON.parse(await fs.readFile(path.join(out,'official-match-report.json'),'utf8'));\nif(!report.engineReady)throw new Error('Official match engine report not ready');\nif(report.coverage.catalogBrands!==manifestV4.coverage.priorityBrands)throw new Error('Official match catalog coverage mismatch');\nif(report.coverage.matched+report.coverage.unmatched+report.coverage.ambiguous!==report.coverage.catalogBrands)throw new Error('Official match partition mismatch');\nif(Boolean(report.active)!==Boolean(manifestV4.officialMerge?.active))throw new Error('Official merge active state mismatch');\nif(report.active&&manifestV4.dataMode!=='FTC_OFFICIAL_PREVIEW')throw new Error('Active official merge must set official data mode');\nif(report.active&&report.activationBlockers.length)throw new Error('Active official merge cannot have blockers');\nconsole.log(JSON.stringify({fullCatalogBrands:manifestV4.coverage.priorityBrands,rankings:manifestV4.coverage.rankings,startupCostBrandOptions:brandOptions,officialMerge:manifestV4.officialMerge},null,2));\n`;
await fs.writeFile(runtimePath,source,'utf8');
try{await import(`${pathToFileURL(runtimePath).href}?run=${Date.now()}`)}finally{await fs.rm(runtimePath,{force:true})}

const mockCatalog=[{name:'정확브랜드',slug:'exact',aliases:[]},{name:'별칭브랜드',slug:'alias',aliases:['공식별칭']},{name:'중복브랜드',slug:'dup',aliases:[]}];
const mockOfficial={status:'READY',promotion:{allowPreviewOverlay:true},records:[{name:'정확브랜드',stores:10,startupCost10k:100},{name:'공식별칭',stores:20,startupCost10k:200},{name:'중복브랜드',corp:'A',stores:1,startupCost10k:1},{name:'중복브랜드',corp:'B',stores:2,startupCost10k:2}]};
const mock=buildOfficialMergePlan({catalogBrands:mockCatalog,officialDoc:mockOfficial,criticalBrandNames:['정확브랜드','별칭브랜드']});
assert.equal(mock.report.coverage.exact,1);assert.equal(mock.report.coverage.alias,1);assert.equal(mock.report.coverage.ambiguous,1);assert.equal(mock.active,false);
const noFuzzy=buildOfficialMergePlan({catalogBrands:[{name:'메가MGC커피',aliases:[]}],officialDoc:{status:'READY',promotion:{allowPreviewOverlay:true},records:[{name:'메가커피',stores:1,startupCost10k:1}]},criticalBrandNames:[]});
assert.equal(noFuzzy.report.coverage.matched,0);assert.equal(noFuzzy.report.coverage.unmatched,1);
console.log(JSON.stringify({officialMergeUnitChecks:'PASS'},null,2));
