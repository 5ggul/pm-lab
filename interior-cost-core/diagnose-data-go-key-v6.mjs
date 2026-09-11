import fs from 'node:fs';
import path from 'node:path';

const BASE='https://apis.data.go.kr/1230000/ao/PriceInfoService/getStdMarkUprcinfoList';
const raw=(process.env.DATA_GO_KR_SERVICE_KEY||'').trim();
const outDir=process.env.PREFLIGHT_OUT_DIR||'/tmp/interior-v6-public-price-preflight';
fs.mkdirSync(outDir,{recursive:true});
const outFile=path.join(outDir,'service-key-diagnostic.json');

function decodeOnce(value){try{return decodeURIComponent(value)}catch{return value}}
function safeSnippet(text){
  let s=String(text||'').slice(0,500),decoded=decodeOnce(raw);
  const variants=[raw,decoded];try{variants.push(encodeURIComponent(decoded))}catch{}
  for(const v of [...new Set(variants.filter(Boolean))])s=s.split(v).join('[REDACTED]');
  return s;
}
function parse(text){
  try{
    const j=JSON.parse(text),gw=j?.OpenAPI_ServiceResponse?.cmmMsgHeader;
    if(gw)return{code:String(gw.returnReasonCode??''),msg:String(gw.errMsg??''),gateway:true,total:0,items:[]};
    const r=j?.response||j,h=r?.header||j?.header||{},b=r?.body||j?.body||{},items=b?.items?.item??b?.items??[];
    return{code:String(h?.resultCode??''),msg:String(h?.resultMsg??''),gateway:false,total:Number(b?.totalCount??0)||0,items:Array.isArray(items)?items:(items&&typeof items==='object'?[items]:[])};
  }catch{return{code:'',msg:'',gateway:false,total:0,items:[]}}
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(label,query){
  const u=new URL(BASE),decoded=decodeOnce(raw);
  u.searchParams.set('ServiceKey',decoded);
  u.searchParams.set('type','json');u.searchParams.set('pageNo','1');u.searchParams.set('numOfRows','5');
  for(const [k,v] of Object.entries(query||{}))if(v!==null&&v!==undefined&&v!=='')u.searchParams.set(k,String(v));
  const attempts=[];
  for(let i=1;i<=3;i++){
    try{
      const res=await fetch(u,{headers:{accept:'application/json','user-agent':'interior-v6-pps-discovery'},signal:AbortSignal.timeout(15000)});
      const text=await res.text(),p=parse(text);
      const out={label,attempt:i,http_status:res.status,result_code:p.code||null,result_msg:p.msg||null,total_count:p.total,item_count:p.items.length,published_dates:[...new Set(p.items.map(x=>String(x?.pblctDate||'')).filter(Boolean))].slice(0,10),sample_names:p.items.map(x=>String(x?.prdnm||'')).filter(Boolean).slice(0,3),body_snippet:safeSnippet(text)};
      attempts.push(out);
      if(res.ok||['20','30','31'].includes(p.code)||res.status<500)return{...out,attempts};
    }catch(error){attempts.push({label,attempt:i,error:String(error?.cause?.code||error?.code||error?.message||error)})}
    if(i<3)await sleep(500*i);
  }
  return{label,error:attempts.at(-1)?.error||'unknown',attempts};
}

const windows=[
  ['current-550d',{inqryDiv:'1',inqryBgnDate:'20250311',inqryEndDate:'20260912'}],
  ['2024-to-now',{inqryDiv:'1',inqryBgnDate:'20240101',inqryEndDate:'20260912'}],
  ['2023-to-now',{inqryDiv:'1',inqryBgnDate:'20230101',inqryEndDate:'20260912'}],
  ['2022-to-now',{inqryDiv:'1',inqryBgnDate:'20220101',inqryEndDate:'20260912'}],
  ['sample-20220922-23',{inqryDiv:'1',inqryBgnDate:'20220922',inqryEndDate:'20220923'}],
  ['no-date-filter',{}]
];
const report={generated_at:new Date().toISOString(),secret_present:Boolean(raw),key_value_logged:false,probes:[]};
if(raw)for(const [label,q] of windows)report.probes.push(await request(label,q));
report.first_nonzero=report.probes.find(p=>Number(p.total_count)>0)?.label||null;
report.max_total=Math.max(0,...report.probes.map(p=>Number(p.total_count)||0));
fs.writeFileSync(outFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({secret_present:report.secret_present,first_nonzero:report.first_nonzero,max_total:report.max_total,probes:report.probes.map(p=>({label:p.label,http_status:p.http_status,result_code:p.result_code,result_msg:p.result_msg,total_count:p.total_count,item_count:p.item_count,published_dates:p.published_dates,error:p.error}))},null,2));
