import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FTC_PUBLIC_DATASETS, requestFtc} from './ftc-registry.mjs';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const key=process.env.DATA_GO_KR_SERVICE_KEY||'';
const results=await Promise.all(FTC_PUBLIC_DATASETS.map(async spec=>{
  const r=await requestFtc(spec,key,{year:2025,numOfRows:3,pageNo:1,timeoutMs:18000});
  return {id:spec.id,dataId:spec.dataId,name:spec.name,role:spec.role,endpoint:spec.endpoint,yearParam:spec.yearParam,...r};
}));
const byId=Object.fromEntries(results.map(x=>[x.id,x]));
const required=['ftcBrandCost','ftcBrandStores'];
const blockers=required.filter(id=>byId[id]?.live!=='LIVE_VERIFIED').map(id=>`${id}:${byId[id]?.live||'MISSING'}`);
const snapshot={schemaVersion:2,generatedAt:new Date().toISOString(),year:2025,status:blockers.length?'BLOCKED':'PROMOTION_READY',required,blockers,results};
const jsonPath=resolve(repoRoot,'data/franchise/snapshots/ftc/pilot-2025.json');
const previewPath=resolve(repoRoot,'docs/franchise-data-preview/ftc-pilot-final.js');
await mkdir(dirname(jsonPath),{recursive:true});
await writeFile(jsonPath,JSON.stringify(snapshot,null,2)+'\n','utf8');
await writeFile(previewPath,`'use strict';\nglobalThis.FTC_PILOT=${JSON.stringify(snapshot,null,2)};\n`,'utf8');
console.log(JSON.stringify({status:snapshot.status,blockers,results:results.map(x=>({id:x.id,live:x.live,totalCount:x.totalCount,sampleCount:x.sampleCount}))},null,2));
