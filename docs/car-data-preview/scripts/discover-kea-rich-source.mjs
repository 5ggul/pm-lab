import fs from 'node:fs';
import path from 'node:path';
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
const patterns=[
  /https?:\\?\/\\?\/[^"'<>\\s]+/gi,
  /(?:href|src|url|action)\\?=[\\?"']([^"'<>]+)["']/gi,
  /(?:fileDataDownload|fileDownload|atchFile|download|odcloud|uddi|swagger|openapi)[^"'<>\\s]*/gi
];
function decode(s){return String(s||'').replace(/\\u0026/g,'&').replace(/\\\//g,'/').replace(/&amp;/g,'&')}
for(const page of pages){
  try{
    const res=await fetch(page,{headers:{'user-agent':'Mozilla/5.0 pm-lab-car-preview'},redirect:'follow',signal:AbortSignal.timeout(30000)});
    const text=await res.text();
    for(const re of patterns){for(const m of text.matchAll(re)){const raw=decode(m[1]||m[0]);if(/download|csv|odcloud|uddi|swagger|openapi|15083023|15139827/i.test(raw))hits.push({page,value:raw.slice(0,1000)})}}
  }catch(error){hits.push({page,error:String(error?.message||error)})}
}
const unique=[];const seen=new Set();for(const h of hits){const k=JSON.stringify(h);if(!seen.has(k)){seen.add(k);unique.push(h)}}
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({schema_version:1,fetched_at,pages,hits:unique.slice(0,500)},null,2)+'\n');
console.log(`KEA rich source discovery: ${unique.length} candidate strings`);
