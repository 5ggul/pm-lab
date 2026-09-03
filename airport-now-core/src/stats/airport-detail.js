import { airportMeta } from '../airports.js';
import { airportCurrentSummary,airportFourWeekBaseline } from './queries.js';
import { airportBoard } from '../read-model.js';
import { readWeather,readWarnings,readParking,readCongestion,readProcessTime,moduleAvailability } from '../capability-read-model.js';

const limit=n=>Math.min(Math.max(Number(n)||10,1),50);
export function topRoutesTodaySpec({iata,serviceDate,rowLimit=10}){return{sql:`SELECT destination,COUNT(*) AS total_flights,SUM(CASE WHEN status='DELAYED' THEN 1 ELSE 0 END) AS delayed_flights,SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END) AS cancelled_flights,ROUND(100.0*SUM(CASE WHEN status='DELAYED' THEN 1 ELSE 0 END)/NULLIF(SUM(CASE WHEN status<>'UNKNOWN' THEN 1 ELSE 0 END),0),1) AS delay_rate FROM flight_current WHERE service_date=?1 AND direction='DEPARTURE' AND origin=?2 GROUP BY destination ORDER BY total_flights DESC,destination LIMIT ?3`,params:[serviceDate,iata,limit(rowLimit)]}}
export function airlineTodaySpec({iata,serviceDate,rowLimit=10}){return{sql:`SELECT COALESCE(operating_airline,marketing_airline) AS airline,COUNT(*) AS total_flights,SUM(CASE WHEN status='DELAYED' THEN 1 ELSE 0 END) AS delayed_flights,SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END) AS cancelled_flights,ROUND(100.0*SUM(CASE WHEN status='DELAYED' THEN 1 ELSE 0 END)/NULLIF(SUM(CASE WHEN status<>'UNKNOWN' THEN 1 ELSE 0 END),0),1) AS delay_rate FROM flight_current WHERE service_date=?1 AND direction='DEPARTURE' AND origin=?2 AND COALESCE(operating_airline,marketing_airline) IS NOT NULL GROUP BY COALESCE(operating_airline,marketing_airline) ORDER BY total_flights DESC,airline LIMIT ?3`,params:[serviceDate,iata,limit(rowLimit)]}}
async function all(db,s){const r=await db.prepare(s.sql).bind(...s.params).all();return r.results||[]}
function fmtKst(iso){if(!iso)return null;const d=new Date(iso);if(!Number.isFinite(d.getTime()))return null;return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)+' KST'}
export function buildAirportAnswerBlock({airport,current,baseline,hourKst}){
  if(current?.delay_rate==null||!current?.eligible_flights)return `${airport.name}의 현재 출발 지연률은 아직 공식 데이터 집계가 완료되지 않았습니다.`;
  let s=`현재 ${airport.name} 출발 지연률은 ${current.delay_rate}%입니다.`;
  if(baseline?.baseline_delay_rate!=null&&Number(baseline.baseline_sample_size)>=20){const delta=+(Number(current.delay_rate)-Number(baseline.baseline_delay_rate)).toFixed(1);s+=` 최근 4주 같은 요일 ${String(hourKst).padStart(2,'0')}시대 평균 ${baseline.baseline_delay_rate}%보다 ${Math.abs(delta).toFixed(1)}%p ${delta>0?'높습니다':delta<0?'낮습니다':'차이가 없습니다'}.`}
  s+=` 현재 집계 대상 ${current.eligible_flights}편 중 ${current.delayed_flights||0}편이 지연, ${current.cancelled_flights||0}편이 결항 상태입니다.`;
  const t=fmtKst(current.data_as_of);if(t)s+=` 데이터 기준시각은 ${t}입니다.`;return s;
}
export async function loadAirportOverview(db,{iata,serviceDate,hourKst,nowIso=new Date().toISOString()}){
  const airport=airportMeta(iata);
  const [current,baseline,departures,arrivals,delayed,cancelled,routes,airlines,weather,warnings,parking,congestion,processTime]=await Promise.all([
    airportCurrentSummary(db,{serviceDate,direction:'DEPARTURE',airportIata:airport.iata}),airportFourWeekBaseline(db,{serviceDate,hourKst,direction:'DEPARTURE',airportIata:airport.iata}),airportBoard(db,{iata:airport.iata,serviceDate,direction:'DEPARTURE',limit:12}),airportBoard(db,{iata:airport.iata,serviceDate,direction:'ARRIVAL',limit:12}),airportBoard(db,{iata:airport.iata,serviceDate,direction:'DEPARTURE',status:'DELAYED',limit:50}),airportBoard(db,{iata:airport.iata,serviceDate,direction:'DEPARTURE',status:'CANCELLED',limit:50}),all(db,topRoutesTodaySpec({iata:airport.iata,serviceDate,rowLimit:10})),all(db,airlineTodaySpec({iata:airport.iata,serviceDate,rowLimit:10})),readWeather(db,airport.icao),readWarnings(db,airport.icao,nowIso),readParking(db,airport.iata),readCongestion(db,airport.iata),readProcessTime(db,airport.iata)
  ]);
  const capability=(rows,maxAgeMinutes)=>({...moduleAvailability(rows,{nowIso,maxAgeMinutes}),rows});
  return{airport,current,baseline,answerBlock:buildAirportAnswerBlock({airport,current,baseline,hourKst}),departures,arrivals,delayed,cancelled,routes,airlines,modules:{weather:capability(weather,20),warnings:capability(warnings,180),parking:capability(parking,15),congestion:capability(congestion,10),processTime:capability(processTime,15)}};
}
