import {validateCapturedFlight,sourceForTask} from './captured-flight.js';
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
  while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4_000_000){await reader.cancel();return reply({error:'BODY_TOO_LARGE'},413);}parts.push(value);}
  const joined=new Uint8Array(bytes);let offset=0;for(const part of parts){joined.set(part,offset);offset+=part.length;}
  let body;try{body=JSON.parse(new TextDecoder().decode(joined));}catch{return reply({error:'INVALID_JSON'},400);}
  if(!body?.capture&&bytes>4096)return reply({error:'BODY_TOO_LARGE'},413);
  if(!body||!INGEST_TASKS.includes(body.task))return reply({error:'INVALID_TASK'},400);
  const airport=AIRPORTS.find(a=>a.icao===body.icao);
  if(body.task==='metar'&&!airport)return reply({error:'INVALID_ICAO'},400);
  let replay;try{if(body.capture)replay=validateCapturedFlight(body.task,body.capture);}catch(error){return reply({error:error.message},400);}
  if(body.runId&&!/^[A-Za-z0-9._:-]{1,120}$/.test(body.runId))return reply({error:'INVALID_RUN_ID'},400);
  const key=body.capture?'CAPTURE_ONLY':body.task==='metar'?body.kmaKey:body.serviceKey;
  if(typeof key!=='string'||!key.trim()||key.length>1024)return reply({error:'KEY_NOT_IN_REQUEST'},400);
  const owner=crypto.randomUUID(),now=Date.now(),lockId=sourceForTask(body.task,body.icao);
  const runId=body.runId||owner;
  const lease=await env.DB.prepare(`INSERT INTO ingest_locks (id,owner,expires_at) VALUES (?1,?2,?3)
    ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE ingest_locks.expires_at<?4`).bind(lockId,owner,now+300000,now).run();
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
    const result=await run({...env,DATA_GO_KR_SERVICE_KEY:body.capture?'CAPTURE_ONLY':body.serviceKey,KMA_API_HUB_KEY:body.kmaKey},{tasks:[body.task],maxPages:20,fetchImpl,...replay,airports:airport?[airport]:[],
      capture:async({provider,direction,icao,pageNo,capturedAt,httpStatus,body:payload})=>captures.push({provider,direction,icao,pageNo,capturedAt,httpStatus,bytes:payload.length})});
    const outcome=result[body.task],success=outcome?.ok===true;
    await env.DB.prepare('INSERT INTO collection_runs (run_id,source_id,started_at,completed_at,success,success_at,error_code,transport,operating_flights,emitted_events,duration_ms) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11) ON CONFLICT(run_id,source_id) DO NOTHING')
      .bind(runId,lockId,new Date(now).toISOString(),new Date().toISOString(),success?1:0,success?(body.capture?.completedAt||new Date().toISOString()):null,outcome?.error||null,body.capture?'runner-capture':'worker-fetch',outcome?.operatingFlights??null,outcome?.emittedEvents??null,Date.now()-now).run();
    const placement=request.headers.get('cf-placement')||'';
    const ingressColo=request.cf?.colo||'';
    const execution={ingressColo:/^[A-Z]{3}$/.test(ingressColo)?ingressColo:null,placement:/^(local|remote)-[A-Z]{3}$/.test(placement)?placement:null};
    return reply({result,captures,transport,execution},result[body.task]?.ok?200:502);
  }catch{return reply({error:'INGEST_FAILED'},500);}
  finally{await env.DB.prepare("DELETE FROM ingest_locks WHERE id=?1 AND owner=?2").bind(lockId,owner).run();}
}
