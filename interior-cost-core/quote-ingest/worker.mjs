const STANDARD = ['철거','폐기물','방수','욕실','주방','도배','바닥','목공','전기','창호','현장관리비','VAT'];
const FORBIDDEN = new Set(['name','company','address','phone','email','account','memo','note','image','file','user_agent','ip_address']);
const TOP_LEVEL = ['schema_version','submission_id','quote_month','region_level1','pyeong_band','building_age_band','scope','bathroom_count','window_status','vat_status','waste_status','total_amount_manwon','work_items','source_type','consent'];
const ENUMS = {
  region_level1:['서울','경기','인천','부산','대구','광주','대전','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주','기타'],
  pyeong_band:['20평 미만','20-24평','25-29평','30-34평','35-39평','40-49평','50평 이상'],
  building_age_band:['5년 미만','5-9년','10-19년','20-29년','30년 이상','모름'],
  scope:['전체','부분'],
  bathroom_count:['0','1','2','3+'],
  window_status:['included','excluded','unknown'],
  item_status:['included','separate','missing','unknown'],
  detail_level:['detailed','one_set','unknown']
};
const ADMIN_STATUSES=['pending','approved','rejected','duplicate','outlier_hold'];
const ADMIN_REASON_CODES=['ok','exact_duplicate','incomplete_conditions','invalid_amount','outlier_needs_context','manual_exclusion','other'];

const json = (body,status=200,origin='') => new Response(JSON.stringify(body),{
  status,
  headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'access-control-allow-origin':origin || 'null',
    'vary':'Origin',
    'x-content-type-options':'nosniff'
  }
});

function scanForbidden(value,path='root',hits=[]){
  if(Array.isArray(value)){
    value.forEach((item,i)=>scanForbidden(item,`${path}[${i}]`,hits));
    return hits;
  }
  if(value && typeof value === 'object'){
    for(const [key,item] of Object.entries(value)){
      if(FORBIDDEN.has(key.toLowerCase())) hits.push(`${path}.${key}`);
      scanForbidden(item,`${path}.${key}`,hits);
    }
  }
  return hits;
}

function quality(payload){
  const values = Object.values(payload.work_items);
  const listed = values.filter(x=>['included','separate'].includes(x.status)).length;
  const amounts = values.filter(x=>Number.isInteger(x.amount_manwon) && x.amount_manwon > 0).length;
  const critical = ['VAT','폐기물'].every(key=>!['unknown','missing'].includes(payload.work_items[key].status));
  let grade = 'C';
  if(listed >= 10 && amounts >= 8 && critical) grade = 'A';
  else if(listed >= 7 && amounts >= 5 && critical) grade = 'B';
  const flags = [];
  if(listed < 5) flags.push('too_few_items');
  if(!critical) flags.push('critical_condition_unknown');
  if(values.some(x=>x.status === 'separate' && x.amount_manwon == null)) flags.push('separate_amount_unknown');
  return {grade,flags};
}

function validate(payload){
  const errors = [];
  for(const key of TOP_LEVEL) if(!(key in payload)) errors.push(`missing:${key}`);
  for(const key of Object.keys(payload)) if(!TOP_LEVEL.includes(key)) errors.push(`unknown:${key}`);
  if(payload.schema_version !== '1.0') errors.push('schema_version');
  if(typeof payload.submission_id !== 'string' || payload.submission_id.length < 12 || payload.submission_id.length > 80) errors.push('submission_id');
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(payload.quote_month || '')) errors.push('quote_month');
  for(const key of ['region_level1','pyeong_band','building_age_band','scope','bathroom_count','window_status']){
    if(!ENUMS[key].includes(payload[key])) errors.push(key);
  }
  if(payload.source_type !== 'self_reported_quote') errors.push('source_type');
  if(payload.consent !== true) errors.push('consent');
  if(!Number.isInteger(payload.total_amount_manwon) || payload.total_amount_manwon < 1 || payload.total_amount_manwon > 100000) errors.push('total_amount_manwon');
  if(!payload.work_items || typeof payload.work_items !== 'object' || Array.isArray(payload.work_items)){
    errors.push('work_items');
  }else{
    const keys = Object.keys(payload.work_items);
    if(keys.length !== STANDARD.length || STANDARD.some(key=>!keys.includes(key))) errors.push('work_items_keys');
    for(const key of STANDARD){
      const item = payload.work_items[key];
      if(!item || typeof item !== 'object'){
        errors.push(`work:${key}`);
        continue;
      }
      const allowedItemKeys = ['status','amount_manwon','detail_level'];
      for(const itemKey of Object.keys(item)) if(!allowedItemKeys.includes(itemKey)) errors.push(`work:${key}:unknown:${itemKey}`);
      if(!ENUMS.item_status.includes(item.status)) errors.push(`work:${key}:status`);
      if(!(item.amount_manwon === null || (Number.isInteger(item.amount_manwon) && item.amount_manwon >= 0 && item.amount_manwon <= 100000))) errors.push(`work:${key}:amount`);
      if(!ENUMS.detail_level.includes(item.detail_level)) errors.push(`work:${key}:detail`);
    }
  }
  if(payload.vat_status !== payload.work_items?.VAT?.status) errors.push('vat_status_mismatch');
  if(payload.waste_status !== payload.work_items?.['폐기물']?.status) errors.push('waste_status_mismatch');
  const forbidden = scanForbidden(payload);
  if(forbidden.length) errors.push(...forbidden.map(path=>`forbidden:${path}`));
  return errors;
}

async function verifyTurnstile(request,env){
  if(!env.TURNSTILE_SECRET) return true;
  const token = request.headers.get('x-turnstile-token');
  if(!token) return false;
  const form = new FormData();
  form.append('secret',env.TURNSTILE_SECRET);
  form.append('response',token);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form});
  const result = await response.json();
  return result.success === true;
}

async function sameSecret(a,b){
  if(!a || !b) return false;
  const enc=new TextEncoder();
  const [da,db]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))]);
  const aa=new Uint8Array(da),bb=new Uint8Array(db);
  let diff=aa.length^bb.length;
  for(let i=0;i<Math.max(aa.length,bb.length);i++) diff|=(aa[i%aa.length]||0)^(bb[i%bb.length]||0);
  return diff===0;
}

function adminCors(origin){return {
  'access-control-allow-origin':origin,
  'access-control-allow-methods':'GET,POST,OPTIONS',
  'access-control-allow-headers':'authorization,content-type',
  'access-control-max-age':'600',
  'vary':'Origin'
}}

async function adminAuth(request,env){
  if(env.ADMIN_API_ENABLED!=='true') return {ok:false,status:404,error:'not_found',origin:''};
  const origin=request.headers.get('Origin')||'';
  const allowed=env.ADMIN_ORIGIN||'';
  if(!allowed || origin!==allowed) return {ok:false,status:403,error:'admin_origin_not_allowed',origin:''};
  const auth=request.headers.get('Authorization')||'';
  const token=auth.startsWith('Bearer ')?auth.slice(7):'';
  if(!(await sameSecret(token,env.ADMIN_API_TOKEN||''))) return {ok:false,status:401,error:'admin_unauthorized',origin:allowed};
  return {ok:true,origin:allowed};
}

function safeJsonParse(value,fallback){try{return JSON.parse(value)}catch{return fallback}}

async function handleAdmin(request,env,pathname){
  const auth=await adminAuth(request,env);
  if(!auth.ok) return json({ok:false,error:auth.error},auth.status,auth.origin);
  const origin=auth.origin;
  if(request.method==='GET' && pathname==='/admin/v1/summary'){
    const counts=await env.QUOTE_DB.prepare(`SELECT COALESCE(r.reviewer_status,'pending') AS reviewer_status, COUNT(*) AS count FROM quote_submissions q LEFT JOIN quote_reviews r ON r.submission_id=q.submission_id GROUP BY COALESCE(r.reviewer_status,'pending')`).all();
    const segments=await env.QUOTE_DB.prepare(`SELECT q.region_level1,q.pyeong_band,q.scope,q.bathroom_count,q.window_status,q.vat_status,q.waste_status,COUNT(*) AS approved_count FROM quote_submissions q JOIN quote_reviews r ON r.submission_id=q.submission_id WHERE r.reviewer_status='approved' AND q.quality_grade IN ('A','B') GROUP BY q.region_level1,q.pyeong_band,q.scope,q.bathroom_count,q.window_status,q.vat_status,q.waste_status ORDER BY approved_count DESC LIMIT 100`).all();
    return json({ok:true,counts:counts.results||[],segments:segments.results||[],minimum_public_sample:80},200,origin);
  }
  if(request.method==='GET' && pathname==='/admin/v1/quotes'){
    const url=new URL(request.url),status=url.searchParams.get('status')||'pending',limit=Math.min(100,Math.max(1,Number(url.searchParams.get('limit')||50)));
    if(!ADMIN_STATUSES.includes(status)) return json({ok:false,error:'invalid_status'},400,origin);
    const before=url.searchParams.get('before')||'9999-12-31T23:59:59.999Z';
    const rows=await env.QUOTE_DB.prepare(`SELECT q.submission_id,q.quote_month,q.region_level1,q.pyeong_band,q.building_age_band,q.scope,q.bathroom_count,q.window_status,q.vat_status,q.waste_status,q.total_amount_manwon,q.work_items_json,q.quality_grade,q.quality_flags_json,q.received_at,COALESCE(r.reviewer_status,'pending') AS reviewer_status,r.suggested_status,r.review_flags_json,r.duplicate_of,r.reviewer_note_code,r.reviewed_at FROM quote_submissions q LEFT JOIN quote_reviews r ON r.submission_id=q.submission_id WHERE COALESCE(r.reviewer_status,'pending')=? AND q.received_at<? ORDER BY q.received_at DESC LIMIT ?`).bind(status,before,limit).all();
    const items=(rows.results||[]).map(row=>({...row,work_items:safeJsonParse(row.work_items_json,{}),quality_flags:safeJsonParse(row.quality_flags_json,[]),review_flags:safeJsonParse(row.review_flags_json,[]),work_items_json:undefined,quality_flags_json:undefined,review_flags_json:undefined}));
    return json({ok:true,status,count:items.length,items,next_before:items.at(-1)?.received_at||null},200,origin);
  }
  const reviewMatch=pathname.match(/^\/admin\/v1\/quotes\/([^/]+)\/review$/);
  if(request.method==='POST' && reviewMatch){
    let body;try{body=await request.json()}catch{return json({ok:false,error:'invalid_json'},400,origin)}
    const submissionId=decodeURIComponent(reviewMatch[1]);
    const status=String(body?.status||''),reason=String(body?.reason_code||''),duplicateOf=body?.duplicate_of?String(body.duplicate_of):null;
    if(!ADMIN_STATUSES.includes(status)||status==='pending') return json({ok:false,error:'invalid_review_status'},400,origin);
    if(!ADMIN_REASON_CODES.includes(reason)) return json({ok:false,error:'invalid_reason_code'},400,origin);
    if(status==='duplicate' && (!duplicateOf || duplicateOf===submissionId)) return json({ok:false,error:'duplicate_target_required'},400,origin);
    if(status!=='duplicate' && duplicateOf) return json({ok:false,error:'duplicate_target_not_allowed'},400,origin);
    const exists=await env.QUOTE_DB.prepare(`SELECT submission_id FROM quote_submissions WHERE submission_id=? LIMIT 1`).bind(submissionId).first();
    if(!exists) return json({ok:false,error:'submission_not_found'},404,origin);
    if(duplicateOf){const target=await env.QUOTE_DB.prepare(`SELECT submission_id FROM quote_submissions WHERE submission_id=? LIMIT 1`).bind(duplicateOf).first();if(!target)return json({ok:false,error:'duplicate_target_not_found'},400,origin)}
    const reviewedAt=new Date().toISOString();
    await env.QUOTE_DB.prepare(`INSERT INTO quote_reviews (submission_id,payload_fingerprint,duplicate_of,suggested_status,review_flags_json,reviewer_status,reviewer_note_code,reviewed_at) VALUES (?,NULL,?,'manual_review','[]',?,?,?) ON CONFLICT(submission_id) DO UPDATE SET duplicate_of=excluded.duplicate_of,reviewer_status=excluded.reviewer_status,reviewer_note_code=excluded.reviewer_note_code,reviewed_at=excluded.reviewed_at`).bind(submissionId,duplicateOf,status,reason,reviewedAt).run();
    return json({ok:true,submission_id:submissionId,reviewer_status:status,reason_code:reason,duplicate_of:duplicateOf,reviewed_at:reviewedAt},200,origin);
  }
  return json({ok:false,error:'not_found'},404,origin);
}

export default {
  async fetch(request,env){
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || '';
    const pathname = new URL(request.url).pathname;

    if(pathname.startsWith('/admin/')){
      if(request.method==='OPTIONS'){
        const adminOrigin=env.ADMIN_ORIGIN||'';
        if(env.ADMIN_API_ENABLED!=='true'||!adminOrigin||origin!==adminOrigin)return new Response(null,{status:403});
        return new Response(null,{status:204,headers:adminCors(adminOrigin)});
      }
      return handleAdmin(request,env,pathname);
    }

    if(request.method === 'OPTIONS'){
      if(!allowed || origin !== allowed) return new Response(null,{status:403});
      return new Response(null,{status:204,headers:{
        'access-control-allow-origin':allowed,
        'access-control-allow-methods':'POST,OPTIONS',
        'access-control-allow-headers':'content-type,x-turnstile-token',
        'access-control-max-age':'600',
        'vary':'Origin'
      }});
    }

    if(request.method !== 'POST' || pathname !== '/v1/quotes') return json({ok:false,error:'not_found'},404,allowed && origin === allowed ? allowed : '');
    if(!allowed || origin !== allowed) return json({ok:false,error:'origin_not_allowed'},403,'');

    const length = Number(request.headers.get('content-length') || 0);
    if(length > 32768) return json({ok:false,error:'payload_too_large'},413,allowed);
    if(!(await verifyTurnstile(request,env))) return json({ok:false,error:'turnstile_failed'},403,allowed);

    let payload;
    try{ payload = await request.json(); }
    catch{ return json({ok:false,error:'invalid_json'},400,allowed); }

    const errors = validate(payload);
    if(errors.length) return json({ok:false,error:'validation_failed',fields:errors.slice(0,24)},400,allowed);

    const q = quality(payload);
    const receivedAt = new Date().toISOString();
    await env.QUOTE_DB.prepare(`INSERT INTO quote_submissions (submission_id,schema_version,quote_month,region_level1,pyeong_band,building_age_band,scope,bathroom_count,window_status,vat_status,waste_status,total_amount_manwon,work_items_json,source_type,quality_grade,quality_flags_json,review_status,received_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(
        payload.submission_id,payload.schema_version,payload.quote_month,payload.region_level1,payload.pyeong_band,
        payload.building_age_band,payload.scope,payload.bathroom_count,payload.window_status,payload.vat_status,
        payload.waste_status,payload.total_amount_manwon,JSON.stringify(payload.work_items),payload.source_type,
        q.grade,JSON.stringify(q.flags),'pending',receivedAt
      ).run();

    return json({ok:true,submission_id:payload.submission_id,quality_grade:q.grade,review_status:'pending'},202,allowed);
  }
};
