import fs from 'node:fs';
import path from 'node:path';

const endpoint='https://apis.data.go.kr/1230000/ao/PriceInfoService/getStdMarkUprcinfoList';
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
    const h=j?.response?.header||j?.header||j;
    return {result_code:String(h?.resultCode??''),result_msg:String(h?.resultMsg??''),result_reason:String(h?.resultReason??'')};
  }catch{return {result_code:'',result_msg:'',result_reason:''}}
}
function safeSnippet(text){
  if(!text)return '';
  let s=text.slice(0,500);
  for(const secret of [raw,decodeOnce(raw)])if(secret)s=s.split(secret).join('[REDACTED]');
  return s;
}
async function probe(label,key,paramName){
  const url=new URL(endpoint);
  url.searchParams.set(paramName,key);
  url.searchParams.set('type','json');
  url.searchParams.set('numOfRows','1');
  url.searchParams.set('pageNo','1');
  try{
    const res=await fetch(url,{headers:{accept:'application/json','user-agent':'interior-v6-key-diagnostic'},signal:AbortSignal.timeout(15000)});
    const text=await res.text();
    const parsed=extractResult(text);
    const rejectedCodes=new Set(['12','30','31']);
    return {
      label,param_name:paramName,http_status:res.status,content_type:res.headers.get('content-type'),
      result_code:parsed.result_code||null,result_msg:parsed.result_msg||null,result_reason:parsed.result_reason||null,
      credential_accepted:!rejectedCodes.has(parsed.result_code)&&parsed.result_msg!=='SERVICE_KEY_IS_NOT_REGISTERED_ERROR'&&parsed.result_reason!=='SERVICE_KEY_IS_NOT_REGISTERED_ERROR',
      body_snippet:safeSnippet(text)
    };
  }catch(error){
    return {label,param_name:paramName,http_status:null,credential_accepted:false,error:String(error?.cause?.code||error?.code||error?.message||error)};
  }
}

const decoded=decodeOnce(raw);
const report={
  generated_at:new Date().toISOString(),
  endpoint,
  secret_present:Boolean(raw),
  raw_has_percent_escape:/%[0-9A-Fa-f]{2}/.test(raw),
  decoded_differs:decoded!==raw,
  key_value_logged:false,
  probes:[]
};
if(raw){
  report.probes.push(await probe('raw-uppercase-param',raw,'ServiceKey'));
  report.probes.push(await probe('raw-lowercase-param',raw,'serviceKey'));
  if(decoded!==raw){
    report.probes.push(await probe('decoded-uppercase-param',decoded,'ServiceKey'));
    report.probes.push(await probe('decoded-lowercase-param',decoded,'serviceKey'));
  } else {
    report.probes.push({label:'decoded-variants',skipped:true,reason:'decoded key is identical to stored key'});
  }
}
report.any_credential_accepted=report.probes.some(p=>p.credential_accepted===true);
fs.writeFileSync(outFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({
  secret_present:report.secret_present,
  raw_has_percent_escape:report.raw_has_percent_escape,
  decoded_differs:report.decoded_differs,
  any_credential_accepted:report.any_credential_accepted,
  probes:report.probes.map(({label,param_name,http_status,result_code,result_msg,result_reason,credential_accepted,error,skipped,reason})=>({label,param_name,http_status,result_code,result_msg,result_reason,credential_accepted,error,skipped,reason}))
},null,2));
