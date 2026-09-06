import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FTC_PUBLIC_DATASETS, requestFtc, discoverPublicPreviewKey} from './ftc-registry.mjs';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const ownKey=process.env.DATA_GO_KR_SERVICE_KEY||'';
const allowDemo=process.env.ALLOW_FTC_PUBLIC_DEMO_BOOTSTRAP==='1';
const required=['ftcBrandCost','ftcBrandStores'];

async function run(key){
  return Promise.all(FTC_PUBLIC_DATASETS.map(async spec=>{
    const r=await requestFtc(spec,key,{year:2025,numOfRows:3,pageNo:1,timeoutMs:15000});
    return {id:spec.id,dataId:spec.dataId,name:spec.name,role:spec.role,endpoint:spec.endpoint,yearParam:spec.yearParam,...r};
  }));
}
function blockers(results){const byId=Object.fromEntries(results.map(x=>[x.id,x]));return required.filter(id=>byId[id]?.live!=='LIVE_VERIFIED').map(id=>`${id}:${byId[id]?.live||'MISSING'}`)}

let credentialMode='USER_DATA_GO_KR_KEY';
let primaryResults=await run(ownKey);
let results=primaryResults;
let blocked=blockers(results);
let demoDiscovery=null;
if(blocked.length&&allowDemo){
  demoDiscovery=await discoverPublicPreviewKey();
  if(demoDiscovery.ok){
    const demoResults=await run(demoDiscovery.key);
    const demoBlocked=blockers(demoResults);
    if(!demoBlocked.length){results=demoResults;blocked=[];credentialMode='FTC_PUBLIC_PREVIEW_DEMO'}
    else demoDiscovery={ok:false,error:`Demo key probe blocked: ${demoBlocked.join(', ')}`};
  }
}
const status=blocked.length?'BLOCKED':credentialMode==='FTC_PUBLIC_PREVIEW_DEMO'?'PREVIEW_READY':'PROMOTION_READY';
const snapshot={
  schemaVersion:3,generatedAt:new Date().toISOString(),year:2025,status,credentialMode,
  productionReady:status==='PROMOTION_READY',previewRealDataReady:['PROMOTION_READY','PREVIEW_READY'].includes(status),required,blockers:blocked,
  primaryCredentialBlockers:blockers(primaryResults),demoDiscovery:demoDiscovery?{ok:demoDiscovery.ok,error:demoDiscovery.error||null,source:demoDiscovery.source||null}:null,
  results
};
const jsonPath=resolve(repoRoot,'data/franchise/snapshots/ftc/pilot-2025.json');
const previewPath=resolve(repoRoot,'docs/franchise-data-preview/ftc-pilot-final.js');
await mkdir(dirname(jsonPath),{recursive:true});
await writeFile(jsonPath,JSON.stringify(snapshot,null,2)+'\n','utf8');
await writeFile(previewPath,`'use strict';\nglobalThis.FTC_PILOT=${JSON.stringify(snapshot,null,2)};\n`,'utf8');
console.log(JSON.stringify({status:snapshot.status,credentialMode,productionReady:snapshot.productionReady,blockers:snapshot.blockers,primaryCredentialBlockers:snapshot.primaryCredentialBlockers,results:results.map(x=>({id:x.id,live:x.live,totalCount:x.totalCount,sampleCount:x.sampleCount,transport:x.transport}))},null,2));
