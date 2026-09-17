import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.CAR_PREVIEW_BASE;
if(!base)throw new Error('CAR_PREVIEW_BASE is required');
const routes=[];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(entry.name==='index.html')routes.push(path.relative(root,path.dirname(full)).replaceAll('\\','/'));
  }
}
walk(root);
const failures=[];
let done=0;
await Promise.all(Array.from({length:8},async()=>{
  while(done<routes.length){
    const route=routes[done++],url=base.replace(/\/$/,'')+'/'+(route?route+'/':'');
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
      const html=await response.text();
      if(response.status!==200||!response.headers.get('content-type')?.includes('text/html')||!/<title>[^<]+<\/title>/i.test(html)||!/<h1\b/i.test(html))failures.push({route,status:response.status,contentType:response.headers.get('content-type'),title:/<title>[^<]+<\/title>/i.test(html),h1:/<h1\b/i.test(html)});
    }catch(error){failures.push({route,error:String(error)})}
  }
}));
console.log(JSON.stringify({checked:routes.length,failed:failures.length,failures:failures.slice(0,30)},null,2));
if(failures.length)process.exitCode=1;
