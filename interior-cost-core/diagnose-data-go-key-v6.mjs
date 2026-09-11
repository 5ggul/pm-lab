import fs from 'node:fs';
import path from 'node:path';

const ppsEndpoint='https://apis.data.go.kr/1230000/ao/PriceInfoService/getStdMarkUprcinfoList';
const controls=[
  {label:'kac-arrival',endpoint:'https://apis.data.go.kr/B551178/flight-status/arrival',params:{type:'json',numOfRows:'1',pageNo:'1'}},
  {label:'iiac-departure',endpoint:'https://apis.data.go.kr/B551177/StatusOfPassengerFlightsDeOdp/getPassengerDeparturesDeOdp',params:{type:'json',numOfRows:'1',pageNo:'1',inqtimechcd:'S'}}
];
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
    return {result_code:String(h?.resultCode??''),result_msg:String(h?.resultMsg??''),result_reason:String(h?.resultReason??''),envelope:'provider'};
  }catch{return {result_code:'',result_msg:'',result_reason:'',envelope:'unparsed'}}
}
function safeSnippet(text){
  if(!text)return '';
  let s=text.slice(0,500);
  for(const secret of [raw,decodeOnce(raw)])if(secret)s=s.split(secret).join('[REDACTED]');
  return s;
}
async function fetchProbe({label,endpoint,key,paramName='serviceKey',params={}}){
  const url=new URL(endpoint);
  url.searchParams.set(paramName,key);
  for(const [name,value] of Object.entries(params))url.searchParams.set(name,value);
  try{
    const res=await fetch(url,{headers:{accept:'application/json','user-agent':'interior-v6-key-diagnostic'},signal:AbortSignal.timeout(15000)});
    const text=await res.text();
    const parsed=extractResult(text);
    const authRejected=['20','30','31'].includes(parsed.result_code)||/SERVICE_KEY_(IS_NULL|IS_NOT_REGISTERED|IS_EXPIRED)/.test(`${parsed.result_msg} ${parsed.result_reason}`);
    return {
      label,param_name:paramName,http_status:res.status,content_type:res.headers.get('content-type'),
      result_code:parsed.result_code||null,result_msg:parsed.result_msg||null,result_reason:parsed.result_reason||null,envelope:parsed.envelope,
      auth_rejected:authRejected,
      provider_success:res.ok&&['00','0'].includes(parsed.result_code),
      body_snippet:safeSnippet(text)
    };
  }catch(error){
    return {label,param_name:paramName,http_status:null,auth_rejected:false,provider_success:false,error:String(error?.cause?.code||error?.code||error?.message||error)};
  }
}

const decoded=decodeOnce(raw);
const serviceDay=new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10).replaceAll('-','');
const report={
  generated_at:new Date().toISOString(),
  pps_endpoint:ppsEndpoint,
  secret_present:Boolean(raw),
  raw_has_percent_escape:/%[0-9A-Fa-f]{2}/.test(raw),
  decoded_differs:decoded!==raw,
  key_value_logged:false,
  pps_probes:[],
  control_probes:[]
};
if(raw){
  report.pps_probes.push(await fetchProbe({label:'raw-uppercase-param',endpoint:ppsEndpoint,key:raw,paramName:'ServiceKey',params:{type:'json',numOfRows:'1',pageNo:'1'}}));
  report.pps_probes.push(await fetchProbe({label:'raw-lowercase-param',endpoint:ppsEndpoint,key:raw,paramName:'serviceKey',params:{type:'json',numOfRows:'1',pageNo:'1'}}));
  if(decoded!==raw){
    report.pps_probes.push(await fetchProbe({label:'decoded-uppercase-param',endpoint:ppsEndpoint,key:decoded,paramName:'ServiceKey',params:{type:'json',numOfRows:'1',pageNo:'1'}}));
    report.pps_probes.push(await fetchProbe({label:'decoded-lowercase-param',endpoint:ppsEndpoint,key:decoded,paramName:'serviceKey',params:{type:'json',numOfRows:'1',pageNo:'1'}}));
  } else {
    report.pps_probes.push({label:'decoded-variants',skipped:true,reason:'decoded key is identical to stored key'});
  }
  for(const control of controls){
    report.control_probes.push(await fetchProbe({
      label:control.label,
      endpoint:control.endpoint,
      key:decoded,
      paramName:'serviceKey',
      params:{...control.params,searchday:serviceDay}
    }));
  }
}
const activePps=report.pps_probes.filter(p=>!p.skipped);
report.pps_all_code30=activePps.length>0&&activePps.every(p=>p.result_code==='30'&&p.auth_rejected);
report.control_key_valid_now=report.control_probes.some(p=>p.provider_success===true);
report.diagnosis=report.control_key_valid_now&&report.pps_all_code30
  ?'shared_key_valid_pps_service_specific_rejection'
  :report.control_key_valid_now
    ?'shared_key_valid_pps_result_mixed'
    :report.pps_all_code30
      ?'pps_rejects_all_key_representations_control_not_confirmed'
      :'inconclusive';
fs.writeFileSync(outFile,JSON.stringify(report,null,2)+'\n');
const compact=p=>({label:p.label,param_name:p.param_name,http_status:p.http_status,result_code:p.result_code,result_msg:p.result_msg,result_reason:p.result_reason,envelope:p.envelope,auth_rejected:p.auth_rejected,provider_success:p.provider_success,error:p.error,skipped:p.skipped,reason:p.reason});
console.log(JSON.stringify({
  secret_present:report.secret_present,
  raw_has_percent_escape:report.raw_has_percent_escape,
  decoded_differs:report.decoded_differs,
  pps_all_code30:report.pps_all_code30,
  control_key_valid_now:report.control_key_valid_now,
  diagnosis:report.diagnosis,
  pps_probes:report.pps_probes.map(compact),
  control_probes:report.control_probes.map(compact)
},null,2));
