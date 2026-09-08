import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const sourcePath=path.join(here,'validate-v2.mjs');
const runtimePath=path.join(here,'.validate-v3-runtime.mjs');
let source=await fs.readFile(sourcePath,'utf8');
source=source.replace("if(manifest.coverage.priorityBrands!==42)throw new Error(`Expected 42 priority brands, got ${manifest.coverage.priorityBrands}`);","if(manifest.coverage.priorityBrands<170)throw new Error(`Expected at least 170 brand pages, got ${manifest.coverage.priorityBrands}`);");
source=source.replace("if(manifest.coverage.descriptiveBrandSlugs!==42)throw new Error('Descriptive brand slug coverage incomplete');","if(manifest.coverage.descriptiveBrandSlugs!==manifest.coverage.priorityBrands)throw new Error('Descriptive brand slug coverage incomplete');");
source=source.replace("if(brandDirs.length!==42)throw new Error(`Expected 42 brand directories, got ${brandDirs.length}`);","if(brandDirs.length!==manifest.coverage.priorityBrands)throw new Error(`Brand directory coverage mismatch: ${brandDirs.length} / ${manifest.coverage.priorityBrands}`);");
source=source.replace("if(manifest.coverage.guides<15||manifest.coverage.tools<8||manifest.coverage.compareHub!==1)throw new Error('Coverage below target');","if(manifest.coverage.guides<15||manifest.coverage.tools<8||manifest.coverage.compareHub!==1||manifest.coverage.rankings<20)throw new Error('Coverage below target');");
source += `\nconst manifestV3=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));\nconst brandsIndex=await fs.readFile(path.join(out,'brands','index.html'),'utf8');\nif(!brandsIndex.includes('프랜차이즈 브랜드 '+manifestV3.coverage.priorityBrands+'개'))throw new Error('Brand index count copy mismatch');\nconst startup=await fs.readFile(path.join(out,'tools','startup-cost','index.html'),'utf8');\nconst brandOptions=[...startup.matchAll(/<option value=\"[^\"]+\" data-cost=/g)].length;\nif(brandOptions!==manifestV3.coverage.priorityBrands)throw new Error('Startup-cost brand selector coverage mismatch: '+brandOptions+' / '+manifestV3.coverage.priorityBrands);\nconsole.log(JSON.stringify({fullCatalogBrands:manifestV3.coverage.priorityBrands,rankings:manifestV3.coverage.rankings,startupCostBrandOptions:brandOptions},null,2));\n`;
await fs.writeFile(runtimePath,source,'utf8');
try{await import(`${pathToFileURL(runtimePath).href}?run=${Date.now()}`);}finally{await fs.rm(runtimePath,{force:true});}
