import { normalizeKmaMetarLiveResponse } from '../kma-live-parser.js';
import { recordSourceHealth } from '../storage/writer.js';

const SELECT_CURRENT=`SELECT icao,phenomenon_time FROM weather_current WHERE icao=?1 LIMIT 1`;
const UPSERT_CURRENT=`INSERT INTO weather_current (icao,kind,phenomenon_time,air_temperature,dewpoint_temperature,qnh,mean_wind_direction,mean_wind_speed,wind_gust_speed,visibility,present_weather,source_id,observed_at,updated_at)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
ON CONFLICT(icao) DO UPDATE SET kind=excluded.kind,phenomenon_time=excluded.phenomenon_time,air_temperature=excluded.air_temperature,dewpoint_temperature=excluded.dewpoint_temperature,qnh=excluded.qnh,mean_wind_direction=excluded.mean_wind_direction,mean_wind_speed=excluded.mean_wind_speed,wind_gust_speed=excluded.wind_gust_speed,visibility=excluded.visibility,present_weather=excluded.present_weather,source_id=excluded.source_id,observed_at=excluded.observed_at,updated_at=CURRENT_TIMESTAMP`;
const INSERT_EVENT=`INSERT OR IGNORE INTO weather_events (icao,kind,phenomenon_time,air_temperature,dewpoint_temperature,qnh,mean_wind_direction,mean_wind_speed,wind_gust_speed,visibility,present_weather,source_id,observed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`;

function ms(v){const x=Date.parse(v);return Number.isFinite(x)?x:null}
export function metarFreshness(record,{observedAt,maxAgeMinutes=90,maxFutureMinutes=10}={}){
  const now=ms(observedAt),phen=ms(record?.phenomenonTime);
  if(now==null) return {current:false,reason:'OBSERVED_AT_INVALID',ageMinutes:null};
  if(phen==null) return {current:false,reason:'PHENOMENON_TIME_MISSING',ageMinutes:null};
  const age=(now-phen)/60000;
  if(age>maxAgeMinutes) return {current:false,reason:'STALE',ageMinutes:Math.round(age)};
  if(age<0&&Math.abs(age)>maxFutureMinutes) return {current:false,reason:'FUTURE',ageMinutes:Math.round(age)};
  return {current:true,reason:null,ageMinutes:Math.max(0,Math.round(age))};
}
function bindings(r){return [r.icao,r.kind,r.phenomenonTime,r.airTemperature,r.dewpointTemperature,r.qnh,r.meanWindDirection,r.meanWindSpeed,r.windGustSpeed,r.visibility,JSON.stringify(r.presentWeather||[]),r.sourceId,r.observedAt]}

export async function ingestKmaMetarPayload(db,payload,{observedAt,maxAgeMinutes=90}={}){
  if(!db) throw new Error('D1_REQUIRED');
  if(!observedAt) throw new Error('observedAt required');
  const sourceId='KMA_METAR_SPECI';
  try{
    const records=normalizeKmaMetarLiveResponse(payload,{observedAt});
    let currentWritten=0,eventWritten=0,staleSkipped=0,olderSkipped=0;
    const diagnostics=[];
    for(const r of records){
      const fresh=metarFreshness(r,{observedAt,maxAgeMinutes});
      diagnostics.push({icao:r.icao,phenomenonTime:r.phenomenonTime,...fresh});
      if(!fresh.current){staleSkipped++;continue}
      const previous=await db.prepare(SELECT_CURRENT).bind(r.icao).first();
      const previousTime=ms(previous?.phenomenon_time),nextTime=ms(r.phenomenonTime);
      const eventResult=await db.prepare(INSERT_EVENT).bind(...bindings(r)).run();
      if(eventResult?.meta?.changes>0||eventResult?.changes>0) eventWritten++;
      if(previousTime!=null&&nextTime!=null&&previousTime>=nextTime){olderSkipped++;continue}
      await db.prepare(UPSERT_CURRENT).bind(...bindings(r)).run();
      currentWritten++;
    }
    await recordSourceHealth(db,{sourceId,readiness:'LIVE_CAPTURED',attemptedAt:observedAt,succeededAt:observedAt,consecutiveFailures:0});
    return {records:records.length,currentWritten,eventWritten,staleSkipped,olderSkipped,diagnostics};
  }catch(error){
    try{await recordSourceHealth(db,{sourceId,readiness:'ERROR',attemptedAt:observedAt,errorAt:observedAt,errorCode:String(error?.message||'INGEST_ERROR').split(':')[0],errorMessage:String(error?.message||error),consecutiveFailures:1})}catch{}
    throw error;
  }
}

export const KMA_METAR_INGEST_SQL=Object.freeze({SELECT_CURRENT,UPSERT_CURRENT,INSERT_EVENT});
