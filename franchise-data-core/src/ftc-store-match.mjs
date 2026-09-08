import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {matchOfficialBrands} from '../../franchise-ssg-core/official-merge.mjs';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const snapshotPath=resolve(repoRoot,'data/franchise/official/stores-2025.json');
const catalogPath=resolve(repoRoot,'docs/franchise-data-preview/data-final.js');
const reportPath=resolve(repoRoot,'data/franchise/official/store-match-report.json');
const previewPath=resolve(repoRoot,'docs/franchise-data-preview/official-store-match-final.js');

async function catalogBrands(){const code=await readFile(catalogPath,'utf8');const marker=code.indexOf('function bySlug');const ctx={console};vm.createContext(ctx);vm.runInContext(code.slice(0,marker)+"\n;globalThis.__brands=brands.map(b=>({name:b.name,slug:b.slug,aliases:b.aliases||[],category:b.category,categorySlug:b.categorySlug}));",ctx);return ctx.__brands||[]}
const snapshot=JSON.parse(await readFile(snapshotPath,'utf8'));
const catalog=await catalogBrands();
if(snapshot.status!=='READY'){
 const blocked={schemaVersion:1,status:'BLOCKED',generatedAt:new Date().toISOString(),snapshotStatus:snapshot.status||'MISSING',catalogBrands:catalog.length,matched:0,unmatched:catalog.length,ambiguous:0};
 await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(blocked,null,2)+'\n');await writeFile(previewPath,`'use strict';\nglobalThis.OFFICIAL_STORE_MATCH=${JSON.stringify(blocked,null,2)};\n`);console.log(JSON.stringify(blocked,null,2));process.exit(0);
}
const matched=matchOfficialBrands(catalog,snapshot);
const report={schemaVersion:1,status:'READY',generatedAt:new Date().toISOString(),referenceYear:snapshot.referenceYear,catalogBrands:catalog.length,officialRecords:snapshot.records.length,matched:matched.matches.length,exact:matched.matches.filter(x=>x.method==='EXACT').length,alias:matched.matches.filter(x=>x.method==='ALIAS').length,unmatched:matched.unmatched.length,ambiguous:matched.ambiguous.length,coverage:catalog.length?matched.matches.length/catalog.length:0,matches:matched.matches.map(x=>({name:x.brand.name,slug:x.brand.slug||null,method:x.method,officialName:x.record.name,corp:x.record.corp,industryMajor:x.record.industryMajor,stores:x.record.stores,previousStores:x.record.previousStores,storeHistory:x.record.storeHistory})),unmatchedCatalog:matched.unmatched,ambiguousCatalog:matched.ambiguous,duplicateOfficialNames:matched.duplicateOfficialNames};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');await writeFile(previewPath,`'use strict';\nglobalThis.OFFICIAL_STORE_MATCH=${JSON.stringify(report,null,2)};\n`);console.log(JSON.stringify({status:report.status,catalogBrands:report.catalogBrands,officialRecords:report.officialRecords,matched:report.matched,exact:report.exact,alias:report.alias,unmatched:report.unmatched,ambiguous:report.ambiguous,coverage:report.coverage},null,2));
