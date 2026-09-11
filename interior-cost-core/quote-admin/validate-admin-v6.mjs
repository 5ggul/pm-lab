import fs from 'node:fs';
import path from 'node:path';
import worker from '../quote-ingest/worker.mjs';

const root=path.resolve('interior-cost-core/quote-admin');
const errors=[];
for(const file of ['index.html','admin.css','admin.js'])if(!fs.existsSync(path.join(root,file)))errors.push(`missing:${file}`);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'admin.js'),'utf8');
const workerText=fs.readFileSync(path.resolve('interior-cost-core/quote-ingest/worker.mjs'),'utf8');
const wrangler=fs.readFileSync(path.resolve('interior-cost-core/quote-ingest/wrangler.toml.example'),'utf8');
for(const t of ['noindex,nofollow','PRIVATE ADMIN','data-admin-token','data-queue-list','data-save-review','data-segments'])if(!html.includes(t))errors.push(`admin-html:${t}`);
for(const t of ['Authorization','Bearer ',"credentials:'omit'",'beforeunload','/admin/v1/summary','/admin/v1/quotes?','/review'])if(!js.includes(t))errors.push(`admin-js:${t}`);
if(/localStorage|sessionStorage/.test(js))errors.push('admin-token-storage');
if(/innerHTML/.test(js))errors.push('admin-server-innerhtml');
for(const t of ['ADMIN_API_ENABLED','ADMIN_ORIGIN','ADMIN_API_TOKEN','sameSecret','/admin/v1/summary','/admin/v1/quotes','outlier_hold','reviewer_note_code'])if(!workerText.includes(t))errors.push(`worker-admin:${t}`);
if(!wrangler.includes('ADMIN_API_ENABLED = "false"'))errors.push('wrangler-admin-default');
if(/^\s*ADMIN_API_TOKEN\s*=/m.test(wrangler))errors.push('wrangler-token-inline');
if(!wrangler.includes('wrangler secret put ADMIN_API_TOKEN'))errors.push('wrangler-token-secret');

const WORK_NAMES=['철거','폐기물','방수','욕실','주방','도배','바닥','목공','전기','창호','현장관리비','VAT'];
function sampleWork(){return Object.fromEntries(WORK_NAMES.map(k=>[k,{status:'included',amount_manwon:100,detail_level:'detailed'}]))}
function makeDb(){
  const state={reviewWrites:[]};
  const execute=(sql,args=[])=>({
    async all(){
      if(sql.includes('GROUP BY COALESCE(r.reviewer_status'))return{results:[{reviewer_status:'pending',count:2},{reviewer_status:'approved',count:81}]};
      if(sql.includes('approved_count'))return{results:[{region_level1:'서울',pyeong_band:'30-34평',scope:'전체',bathroom_count:'2',window_status:'excluded',vat_status:'included',waste_status:'included',approved_count:81}]};
      if(sql.includes('q.received_at<?'))return{results:[{
        submission_id:'sample_admin_123456',quote_month:'2026-09',region_level1:'서울',pyeong_band:'30-34평',building_age_band:'20-29년',scope:'전체',bathroom_count:'2',window_status:'excluded',vat_status:'included',waste_status:'included',total_amount_manwon:5200,
        work_items_json:JSON.stringify(sampleWork()),quality_grade:'A',quality_flags_json:'[]',received_at:'2026-09-10T00:00:00Z',reviewer_status:'pending',suggested_status:'ready_for_approval',review_flags_json:'[]',duplicate_of:null,reviewer_note_code:null,reviewed_at:null
      }]};
      return{results:[]};
    },
    async first(){
      if(sql.includes('SELECT submission_id FROM quote_submissions'))return{submission_id:String(args[0])};
      return null;
    },
    async run(){
      if(sql.includes('INSERT INTO quote_reviews'))state.reviewWrites.push(args);
      return{success:true};
    }
  });
  return{state,prepare(sql){return{bind(...args){return execute(sql,args)},...execute(sql,[])}}};
}
async function req(url,{method='GET',origin='https://admin.example.test',token='',body}={}){
  const headers={Origin:origin};
  if(token)headers.Authorization='Bearer '+token;
  if(body)headers['content-type']='application/json';
  return new Request(url,{method,headers,body:body?JSON.stringify(body):undefined});
}

if(!errors.length){
  const db=makeDb();
  const baseEnv={QUOTE_DB:db,ALLOWED_ORIGIN:'https://site.example.test',ADMIN_ORIGIN:'https://admin.example.test',ADMIN_API_TOKEN:'super-secret-admin-token-123456'};
  let res=await worker.fetch(await req('https://api.example.test/admin/v1/summary',{token:'super-secret-admin-token-123456'}),{...baseEnv,ADMIN_API_ENABLED:'false'});
  if(res.status!==404)errors.push(`disabled:${res.status}`);

  res=await worker.fetch(await req('https://api.example.test/admin/v1/summary',{origin:'https://evil.example.test',token:'super-secret-admin-token-123456'}),{...baseEnv,ADMIN_API_ENABLED:'true'});
  if(res.status!==403)errors.push(`origin:${res.status}`);

  res=await worker.fetch(await req('https://api.example.test/admin/v1/summary'),{...baseEnv,ADMIN_API_ENABLED:'true'});
  if(res.status!==401)errors.push(`unauthorized:${res.status}`);

  res=await worker.fetch(await req('https://api.example.test/admin/v1/summary',{token:'super-secret-admin-token-123456'}),{...baseEnv,ADMIN_API_ENABLED:'true'});
  if(res.status!==200)errors.push(`summary:${res.status}`);
  else{const b=await res.json();if(b.minimum_public_sample!==80||!Array.isArray(b.segments))errors.push('summary-body')}

  res=await worker.fetch(await req('https://api.example.test/admin/v1/quotes?status=pending&limit=50',{token:'super-secret-admin-token-123456'}),{...baseEnv,ADMIN_API_ENABLED:'true'});
  if(res.status!==200)errors.push(`list:${res.status}`);
  else{const b=await res.json();const row=b.items?.[0];if(!row?.work_items||row.work_items_json!==undefined||row.quality_flags_json!==undefined||row.review_flags_json!==undefined)errors.push('list-sanitization')}

  res=await worker.fetch(await req('https://api.example.test/admin/v1/quotes/sample_admin_123456/review',{method:'POST',token:'super-secret-admin-token-123456',body:{status:'approved',reason_code:'ok',duplicate_of:null}}),{...baseEnv,ADMIN_API_ENABLED:'true'});
  if(res.status!==200)errors.push(`review-approved:${res.status}`);
  if(db.state.reviewWrites.length!==1)errors.push('review-write');

  res=await worker.fetch(await req('https://api.example.test/admin/v1/quotes/sample_admin_123456/review',{method:'POST',token:'super-secret-admin-token-123456',body:{status:'duplicate',reason_code:'exact_duplicate',duplicate_of:null}}),{...baseEnv,ADMIN_API_ENABLED:'true'});
  if(res.status!==400)errors.push(`duplicate-target:${res.status}`);

  res=await worker.fetch(await req('https://api.example.test/admin/v1/quotes?status=wat',{token:'super-secret-admin-token-123456'}),{...baseEnv,ADMIN_API_ENABLED:'true'});
  if(res.status!==400)errors.push(`bad-filter:${res.status}`);
}

if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,admin_default:'disabled',auth:'origin+bearer',token_storage:'memory_only',public_link:false,review_actions:['approved','rejected','duplicate','outlier_hold'],freeform_reviewer_note:false,raw_public_get:false},null,2));
