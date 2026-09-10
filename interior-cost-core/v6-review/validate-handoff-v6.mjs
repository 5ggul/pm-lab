import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('interior-cost-core/v6-review');
const errors=[];
const files=['assets/quote-handoff-v6.js','assets/search-v6.js','quote-check/index.html','quote-compare/index.html'];
for(const f of files)if(!fs.existsSync(path.join(root,f)))errors.push(`missing:${f}`);
const handoff=fs.readFileSync(path.join(root,'assets/quote-handoff-v6.js'),'utf8');
for(const t of ['interior-v6-quote-check','interior-v6-compare','interior-v6-compare-handoff','0:A','7:A','states.length===1','mixed.push','data-qc-to-compare','A/B/C 비교로 보내기','A 불러옴'])if(!handoff.includes(t))errors.push(`handoff:${t}`);
for(const t of ["['철거·폐기',['demolition','waste']]","['욕실',['waterproof','bathroom']]","['주방',['kitchen']]","['샷시',['windows']]","['VAT',['vat']]"])if(!handoff.includes(t))errors.push(`handoff-map:${t}`);
if(handoff.includes('KOSIS_API_KEY')||handoff.includes('apiKey='))errors.push('handoff-client-api-key');
const search=fs.readFileSync(path.join(root,'assets/search-v6.js'),'utf8');
for(const t of ['quote-handoff-v6.js','data-quote-checker','#compare-rows','data-v6-handoff'])if(!search.includes(t))errors.push(`handoff-loader:${t}`);
const checker=fs.readFileSync(path.join(root,'quote-check/index.html'),'utf8');
if(!checker.includes('../assets/search-v6.js'))errors.push('checker-search-loader');
const compare=fs.readFileSync(path.join(root,'quote-compare/index.html'),'utf8');
for(const t of ['../quote-check/','../assets/search-v6.js','검사 연동','A 견적 불러오기'])if(!compare.includes(t))errors.push(`compare-handoff:${t}`);
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,source:'quote-check',target:'quote-compare:A',group_policy:'mixed included/separate -> missing',groups:8,storage:['interior-v6-quote-check','interior-v6-compare','interior-v6-compare-handoff']},null,2));