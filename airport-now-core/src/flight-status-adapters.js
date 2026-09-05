import { createFlightInstance, computeDelayMinutes, fallbackDelayStatus, kstIso } from '../core.js';

const IATA=/^[A-Z0-9]{3}$/;
const HOUR=3600000;

function cleanFlight(v){return String(v||'').toUpperCase().replace(/\s+/g,'')}
function airlinePrefix(v){const m=cleanFlight(v).match(/^([A-Z0-9]{2})(?=\d)/);return m?.[1]||null}
function terminalName(id){return({P01:'T1',P02:'CONCOURSE',P03:'T2',C01:'CARGO_SOUTH',C02:'CARGO_NORTH',C03:'CARGO_T2'})[id]||id||null}
function toKstIso(ms){return `${new Date(ms+9*HOUR).toISOString().slice(0,19)}+09:00`}

export function providerKstIso(value,serviceDate){
  if(value==null||value==='') return null;
  const raw=String(value).trim();
  if(/^\d{4}$/.test(raw)) return kstIso(serviceDate,raw);
  if(/^\d{12}$/.test(raw)) return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}T${raw.slice(8,10)}:${raw.slice(10,12)}:00+09:00`;
  if(/^\d{14}$/.test(raw)) return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}T${raw.slice(8,10)}:${raw.slice(10,12)}:${raw.slice(12,14)}+09:00`;
  const ms=Date.parse(raw);
  return Number.isFinite(ms)?toKstIso(ms):null;
}

export function mapOperationalRemark(raw){
  const s=String(raw||'').trim();
  if(!s) return 'UNKNOWN';
  if(s.includes('결항')) return 'CANCELLED';
  if(s.includes('지연')) return 'DELAYED';
  if(s.includes('회항')) return 'DIVERTED';
  if(s.includes('착륙')) return 'LANDED';
  if(s.includes('도착')) return 'ARRIVED';
  if(s.includes('출발')) return 'DEPARTED';
  if(s.includes('탑승')) return 'BOARDING';
  return 'UNKNOWN';
}

export function parseDataGoKrEnvelope(payload,{sourceId='DATA_GO_KR'}={}){
  const root=typeof payload==='string'?JSON.parse(payload):payload;
  const response=root?.response;
  const code=String(response?.header?.resultCode??'');
  if(code!=='00') throw new Error(`${sourceId}_RESPONSE_ERROR:${code||'MISSING_CODE'}:${response?.header?.resultMsg||''}`);
  const items=response?.body?.items;
  const rows=Array.isArray(items)?items:Array.isArray(items?.item)?items.item:items?.item?[items.item]:[];
  return {rows,totalCount:Number(response?.body?.totalCount??rows.length)||rows.length,pageNo:response?.body?.pageNo??null,numOfRows:response?.body?.numOfRows??null};
}

function rolloverIfNeeded(scheduled,estimated){
  if(!scheduled||!estimated) return estimated;
  const a=Date.parse(scheduled),b=Date.parse(estimated);
  if(!Number.isFinite(a)||!Number.isFinite(b)||b>=a-12*HOUR) return estimated;
  return toKstIso(b+24*HOUR);
}

export function normalizeIiacDepartureDetailedRow(row,{serviceDate,observedAt}){
  if(!row?.flightId) throw new Error('IIAC departure row requires flightId');
  const destination=String(row.airportCode||'').toUpperCase();
  if(!IATA.test(destination)) throw new Error('IIAC departure row requires destination airportCode');
  const operatingFlightNumber=cleanFlight(row.masterflightid||row.flightId);
  const flightNumber=cleanFlight(row.flightId);
  const scheduledDeparture=providerKstIso(row.scheduleDateTime,serviceDate);
  const estimatedDeparture=rolloverIfNeeded(scheduledDeparture,providerKstIso(row.estimatedDateTime,serviceDate));
  const mapped=mapOperationalRemark(row.remark);
  const status=fallbackDelayStatus({canonicalStatus:mapped,scheduledIso:scheduledDeparture,comparisonIso:estimatedDeparture});
  return createFlightInstance({
    serviceDate,flightNumber,operatingFlightNumber,
    operatingAirline:airlinePrefix(operatingFlightNumber),marketingAirline:airlinePrefix(flightNumber),
    isCodeshare:Boolean(row.codeshare||row.masterflightid),masterFlightNumber:row.masterflightid||null,
    origin:'ICN',destination,direction:'DEPARTURE',scheduledDeparture,estimatedDeparture,
    terminal:terminalName(row.terminalid),gate:row.gatenumber||null,checkinCounter:row.chkinrange||null,
    statusRaw:row.remark||null,status,delayMinutes:computeDelayMinutes(scheduledDeparture,estimatedDeparture),
    statusUpdatedAt:null,sourceId:'IIAC_PASSENGER_DEPARTURE',sourceUpdatedAt:null,observedAt,
    sourceRecordKey:row.fid||`${serviceDate}:${flightNumber}:${row.scheduleDateTime}:${destination}`
  });
}

function canonicalizeRows(rows,normalizer,ctx,{rankFields=[]}={}){
  const byOperating=new Map(),aliases=[];
  for(const row of rows){
    const f=normalizer(row,ctx);
    const marketing=cleanFlight(f.flightNumber),operating=cleanFlight(f.operatingFlightNumber);
    if(marketing!==operating){aliases.push({flightInstanceId:f.flightInstanceId,serviceDate:f.serviceDate,marketingFlightNumber:marketing,marketingAirline:f.marketingAirline,operatingFlightNumber:operating,sourceId:f.sourceId,observedAt:f.observedAt})}
    const candidate={...f,flightNumber:operating,marketingAirline:null,masterFlightNumber:null,isCodeshare:false};
    const masterBoost=marketing===operating?200:0;
    const statusBoost=f.status!=='UNKNOWN'?50:0;
    const completeness=rankFields.reduce((n,k)=>n+(row?.[k]!=null&&row[k]!==''?1:0),0);
    const rank=masterBoost+statusBoost+completeness;
    const prev=byOperating.get(candidate.flightInstanceId);
    if(!prev||rank>prev.rank) byOperating.set(candidate.flightInstanceId,{rank,flight:candidate});
  }
  return {flights:[...byOperating.values()].map(x=>x.flight),aliases,diagnostics:{rawRows:rows.length,operatingFlights:byOperating.size,marketingAliases:aliases.length,duplicateOperatingRows:Math.max(0,rows.length-byOperating.size-aliases.length)}};
}

export function collapseIiacDepartureRows(rows,ctx){
  if(!Array.isArray(rows)) throw new Error('IIAC departure rows must be an array');
  return canonicalizeRows(rows,normalizeIiacDepartureDetailedRow,ctx,{rankFields:['estimatedDateTime','gatenumber','chkinrange','terminalid','airportCode','remark']});
}

export function normalizeKacFlightStatusRow(row,{direction,serviceDate,observedAt}){
  const dir=String(direction||'').toUpperCase();
  if(!['DEPARTURE','ARRIVAL'].includes(dir)) throw new Error('KAC direction required');
  if(!row?.flightid) throw new Error('KAC status row requires flightid');
  const origin=String(row.depAirportCode||'').toUpperCase();
  const destination=String(row.arrvAirportCode||row.arrAirportCode||'').toUpperCase();
  if(!IATA.test(origin)||!IATA.test(destination)||origin===destination) throw new Error('KAC status row requires valid dep/arr airport codes');
  const flightNumber=cleanFlight(row.flightid),operatingFlightNumber=cleanFlight(row.masterflightid||row.flightid);
  const scheduled=providerKstIso(row.scheduledatetime,serviceDate);
  const estimated=rolloverIfNeeded(scheduled,providerKstIso(row.estimateddatetime,serviceDate));
  const mapped=mapOperationalRemark(row.rmkKor);
  const status=fallbackDelayStatus({canonicalStatus:mapped,scheduledIso:scheduled,comparisonIso:estimated});
  const sourceUpdatedAt=providerKstIso(row.fgenTime,serviceDate);
  return createFlightInstance({
    serviceDate,flightNumber,operatingFlightNumber,
    operatingAirline:airlinePrefix(operatingFlightNumber),marketingAirline:airlinePrefix(flightNumber),
    isCodeshare:String(row.codeshare||'').toUpperCase()==='Y'||Boolean(row.masterflightid),masterFlightNumber:row.masterflightid||null,
    origin,destination,direction:dir,
    scheduledDeparture:dir==='DEPARTURE'?scheduled:null,estimatedDeparture:dir==='DEPARTURE'?estimated:null,
    scheduledArrival:dir==='ARRIVAL'?scheduled:null,estimatedArrival:dir==='ARRIVAL'?estimated:null,
    statusRaw:row.rmkKor||null,status,delayMinutes:computeDelayMinutes(scheduled,estimated),statusUpdatedAt:sourceUpdatedAt,
    sourceId:'KAC_FLIGHT_STATUS_GW',sourceUpdatedAt,observedAt,sourceRecordKey:row.fid||`${serviceDate}:${flightNumber}:${origin}:${destination}:${dir}`
  });
}

export function collapseKacFlightStatusRows(rows,ctx){
  if(!Array.isArray(rows)) throw new Error('KAC status rows must be an array');
  return canonicalizeRows(rows,(row,x)=>normalizeKacFlightStatusRow(row,x),ctx,{rankFields:['estimateddatetime','rmkKor','fgenTime','depAirportCode','arrvAirportCode','arrAirportCode']});
}
