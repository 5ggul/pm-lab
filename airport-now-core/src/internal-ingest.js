import {AIRPORTS} from './airports.js';
import {ingestOnce,INGEST_TASKS} from './ingest/once.js';

const headers={'content-type':'application/json','cache-control':'no-store','x-robots-tag':'noindex'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
async function authorized(request,secret) {
  if(!secret||secret.length<32)return false;
  const provided=request.headers.get('authorization')||'';
  if(provided.length>256)return false;
  const digest=s=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
  const [a,b]=await Promise.all([digest(provided),digest('Bearer '+secret)]);
  return new Uint8Array(a).reduce((diff,x,i)=>diff|(x^new Uint8Array(b)[i]),0)===0;
}
export async function handleInternalIngest(request,env,{run=ingestOnce}={}) {
  if(env.APP_ENV!=='preview'||!await authorized(request,env.INGEST_TOKEN))return reply({error:'NOT_FOUND'},404);
  if(request.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
  if(!env.DB)return reply({error:'D1_NOT_BOUND'},503);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'JSON_REQUIRED'},415);
  const reader=request.body?.getReader();if(!reader)return reply({error:'BODY_REQUIRED'},400);
  let bytes=0,parts=[];
  while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4096){await reader.cancel();return reply({error:'BODY_TOO_LARGE'},413);}parts.push(value);}
  const joined=new Uint8Array(bytes);let offset=0;for(const part of parts){joined.set(part,offset);offset+=part.length;}
  let body;try{body=JSON.parse(new TextDecoder().decode(joined));}catch{return reply({error:'INVALID_JSON'},400);}
  if(!body||!INGEST_TASKS.includes(body.task))return reply({error:'INVALID_TASK'},400);
  const airport=AIRPORTS.find(a=>a.icao===body.icao);
  if(body.task==='metar'&&!airport)return reply({error:'INVALID_ICAO'},400);
  const key=body.task==='metar'?body.kmaKey:body.serviceKey;
  if(typeof key!=='string'||!key.trim()||key.length>1024)return reply({error:'KEY_NOT_IN_REQUEST'},400);
  const owner=crypto.randomUUID(),now=Date.now();
  const lease=await env.DB.prepare(`INSERT INTO ingest_locks (id,owner,expires_at) VALUES ('once',?1,?2)
    ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE ingest_locks.expires_at<?3`).bind(owner,now+300000,now).run();
  if(!lease.meta?.changes)return reply({error:'INGEST_BUSY'},409);
  try {
    const captures=[],transport=[],deadline=Date.now()+120000;
    const fetchImpl=async(url,options={})=>{
      for(let attempt=1;attempt<=2;attempt++){
        const start=Date.now();
        if(start>=deadline)throw new Error('UPSTREAM_DEADLINE');
        try{
          const response=await fetch(url,{...options,signal:AbortSignal.timeout(Math.min(25000,deadline-start))});
          const payload=await response.text();
          transport.push({host:new URL(url).hostname,attempt,status:response.status,ms:Date.now()-start});
          if(response.status>=500&&attempt<2)continue;
          return new Response(payload,{status:response.status,headers:response.headers});
        }catch{
          transport.push({host:new URL(url).hostname,attempt,error:'CONNECT_OR_TIMEOUT',ms:Date.now()-start});
          if(attempt===2)throw new Error('UPSTREAM_FETCH_FAILED');
        }
      }
    };
    const result=await run({...env,DATA_GO_KR_SERVICE_KEY:body.serviceKey,KMA_API_HUB_KEY:body.kmaKey},{tasks:[body.task],maxPages:20,fetchImpl,airports:airport?[airport]:[],
      capture:async({provider,direction,icao,pageNo,capturedAt,httpStatus,body:payload})=>captures.push({provider,direction,icao,pageNo,capturedAt,httpStatus,bytes:payload.length})});
    return reply({result,captures,transport},result[body.task]?.ok?200:502);
  }catch{return reply({error:'INGEST_FAILED'},500);}
  finally{await env.DB.prepare("DELETE FROM ingest_locks WHERE id='once' AND owner=?1").bind(owner).run();}
}
