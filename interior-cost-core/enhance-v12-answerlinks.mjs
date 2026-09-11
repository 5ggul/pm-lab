import fs from 'node:fs';
import path from 'node:path';
const ROOT=path.resolve('docs/interior-cost-preview'),BASE='/pm-lab/interior-cost-preview',FALLBACK=`${BASE}/data/methodology/`;
const jf=path.join(ROOT,'data','answer-index-v12.json'),hf=path.join(ROOT,'data','answers-v12','index.html');
const data=JSON.parse(fs.readFileSync(jf,'utf8'));let fixed=0;
for(const a of data.answers||[]){if(!a.url){a.url=FALLBACK;a.evidence_fallback=true;fixed++}}
data.empty_url_count=(data.answers||[]).filter(a=>!a.url).length;data.evidence_fallback_count=fixed;fs.writeFileSync(jf,JSON.stringify(data,null,2));
let html=fs.readFileSync(hf,'utf8');html=html.replaceAll('<a href="">근거/도구</a>',`<a href="${FALLBACK}">근거/도구</a>`);fs.writeFileSync(hf,html);
if(data.empty_url_count!==0||html.includes('<a href="">근거/도구</a>'))throw new Error('v12 answer evidence link repair failed');
console.log(JSON.stringify({version:'12.0.0',answers:data.count,fixed,empty:data.empty_url_count},null,2));
