import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchText} from './core.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const base='https://franchise.ftc.go.kr';
const services=['FftcBrandFrcsStatsService','FftcSclasIndutyFntnStatsService','FftcIndutyBrandStatsService'];
const out=[];
const uniq=a=>[...new Set(a.filter(Boolean))];
const abs=p=>p?.startsWith('http')?p:new URL(p,base).href;
const compactText=s=>String(s||'').replace(/\s+/g,' ').slice(0,500);

for(const service of services){
 const pageUrl=`${base}/openApi.do?service=${service}`;
 const r=await fetchText(pageUrl,{timeoutMs:20000,attempts:2,headers:{referer:`${base}/`}});
 const html=r.text||'';
 const inline=[...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
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
 })).slice(0,120);
 const hidden=[...html.matchAll(/<input\b([^>]*)>/gi)].map(m=>m[1]).map(a=>({name:a.match(/name=["']([^"']+)["']/i)?.[1]||null,id:a.match(/id=["']([^"']+)["']/i)?.[1]||null,value:a.match(/value=["']([^"']*)["']/i)?.[1]||null,type:a.match(/type=["']([^"']+)["']/i)?.[1]||null})).filter(x=>x.name||x.id);
 out.push({service,pageUrl,httpStatus:r.status,htmlLength:html.length,scriptSources:srcs,discoveredUrls:urls,inputs:hidden.slice(0,80),ajaxSnippets});
}
const doc={schemaVersion:1,generatedAt:new Date().toISOString(),pages:out};
const path=resolve(root,'data/franchise/diagnostics/ftc-public-paths.json');await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(doc,null,2)+'\n','utf8');console.log(JSON.stringify(doc,null,2));
