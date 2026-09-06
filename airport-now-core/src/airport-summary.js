import {AIRPORTS} from './airports.js';
import {collectionState,collectionCadence} from './collector-status.js';
import {currentWeatherMany} from './read-model.js';
export async function airportSummary(db,{serviceDate,asOf=new Date().toISOString()}={}){
  const groups=(await db.prepare(`SELECT source_id,direction,CASE WHEN direction='DEPARTURE' THEN origin ELSE destination END AS airport,COUNT(*) AS operating,SUM(status='DELAYED') AS delayed,SUM(status='CANCELLED') AS cancelled,MAX(observed_at) AS latest FROM flight_current WHERE service_date=?1 GROUP BY source_id,direction,airport`).bind(serviceDate).all()).results||[];
  const health=(await db.prepare('SELECT source_id,readiness,last_attempt_at,last_success_at FROM source_health').all()).results||[];
  const weather=await currentWeatherMany(db,{icaos:AIRPORTS.map(a=>a.icao),asOf});
  return {date:serviceDate,asOf,cadence:collectionCadence(health,Date.parse(asOf)),airports:AIRPORTS.map(airport=>{
    const result={...airport,weather:weather.find(w=>w.icao===airport.icao)||null};
    for(const direction of ['DEPARTURE','ARRIVAL']){
      const sourceId=(airport.iata==='ICN'?'IIAC_PASSENGER_':'KAC_FLIGHT_')+direction;
      const group=groups.find(g=>g.source_id===sourceId&&g.direction===direction&&g.airport===airport.iata);
      const state=collectionState(health.find(h=>h.source_id===sourceId),Date.parse(asOf),serviceDate);
      if(state.current&&group&&Date.parse(group.latest)>Date.parse(state.lastSuccessAt)){state.current=false;state.state='UPDATING';}
      result[direction.toLowerCase()]={...state,operating:state.current?(group?.operating||0):null,delayed:state.current?(group?.delayed||0):null,cancelled:state.current?(group?.cancelled||0):null};
    }
    return result;
  })};
}
