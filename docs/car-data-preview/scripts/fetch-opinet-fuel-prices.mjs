import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const dataPath=path.join(root,'data','fuel-price.json');
const statusPath=path.join(root,'data','generated','opinet-status.json');
const endpoint='https://www.opinet.co.kr/api/avgAllPrice.do';
const key=(process.env.OPINET_API_KEY||'').trim();
const now=new Date();
fs.mkdirSync(path.dirname(statusPath),{recursive:true});

function writeStatus(obj){fs.writeFileSync(statusPath,JSON.stringify(obj,null,2)+'\n')}
function current(){try{return JSON.parse(fs.readFileSync(dataPath,'utf8'))}catch{return null}}
function ymd(v){const s=String(v||'').replace(/[^0-9]/g,'');return s.length===8?`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`:null}
function oils(payload){const v=payload?.RESULT?.OIL??payload?.result?.oil??[];return Array.isArray(v)?v:v?[v]:[]}
function staleSince(date){if(!date)return true;const t=new Date(date+'T00:00:00+09:00').getTime();return !Number.isFinite(t)||Date.now()-t>3*86400000}

if(!key){const prev=current();writeStatus({ok:false,status:'missing_api_key',checked_at:now.toISOString(),endpoint,snapshot_exists:Boolean(prev),price_as_of:prev?.price_as_of||null,stale:staleSince(prev?.price_as_of)});console.log('Opinet key missing; keeping last reviewed snapshot.');process.exit(0)}

try{
  const u=new URL(endpoint);u.searchParams.set('out','json');u.searchParams.set('certkey',key);
  const res=await fetch(u,{headers:{'user-agent':'pm-lab-car-preview/1.0','accept':'application/json'},signal:AbortSignal.timeout(25000)});
  const text=await res.text();if(!res.ok)throw new Error(`HTTP ${res.status}`);
  let payload;try{payload=JSON.parse(text)}catch{throw new Error(`non-JSON response: ${text.slice(0,100)}`)}
  const rows=oils(payload),map=new Map(rows.map(r=>[String(r.PRODCD||r.prodcd||''),r]));
  const values={gasoline:Number(map.get('B027')?.PRICE??map.get('B027')?.price),diesel:Number(map.get('D047')?.PRICE??map.get('D047')?.price),lpg:Number(map.get('K015')?.PRICE??map.get('K015')?.price)};
  for(const [k,v] of Object.entries(values))if(!Number.isFinite(v)||v<=0)throw new Error(`missing/invalid ${k} price`);
  const dates=[...new Set(rows.map(r=>ymd(r.TRADE_DT??r.trade_dt)).filter(Boolean))].sort();const asOf=dates.at(-1);if(!asOf)throw new Error('TRADE_DT missing');
  const output={schema_version:1,source:'한국석유공사 오피넷 전국 평균',source_url:endpoint,price_as_of:asOf,last_successful_at:now.toISOString(),stale:staleSince(asOf),unit:'KRW/L',prices:values,notes:'전기차 충전단가는 사업자·회원·시간대에 따라 달라 자동 기본값을 두지 않는다.'};
  fs.writeFileSync(dataPath,JSON.stringify(output,null,2)+'\n');writeStatus({ok:true,status:'fetched',checked_at:now.toISOString(),endpoint,price_as_of:asOf,prices:values,stale:output.stale});console.log(`Opinet ${asOf}: gasoline ${values.gasoline}, diesel ${values.diesel}, LPG ${values.lpg}`);
}catch(error){const prev=current();const stale=staleSince(prev?.price_as_of);if(prev){prev.stale=stale;fs.writeFileSync(dataPath,JSON.stringify(prev,null,2)+'\n')}writeStatus({ok:false,status:'fetch_failed',checked_at:now.toISOString(),endpoint,error:String(error?.message||error).slice(0,300),snapshot_exists:Boolean(prev),price_as_of:prev?.price_as_of||null,stale});console.error(`Opinet refresh failed; preserved last snapshot: ${error?.message||error}`);if(!prev)process.exitCode=1}
