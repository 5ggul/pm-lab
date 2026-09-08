import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchText,parseApiPayload} from './core.mjs';
import {classifyDataGoError} from './data-go-error.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const base='https://franchise.ftc.go.kr';
const services=['FftcBrandFrcsStatsService','FftcSclasIndutyFntnStatsService','FftcIndutyBrandStatsService'];
const out=[];
const uniq=a=>[...new Set(a.filter(Boolean))];
const abs=p=>p?.startsWith('http')?p:new URL(p,base).href;
const compactText=s=>String(s||'').replace(/\s+/g,' ').slice(0,500);
let publicDemoKey=null;

for(const service of services){
 const pageUrl=`${base}/openApi.do?service=${service}`;
 const r=await fetchText(pageUrl,{timeoutMs:20000,attempts:2,headers:{referer:`${base}/`}});
 const html=r.text||'';
 const inline=[...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
 const detected=html.match(/serviceKey=([^"'&+\s]+)/i)?.[1]||null;if(detected&&detected.length>40)publicDemoKey=detected;
 const srcs=uniq([...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(m=>m[1])).filter(x=>x.startsWith('/')||x.startsWith(base));
 const scripts=[];
 for(const src of srcs.slice(0,30)){
  try{const sr=await fetchText(abs(src),{timeoutMs:12000,attempts:1,headers:{referer:pageUrl}});if(sr.ok)scripts.push({src,body:sr.text||''})}catch{}
 }
 const bodies=[...inline,...scripts.map(x=>x.body)];
 const urls=uniq(bodies.flatMap(body=>[
  ...[...body.matchAll(/["'`](\/?[A-Za-z0-9_./?=&%-]+\.(?:do|json|xml)(?:\?[^"'`]*)?)["'`]/g)].map(m=>m[1]),
  ...[...body.matchAll(/(?:url|action)\s*:\s*["'`]([^"'`]+)["'`]/gi)].map(m=>m[1]),
  ...[...body.matchAll(/(?:fetch|ajax|post|get)\s*\(\s*["'`]([^"'`]+)["'`]/gi)].map(m=>m[1])
 ]));
 const ajaxSnippets=uniq(bodies.flatMap(body=>{
  const lines=body.split(/\r?\n/);return lines.filter(line=>/\$\.ajax|fetch\(|\.post\(|\.get\(|openApi|service|search|list|select|result/i.test(line)).map(compactText)
 })).filter(line=>!line.includes('serviceKey=')).slice(0,100);
 const hidden=[...html.matchAll(/<input\b([^>]*)>/gi)].map(m=>m[1]).map(a=>({name:a.match(/name=["']([^"']+)["']/i)?.[1]||null,id:a.match(/id=["']([^"']+)["']/i)?.[1]||null,value:a.match(/value=["']([^"']*)["']/i)?.[1]||null,type:a.match(/type=["']([^"']+)["']/i)?.[1]||null})).filter(x=>x.name||x.id);
 const operOptions=[...html.matchAll(/<option\b[^>]*value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi)].map(m=>({value:m[1],text:String(m[2]||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()})).filter(x=>x.value&&/get|select|list|info|stats/i.test(x.value));
 out.push({service,pageUrl,httpStatus:r.status,htmlLength:html.length,scriptSources:srcs,discoveredUrls:urls,inputs:hidden.slice(0,80),operations:operOptions.slice(0,40),ajaxSnippets});
}

const publicDemoProbes=[];
if(publicDemoKey){
 const probes=[
  {id:'brandStores',service:'FftcBrandFrcsStatsService',operation:'getBrandFrcsStats',yearParam:'yr'},
  {id:'brandCost',service:'FftcBrandFntnStatsService',operation:'getBrandFntnStats',yearParam:'yr'}
 ];
 for(const p of probes){
  const url=`https://apis.data.go.kr/1130000/${p.service}/${p.operation}?serviceKey=${publicDemoKey}&pageNo=1&numOfRows=3&resultType=json&${p.yearParam}=2025`;
  try{
   const r=await fetchText(url,{timeoutMs:20000,attempts:1,headers:{referer:`${base}/`}});const parsed=parseApiPayload(r.text||'');const raw=parsed.raw||{};const body=raw?.response?.body||raw;const g=r.ok?null:classifyDataGoError(r.text,r.status);
   publicDemoProbes.push({id:p.id,httpStatus:r.status,ok:r.ok,totalCount:Number(body?.totalCount)||null,error:g?.kind||null,code:g?.code||null});
  }catch(e){publicDemoProbes.push({id:p.id,httpStatus:null,ok:false,totalCount:null,error:String(e?.message||e),code:null})}
 }
}
const doc={schemaVersion:2,generatedAt:new Date().toISOString(),publicDemoKeyDetected:Boolean(publicDemoKey),publicDemoProbes,pages:out};
const path=resolve(root,'data/franchise/diagnostics/ftc-public-paths.json');await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(doc,null,2)+'\n','utf8');console.log(JSON.stringify(doc,null,2));
