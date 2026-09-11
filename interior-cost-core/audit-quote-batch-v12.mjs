import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateCsv,aggregateRows,TRADE_FIELDS,PUBLIC_N,SEGMENT_N} from './compile-quote-stats-v6-7.mjs';

const ROOT=path.resolve('docs/interior-cost-preview');
const schema=()=>JSON.parse(fs.readFileSync(path.join(ROOT,'data','quote-sample-schema.json'),'utf8'));
const getArg=(args,name)=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};
const round=(n,d=2)=>Number(Number(n).toFixed(d));
const q=(a,p)=>{const v=a.filter(Number.isFinite).slice().sort((x,y)=>x-y);if(!v.length)return null;const x=(v.length-1)*p,l=Math.floor(x),h=Math.ceil(x);return l===h?v[l]:v[l]+(v[h]-v[l])*(x-l)};
const signature=r=>[r.quote_month,r.region_level1,round(r.supply_pyeong,1),r.building_type,r.scope,r.bathroom_count,r.window_scope,r.vat_state,r.waste_state,round(r.total_amount_manwon,1)].join('|');

export function auditBatch(csvText,{reviewedOn=new Date().toISOString().slice(0,10)}={}){
  const parsed=validateCsv(csvText,schema());
  if(parsed.errors.length)return {version:'12.0.0',reviewed_on:reviewedOn,status:'blocked',valid_rows:parsed.rows.length,error_count:parsed.errors.length,errors:parsed.errors.slice(0,100),raw_rows_persisted:false};
  const rows=parsed.rows,stats=aggregateRows(rows,{reviewedOn});
  const signatures=new Map();for(const r of rows){const s=signature(r);if(!signatures.has(s))signatures.set(s,[]);signatures.get(s).push(r.sample_id)}
  const duplicateGroups=[...signatures.entries()].filter(([,ids])=>ids.length>1).map(([key,ids])=>({signature:key,count:ids.length,sample_ids:ids}));
  const pp=rows.map(r=>r.supply_pyeong>0?r.total_amount_manwon/r.supply_pyeong:NaN).filter(Number.isFinite),q1=q(pp,.25),q3=q(pp,.75),iqr=q1!=null&&q3!=null?q3-q1:null,lo=pp.length>=8?q1-3*iqr:null,hi=pp.length>=8?q3+3*iqr:null;
  const review=[];
  for(const r of rows){
    const reasons=[],per=r.supply_pyeong>0?r.total_amount_manwon/r.supply_pyeong:null,tradeSum=TRADE_FIELDS.reduce((s,f)=>s+(Number.isFinite(Number(r[f]))?Number(r[f]):0),0);
    if(r.exclusive_pyeong!=null&&Number(r.exclusive_pyeong)>Number(r.supply_pyeong))reasons.push('전용평수가 공급평수보다 큼');
    if(tradeSum>Number(r.total_amount_manwon)*1.05)reasons.push('공종별 금액 합이 총액보다 큼');
    if(per!=null&&lo!=null&&(per<lo||per>hi))reasons.push('데이터셋 내부 평당금액 IQR 범위 이탈');
    if(TRADE_FIELDS.some(f=>Number(r[f])>Number(r.total_amount_manwon)))reasons.push('개별 공종금액이 총액보다 큼');
    if(reasons.length)review.push({sample_id:r.sample_id,reasons});
  }
  const monthCounts=(stats.segments.quote_month||[]).map(x=>({month:x.key,n:x.n}));
  const tradeCounts={};for(const f of TRADE_FIELDS)tradeCounts[f]=rows.filter(r=>r[f]!=null&&Number.isFinite(Number(r[f]))).length;
  return {version:'12.0.0',reviewed_on:reviewedOn,status:'valid',valid_rows:rows.length,error_count:0,raw_rows_persisted:false,raw_rows_returned:false,duplicate_signature_groups:duplicateGroups.length,duplicate_rows:duplicateGroups.reduce((s,x)=>s+x.count,0),review_rows:review.length,review_reasons:review,statistical_review_rule:pp.length>=8?'3×IQR on total_amount_manwon/supply_pyeong':'inactive_until_n8',structural_review_rules:['exclusive_pyeong <= supply_pyeong','trade_sum <= total × 1.05','single trade <= total'],publication:{overall_n:PUBLIC_N,segment_n:SEGMENT_N,mean_published:false},readiness:{overall:{n:stats.sample_count,needed:Math.max(0,PUBLIC_N-stats.sample_count),status:stats.status},published_regions:(stats.segments.region_level1||[]).filter(x=>x.status==='published').length,published_region_pyeong:(stats.segments.region_pyeong_rounded||[]).filter(x=>x.status==='published').length,month_counts:monthCounts,trade_field_counts:tradeCounts}};
}

function selfTest(){
  const s=schema(),header=Object.keys(s.properties),lines=[header.join(',')];
  for(let i=0;i<24;i++){const row={sample_id:`B12_${i}`,quote_month:i<12?'2026-08':'2026-09',region_level1:i<20?'서울':'경기',supply_pyeong:32,exclusive_pyeong:25,building_type:'아파트',scope:'올수리',bathroom_count:2,window_scope:'제외',vat_state:'포함',waste_state:'포함',total_amount_manwon:4300+i*10,bathroom_manwon:800+i};lines.push(header.map(k=>row[k]??'').join(','))}
  const dupe={sample_id:'B12_DUPE',quote_month:'2026-08',region_level1:'서울',supply_pyeong:32,exclusive_pyeong:25,building_type:'아파트',scope:'올수리',bathroom_count:2,window_scope:'제외',vat_state:'포함',waste_state:'포함',total_amount_manwon:4300,bathroom_manwon:800};lines.push(header.map(k=>dupe[k]??'').join(','));
  const out=auditBatch(lines.join('\n'),{reviewedOn:'2026-09-11'});if(out.status!=='valid'||out.valid_rows!==25||out.duplicate_signature_groups!==1||out.readiness.overall.needed!==5||out.readiness.month_counts.length!==2)throw new Error('v12 batch audit self-test failed');
  const bad=auditBatch('sample_id,email\nABC,a@b.com',{reviewedOn:'2026-09-11'});if(bad.status!=='blocked'||!bad.errors.some(x=>x.includes('허용하지 않는 열')))throw new Error('v12 batch privacy self-test failed');
  console.log('v12 batch audit self-test ok');
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked){const args=process.argv.slice(2);if(args.includes('--self-test'))selfTest();else{const input=getArg(args,'--input'),output=getArg(args,'--output');if(!input)throw new Error('Usage: node audit-quote-batch-v12.mjs --input PRIVATE.csv [--output summary.json]');const result=auditBatch(fs.readFileSync(input,'utf8'));const text=JSON.stringify(result,null,2);if(output)fs.writeFileSync(output,text);else process.stdout.write(text+'\n');if(result.status!=='valid')process.exitCode=2}}
