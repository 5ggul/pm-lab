import { SOURCES, productionReadySources } from '../core.js';
import { searchFlights, airportBoard, irregularBoard, flightNumberHistory } from './read-model.js';

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
function kstDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function safeSource(s){return{id:s.id,provider:s.provider,state:s.state,readiness:s.readiness,productionEnabled:s.productionEnabled,scope:s.scope}}

export async function handleRequest(request,env={}){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/health') return json({ok:true,app:'airport-now-core',productionIngestEnabled:false});
  if(path==='/api/readiness') return json({productionReadyCount:productionReadySources().length,sources:Object.values(SOURCES).map(safeSource)});
  if(!path.startsWith('/api/')) return new Response('Not found',{status:404});
  if(!env.DB) return json({error:'D1_NOT_BOUND',message:'Preview read API has no D1 binding.'},503);
  const date=url.searchParams.get('date')||kstDate();
  try{
    if(path==='/api/search/flights'){
      const q=url.searchParams.get('q');if(!q)return json({error:'QUERY_REQUIRED'},400);
      return json({date,results:await searchFlights(env.DB,{query:q,serviceDate:date,limit:20})});
    }
    const airport=path.match(/^\/api\/airports\/([A-Za-z0-9]{3})\/flights$/);
    if(airport){
      const direction=(url.searchParams.get('direction')||'DEPARTURE').toUpperCase();
      const status=url.searchParams.get('status')?.toUpperCase()||null;
      return json({date,airport:airport[1].toUpperCase(),direction,status,results:await airportBoard(env.DB,{iata:airport[1],serviceDate:date,direction,status,limit:url.searchParams.get('limit')||100})});
    }
    if(path==='/api/now/delays') return json({date,status:'DELAYED',results:await irregularBoard(env.DB,{serviceDate:date,status:'DELAYED',airportIata:url.searchParams.get('airport'),direction:url.searchParams.get('direction'),limit:url.searchParams.get('limit')||200})});
    if(path==='/api/now/cancellations') return json({date,status:'CANCELLED',results:await irregularBoard(env.DB,{serviceDate:date,status:'CANCELLED',airportIata:url.searchParams.get('airport'),direction:url.searchParams.get('direction'),limit:url.searchParams.get('limit')||200})});
    const history=path.match(/^\/api\/flights\/([A-Za-z0-9 ]+)\/history$/);
    if(history) return json({flightNumber:history[1].replace(/\s+/g,'').toUpperCase(),results:await flightNumberHistory(env.DB,{flightNumber:history[1],limit:url.searchParams.get('limit')||30})});
    return json({error:'NOT_FOUND'},404);
  }catch(error){
    const known=/^(INVALID_|IRREGULAR_)/.test(error?.message||'');
    return json({error:known?error.message:'READ_API_ERROR'},known?400:500);
  }
}

export default {
  fetch(request,env){return handleRequest(request,env)},
  scheduled(){throw new Error('SCHEDULED_INGEST_DISABLED_UNTIL_USER_APPROVAL')}
};
