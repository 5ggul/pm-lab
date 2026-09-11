import fs from 'node:fs';
import path from 'node:path';
import {parseLivePayload,normalizeLiveRow,validateLiveRow,dedupeLatestRows,buildDataset,resolveQueryRange,collectLiveRows,API_BASE} from '../collect-pps-g2b-price-info.mjs';
import {validateReadyDataset} from './validate-public-unit-prices-ready-v6.mjs';

const errors=[];
const fixturePath=path.resolve('interior-cost-core/fixtures/pps-g2b-standard-market.sample.json');
if(!fs.existsSync(fixturePath))errors.push('fixture-missing');
if(!API_BASE.includes('/PriceInfoService/getStdMarkUprcinfoList'))errors.push('api-operation');
if(!errors.length){
  const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
  const parsed=parseLivePayload(fixture);
  if(parsed.items.length!==3||parsed.totalCount!==3||parsed.resultCode!=='00')errors.push('fixture-parse');
  const normalized=parsed.items.map(normalizeLiveRow);
  if(normalized[0].total_cost_won!==3300)errors.push('cost-sum');
  if(normalized[0].published_date!=='2025-01-01')errors.push('date-normalization');
  if(!normalized[0].application_condition.includes('건축')||!normalized[0].application_condition.includes('표준시장단가'))errors.push('condition-context');
  if(!normalized.every(validateLiveRow))errors.push('row-validation');
  const deduped=dedupeLatestRows(normalized);
  if(deduped.length!==2)errors.push('latest-dedupe-count');
  const latestTile=deduped.find(x=>x.work_code==='A01');
  if(latestTile?.published_date!=='2026-01-15'||latestTile?.total_cost_won!==3550)errors.push('latest-dedupe-value');
  const dataset=buildDataset({rows:deduped,sourceTotalCount:3,rawRowCount:3,validRowCount:3,minPublishedRows:2,start:'20250101',end:'20260201',generatedAt:'2026-02-02T00:00:00.000Z'});
  if(dataset.data_type!=='REFERENCE'||dataset.status!=='ready'||dataset.schema_version!=='1.1')errors.push('dataset-contract');
  if(dataset.source.public_data_id!=='15129415'||dataset.source.api_operation!=='getStdMarkUprcinfoList')errors.push('dataset-source');
  if(dataset.source.latest_published_date!=='2026-01-15'||dataset.source.total_cost_method!=='재료비단가 + 노무비단가 + 경비단가'||dataset.source.completeness_floor_rows!==2)errors.push('dataset-source-meta');
  const readyCheck=validateReadyDataset(dataset,{minRows:2,maxAgeDays:60,now:new Date('2026-02-02T00:00:00Z')});
  if(!readyCheck.ok||readyCheck.stats.rows!==2)errors.push(`ready-validator:${readyCheck.errors.join(',')}`);
  const range=resolveQueryRange({PPS_QUERY_START_DATE:'20250101',PPS_QUERY_END_DATE:'20260201'});
  if(range.start!=='20250101'||range.end!=='20260201')errors.push('query-range');
  try{parseLivePayload({response:{header:{resultCode:'30',resultMsg:'SERVICE KEY IS NOT REGISTERED ERROR'},body:{items:[]}}});errors.push('api-error-not-thrown')}catch{}
  const calls=[];
  const pages=[
    {response:{header:{resultCode:'00'},body:{pageNo:1,numOfRows:2,totalCount:3,items:parsed.items.slice(0,2)}}},
    {response:{header:{resultCode:'00'},body:{pageNo:2,numOfRows:2,totalCount:3,items:parsed.items.slice(2)}}}
  ];
  const mockFetch=async url=>{calls.push(String(url));return{ok:true,status:200,json:async()=>pages.shift()}};
  const collected=await collectLiveRows({fetchImpl:mockFetch,apiKey:'abc%2B123',start:'20250101',end:'20260201',perPage:2,maxPages:5,minPublishedRows:2});
  if(calls.length!==2||collected.sourceTotalCount!==3||collected.rows.length!==2||collected.minPublishedRows!==2)errors.push('pagination');
  if(!calls[0].includes('inqryDiv=1')||!calls[0].includes('inqryBgnDate=20250101')||!calls[0].includes('inqryEndDate=20260201')||!calls[0].includes('type=json'))errors.push('request-params');
  if(!calls[0].includes('ServiceKey=abc%2B123'))errors.push('service-key-normalization');
  try{await collectLiveRows({fetchImpl:async()=>({ok:true,status:200,json:async()=>fixture}),apiKey:'fixture',start:'20250101',end:'20260201',perPage:1000,maxPages:1,minPublishedRows:3});errors.push('completeness-floor-not-enforced')}catch(error){if(!String(error?.message||'').includes('completeness floor not met'))errors.push('completeness-floor-error')}
  const secret='safe-secret+123';
  const failFetch=async()=>({ok:false,status:403,headers:{get:name=>name==='content-type'?'text/html':name==='server'?'gateway-test':''},text:async()=>`Forbidden key=${secret}`});
  try{await collectLiveRows({fetchImpl:failFetch,apiKey:secret,start:'20250101',end:'20260201',perPage:1,maxPages:1,minPublishedRows:1});errors.push('http-error-not-thrown')}catch(error){const msg=String(error?.message||'');if(!msg.includes('HTTP 403')||!msg.includes('content-type=text/html')||!msg.includes('server=gateway-test')||!msg.includes('[REDACTED]')||msg.includes(secret))errors.push('http-error-diagnostic-redaction')}
  const stale={...dataset,source:{...dataset.source,latest_published_date:'2020-01-01'},rows:dataset.rows.map(r=>({...r,published_date:'2020-01-01'}))};
  const staleCheck=validateReadyDataset(stale,{minRows:2,maxAgeDays:365,now:new Date('2026-02-02T00:00:00Z')});if(staleCheck.ok||!staleCheck.errors.some(x=>x.startsWith('stale:')))errors.push('stale-validator');
}
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,source:'15129415',operation:'getStdMarkUprcinfoList',fixture_rows:3,published_rows:2,total_is_component_sum:true,pagination:true,completeness_floor:true,ready_snapshot_validator:true,stale_guard:true,sanitized_http_diagnostics:true,api_key_not_required_for_contract_test:true},null,2));
