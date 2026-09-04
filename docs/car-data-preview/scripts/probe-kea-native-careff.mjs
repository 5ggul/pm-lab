import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const out=path.join(root,'data','generated','kea-native-careff-probe.json');
const raw=(process.env.DATA_GO_KR_SERVICE_KEY||'').trim();
function key(){try{return decodeURIComponent(raw)}catch{return raw}}
const endpoints=['https://api.energy.or.kr/api/CAREFF/CAREFF_LIST.do','http://api.energy.or.kr/api/CAREFF/CAREFF_LIST.do'];
const attempts=[];
function sanitize(text){return String(text||'').replace(/serviceKey=[^&\s"']+/gi,'serviceKey=[REDACTED]').slice(0,12000)}
for(const endpoint of endpoints){
  for(const mode of [
    {apiType:'json'},
    {type:'json'},
    {_type:'json'},
    {returnType:'JSON'},
    {}
  ]){
    const u=new URL(endpoint);u.searchParams.set('serviceKey',key());u.searchParams.set('pageNo','1');u.searchParams.set('numOfRows','2');for(const [k,v] of Object.entries(mode))u.searchParams.set(k,v);
    try{
      const text=execFileSync('curl',['-sS','-L','--connect-timeout','10','--max-time','30','-A','pm-lab-car-preview/1.0',u.toString()],{encoding:'utf8',maxBuffer:4*1024*1024});
      attempts.push({endpoint,mode,http_response_preview:sanitize(text),looks_json:/^\s*[\[{]/.test(text),looks_xml:/^\s*</.test(text)});
      if(/MODEL|model|CAR|차|연비|EFF|CO2|items|item/i.test(text)){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({ok:true,fetched_at:new Date().toISOString(),successful_endpoint:endpoint,mode,response_preview:sanitize(text),attempts},null,2)+'\n');console.log(`CAREFF probe got structured response via ${endpoint} ${JSON.stringify(mode)}`);process.exit(0)}
    }catch(error){attempts.push({endpoint,mode,error:sanitize(error?.stderr||error?.message||error)})}
  }
}
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({ok:false,fetched_at:new Date().toISOString(),attempts},null,2)+'\n');console.log('CAREFF probe did not find a structured response');
