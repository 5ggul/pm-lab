import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {requestSbiz} from './core.mjs';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=resolve(repoRoot,'data/franchise/snapshots/sbiz/gangnam-cafe.json');
const previewOutput=resolve(repoRoot,'docs/franchise-data-preview/sbiz-pilot-final.js');
const serviceKey=process.env.DATA_GO_KR_SERVICE_KEY||'';
let snapshot;
if(!serviceKey){
 snapshot={schemaVersion:1,status:'KEY_REQUIRED',source:'sbiz',scope:{signguCd:'11680',indsSclsCd:'I21201'},generatedAt:new Date().toISOString()};
}else{
 try{
  const res=await requestSbiz('storeListInDong',{divId:'signguCd',key:'11680',indsSclsCd:'I21201',numOfRows:'10',pageNo:'1'},serviceKey,{timeoutMs:45000});
  const items=res.body?.items;
  const list=Array.isArray(items)?items:Array.isArray(items?.item)?items.item:items?[items]:[];
  snapshot={
   schemaVersion:1,status:'LIVE_VERIFIED',source:'sbiz',scope:{label:'서울 강남구 카페',signguCd:'11680',indsSclsCd:'I21201'},
   totalCount:Number(res.body?.totalCount)||0,sampleCount:list.length,
   schemaFields:list[0]?Object.keys(list[0]).sort():[],
   categoryNames:[...new Set(list.map(x=>x.indsSclsNm).filter(Boolean))].slice(0,5),
   generatedAt:new Date().toISOString()
  };
 }catch(e){snapshot={schemaVersion:1,status:'LIVE_ERROR',source:'sbiz',scope:{label:'서울 강남구 카페',signguCd:'11680',indsSclsCd:'I21201'},error:e.message,generatedAt:new Date().toISOString()};}
}
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(snapshot,null,2)+'\n','utf8');
await writeFile(previewOutput,`'use strict';\nglobalThis.SBIZ_PILOT=${JSON.stringify(snapshot,null,2)};\n`,'utf8');
console.log(JSON.stringify(snapshot,null,2));
