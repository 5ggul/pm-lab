import fs from 'node:fs';
import path from 'node:path';
import {normalizeWranglerExport,EXPECTED_COLUMNS} from '../quote-ingest/normalize-d1-export.mjs';
import {buildPublication,aggregateRunSql} from '../quote-ingest/publish-public-quote-data.mjs';
import {STANDARD_WORK_ITEMS,MIN_PUBLIC_SAMPLE} from '../quote-ingest/review-aggregate.mjs';

const errors=[];
const work=total=>Object.fromEntries(STANDARD_WORK_ITEMS.map((name,i)=>[name,{status:'included',amount_manwon:Math.max(10,Math.round(total*(.03+i*.004))),detail_level:'detailed'}]));
const row=(i,region='서울')=>({
  submission_id:`publish-${region}-${String(i).padStart(4,'0')}`,
  schema_version:'1.0',quote_month:'2026-09',region_level1:region,pyeong_band:'30-34평',building_age_band:'20-29년',scope:'전체',bathroom_count:'2',window_status:'excluded',vat_status:'included',waste_status:'included',
  total_amount_manwon:5000+i*5,work_items_json:JSON.stringify(work(5000+i*5)),source_type:'self_reported_quote',quality_grade:'A',quality_flags_json:'[]',review_status:'pending',reviewer_status:'approved',received_at:`2026-09-${String((i%28)+1).padStart(2,'0')}T00:00:00Z`
});
const records=Array.from({length:MIN_PUBLIC_SAMPLE},(_,i)=>row(i));
const wranglerShape=[{results:records,success:true,meta:{duration:1}}];
let normalized=[];
try{normalized=normalizeWranglerExport(wranglerShape)}catch(e){errors.push(`normalize:${e.message}`)}
if(normalized.length!==MIN_PUBLIC_SAMPLE)errors.push(`normalized-count:${normalized.length}`);
if(normalized.some(r=>Object.keys(r).length!==EXPECTED_COLUMNS.length))errors.push('column-whitelist-count');

let first;
try{first=buildPublication(normalized,null)}catch(e){errors.push(`publish:${e.message}`)}
if(first?.output?.segments?.length!==1)errors.push(`published-segments:${first?.output?.segments?.length}`);
if(first?.output?.segments?.[0]?.sample_count!==MIN_PUBLIC_SAMPLE)errors.push(`published-sample:${first?.output?.segments?.[0]?.sample_count}`);
if(first?.summary?.public_changed!==true)errors.push('first-run-changed');
const publicText=JSON.stringify(first?.output||{});
if(/publish-서울-|submission_id|reviewer_status|received_at|fingerprint/.test(publicText))errors.push('raw-data-leak');

if(first){
  const old={...first.output,generated_at:'2026-09-10T00:00:00.000Z'};
  const second=buildPublication(normalized,old);
  if(second.summary.public_changed!==false)errors.push('semantic-noop-detected-as-change');
  if(second.output.generated_at!==old.generated_at)errors.push('generated-at-noise');
  const sql=aggregateRunSql(second.summary);
  if(!sql.includes('INSERT INTO quote_aggregate_runs')||/submission_id|work_items_json|received_at/.test(sql))errors.push('aggregate-run-sql');
}
const below=buildPublication(normalized.slice(0,MIN_PUBLIC_SAMPLE-1),null);
if(below.output.segments.length!==0||below.output.status!=='no_public_segment')errors.push('below-threshold-published');
try{normalizeWranglerExport([{results:[{...records[0],email:'blocked@example.test'}]}]);errors.push('forbidden-column-accepted')}catch{}
try{normalizeWranglerExport([{results:[Object.fromEntries(Object.entries(records[0]).filter(([k])=>k!=='reviewer_status'))]}]);errors.push('missing-column-accepted')}catch{}

const sql=fs.readFileSync(path.resolve('interior-cost-core/quote-ingest/export-for-aggregate.sql'),'utf8');
if(/SELECT\s+\*/i.test(sql))errors.push('sql-select-star');
for(const word of ['company','address','phone','email','memo','note','user_agent','ip_address'])if(new RegExp(`\\b${word}\\b`,'i').test(sql))errors.push(`sql-forbidden:${word}`);
for(const col of EXPECTED_COLUMNS)if(!sql.includes(col))errors.push(`sql-missing:${col}`);

const workflow=fs.readFileSync(path.resolve('.github/workflows/interior-quote-publish.yml'),'utf8');
for(const token of ["vars.INTERIOR_QUOTE_PUBLISH_ENABLED == 'true'","github.ref == 'refs/heads/main'",'RUNNER_TEMP','wrangler@4.33.1','git pull --rebase origin main','quote-public-segments.json','Cleanup private runner files','rm -f'])if(!workflow.includes(token))errors.push(`workflow:${token}`);
if(/git push[^\n]*--force|git push[^\n]*-f\b/.test(workflow))errors.push('workflow-force-push');
if(/upload-artifact/.test(workflow))errors.push('workflow-private-artifact-risk');
if(!workflow.includes('git diff --name-only'))errors.push('workflow-diff-guard');
if(!workflow.includes('CLOUDFLARE_API_TOKEN')||!workflow.includes('CLOUDFLARE_ACCOUNT_ID'))errors.push('workflow-cloudflare-auth');

if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,synthetic_only:true,remote_d1_called:false,minimum_public_sample:MIN_PUBLIC_SAMPLE,exact_threshold_published:true,below_threshold_hidden:true,private_columns_blocked:true,semantic_noop_preserves_timestamp:true,raw_rows_not_public:true,workflow_default_gate:'repository variable + main branch',force_push:false,raw_artifact_upload:false},null,2));
