import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const out=path.join(root,'data','generated','kea-rich-source-discovery.json');
const pages=[
  'https://www.data.go.kr/data/15083023/fileData.do',
  'https://www.data.go.kr/data/15139827/openapi.do'
];
const fetched_at=new Date().toISOString();
const hits=[];

async function getText(url){
  try{
    const res=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 pm-lab-car-preview','accept':'text/html,*/*'},redirect:'follow',signal:AbortSignal.timeout(20000)});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }catch(first){
    try{return execFileSync('curl',['-fsSL','--retry','3','--retry-all-errors','--connect-timeout','10','--max-time','45','-A','Mozilla/5.0 pm-lab-car-preview',url],{encoding:'utf8',maxBuffer:32*1024*1024})}
    catch(second){throw new Error(`fetch=${first?.message||first}; curl=${second?.message||second}`)}
  }
}
function clean(s){return String(s??'').replace(/\\u0026/g,'&').replace(/\\\//g,'/').replace(/&amp;/g,'&').replace(/&quot;/g,'"')}
function push(page,kind,value){value=clean(value).trim();if(!value)return;hits.push({page,kind,value:value.slice(0,2000)})}

for(const page of pages){
  try{
    const text=await getText(page);
    push(page,'html_length',String(text.length));
    for(const m of text.matchAll(/https?:\\?\/\\?\/[^"'<>\s)]+/gi)){
      const v=clean(m[0]);if(/data\.go\.kr|apis\.data\.go\.kr|api\.odcloud\.kr|swagger|download|csv|openapi/i.test(v))push(page,'url',v)
    }
    for(const m of text.matchAll(/(?:href|src|action|data-url|data-href|onclick)\s*=\s*["']([^"']+)["']/gi)){
      const v=clean(m[1]);if(/download|file|csv|odcloud|uddi|swagger|openapi|15083023|15139827|api/i.test(v))push(page,'attribute',v)
    }
    for(const m of text.matchAll(/.{0,250}(?:fileDataDownload|fileDownload|downloadFile|download|atchFile|fileDetail|odcloud|uddi|swagger|openApi|openapi|apiUrl|15083023|15139827).{0,500}/gi))push(page,'context',m[0]);
    for(const m of text.matchAll(/(?:FILE_[A-Za-z0-9_-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi))push(page,'identifier',m[0]);
  }catch(error){hits.push({page,error:String(error?.message||error).slice(0,1000)})}
}
const unique=[],seen=new Set();for(const h of hits){const k=JSON.stringify(h);if(!seen.has(k)){seen.add(k);unique.push(h)}}
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({schema_version:2,fetched_at,pages,hits:unique.slice(0,1000)},null,2)+'\n');
console.log(`KEA rich source discovery: ${unique.length} candidate strings`);
