import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('interior-cost-core/v6-review');
const errors=[];
const required=[
  'index.html','assets/site-v6.css','assets/mobile-v6.css','assets/app-v6.js','assets/cost-v6.js','assets/cost-v6.css','assets/guide-v6.css','data/data-contract.json','data/construction-cost-index.json','data/quote-statistics.json',
  'quote-compare/index.html','calculator/index.html','interior-cost/index.html','interior-cost/24-pyeong/index.html','interior-cost/30-pyeong/index.html','interior-cost/32-pyeong/index.html','interior-cost/34-pyeong/index.html','interior-cost/40-pyeong/index.html',
  'cost/index.html','cost/bathroom/index.html','cost/kitchen/index.html','cost/windows/index.html','cost/demolition-waste/index.html','data/construction-cost-index/index.html',
  'guides/index.html','guides/quote-how-to/index.html','guides/vat/index.html','guides/waste-separate/index.html','guides/bathroom-one-set/index.html','guides/window-included-excluded/index.html','guides/old-apartment/index.html'
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

const bathroom=fs.readFileSync(path.join(root,'cost/bathroom/index.html'),'utf8');
for(const text of ['욕실 리모델링 비용','data-quote-scope="bathroom"','철거','방수','타일','도기','배관']) if(!bathroom.includes(text)) errors.push(`bathroom:${text}`);
const workPages={
  kitchen:['주방 인테리어 비용','data-kitchen-tool','data-kitchen-length','data-kitchen-amount','cost-v6.js'],
  windows:['샷시 교체 비용','data-window-tool','data-window-count','data-window-width','data-window-glass','cost-v6.js'],
  'demolition-waste':['철거·폐기물 비용','data-demolition-tool','data-demo-scope','data-demo-floor','data-demo-amount','cost-v6.js']
};
for(const [slug,tokens] of Object.entries(workPages)){
  const html=fs.readFileSync(path.join(root,`cost/${slug}/index.html`),'utf8');
  for(const token of tokens) if(!html.includes(token)) errors.push(`${slug}:${token}`);
}
const costHub=fs.readFileSync(path.join(root,'cost/index.html'),'utf8');
for(const token of ['공종별 견적 비교','bathroom/','kitchen/','windows/','demolition-waste/']) if(!costHub.includes(token)) errors.push(`cost-hub:${token}`);
const sizePages={
  '24-pyeong':['24평 인테리어 비용','고정비 성격','면적 연동'],
  '30-pyeong':['30평 인테리어 비용','조건 매트릭스','욕실 수'],
  '32-pyeong':['32평 인테리어 비용','data-quote-scope="32pyeong"'],
  '34-pyeong':['34평 인테리어 비용','수량 원장','붙박이장'],
  '40-pyeong':['40평 인테리어 비용','면적비용','선택공사']
};
for(const [slug,tokens] of Object.entries(sizePages)){
  const html=fs.readFileSync(path.join(root,`interior-cost/${slug}/index.html`),'utf8');
  for(const token of tokens) if(!html.includes(token)) errors.push(`${slug}:${token}`);
}
const sizeHub=fs.readFileSync(path.join(root,'interior-cost/index.html'),'utf8');
for(const token of ['평수별 인테리어 비용','24-pyeong/','30-pyeong/','32-pyeong/','34-pyeong/','40-pyeong/']) if(!sizeHub.includes(token)) errors.push(`size-hub:${token}`);

const guideHub=fs.readFileSync(path.join(root,'guides/index.html'),'utf8');
for(const token of ['인테리어 견적 읽기','quote-how-to/','vat/','waste-separate/','bathroom-one-set/','window-included-excluded/','old-apartment/']) if(!guideHub.includes(token)) errors.push(`guide-hub:${token}`);
const guidePages={
  'quote-how-to':['인테리어 견적서 보는 법','공종명을 표준 항목','별도와 미기재','A/B/C 견적 비교'],
  vat:['VAT 별도 견적 해석','포함','별도','미기재','총액 정규화 순서'],
  'waste-separate':['폐기물 별도 견적 해석','철거','반출','운반','처리','층수와 이동 조건'],
  'bathroom-one-set':['욕실 1식 견적 해체','철거·폐기물·방수·타일·도기·수전·천장·배관','임의 배분하지 않습니다'],
  'window-included-excluded':['샷시 포함·제외 견적 비교','창 개수','가로×세로','철거·양중'],
  'old-apartment':['구축 인테리어 추가비 체크','확정 / 조건부 / 미확인','자동 연식 보정','변경 합의']
};
for(const [slug,tokens] of Object.entries(guidePages)){
  const html=fs.readFileSync(path.join(root,`guides/${slug}/index.html`),'utf8');
  for(const token of tokens) if(!html.includes(token)) errors.push(`guide-${slug}:${token}`);
  if(!html.includes('guide-v6.css')) errors.push(`guide-style:${slug}`);
}
const guideCss=fs.readFileSync(path.join(root,'assets/guide-v6.css'),'utf8');
for(const token of ['.guide-layout','.answer-strip','.example-ledger','.flow-row','.risk-grid']) if(!guideCss.includes(token)) errors.push(`guide-css:${token}`);

const quote=JSON.parse(fs.readFileSync(path.join(root,'data/quote-statistics.json'),'utf8'));
if(quote.sample_count!==0||quote.statistics_visible!==false||quote.status!=='threshold_not_met') errors.push('quote-gate');
if(Number(quote.minimum_public_sample)<80) errors.push('quote-threshold');
const contract=JSON.parse(fs.readFileSync(path.join(root,'data/data-contract.json'),'utf8'));
for(const t of ['OFFICIAL','QUOTE','CALCULATED','REFERENCE']) if(!contract.types?.[t]) errors.push(`data-type:${t}`);
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data/construction-cost-index.json'),'utf8'));
if(snapshot.data_type!=='REFERENCE'||!String(snapshot.display_rule||'').includes('민간')) errors.push('index-snapshot-label');

const app=fs.readFileSync(path.join(root,'assets/app-v6.js'),'utf8');
if(app.includes('KOSIS_API_KEY')||app.includes('apiKey=')) errors.push('client-api-key');
for(const text of ['ROOT_URL','data-state','data-amount','interior-v6-quote','interior-v6-compare','data-calculator','mobile-v6.css','data-v6-mobile','data-quote-scope','storageKey']) if(!app.includes(text)) errors.push(`app-binding:${text}`);
if(app.includes('data-vendor')) errors.push('obsolete-v5-compare-binding');
if(!app.includes("['욕실','cost/bathroom/']")) errors.push('bathroom-search-route');
const workJs=fs.readFileSync(path.join(root,'assets/cost-v6.js'),'utf8');
for(const text of ['data-v6-cost','cost-v6.css','interior-v6-kitchen','interior-v6-windows','interior-v6-demolition','data-kitchen-tool','data-window-tool','data-demolition-tool']) if(!workJs.includes(text)) errors.push(`work-js:${text}`);
if(workJs.includes('KOSIS_API_KEY')||workJs.includes('apiKey=')) errors.push('work-client-api-key');
const workCss=fs.readFileSync(path.join(root,'assets/cost-v6.css'),'utf8');
for(const text of ['.kitchen-ledger','.window-ledger','.demo-flow','position:sticky']) if(!workCss.includes(text)) errors.push(`work-css:${text}`);
const mobile=fs.readFileSync(path.join(root,'assets/mobile-v6.css'),'utf8');
for(const text of ['position:sticky','left:0','#compare-chart[hidden]']) if(!mobile.includes(text)) errors.push(`mobile:${text}`);
const collector=fs.readFileSync(path.join(root,'collect-kosis-construction-index.mjs'),'utf8');
for(const text of ['KOSIS_API_KEY',"newEstPrdCnt:'13'",'statisticsSearch.do','statisticsData.do']) if(!collector.includes(text)) errors.push(`collector:${text}`);

if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,html_count:htmlFiles.length,quote_sample_count:quote.sample_count,quote_public_threshold:quote.minimum_public_sample,data_types:Object.keys(contract.types),snapshot_latest:snapshot.latest?.date,compare_binding:'data-state/data-amount',mobile_compare:'sticky-first-column',work_pages:Object.keys(workPages),pyeong_pages:Object.keys(sizePages),guide_pages:Object.keys(guidePages),work_module:'cost-v6'},null,2));
