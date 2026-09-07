import {AIRPORTS} from './airports.js';
const tasks=[...['iiacArrival','iiacDeparture','kacArrival','kacDeparture'].map(task=>({task})),...AIRPORTS.map(a=>({task:'metar',icao:a.icao}))];
export async function runClock(event,env,{sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  if(!env.CORE||!env.INGEST_TOKEN)throw new Error('CLOCK_NOT_CONFIGURED');
  const pending=[...tasks],results=[];
  async function collect(item){
    for(let attempt=1;attempt<=2;attempt++){
      let report;
      try{
        const response=await env.CORE.fetch(new Request('https://airport-now.internal/internal/ingest/once',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+env.INGEST_TOKEN},body:JSON.stringify({...item,runId:'cron.'+event.scheduledTime+'.'+(item.icao||item.task)+'.'+attempt})}));
        const body=await response.json();
        report={...item,attempt,status:response.status,ok:response.ok&&body.result?.[item.task]?.ok===true,error:body.result?.[item.task]?.error||body.error||null};
        if(report.ok||[400,401,403,404,413,415].includes(response.status)||/^GATEWAY_(10|12|20|22|29|30|31)$/.test(report.error||''))return report;
      }catch{report={...item,attempt,ok:false,error:'CORE_UNAVAILABLE'};}
      if(attempt===2)return report;
      await sleep(2000);
    }
  }
  await Promise.all(Array.from({length:6},async()=>{while(pending.length){const item=pending.shift();results.push(await collect(item));}}));
  const report={scheduledTime:event.scheduledTime,completedAt:new Date().toISOString(),ok:results.every(r=>r.ok),results};
  console.log(JSON.stringify(report));
  if(!report.ok)throw new Error('CLOCK_COLLECTION_INCOMPLETE');
  return report;
}
export default {
  fetch(){return new Response('Not found',{status:404});},
  scheduled(event,env,ctx){ctx.waitUntil(runClock(event,env));}
};
