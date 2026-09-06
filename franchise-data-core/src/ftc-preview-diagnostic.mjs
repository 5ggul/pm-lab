import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchText} from './core.mjs';
import {extractPublicPreviewKey} from './ftc-registry.mjs';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const url='https://franchise.ftc.go.kr/openApi.do?service=FftcBrandFrcsStatsService';
let out={schemaVersion:1,generatedAt:new Date().toISOString(),url,status:'ERROR'};
try{
 const r=await fetchText(url,{timeoutMs:15000,attempts:2,headers:{referer:'https://franchise.ftc.go.kr/'}});
 const html=r.text||'';
 const strip=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim();
 const forms=[...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].map(m=>{
   const attrs=m[1],body=m[2];
   const attr=(n)=>attrs.match(new RegExp(`${n}=["']([^"']*)["']`,'i'))?.[1]||null;
   const inputs=[...body.matchAll(/<input\b([^>]*)>/gi)].map(x=>{const a=x[1];const get=n=>a.match(new RegExp(`${n}=["']([^"']*)["']`,'i'))?.[1]||null;return {name:get('name'),id:get('id'),type:get('type')||'text'}}).filter(x=>x.name||x.id);
   const selects=[...body.matchAll(/<select\b([^>]*)>/gi)].map(x=>{const a=x[1];const get=n=>a.match(new RegExp(`${n}=["']([^"']*)["']`,'i'))?.[1]||null;return {name:get('name'),id:get('id')}}).filter(x=>x.name||x.id);
   return {method:(attr('method')||'GET').toUpperCase(),action:attr('action'),inputs,selects};
 });
 const headers=[...html.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m=>strip(m[1])).filter(Boolean).slice(0,80);
 const scripts=[...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(m=>m[1]).slice(0,40);
 const links=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({href:m[1],text:strip(m[2])})).filter(x=>/api|검색|조회/i.test(x.href+' '+x.text)).slice(0,40);
 const services=[...new Set([...html.matchAll(/Fftc[A-Za-z0-9_]+Service/g)].map(m=>m[0]))].slice(0,50);
 out={schemaVersion:1,generatedAt:new Date().toISOString(),url,status:r.ok?'FETCHED':'HTTP_ERROR',httpStatus:r.status,transport:r.transport,htmlLength:html.length,publicPreviewKeyEmbedded:!!extractPublicPreviewKey(html),forms,headers,scripts,links,services};
}catch(e){out.error=`${e.message}${e?.cause?.code?` (${e.cause.code})`:''}`}
const path=resolve(repoRoot,'data/franchise/diagnostics/ftc-preview-page.json');await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(out,null,2)+'\n','utf8');console.log(JSON.stringify(out,null,2));
