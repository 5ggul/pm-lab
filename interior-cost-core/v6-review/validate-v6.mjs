import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('interior-cost-core/v6-review');
const errors=[];
const required=[
  'index.html','assets/site-v6.css','assets/app-v6.js','data/data-contract.json','data/construction-cost-index.json',
  'data/quote-statistics.json','quote-compare/index.html','calculator/index.html','interior-cost/32-pyeong/index.html','data/construction-cost-index/index.html'
];
for(const f of required) if(!fs.existsSync(path.join(root,f))) errors.push(`missing:${f}`);

const htmlFiles=[];
const walk=dir=>{for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,ent.name);if(ent.isDirectory())walk(full);else if(ent.name.endsWith('.html'))htmlFiles.push(full)}};
walk(root);
for(const file of htmlFiles){
  const html=fs.readFileSync(file,'utf8');
  const rel=path.relative(root,file);
  if(!html.includes('noindex,nofollow')) errors.push(`noindex:${rel}`);
  if((html.match(/<h1\b/g)||[]).length!==1) errors.push(`h1:${rel}`);
  if(/아파트 인테리어 견적,\s*총액보다 먼저 조건을 맞춥니다/.test(html)) errors.push(`old-hero:${rel}`);
  if(/<meta[^>]+name=["']robots["'][^>]+index,follow/i.test(html)) errors.push(`indexable:${rel}`);
}
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const text of ['인테리어 견적 표준화','아파트 인테리어 견적,<br>총액보다 먼저 조건을 맞춥니다.','실제 견적 표본 0건']) if(home.includes(text)) errors.push(`home-copy:${text}`);
for(const text of ['인테리어 비용 비교','data-month-change','data-year-change','quote-compare/','calculator/','data/construction-cost-index/']) if(!home.includes(text)) errors.push(`home-required:${text}`);

const quote=JSON.parse(fs.readFileSync(path.join(root,'data/quote-statistics.json'),'utf8'));
if(quote.sample_count!==0||quote.statistics_visible!==false||quote.status!=='threshold_not_met') errors.push('quote-gate');
if(Number(quote.minimum_public_sample)<80) errors.push('quote-threshold');
const contract=JSON.parse(fs.readFileSync(path.join(root,'data/data-contract.json'),'utf8'));
for(const t of ['OFFICIAL','QUOTE','CALCULATED','REFERENCE']) if(!contract.types?.[t]) errors.push(`data-type:${t}`);
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data/construction-cost-index.json'),'utf8'));
if(snapshot.data_type!=='REFERENCE'||!String(snapshot.display_rule||'').includes('민간')) errors.push('index-snapshot-label');

const app=fs.readFileSync(path.join(root,'assets/app-v6.js'),'utf8');
if(app.includes('KOSIS_API_KEY')||app.includes('apiKey=')) errors.push('client-api-key');
for(const text of ['ROOT_URL','data-vendor','interior-v6-quote','interior-v6-compare','data-calculator']) if(!app.includes(text)) errors.push(`app-binding:${text}`);
const collector=fs.readFileSync(path.join(root,'collect-kosis-construction-index.mjs'),'utf8');
for(const text of ['KOSIS_API_KEY',"newEstPrdCnt:'13'",'statisticsSearch.do','statisticsData.do']) if(!collector.includes(text)) errors.push(`collector:${text}`);

if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,html_count:htmlFiles.length,quote_sample_count:quote.sample_count,quote_public_threshold:quote.minimum_public_sample,data_types:Object.keys(contract.types),snapshot_latest:snapshot.latest?.date},null,2));
