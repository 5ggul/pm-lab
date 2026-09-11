import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {reviewAndAggregate,MIN_PUBLIC_SAMPLE,METHODOLOGY_VERSION} from './review-aggregate.mjs';

const FORBIDDEN_PUBLIC_KEYS=/submission_id|fingerprint|duplicate_of|reviewer_status|review_status|received_at|work_items_json|quality_flags_json/i;

function readRecords(file){
  const parsed=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
  if(Array.isArray(parsed)) return parsed;
  if(Array.isArray(parsed.records)) return parsed.records;
  throw new Error('normalized input must contain records[]');
}
function readExisting(file){
  try{return JSON.parse(fs.readFileSync(path.resolve(file),'utf8'))}catch{return null}
}
function canonical(value){
  if(Array.isArray(value)) return value.map(canonical);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
function semantic(value){
  const copy=structuredClone(value);
  if(copy&&typeof copy==='object') delete copy.generated_at;
  return canonical(copy);
}
function sameSemantic(a,b){return JSON.stringify(semantic(a))===JSON.stringify(semantic(b))}
function scanPublicKeys(value,pathName='root'){
  if(Array.isArray(value)){value.forEach((v,i)=>scanPublicKeys(v,`${pathName}[${i}]`));return}
  if(!value||typeof value!=='object')return;
  for(const [key,val] of Object.entries(value)){
    if(FORBIDDEN_PUBLIC_KEYS.test(key)) throw new Error(`private field leaked to public output at ${pathName}.${key}`);
    scanPublicKeys(val,`${pathName}.${key}`);
  }
}
export function validatePublicDataset(data){
  if(data?.data_type!=='QUOTE') throw new Error('public dataset data_type must be QUOTE');
  if(data?.minimum_public_sample!==MIN_PUBLIC_SAMPLE) throw new Error(`minimum_public_sample must remain ${MIN_PUBLIC_SAMPLE}`);
  if(data?.methodology_version!==METHODOLOGY_VERSION) throw new Error('methodology_version mismatch');
  if(!Array.isArray(data?.segments)) throw new Error('segments must be an array');
  scanPublicKeys(data);
  for(const segment of data.segments){
    if(Number(segment.sample_count)<MIN_PUBLIC_SAMPLE) throw new Error(`segment below public threshold: ${segment.key||'unknown'}`);
    const total=segment.total_amount_manwon||{};
    if(![total.p25,total.median,total.p75].every(Number.isFinite)) throw new Error(`invalid total percentiles: ${segment.key||'unknown'}`);
    if(!(total.p25<=total.median&&total.median<=total.p75)) throw new Error(`unordered total percentiles: ${segment.key||'unknown'}`);
    for(const [item,stats] of Object.entries(segment.work_items||{})){
      if(Number(stats.sample_count)<MIN_PUBLIC_SAMPLE) throw new Error(`work item below public threshold: ${segment.key||'unknown'}:${item}`);
      if(!(Number(stats.p25)<=Number(stats.median)&&Number(stats.median)<=Number(stats.p75))) throw new Error(`unordered item percentiles: ${segment.key||'unknown'}:${item}`);
    }
  }
  return data;
}

export function buildPublication(records,existing=null){
  const {publicData,privateReview}=reviewAndAggregate(records,{minimumPublicSample:MIN_PUBLIC_SAMPLE});
  validatePublicDataset(publicData);
  const unchanged=existing&&sameSemantic(publicData,existing);
  const output=unchanged?existing:publicData;
  const summary={
    run_id:crypto.randomUUID(),
    generated_at:new Date().toISOString(),
    input_count:privateReview.input_count,
    approved_candidate_count:privateReview.approved_candidate_count,
    eligible_after_outlier_count:privateReview.eligible_after_outlier_count,
    published_segment_count:privateReview.published_segment_count,
    methodology_version:METHODOLOGY_VERSION,
    public_changed:!unchanged
  };
  return {output,summary};
}
function sqlQuote(value){return `'${String(value).replaceAll("'","''")}'`}
export function aggregateRunSql(summary){
  return `INSERT INTO quote_aggregate_runs (run_id,generated_at,input_count,approved_candidate_count,eligible_after_outlier_count,published_segment_count,methodology_version) VALUES (${sqlQuote(summary.run_id)},${sqlQuote(summary.generated_at)},${Number(summary.input_count)},${Number(summary.approved_candidate_count)},${Number(summary.eligible_after_outlier_count)},${Number(summary.published_segment_count)},${sqlQuote(summary.methodology_version)});\n`;
}

function runCli(){
  const input=process.env.INPUT_JSON,publicOut=process.env.PUBLIC_OUT;
  if(!input||!publicOut) throw new Error('INPUT_JSON and PUBLIC_OUT are required');
  const records=readRecords(input),existing=readExisting(publicOut);
  const {output,summary}=buildPublication(records,existing);
  fs.mkdirSync(path.dirname(path.resolve(publicOut)),{recursive:true});
  fs.writeFileSync(path.resolve(publicOut),JSON.stringify(output,null,2)+'\n');
  if(process.env.RUN_SUMMARY_OUT){
    const p=path.resolve(process.env.RUN_SUMMARY_OUT);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(summary,null,2)+'\n',{mode:0o600});
  }
  if(process.env.RUN_LOG_SQL_OUT){
    const p=path.resolve(process.env.RUN_LOG_SQL_OUT);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,aggregateRunSql(summary),{mode:0o600});
  }
  console.log(JSON.stringify({ok:true,public_changed:summary.public_changed,published_segment_count:summary.published_segment_count,methodology_version:summary.methodology_version}));
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)) runCli();
