import fs from 'node:fs/promises';
import {AIRPORTS,serviceDateKst} from '../src/airports.js';
import {fetchFlightRows} from '../src/flight-client.js';
import {providerFetch} from './provider-fetch.mjs';

const task=process.argv[2];
if(!['iiacArrival','iiacDeparture','kacArrival','kacDeparture','metar'].includes(task))throw new Error('INVALID_TASK');
const base='https://airport-now-preview-core.dhkim8704.workers.dev';
const token=process.env.AIRPORT_NOW_INGEST_TOKEN;
if(!token)throw new Error('INGEST_AUTH_NOT_CONFIGURED');
const runId=String(process.env.GITHUB_RUN_ID||Date.now())+'.'+String(process.env.GITHUB_RUN_ATTEMPT||1)+'.'+task;
const reports=[];
async function post(body,suffix){
  try{
    const response=await fetch(base+'/internal/ingest/once',{method:'POST',redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({...body,runId:runId+'.'+suffix}),signal:AbortSignal.timeout(150000)});
    let payload;try{payload=await response.json();}catch{payload={error:'NON_JSON_RESPONSE'};}
    const report={task:body.task,icao:body.icao,httpStatus:response.status,...payload};reports.push(report);return response.ok&&payload.result?.[body.task]?.ok===true;
  }catch{reports.push({task:body.task,error:'WORKER_CONNECTION_FAILED'});return false;}
}
async function flights(){
  const provider=task.startsWith('iiac')?'IIAC':'KAC',direction=task.endsWith('Arrival')?'ARRIVAL':'DEPARTURE';
  const serviceKey=process.env.DATA_GO_KR_SERVICE_KEY||process.env.DATAKEY;
  const deadline=AbortSignal.timeout(150000);
  for(let attempt=1;attempt<=2;attempt++){
    const startedAt=new Date().toISOString(),pages=[];
    try{
      const serviceDate=serviceDateKst(startedAt);
      await fetchFlightRows({provider,direction,serviceDate,serviceKey},{maxPages:20,fetchImpl:url=>providerFetch(url,{signal:deadline}),capture:async page=>{if(page.httpStatus!==200)throw new Error('PROVIDER_HTTP_ERROR');pages.push(page.body);}});
      if(await post({task,capture:{serviceDate,startedAt,completedAt:new Date().toISOString(),pages}},'capture'+attempt))return true;
      break;
    }catch(error){
      const code=/^[A-Z0-9_]+$/.test(error.message)?error.message:'RUNNER_CAPTURE_FAILED';reports.push({task,path:'runner',attempt,error:code});
      if(code!=='TOTAL_CHANGED_DURING_CAPTURE'||deadline.aborted)break;
    }
  }
  // Independent execution origin; only invoke after the runner's complete capture fails.
  return post({task,serviceKey},'fallback');
}
let success;
if(task==='metar'){
  const results=[];
  for(let index=0;index<AIRPORTS.length;index+=3)results.push(...await Promise.all(AIRPORTS.slice(index,index+3).map(a=>post({task,icao:a.icao,kmaKey:process.env.KMAKEY||process.env.KMA_API_HUB_KEY},a.icao))));
  success=results.every(Boolean);
}else success=await flights();
const report={runId,completedAt:new Date().toISOString(),success,reports};
const dir=new URL('../tests/fixtures/live-local/',import.meta.url);await fs.mkdir(dir,{recursive:true});await fs.writeFile(new URL('collector-'+task+'.json',dir),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));if(!success)process.exitCode=1;
