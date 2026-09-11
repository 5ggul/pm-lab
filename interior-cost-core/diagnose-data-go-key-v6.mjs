import fs from 'node:fs';
import path from 'node:path';

const HTTPS_BASE='https://apis.data.go.kr/1230000/ao/PriceInfoService/getStdMarkUprcinfoList';
const HTTP_BASE='http://apis.data.go.kr/1230000/ao/PriceInfoService/getStdMarkUprcinfoList';
const raw=(process.env.DATA_GO_KR_SERVICE_KEY||'').trim();
const outDir=process.env.PREFLIGHT_OUT_DIR||'/tmp/interior-v6-public-price-preflight';
fs.mkdirSync(outDir,{recursive:true});
const outFile=path.join(outDir,'service-key-diagnostic.json');

function decodeOnce(value){
  try{return decodeURIComponent(value)}catch{return value}
}
function extractResult(text){
  try{
    const j=JSON.parse(text);
    const gateway=j?.OpenAPI_ServiceResponse?.cmmMsgHeader;
    if(gateway)return {
      result_code:String(gateway.returnReasonCode??''),
      result_msg:String(gateway.errMsg??''),
      result_reason:String(gateway.returnAuthMsg??''),
      envelope:'gateway'
    };
    const h=j?.response?.header||j?.header||j;
    const body=j?.response?.body||j?.body||{};
    const items=body?.items?.item??body?.items??[];
    return {
      result_code:String(h?.resultCode??''),
      result_msg:String(h?.resultMsg??''),
      result_reason:String(h?.resultReason??''),
      envelope:'provider',
      total_count:Number(body?.totalCount??0)||0,
      item_count:Array.isArray(items)?items.length:(items&&typeof items==='object'?1:0)
    };
  }catch{return {result_code:'',result_msg:'',result_reason:'',envelope:'unparsed',total_count:0,item_count:0}}
}
function safeSnippet(text){
  if(!text)return '';
  let s=text.slice(0,600);
  const decoded=decodeOnce(raw);
  const variants=[raw,decoded];
  try{variants.push(encodeURIComponent(decoded))}catch{}
  for(const secret of [...new Set(variants.filter(Boolean))])s=s.split(secret).join('[REDACTED]');
  return s;
}
const params={
  inqryDiv:'1',
  inqryBgnDate:'20220922',
  inqryEndDate:'20220923',
  pageNo:'1',
  numOfRows:'10',
  type:'json'
};
function officialDirectUrl(base,key){
  // Match the documented sample exactly: Encoding key is inserted after ServiceKey= without URLSearchParams touching it.
  const rest=Object.entries(params).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `${base}?ServiceKey=${key}&${rest}`;
}
function normalizedUrl(base,key){
  const u=new URL(base);
  u.searchParams.set('ServiceKey',key);
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
  return u.toString();
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function probe(label,url,mode){
  const attempts=[];
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const res=await fetch(url,{headers:{accept:'application/json','user-agent':'interior-v6-pps-diagnostic'},redirect:'manual',signal:AbortSignal.timeout(15000)});
      const text=await res.text();
      const parsed=extractResult(text);
      const authRejected=['20','30','31'].includes(parsed.result_code)||/SERVICE_KEY_(IS_NULL|IS_NOT_REGISTERED|IS_EXPIRED)/.test(`${parsed.result_msg} ${parsed.result_reason}`);
      const success=res.ok&&['00','0'].includes(parsed.result_code);
      const row={attempt,http_status:res.status,result_code:parsed.result_code||null,result_msg:parsed.result_msg||null,result_reason:parsed.result_reason||null,envelope:parsed.envelope,total_count:parsed.total_count||0,item_count:parsed.item_count||0,auth_rejected:authRejected,provider_success:success,body_snippet:safeSnippet(text)};
      attempts.push(row);
      if(success||authRejected||res.status<500)return {label,mode,scheme:new URL(url).protocol,...row,attempts};
    }catch(error){
      attempts.push({attempt,error:String(error?.cause?.code||error?.code||error?.message||error)});
    }
    if(attempt<3)await sleep(500*attempt);
  }
  const last=attempts.at(-1)||{};
  return {label,mode,scheme:new URL(url).protocol,http_status:last.http_status??null,result_code:last.result_code??null,result_msg:last.result_msg??null,result_reason:last.result_reason??null,envelope:last.envelope??null,total_count:last.total_count??0,item_count:last.item_count??0,auth_rejected:Boolean(last.auth_rejected),provider_success:Boolean(last.provider_success),error:last.error??null,attempts};
}

const decoded=decodeOnce(raw);
const report={
  generated_at:new Date().toISOString(),
  secret_present:Boolean(raw),
  raw_has_percent_escape:/%[0-9A-Fa-f]{2}/.test(raw),
  decoded_differs:decoded!==raw,
  key_value_logged:false,
  official_sample:{operation:'getStdMarkUprcinfoList',param_name:'ServiceKey',scheme:'http:',encoded_key_direct:true,query:params},
  probes:[]
};
if(raw){
  // Exact official sample transport/serialization first.
  report.probes.push(await probe('official-http-encoded-direct',officialDirectUrl(HTTP_BASE,raw),'encoded-direct'));
  report.probes.push(await probe('official-https-encoded-direct',officialDirectUrl(HTTPS_BASE,raw),'encoded-direct'));
  // Compare with the implementation's decode + URLSearchParams serialization.
  report.probes.push(await probe('http-decoded-urlsearchparams',normalizedUrl(HTTP_BASE,decoded),'decoded-urlsearchparams'));
  report.probes.push(await probe('https-decoded-urlsearchparams',normalizedUrl(HTTPS_BASE,decoded),'decoded-urlsearchparams'));
}
report.any_success=report.probes.some(p=>p.provider_success===true);
report.successful_probe=report.probes.find(p=>p.provider_success===true)?.label||null;
report.all_auth_rejected=report.probes.length>0&&report.probes.every(p=>p.auth_rejected===true);
report.only_transport_failures=report.probes.length>0&&report.probes.every(p=>!p.provider_success&&!p.auth_rejected&&p.http_status===null);
report.diagnosis=report.any_success
  ?'pps_live_success'
  :report.all_auth_rejected
    ?'pps_gateway_rejects_same_shared_key_even_with_official_sample_request'
    :report.only_transport_failures
      ?'data_go_kr_transport_unavailable_from_runner'
      :'pps_mixed_failure';
fs.writeFileSync(outFile,JSON.stringify(report,null,2)+'\n');
const compact=p=>({label:p.label,mode:p.mode,scheme:p.scheme,http_status:p.http_status,result_code:p.result_code,result_msg:p.result_msg,result_reason:p.result_reason,envelope:p.envelope,total_count:p.total_count,item_count:p.item_count,auth_rejected:p.auth_rejected,provider_success:p.provider_success,error:p.error,attempts:p.attempts?.map(a=>({attempt:a.attempt,http_status:a.http_status,result_code:a.result_code,auth_rejected:a.auth_rejected,provider_success:a.provider_success,error:a.error}))});
console.log(JSON.stringify({
  secret_present:report.secret_present,
  raw_has_percent_escape:report.raw_has_percent_escape,
  decoded_differs:report.decoded_differs,
  any_success:report.any_success,
  successful_probe:report.successful_probe,
  all_auth_rejected:report.all_auth_rejected,
  diagnosis:report.diagnosis,
  probes:report.probes.map(compact)
},null,2));
