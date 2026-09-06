import fs from 'node:fs/promises';
import {AIRPORTS} from '../src/airports.js';

// Credentials travel only to our deployed preview Worker over HTTPS; never into artifacts.
const base='https://airport-now-preview-core.dhkim8704.workers.dev';
const token=process.env.AIRPORT_NOW_INGEST_TOKEN;
if(!token)throw new Error('INGEST_AUTH_NOT_CONFIGURED');
const tasks=[...['iiacArrival','iiacDeparture','kacArrival','kacDeparture'].map(task=>({task})),...AIRPORTS.map(a=>({task:'metar',icao:a.icao}))];
const results=[];
for(const task of tasks){
  const body={...task,...(task.task==='metar'?{kmaKey:process.env.KMAKEY||process.env.KMA_API_HUB_KEY}:{serviceKey:process.env.DATA_GO_KR_SERVICE_KEY||process.env.DATAKEY})};
  let record;
  try {
    const response=await fetch(base+'/internal/ingest/once',{method:'POST',redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
    let payload;try{payload=await response.json();}catch{payload={error:'NON_JSON_WORKER_RESPONSE'};}
    record={...task,httpStatus:response.status,...payload};
  }catch{record={...task,error:'WORKER_CONNECTION_FAILED'};}
  results.push(record);console.log(JSON.stringify(record));
}
const dir=new URL('../tests/fixtures/live-local/',import.meta.url);await fs.mkdir(dir,{recursive:true});
await fs.writeFile(new URL('remote-ingest-'+Date.now()+'.json',dir),JSON.stringify({capturedAt:new Date().toISOString(),results},null,2));
if(results.some(r=>r.httpStatus!==200))process.exitCode=1;
