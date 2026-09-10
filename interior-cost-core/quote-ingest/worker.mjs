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

const json = (body,status=200,origin='') => new Response(JSON.stringify(body),{
  status,
  headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'access-control-allow-origin':origin || 'null',
    'vary':'Origin'
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

export default {
  async fetch(request,env){
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || '';
    const pathname = new URL(request.url).pathname;

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
