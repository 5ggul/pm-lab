const IATA=/^[A-Z0-9]{3}$/;const ICAO=/^[A-Z0-9]{4}$/;
function iata(v){const x=String(v||'').toUpperCase();if(!IATA.test(x))throw new Error('INVALID_IATA');return x}
function icao(v){const x=String(v||'').toUpperCase();if(!ICAO.test(x))throw new Error('INVALID_ICAO');return x}
export function weatherSpec(code){return{sql:'SELECT * FROM weather_current WHERE icao=?1 LIMIT 1',params:[icao(code)]}}
export function warningSpec(code,nowIso){return{sql:'SELECT * FROM airport_warning_current WHERE icao=?1 AND (valid_to IS NULL OR valid_to>=?2) ORDER BY valid_from DESC',params:[icao(code),nowIso]}}
export function parkingSpec(code){return{sql:'SELECT * FROM parking_current WHERE airport_iata=?1 ORDER BY terminal,lot_name,lot_id',params:[iata(code)]}}
export function congestionSpec(code){return{sql:'SELECT * FROM congestion_current WHERE airport_iata=?1 ORDER BY terminal,zone,flight_number',params:[iata(code)]}}
export function processTimeSpec(code){return{sql:'SELECT * FROM process_time_current WHERE airport_iata=?1 ORDER BY terminal,segment',params:[iata(code)]}}
function timeMs(v){const x=Date.parse(v);return Number.isFinite(x)?x:null}
export function moduleAvailability(rows,{nowIso=new Date().toISOString(),maxAgeMinutes=15}={}){
  if(!rows?.length)return{available:false,reason:'NO_OFFICIAL_CURRENT_RECORD',freshnessMinutes:null,dataAsOf:null};
  const dates=rows.map(r=>r.data_as_of||r.phenomenon_time||r.issued_at||r.forecast_for||r.observed_at||r.updated_at).map(timeMs).filter(Number.isFinite);
  if(!dates.length)return{available:false,reason:'FRESHNESS_UNKNOWN',freshnessMinutes:null,dataAsOf:null};
  const newest=Math.max(...dates),now=timeMs(nowIso);if(now==null)return{available:false,reason:'CLOCK_INVALID',freshnessMinutes:null,dataAsOf:null};
  const freshness=Math.max(0,Math.round((now-newest)/60000));
  if(freshness>maxAgeMinutes)return{available:false,reason:'STALE',freshnessMinutes:freshness,dataAsOf:new Date(newest).toISOString()};
  return{available:true,reason:null,freshnessMinutes:freshness,dataAsOf:new Date(newest).toISOString()};
}
async function all(db,spec){const r=await db.prepare(spec.sql).bind(...spec.params).all();return r.results||[]}
export async function readWeather(db,code){return all(db,weatherSpec(code))}
export async function readWarnings(db,code,nowIso){return all(db,warningSpec(code,nowIso))}
export async function readParking(db,code){return all(db,parkingSpec(code))}
export async function readCongestion(db,code){return all(db,congestionSpec(code))}
export async function readProcessTime(db,code){return all(db,processTimeSpec(code))}
