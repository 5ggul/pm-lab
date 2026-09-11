import fs from 'node:fs';
import path from 'node:path';
import {filterRows,referenceDelta,calculatedAmount} from './assets/reference-prices-v6.js';

const root=path.resolve('interior-cost-core/v6-review'),errors=[];
const files={html:path.join(root,'reference-prices/index.html'),js:path.join(root,'assets/reference-prices-v6.js'),css:path.join(root,'assets/reference-prices-v6.css'),data:path.join(root,'data/public-unit-prices.json'),sources:path.join(root,'data/public-price-sources.json'),collector:path.resolve('interior-cost-core/collect-pps-standard-market.mjs'),workflow:path.resolve('.github/workflows/interior-public-prices-refresh.yml'),search:path.join(root,'assets/search-v6.js')};
for(const [k,p] of Object.entries(files))if(!fs.existsSync(p))errors.push(`missing:${k}`);
if(!errors.length){
  const html=fs.readFileSync(files.html,'utf8'),js=fs.readFileSync(files.js,'utf8'),css=fs.readFileSync(files.css,'utf8'),collector=fs.readFileSync(files.collector,'utf8'),workflow=fs.readFileSync(files.workflow,'utf8'),search=fs.readFileSync(files.search,'utf8'),data=JSON.parse(fs.readFileSync(files.data,'utf8')),sources=JSON.parse(fs.readFileSync(files.sources,'utf8'));
  for(const t of ['noindex,nofollow','data-reference-price-explorer','공공 단가 조회','REFERENCE DATA','data-reference-query','data-reference-table','data-reference-detail','CALCULATED','민간 아파트 인테리어 평균가격이 아니며'])if(!html.includes(t))errors.push(`html:${t}`);
  for(const t of ['filterRows','referenceDelta','calculatedAmount','public-unit-prices.json','history.replaceState','data-reference-term'])if(!js.includes(t))errors.push(`js:${t}`);
  if(/DATA_GO_KR_SERVICE_KEY|serviceKey/i.test(html+js))errors.push('browser-api-key-reference');
  if(/@keyframes|animation\s*:|transition\s*:/i.test(css))errors.push('reference-animation');
  if(data.data_type!=='REFERENCE'||data.status!=='source_not_collected'||data.rows.length!==0)errors.push('review-data-must-remain-empty');
  if(Number(data.source?.source_row_count)!==6263)errors.push('source-row-count');
  if(!sources.sources?.some(x=>x.public_data_id==='15129415')||!sources.sources?.some(x=>x.public_data_id==='15151298'))errors.push('source-registry');
  for(const t of ['DATA_GO_KR_SERVICE_KEY','api.odcloud.kr/api/15151298','PER_PAGE=1000','latest_published_date','material_cost_won','labor_cost_won','expense_cost_won','total_cost_won'])if(!collector.includes(t))errors.push(`collector:${t}`);
  if(!workflow.includes("vars.INTERIOR_PUBLIC_PRICES_REFRESH_ENABLED == 'true'")||!workflow.includes('secrets.DATA_GO_KR_SERVICE_KEY')||!workflow.includes('git pull --rebase')||/push --force|force-with-lease/.test(workflow))errors.push('workflow-guard');
  if(!search.includes("['공공 단가','reference-prices/']")||!search.includes("['표준시장단가','reference-prices/']"))errors.push('search-route');
  const sample=[{name:'도기질 타일 붙임',spec:'벽 300×600',work_code:'A01',application_condition:'실내',unit:'㎡',total_cost_won:12000},{name:'시멘트 액체방수',spec:'2종',work_code:'B02',application_condition:'욕실',unit:'㎡',total_cost_won:9000},{name:'전선관 배선',spec:'16mm',work_code:'E03',application_condition:'전기',unit:'m',total_cost_won:3000}];
  if(filterRows(sample,'타일').length!==1||filterRows(sample,'욕실').length!==1||filterRows(sample,'전기').length!==1)errors.push('search-function');
  if(calculatedAmount(12000,2.5)!==30000)errors.push('calculation');
  if(referenceDelta(12000,15000)!==3000||referenceDelta(12000,'')!==-12000)errors.push('delta-function');
}
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,route:'/reference-prices/',review_rows:0,source_row_count:6263,data_type:'REFERENCE',collector:'server_side_only',refresh_default:'disabled',browser_api_key:false,synthetic_search_test:true},null,2));
