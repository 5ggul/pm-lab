import {reviewAndAggregate,STANDARD_WORK_ITEMS,METHODOLOGY_VERSION} from '../quote-ingest/review-aggregate.mjs';

const errors=[];
const work=(total)=>Object.fromEntries(STANDARD_WORK_ITEMS.map((name,i)=>[name,{status:'included',amount_manwon:Math.max(10,Math.round(total*(0.035+i*0.003))),detail_level:'detailed'}]));
const row=(i,{region='서울',grade='A',reviewer='approved',total=5000+i*3,id=`s${String(i).padStart(4,'0')}`,received=`2026-09-${String((i%28)+1).padStart(2,'0')}T00:00:00Z`,workItems=null}={})=>({
  submission_id:id,
  schema_version:'1.0',
  quote_month:'2026-09',
  region_level1:region,
  pyeong_band:'30-34평',
  building_age_band:'20-29년',
  scope:'전체',
  bathroom_count:'2',
  window_status:'excluded',
  vat_status:'included',
  waste_status:'included',
  total_amount_manwon:total,
  work_items_json:JSON.stringify(workItems||work(total)),
  source_type:'self_reported_quote',
  quality_grade:grade,
  quality_flags_json:'[]',
  review_status:'pending',
  reviewer_status:reviewer,
  received_at:received
});

const records=[];
for(let i=0;i<84;i++)records.push(row(i));
records.push({...records[0],submission_id:'dup-0001',received_at:'2026-09-29T00:00:00Z'});
records.push(row(900,{id:'outlier-0001',total:50000,received:'2026-09-30T00:00:00Z'}));
records.push(row(901,{id:'quality-c-0001',grade:'C',total:8201}));
records.push(row(902,{id:'pending-0001',reviewer:'pending',total:8207}));
for(let i=0;i<79;i++)records.push(row(1000+i,{id:`g${i}`,region:'경기',total:4600+i*4}));
for(let i=0;i<79;i++)records.push(row(2000+i,{id:`b${i}`,region:'부산',total:4700+i*4}));
records.push(row(2999,{id:'busan-outlier',region:'부산',total:60000}));
const pendingFirst=row(3001,{id:'pending-first',region:'인천',reviewer:'pending',total:7001,received:'2026-09-01T00:00:00Z'});
const approvedLater={...pendingFirst,submission_id:'approved-later',reviewer_status:'approved',received_at:'2026-09-20T00:00:00Z'};
records.push(pendingFirst,approvedLater);

const {publicData,privateReview}=reviewAndAggregate(records);
if(publicData.methodology_version!==METHODOLOGY_VERSION)errors.push('methodology-version');
if(publicData.minimum_public_sample!==80)errors.push('threshold');
if(publicData.segments.length!==1)errors.push(`published-segments:${publicData.segments.length}`);
const seg=publicData.segments[0];
if(seg?.dimensions?.region_level1!=='서울')errors.push('wrong-published-region');
if(seg?.sample_count!==84)errors.push(`sample-count:${seg?.sample_count}`);
if(seg?.excluded_outlier_count!==1)errors.push(`outlier-count:${seg?.excluded_outlier_count}`);
if(!(seg?.total_amount_manwon?.p25<=seg?.total_amount_manwon?.median&&seg?.total_amount_manwon?.median<=seg?.total_amount_manwon?.p75))errors.push('percentile-order');
if(Object.keys(seg?.work_items||{}).length!==12)errors.push(`work-item-stats:${Object.keys(seg?.work_items||{}).length}`);
if(publicData.segments.some(x=>x.dimensions.region_level1==='경기'))errors.push('published-79-segment');
if(publicData.segments.some(x=>x.dimensions.region_level1==='부산'))errors.push('published-80-before-outlier-segment');
const byId=Object.fromEntries(privateReview.records.map(x=>[x.submission_id,x]));
if(byId['dup-0001']?.suggested_status!=='excluded_duplicate')errors.push('duplicate-status');
if(byId['outlier-0001']?.suggested_status!=='excluded_outlier')errors.push('outlier-status');
if(byId['quality-c-0001']?.suggested_status!=='needs_review')errors.push('quality-c-status');
if(byId['pending-0001']?.suggested_status!=='ready_for_approval')errors.push('pending-status');
if(byId['pending-first']?.suggested_status!=='excluded_duplicate'||byId['pending-first']?.duplicate_of!=='approved-later')errors.push('approved-duplicate-winner');
if(byId['approved-later']?.suggested_status!=='approved_candidate')errors.push('reviewer-status-priority');
const publicText=JSON.stringify(publicData);
for(const id of ['dup-0001','outlier-0001','pending-0001','s0000','approved-later'])if(publicText.includes(id))errors.push(`public-leaks-id:${id}`);
if(publicText.includes('received_at')||publicText.includes('fingerprint')||publicText.includes('duplicate_of')||publicText.includes('reviewer_status'))errors.push('public-leaks-review-metadata');
if(!publicData.outlier_rule.includes('MAD'))errors.push('outlier-methodology');

if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,synthetic_only:true,input_count:records.length,published_segments:publicData.segments.length,published_sample_count:seg.sample_count,below_threshold_79_hidden:true,threshold_checked_after_outlier:true,duplicate_excluded:true,approved_duplicate_wins_pending:true,outlier_excluded:true,pending_not_published:true,quality_c_not_published:true,raw_ids_public:false,work_item_statistics:Object.keys(seg.work_items).length,methodology_version:METHODOLOGY_VERSION},null,2));
