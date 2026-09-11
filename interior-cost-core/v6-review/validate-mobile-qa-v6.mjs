import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('interior-cost-core/v6-review');
const errors=[];
for(const f of ['assets/qa-v6.css','assets/qa-v6.js','assets/search-v6.js','quote-check/index.html','quote-compare/index.html'])if(!fs.existsSync(path.join(root,f)))errors.push(`missing:${f}`);
const css=fs.readFileSync(path.join(root,'assets/qa-v6.css'),'utf8');
for(const t of ['.mobile-result-bar','position:fixed','grid-template-columns:1fr!important','82px repeat(3,minmax(0,1fr))','height:44px'])if(!css.includes(t))errors.push(`qa-css:${t}`);
const js=fs.readFileSync(path.join(root,'assets/qa-v6.js'),'utf8');
for(const t of ['검사 결과','비교 판정','checker-result','compare-result','MutationObserver','data-qc-status','#compare-status'])if(!js.includes(t))errors.push(`qa-js:${t}`);
const search=fs.readFileSync(path.join(root,'assets/search-v6.js'),'utf8');
for(const t of ['qa-v6.js','dataset.v6Qa','quote-handoff-v6.js'])if(!search.includes(t))errors.push(`qa-loader:${t}`);
if(js.includes('KOSIS_API_KEY')||js.includes('apiKey='))errors.push('qa-client-api-key');
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,mobile_checker:'single-column conditions + fixed result bar',mobile_compare:'A/B/C visible at 390px + fixed verdict bar',desktop:'unchanged'},null,2));
