import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const REQUIRED_FIELDS=['published_date','work_code','name','spec','unit','material_cost_won','labor_cost_won','expense_cost_won','total_cost_won','application_condition'];
const DAY=86400000;
const n=v=>Number(v);
const dateMs=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])):NaN};
const rowKey=r=>[r.work_code,r.name,r.spec,r.unit,r.application_condition].map(v=>String(v??'').trim()).join('\u001f');

export function validateReadyDataset(data,{minRows=5000,maxAgeDays=730,now=new Date()}={}){
  const errors=[],warnings=[];
  const rows=Array.isArray(data?.rows)?data.rows:[];
  if(data?.data_type!=='REFERENCE')errors.push('data_type');
  if(data?.status!=='ready')errors.push('status-not-ready');
  if(data?.schema_version!=='1.1')errors.push('schema-version');
  if(data?.source?.public_data_id!=='15129415')errors.push('source-id');
  if(data?.source?.api_operation!=='getStdMarkUprcinfoList')errors.push('source-operation');
  if(!String(data?.source?.source_url||'').includes('/15129415/'))errors.push('source-url');
  if(JSON.stringify(data?.fields)!==JSON.stringify(REQUIRED_FIELDS))errors.push('fields');
  if(rows.length<Number(minRows))errors.push(`row-floor:${rows.length}/${minRows}`);
  if(Number(data?.source?.collected_row_count)!==rows.length)errors.push('collected-row-count');
  if(Number.isFinite(n(data?.source?.source_row_count))&&n(data.source.source_row_count)<rows.length)errors.push('source-row-count');
  if(Number(data?.source?.completeness_floor_rows||0)!==Number(minRows))errors.push('completeness-floor-meta');

  let maxPublished='',coded=0,standard=0,market=0,componentMismatch=0,negative=0,invalid=0;
  const seen=new Set();
  for(const row of rows){
    const key=rowKey(row);if(seen.has(key))errors.push(`duplicate-row:${key.slice(0,120)}`);else seen.add(key);
    const published=String(row?.published_date||'');if(dateMs(published)){if(published>maxPublished)maxPublished=published}else invalid++;
    if(String(row?.work_code||'').trim())coded++;
    const cond=String(row?.application_condition||'');if(cond.includes('표준시장단가'))standard++;if(cond.includes('시장시공가격'))market++;
    const parts=['material_cost_won','labor_cost_won','expense_cost_won'].map(k=>row?.[k]).filter(v=>v!==null&&v!==undefined&&v!=='').map(Number);
    if(!parts.length||parts.some(v=>!Number.isFinite(v)))invalid++;
    if(parts.some(v=>v<0)||Number(row?.total_cost_won)<0)negative++;
    const sum=parts.reduce((a,b)=>a+b,0);if(!Number.isFinite(Number(row?.total_cost_won))||Math.abs(sum-Number(row.total_cost_won))>1)componentMismatch++;
  }
  if(invalid)errors.push(`invalid-rows:${invalid}`);
  if(negative)errors.push(`negative-cost:${negative}`);
  if(componentMismatch)errors.push(`component-sum:${componentMismatch}`);
  const codeCoverage=rows.length?coded/rows.length:0;if(codeCoverage<0.8)errors.push(`work-code-coverage:${codeCoverage.toFixed(3)}`);
  if(!standard)warnings.push('no-standard-market-label');
  if(!market)warnings.push('no-market-construction-label');
  if(!maxPublished||data?.source?.latest_published_date!==maxPublished)errors.push('latest-published-date');
  const latestMs=dateMs(maxPublished),nowMs=now instanceof Date?now.getTime():new Date(now).getTime();
  if(Number.isFinite(latestMs)&&Number.isFinite(nowMs)){
    const ageDays=(nowMs-latestMs)/DAY;if(ageDays>Number(maxAgeDays))errors.push(`stale:${Math.floor(ageDays)}d`);if(ageDays<-2)errors.push(`future-date:${Math.floor(ageDays)}d`);
  }
  return {ok:errors.length===0,errors,warnings,stats:{rows:rows.length,unique_rows:seen.size,latest_published_date:maxPublished,work_code_coverage:Number(codeCoverage.toFixed(4)),standard_market_rows:standard,market_construction_rows:market,min_rows:Number(minRows),max_age_days:Number(maxAgeDays)}};
}

export function runCli(env=process.env){
  const file=path.resolve(env.PUBLIC_PRICE_FILE||env.OUT_FILE||'interior-cost-core/v6-review/data/public-unit-prices.json');
  const minRows=Math.max(1,Number(env.PPS_MIN_PUBLISHED_ROWS)||5000),maxAgeDays=Math.max(30,Number(env.PPS_MAX_AGE_DAYS)||730);
  const data=JSON.parse(fs.readFileSync(file,'utf8')),result=validateReadyDataset(data,{minRows,maxAgeDays});
  if(!result.ok){console.error(JSON.stringify({...result,file},null,2));process.exit(1)}
  console.log(JSON.stringify({...result,file},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)runCli();
