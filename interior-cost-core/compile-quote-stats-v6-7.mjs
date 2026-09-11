import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const VERSION='6.7.0';
export const PUBLIC_N=30;
export const SEGMENT_N=20;
const ROOT=path.resolve('docs/interior-cost-preview');
const DEFAULT_STATS=path.join(ROOT,'data','quote-statistics.json');
const DEFAULT_HEALTH=path.join(ROOT,'data','quote-data-health.json');
const NUMERIC=new Set(['supply_pyeong','exclusive_pyeong','bathroom_count','total_amount_manwon','demolition_manwon','waste_manwon','waterproof_manwon','bathroom_manwon','kitchen_manwon','wallpaper_manwon','flooring_manwon','carpentry_manwon','electrical_manwon','window_manwon','management_manwon']);
const TRADE_FIELDS=[...NUMERIC].filter(x=>x.endsWith('_manwon')&&x!=='total_amount_manwon');

function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  const src=String(text||'').replace(/^\ufeff/,'');
  for(let i=0;i<src.length;i++){
    const ch=src[i];
    if(quoted){
      if(ch==='"'&&src[i+1]==='"'){cell+='"';i++;}
      else if(ch==='"')quoted=false;
      else cell+=ch;
    }else if(ch==='"')quoted=true;
    else if(ch===','){row.push(cell.trim());cell='';}
    else if(ch==='\n'){row.push(cell.trim());rows.push(row);row=[];cell='';}
    else if(ch!=='\r')cell+=ch;
  }
  if(cell.length||row.length){row.push(cell.trim());rows.push(row)}
  return rows.filter(r=>r.some(v=>String(v).trim()!==''));
}
function q(values,p){
  const a=values.filter(Number.isFinite).slice().sort((x,y)=>x-y);if(!a.length)return null;
  const idx=(a.length-1)*p,lo=Math.floor(idx),hi=Math.ceil(idx);if(lo===hi)return a[lo];
  return a[lo]+(a[hi]-a[lo])*(idx-lo);
}
const round=(n,d=1)=>n==null?null:Number(n.toFixed(d));
function dist(values){return {p25:round(q(values,.25)),median:round(q(values,.5)),p75:round(q(values,.75))}}
function pyeongBand(v){
  const n=Number(v);if(n<20)return '20평 미만';if(n<30)return '20평대';if(n<40)return '30평대';if(n<50)return '40평대';return '50평 이상';
}
function normalize(row,schema){
  const out={};for(const key of Object.keys(schema.properties||{})){
    const raw=row[key];if(raw==null||raw===''){out[key]=key==='exclusive_pyeong'||key.endsWith('_manwon')?null:raw;continue}
    out[key]=NUMERIC.has(key)?Number(raw):String(raw).trim();
  }
  return out;
}
function validateValue(key,val,rule){
  if(val==null||val===''){return rule.type?.includes?.('null')?null:`${key}: 값이 비어 있음`}
  if(rule.enum&&!rule.enum.includes(val))return `${key}: 허용값 아님`;
  if(rule.pattern&&!new RegExp(rule.pattern).test(String(val)))return `${key}: 형식 불일치`;
  const types=Array.isArray(rule.type)?rule.type:[rule.type];
  if(types.includes('number')||types.includes('integer')){
    if(!Number.isFinite(val))return `${key}: 숫자 아님`;
    if(types.includes('integer')&&!Number.isInteger(val))return `${key}: 정수 아님`;
    if(rule.minimum!=null&&val<rule.minimum)return `${key}: 최소값 미만`;
    if(rule.maximum!=null&&val>rule.maximum)return `${key}: 최대값 초과`;
    if(rule.exclusiveMinimum!=null&&val<=rule.exclusiveMinimum)return `${key}: 0보다 커야 함`;
  }
  return null;
}
export function validateCsv(csvText,schema){
  const matrix=parseCsv(csvText);if(!matrix.length)return {rows:[],errors:['CSV가 비어 있음'],header:[]};
  const header=matrix[0].map(x=>x.trim()),allowed=new Set(Object.keys(schema.properties||{}));
  const unknown=header.filter(h=>!allowed.has(h)),missing=(schema.required||[]).filter(h=>!header.includes(h));
  const errors=[];if(unknown.length)errors.push(`허용하지 않는 열: ${unknown.join(', ')}`);if(missing.length)errors.push(`필수 열 누락: ${missing.join(', ')}`);
  if(errors.length)return {rows:[],errors,header};
  const seen=new Set(),valid=[];
  matrix.slice(1).forEach((cells,idx)=>{
    const raw={};header.forEach((h,i)=>raw[h]=(cells[i]??'').trim());const row=normalize(raw,schema);const rowErrors=[];
    for(const key of schema.required||[]){if(row[key]==null||row[key]==='')rowErrors.push(`${key}: 필수값 누락`)}
    for(const [key,rule] of Object.entries(schema.properties||{})){const e=validateValue(key,row[key],rule);if(e&&!(row[key]==null&&Array.isArray(rule.type)&&rule.type.includes('null')))rowErrors.push(e)}
    if(row.sample_id){if(seen.has(row.sample_id))rowErrors.push('sample_id: 중복');else seen.add(row.sample_id)}
    if(rowErrors.length)errors.push(`행 ${idx+2}: ${rowErrors.join(' / ')}`);else valid.push(row);
  });
  return {rows:valid,errors,header};
}
function distributionFor(rows){
  const totals=rows.map(r=>Number(r.total_amount_manwon)).filter(Number.isFinite);
  const perPyeong=rows.map(r=>Number(r.supply_pyeong)>0?Number(r.total_amount_manwon)/Number(r.supply_pyeong):NaN).filter(Number.isFinite);
  const trades={};for(const field of TRADE_FIELDS){const vals=rows.map(r=>Number(r[field])).filter(v=>Number.isFinite(v)&&v>=0);if(vals.length>=SEGMENT_N)trades[field]={n:vals.length,...dist(vals)}}
  return {total_amount_manwon:dist(totals),per_supply_pyeong_manwon:dist(perPyeong),trade_amounts:trades};
}
function segmentCells(rows,keyFn,threshold=SEGMENT_N){
  const map=new Map();for(const row of rows){const key=keyFn(row);if(!key)continue;if(!map.has(key))map.set(key,[]);map.get(key).push(row)}
  return [...map.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'ko')).map(([key,group])=>({key,n:group.length,status:group.length>=threshold?'published':'withheld',...(group.length>=threshold?{distribution:distributionFor(group)}:{reason:`N<${threshold}`})}));
}
export function aggregateRows(rows,{reviewedOn=new Date().toISOString().slice(0,10)}={}){
  const n=rows.length,eligible=n>=PUBLIC_N;
  return {
    version:VERSION,reviewed_on:reviewedOn,sample_count:n,status:eligible?'published':'withheld',publication_threshold:PUBLIC_N,segment_threshold:SEGMENT_N,
    metrics_visible:eligible?['median','p25','p75']:[],reason:eligible?'검수 통과 표본 수 기준 충족':`검수 통과 실제 견적 표본 N=${n}, 공개 기준 N>=${PUBLIC_N} 미달`,
    methodology:{quantile:'linear interpolation (R-7 compatible)',mean_published:false,raw_rows_persisted:false,per_pyeong_formula:'total_amount_manwon / supply_pyeong'},
    overall:eligible?{n,distribution:distributionFor(rows)}:{n,status:'withheld'},
    segments:{
      region_level1:segmentCells(rows,r=>r.region_level1),
      supply_pyeong_band:segmentCells(rows,r=>pyeongBand(r.supply_pyeong)),
      supply_pyeong_rounded:segmentCells(rows,r=>`${Math.round(Number(r.supply_pyeong))}평`),
      scope:segmentCells(rows,r=>r.scope),
      building_type:segmentCells(rows,r=>r.building_type),
      quote_month:segmentCells(rows,r=>r.quote_month),
      pyeong_band_scope:segmentCells(rows,r=>`${pyeongBand(r.supply_pyeong)} · ${r.scope}`),
      region_pyeong_rounded:segmentCells(rows,r=>`${r.region_level1} · ${Math.round(Number(r.supply_pyeong))}평`),
      region_pyeong_band:segmentCells(rows,r=>`${r.region_level1} · ${pyeongBand(r.supply_pyeong)}`)
    }
  };
}
function health(rows,errors,header,{reviewedOn}){
  const complete={};for(const f of TRADE_FIELDS){complete[f]=rows.length?round(rows.filter(r=>r[f]!=null).length/rows.length*100):0}
  return {version:VERSION,reviewed_on:reviewedOn,source_mode:rows.length?'private_csv_aggregate_only':'no_private_dataset',valid_rows:rows.length,invalid_messages:errors.length,header_columns:header.length,raw_rows_persisted:false,raw_rows_written_to_docs:false,trade_field_completion_percent:complete};
}
export function compileQuoteStats({inputPath=null,csvText=null,statsPath=DEFAULT_STATS,healthPath=DEFAULT_HEALTH,reviewedOn=new Date().toISOString().slice(0,10),strict=true}={}){
  const schema=JSON.parse(fs.readFileSync(path.join(ROOT,'data','quote-sample-schema.json'),'utf8'));
  const text=csvText!=null?csvText:(inputPath?fs.readFileSync(inputPath,'utf8'):'');
  let rows=[],errors=[],header=[];
  if(text){({rows,errors,header}=validateCsv(text,schema))}
  const blocked=strict&&errors.length>0;
  const stats=blocked?{version:VERSION,reviewed_on:reviewedOn,sample_count:0,status:'blocked_invalid_rows',publication_threshold:PUBLIC_N,segment_threshold:SEGMENT_N,metrics_visible:[],reason:'입력 검증 오류가 있어 통계를 생성하지 않음',overall:{n:0,status:'withheld'},segments:{}}:aggregateRows(rows,{reviewedOn});
  const h=health(rows,errors,header,{reviewedOn});
  fs.mkdirSync(path.dirname(statsPath),{recursive:true});fs.writeFileSync(statsPath,JSON.stringify(stats,null,2));fs.writeFileSync(healthPath,JSON.stringify(h,null,2));
  return {stats,health:h,errors};
}
function selfTest(){
  const schema=JSON.parse(fs.readFileSync(path.join(ROOT,'data','quote-sample-schema.json'),'utf8'));
  const header=Object.keys(schema.properties);const lines=[header.join(',')];
  for(let i=0;i<40;i++){
    const row={sample_id:`T${String(i).padStart(3,'0')}`,quote_month:'2026-08',region_level1:i<25?'서울':'경기',supply_pyeong:32,exclusive_pyeong:25.7,building_type:'아파트',scope:'올수리',bathroom_count:2,window_scope:'제외',vat_state:'포함',waste_state:'포함',total_amount_manwon:4000+i*10};
    lines.push(header.map(h=>row[h]??'').join(','));
  }
  const parsed=validateCsv(lines.join('\n'),schema);if(parsed.errors.length||parsed.rows.length!==40)throw new Error('self-test validation failed');
  const out=aggregateRows(parsed.rows,{reviewedOn:'2026-09-11'});if(out.status!=='published'||out.overall.distribution.total_amount_manwon.median!==4195)throw new Error('self-test overall failed');
  const seoul=out.segments.region_level1.find(x=>x.key==='서울'),gyeonggi=out.segments.region_level1.find(x=>x.key==='경기');if(seoul?.status!=='published'||gyeonggi?.status!=='withheld')throw new Error('self-test threshold failed');
  const seoul32=out.segments.region_pyeong_rounded.find(x=>x.key==='서울 · 32평'),gyeonggi32=out.segments.region_pyeong_rounded.find(x=>x.key==='경기 · 32평');if(seoul32?.status!=='published'||gyeonggi32?.status!=='withheld')throw new Error('self-test region pyeong threshold failed');
  const bad=validateCsv('sample_id,phone\nA01,010',schema);if(!bad.errors.some(x=>x.includes('허용하지 않는 열')))throw new Error('self-test privacy header rejection failed');
  console.log('v6.7 quote aggregate compiler self-test ok');
}
function args(){const a=process.argv.slice(2),get=n=>{const i=a.indexOf(n);return i>=0?a[i+1]:null};return {self:a.includes('--self-test'),input:get('--input'),stats:get('--stats')||DEFAULT_STATS,health:get('--health')||DEFAULT_HEALTH}}
const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked){const a=args();if(a.self)selfTest();else{const r=compileQuoteStats({inputPath:a.input,statsPath:a.stats,healthPath:a.health});if(r.errors.length){console.error(r.errors.join('\n'));process.exitCode=2}else console.log(`quote stats ${r.stats.status} N=${r.stats.sample_count}`)}}
