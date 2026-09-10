import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const STANDARD_WORK_ITEMS=['철거','폐기물','방수','욕실','주방','도배','바닥','목공','전기','창호','현장관리비','VAT'];
export const SEGMENT_DIMENSIONS=['region_level1','pyeong_band','scope','bathroom_count','window_status','vat_status','waste_status'];
export const MIN_PUBLIC_SAMPLE=80;
export const OUTLIER_MIN_SAMPLE=20;
export const OUTLIER_Z=3.5;

const num=v=>Number.isFinite(Number(v))?Number(v):null;
const cleanStatus=v=>String(v||'unknown');

export function percentile(values,p){
  const a=values.filter(Number.isFinite).slice().sort((x,y)=>x-y);
  if(!a.length)return null;
  if(a.length===1)return a[0];
  const pos=(a.length-1)*p;
  const lo=Math.floor(pos),hi=Math.ceil(pos),w=pos-lo;
  return Math.round((a[lo]*(1-w)+a[hi]*w)*100)/100;
}

function median(values){return percentile(values,.5)}

export function parseWorkItems(record){
  const raw=record.work_items_json??record.work_items;
  if(!raw)return null;
  try{
    const parsed=typeof raw==='string'?JSON.parse(raw):raw;
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return null;
    if(STANDARD_WORK_ITEMS.some(k=>!parsed[k]))return null;
    return Object.fromEntries(STANDARD_WORK_ITEMS.map(k=>{
      const item=parsed[k]||{};
      const amount=item.amount_manwon==null?null:num(item.amount_manwon);
      return [k,{status:cleanStatus(item.status),amount_manwon:amount,detail_level:String(item.detail_level||'unknown')}];
    }));
  }catch{return null}
}

function canonicalPayload(record,workItems){
  return {
    schema_version:String(record.schema_version||''),
    quote_month:String(record.quote_month||''),
    region_level1:String(record.region_level1||''),
    pyeong_band:String(record.pyeong_band||''),
    building_age_band:String(record.building_age_band||''),
    scope:String(record.scope||''),
    bathroom_count:String(record.bathroom_count||''),
    window_status:String(record.window_status||''),
    vat_status:String(record.vat_status||''),
    waste_status:String(record.waste_status||''),
    total_amount_manwon:num(record.total_amount_manwon),
    work_items:Object.fromEntries(STANDARD_WORK_ITEMS.map(k=>[k,workItems[k]])),
    source_type:String(record.source_type||'')
  };
}

export function fingerprintRecord(record,workItems=parseWorkItems(record)){
  if(!workItems)return null;
  return crypto.createHash('sha256').update(JSON.stringify(canonicalPayload(record,workItems))).digest('hex');
}

export function segmentObject(record){return Object.fromEntries(SEGMENT_DIMENSIONS.map(k=>[k,String(record[k]??'')]))}
export function segmentKey(record){return SEGMENT_DIMENSIONS.map(k=>String(record[k]??'')).join('|')}

function baseFlags(record,workItems){
  const flags=[];
  if(!workItems){flags.push('invalid_work_items');return flags}
  if(!['A','B'].includes(String(record.quality_grade||'')))flags.push('quality_below_b');
  if(!Number.isInteger(num(record.total_amount_manwon))||num(record.total_amount_manwon)<=0)flags.push('invalid_total');
  if(['missing','unknown'].includes(workItems.VAT.status))flags.push('vat_unknown');
  if(['missing','unknown'].includes(workItems['폐기물'].status))flags.push('waste_unknown');
  if(STANDARD_WORK_ITEMS.some(k=>workItems[k].status==='separate'&&workItems[k].amount_manwon==null))flags.push('separate_amount_unknown');
  const listed=STANDARD_WORK_ITEMS.filter(k=>['included','separate'].includes(workItems[k].status));
  const withAmount=listed.filter(k=>Number.isFinite(workItems[k].amount_manwon)&&workItems[k].amount_manwon>0);
  if(listed.length<7)flags.push('too_few_listed_items');
  if(withAmount.length<5)flags.push('too_few_amount_items');
  return flags;
}

function outlierIds(records){
  const grouped=new Map();
  for(const r of records){const k=segmentKey(r);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(r)}
  const ids=new Set();
  const meta=new Map();
  for(const [key,rows] of grouped){
    if(rows.length<OUTLIER_MIN_SAMPLE){meta.set(key,{candidate_count:rows.length,rule_applied:false,outlier_count:0});continue}
    const logs=rows.map(r=>Math.log(Number(r.total_amount_manwon))).filter(Number.isFinite);
    const med=median(logs),abs=logs.map(v=>Math.abs(v-med)),mad=median(abs);
    if(!mad||!Number.isFinite(mad)){meta.set(key,{candidate_count:rows.length,rule_applied:false,outlier_count:0,mad_zero:true});continue}
    let count=0;
    rows.forEach(r=>{const z=.6745*(Math.log(Number(r.total_amount_manwon))-med)/mad;if(Math.abs(z)>OUTLIER_Z){ids.add(r.submission_id);count++}});
    meta.set(key,{candidate_count:rows.length,rule_applied:true,outlier_count:count,method:'log_total_mad_modified_z',threshold:OUTLIER_Z});
  }
  return {ids,meta};
}

export function reviewAndAggregate(records,{minimumPublicSample=MIN_PUBLIC_SAMPLE}={}){
  const sorted=records.slice().sort((a,b)=>String(a.received_at||'').localeCompare(String(b.received_at||''))||String(a.submission_id||'').localeCompare(String(b.submission_id||'')));
  const seen=new Map(),review=[];
  const approvedCandidates=[];
  for(const record of sorted){
    const workItems=parseWorkItems(record),fingerprint=fingerprintRecord(record,workItems),flags=baseFlags(record,workItems);
    let duplicateOf=null;
    if(fingerprint){if(seen.has(fingerprint)){duplicateOf=seen.get(fingerprint);flags.push('exact_duplicate')}else seen.set(fingerprint,record.submission_id)}
    const sourceReview=String(record.review_status||'pending');
    let suggested='ready_for_approval';
    if(sourceReview==='rejected')suggested='excluded_manual';
    else if(duplicateOf)suggested='excluded_duplicate';
    else if(flags.some(f=>['invalid_work_items','invalid_total','quality_below_b','vat_unknown','waste_unknown','separate_amount_unknown','too_few_listed_items','too_few_amount_items'].includes(f)))suggested='needs_review';
    else if(sourceReview==='approved')suggested='approved_candidate';
    review.push({submission_id:record.submission_id,fingerprint,duplicate_of:duplicateOf,source_review_status:sourceReview,suggested_status:suggested,flags});
    if(sourceReview==='approved'&&suggested==='approved_candidate')approvedCandidates.push({...record,work_items:workItems});
  }

  const outliers=outlierIds(approvedCandidates);
  const eligible=approvedCandidates.filter(r=>!outliers.ids.has(r.submission_id));
  for(const row of review)if(outliers.ids.has(row.submission_id)){row.flags.push('statistical_outlier');row.suggested_status='excluded_outlier'}

  const groups=new Map();
  for(const r of eligible){const key=segmentKey(r);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
  const segments=[];
  for(const [key,rows] of groups){
    if(rows.length<minimumPublicSample)continue;
    const totals=rows.map(r=>Number(r.total_amount_manwon)).filter(Number.isFinite);
    const itemStats={};
    for(const item of STANDARD_WORK_ITEMS){
      const vals=rows.map(r=>r.work_items[item]).filter(x=>['included','separate'].includes(x.status)&&Number.isFinite(x.amount_manwon)&&x.amount_manwon>0).map(x=>x.amount_manwon);
      if(vals.length>=minimumPublicSample)itemStats[item]={sample_count:vals.length,p25:percentile(vals,.25),median:percentile(vals,.5),p75:percentile(vals,.75)};
    }
    const months=rows.map(r=>String(r.quote_month||'')).filter(Boolean).sort();
    segments.push({
      key,
      dimensions:segmentObject(rows[0]),
      sample_count:rows.length,
      excluded_outlier_count:outliers.meta.get(key)?.outlier_count||0,
      period:{from:months[0]||null,to:months.at(-1)||null},
      total_amount_manwon:{p25:percentile(totals,.25),median:percentile(totals,.5),p75:percentile(totals,.75)},
      work_items:itemStats
    });
  }
  segments.sort((a,b)=>a.key.localeCompare(b.key,'ko'));

  const publicData={
    dataset:'익명 인테리어 견적 공개 집계',
    data_type:'QUOTE',
    schema_version:'1.0',
    generated_at:new Date().toISOString(),
    minimum_public_sample:minimumPublicSample,
    outlier_rule:`같은 세그먼트의 승인 표본이 ${OUTLIER_MIN_SAMPLE}건 이상일 때 log(total_amount_manwon)의 MAD modified z-score 절대값 > ${OUTLIER_Z}를 이상치로 분리. 원본값은 수정하지 않음`,
    segment_dimensions:SEGMENT_DIMENSIONS,
    statistics:['p25','median','p75','sample_count'],
    status:segments.length?'published_segments_available':'no_public_segment',
    segments
  };
  const privateReview={
    generated_at:publicData.generated_at,
    input_count:records.length,
    approved_candidate_count:approvedCandidates.length,
    eligible_after_outlier_count:eligible.length,
    published_segment_count:segments.length,
    minimum_public_sample:minimumPublicSample,
    records:review
  };
  return {publicData,privateReview};
}

function loadRecords(file){
  const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
  if(Array.isArray(parsed))return parsed;
  if(Array.isArray(parsed.records))return parsed.records;
  if(Array.isArray(parsed.results))return parsed.results;
  throw new Error('INPUT_JSON must contain an array or {records:[...]} / {results:[...]}');
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const input=process.env.INPUT_JSON;
  const publicOut=process.env.PUBLIC_OUT;
  const privateOut=process.env.PRIVATE_REVIEW_OUT;
  if(!input||!publicOut)throw new Error('INPUT_JSON and PUBLIC_OUT are required');
  const records=loadRecords(path.resolve(input));
  const {publicData,privateReview}=reviewAndAggregate(records,{minimumPublicSample:Number(process.env.MIN_PUBLIC_SAMPLE||MIN_PUBLIC_SAMPLE)});
  fs.mkdirSync(path.dirname(path.resolve(publicOut)),{recursive:true});
  fs.writeFileSync(path.resolve(publicOut),JSON.stringify(publicData,null,2)+'\n');
  if(privateOut){fs.mkdirSync(path.dirname(path.resolve(privateOut)),{recursive:true});fs.writeFileSync(path.resolve(privateOut),JSON.stringify(privateReview,null,2)+'\n')}
  console.log(JSON.stringify({ok:true,input_count:records.length,published_segment_count:publicData.segments.length,status:publicData.status,public_out:path.resolve(publicOut),private_review_out:privateOut?path.resolve(privateOut):null},null,2));
}
