import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateCsv,aggregateRows,TRADE_FIELDS,PUBLIC_N,SEGMENT_N} from './compile-quote-stats-v6-7.mjs';

const ROOT=path.resolve('docs/interior-cost-preview');
const schemaPath=path.join(ROOT,'data','quote-sample-schema.json');
const schema=()=>JSON.parse(fs.readFileSync(schemaPath,'utf8'));
const getArg=(args,name)=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};
const top=(arr,n=20)=>arr.slice().sort((a,b)=>b.n-a.n).slice(0,n);

export function auditCsv(csvText,{reviewedOn=new Date().toISOString().slice(0,10)}={}){
  const parsed=validateCsv(csvText,schema());
  if(parsed.errors.length)return {version:'11.0.0',reviewed_on:reviewedOn,status:'blocked',valid_rows:parsed.rows.length,error_count:parsed.errors.length,errors:parsed.errors.slice(0,100),raw_rows_persisted:false};
  const stats=aggregateRows(parsed.rows,{reviewedOn});
  const tradeFieldCounts={};for(const field of TRADE_FIELDS)tradeFieldCounts[field]=parsed.rows.filter(r=>r[field]!=null&&Number.isFinite(Number(r[field]))).length;
  const readiness={
    overall:{n:stats.sample_count,threshold:PUBLIC_N,needed:Math.max(0,PUBLIC_N-stats.sample_count),status:stats.status},
    published_regions:(stats.segments.region_level1||[]).filter(x=>x.status==='published').length,
    published_region_pyeong:(stats.segments.region_pyeong_rounded||[]).filter(x=>x.status==='published').length,
    closest_region_cells:top((stats.segments.region_level1||[]).map(x=>({...x,needed:Math.max(0,SEGMENT_N-x.n)})).filter(x=>x.status!=='published'),10),
    closest_region_pyeong_cells:top((stats.segments.region_pyeong_rounded||[]).map(x=>({...x,needed:Math.max(0,SEGMENT_N-x.n)})).filter(x=>x.status!=='published'),20),
    trade_field_counts:tradeFieldCounts
  };
  return {version:'11.0.0',reviewed_on:reviewedOn,status:'valid',valid_rows:parsed.rows.length,error_count:0,header_columns:parsed.header.length,raw_rows_persisted:false,raw_rows_returned:false,publication:{overall_n:PUBLIC_N,segment_n:SEGMENT_N,mean_published:false},readiness};
}

function selfTest(){
  const s=schema(),header=Object.keys(s.properties),lines=[header.join(',')];
  for(let i=0;i<24;i++){
    const row={sample_id:`V11_${i}`,quote_month:'2026-09',region_level1:i<20?'서울':'경기',supply_pyeong:32,building_type:'아파트',scope:'올수리',bathroom_count:2,window_scope:'제외',vat_state:'포함',waste_state:'포함',total_amount_manwon:4500+i*5,bathroom_manwon:800+i};
    lines.push(header.map(k=>row[k]??'').join(','));
  }
  const out=auditCsv(lines.join('\n'),{reviewedOn:'2026-09-11'});
  if(out.status!=='valid'||out.valid_rows!==24||out.readiness.overall.needed!==6||out.readiness.published_regions!==1||out.readiness.trade_field_counts.bathroom_manwon!==24)throw new Error('v11 audit self-test failed');
  const bad=auditCsv('sample_id,phone\nABC,010',{reviewedOn:'2026-09-11'});if(bad.status!=='blocked'||!bad.errors.some(x=>x.includes('허용하지 않는 열')))throw new Error('v11 privacy self-test failed');
  console.log('v11 quote dataset audit self-test ok');
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked){
  const args=process.argv.slice(2);if(args.includes('--self-test'))selfTest();else{
    const input=getArg(args,'--input'),output=getArg(args,'--output');if(!input)throw new Error('Usage: node audit-quote-dataset-v11.mjs --input PRIVATE.csv [--output summary.json]');
    const result=auditCsv(fs.readFileSync(input,'utf8'));const text=JSON.stringify(result,null,2);if(output)fs.writeFileSync(output,text);else process.stdout.write(text+'\n');if(result.status!=='valid')process.exitCode=2;
  }
}
