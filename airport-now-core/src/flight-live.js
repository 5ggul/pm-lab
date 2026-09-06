import {createFlightInstance, computeDelayMinutes} from '../core.js';
import {flightTime, comparisonTime} from './flight-time.js';
import {serviceDateKst,KAC_AIRPORTS} from './airports.js';

const STATUSES={'출발':'DEPARTED','이륙':'DEPARTED','도착':'ARRIVED','착륙':'LANDED','탑승중':'BOARDING','탑승':'BOARDING','탑승최종':'BOARDING','탑승장 입장':'BOARDING','결항':'CANCELLED','사전결항':'CANCELLED','지연':'DELAYED','회항':'DIVERTED','정시':'SCHEDULED','예정':'SCHEDULED','수속중':'SCHEDULED','마감예정':'BOARDING'};
const clean=v=>String(v??'').trim();
const prefix=v=>v.match(/^([A-Z0-9]{2})(?=\d)/)?.[1]||null;

function normalize(fields,{serviceDate,observedAt,direction,sourceId}) {
  if(!['ARRIVAL','DEPARTURE'].includes(direction))throw new Error('INVALID_DIRECTION');
  const scheduled=flightTime(fields.scheduled,serviceDate);
  if(!scheduled)throw new Error('SCHEDULED_TIME_REQUIRED');
  const date=serviceDateKst(scheduled);
  if(date!==serviceDate)throw new Error('SERVICE_DATE_MISMATCH');
  const estimated=comparisonTime(fields.estimated,serviceDate,scheduled);
  const flightNumber=clean(fields.flightNumber).replace(/\s+/g,'').toUpperCase();
  const master=clean(fields.master).replace(/\s+/g,'').toUpperCase();
  if(fields.slave&&!master)throw new Error('CODESHARE_MASTER_MISSING');
  const operatingFlightNumber=master||flightNumber;
  if(!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(operatingFlightNumber))throw new Error('INVALID_OPERATING_FLIGHT');
  const delayMinutes=computeDelayMinutes(scheduled,estimated);
  const statusRaw=clean(fields.status)||null;
  const official=STATUSES[statusRaw]||'UNKNOWN';
  const status=['UNKNOWN','SCHEDULED'].includes(official)&&delayMinutes>=15?'DELAYED':official;
  // A changed/estimated time is not proof of an actual movement time.
  const timeFields=direction==='ARRIVAL'?{scheduledArrival:scheduled,estimatedArrival:estimated}:{scheduledDeparture:scheduled,estimatedDeparture:estimated};
  return createFlightInstance({serviceDate:date,flightNumber,operatingFlightNumber,
    operatingAirline:prefix(operatingFlightNumber),marketingAirline:master?prefix(flightNumber):null,
    isCodeshare:Boolean(fields.shared||master),masterFlightNumber:master||null,
    origin:clean(fields.origin).toUpperCase(),destination:clean(fields.destination).toUpperCase(),direction,
    ...timeFields,terminal:fields.terminal||null,gate:fields.gate||null,checkinCounter:fields.checkin||null,
    baggageCarousel:fields.carousel||null,statusRaw,status,delayMinutes,sourceId,observedAt,
    sourceUpdatedAt:flightTime(fields.updated,serviceDate),sourceRecordKey:clean(fields.id)||null,
    airlineName:clean(fields.airline)||null});
}

export function normalizeIiacDetail(row,ctx) {
  return normalize({flightNumber:row.flightId,master:row.masterflightid,slave:row.codeshare==='Slave',shared:row.codeshare==='Master',
    scheduled:row.scheduleDateTime,estimated:row.estimatedDateTime,status:row.remark,
    origin:ctx.direction==='ARRIVAL'?row.airportCode:'ICN',destination:ctx.direction==='ARRIVAL'?'ICN':row.airportCode,
    terminal:({P01:'T1',P02:'CONCOURSE',P03:'T2'})[row.terminalid]||row.terminalid,
    gate:row.gatenumber,checkin:row.chkinrange,carousel:row.carousel,id:row.fid,airline:row.airline},
    {...ctx,sourceId:`IIAC_PASSENGER_${ctx.direction}`});
}

export function normalizeKacFlight(row,ctx) {
  const io=clean(row.io).toUpperCase();
  if(io&&!((ctx.direction==='ARRIVAL'&&['I','IN'].includes(io))||(ctx.direction==='DEPARTURE'&&['O','OUT'].includes(io))))throw new Error('DIRECTION_MISMATCH');
  const airport=ctx.direction==='ARRIVAL'?row.arrAirportCode||row.arrvAirportCode:row.depAirportCode;
  if(!KAC_AIRPORTS.some(a=>a.iata===airport))throw new Error('OUT_OF_SOURCE_SCOPE');
  const f=normalize({flightNumber:row.flightid,master:row.masterflightid,
    slave:row.codeshare==='Y'&&!clean(row.masterflightid),shared:row.codeshare==='Y',
    scheduled:row.scheduledatetime,estimated:row.estimateddatetime,status:row.rmkKor,
    origin:row.depAirportCode,destination:row.arrAirportCode||row.arrvAirportCode,
    updated:row.fgenTime,id:row.fid,airline:row.airline},
    {...ctx,sourceId:`KAC_FLIGHT_${ctx.direction}`});
  // KAC documents this field as actual time. Only completed movements can use it as actual.
  if(ctx.direction==='ARRIVAL'&&['ARRIVED','LANDED'].includes(f.status))f.actualArrival=f.estimatedArrival;
  if(ctx.direction==='DEPARTURE'&&f.status==='DEPARTED')f.actualDeparture=f.estimatedDeparture;
  return f;
}

export function collapseFlightRows(rows,normalizeRow,ctx) {
  const flights=new Map(),aliases=new Map(),rejected=[],seenOperating=new Set();
  let duplicateRows=0,outOfScopeRows=0;
  for(let i=0;i<rows.length;i++) {
    try {
      const f=normalizeRow(rows[i],ctx);
      const alias=f.flightNumber!==f.operatingFlightNumber;
      if(alias) aliases.set(f.flightInstanceId+':'+f.flightNumber,{
        flightInstanceId:f.flightInstanceId,serviceDate:f.serviceDate,marketingFlightNumber:f.flightNumber,
        marketingAirline:f.marketingAirline,operatingFlightNumber:f.operatingFlightNumber,sourceId:f.sourceId,observedAt:f.observedAt});
      const canonical={...f,flightNumber:f.operatingFlightNumber,marketingAirline:null,masterFlightNumber:null};
      const rank=[alias?0:1,Date.parse(f.sourceUpdatedAt)||0,f.status==='UNKNOWN'?0:1,
        [f.estimatedArrival,f.estimatedDeparture,f.gate,f.terminal].filter(Boolean).length,JSON.stringify(canonical)];
      const previous=flights.get(f.flightInstanceId);
      const compare=(a,b)=>{for(let j=0;j<a.length;j++){if(a[j]!==b[j])return a[j]>b[j]?1:-1;}return 0;};
      if(!alias){if(seenOperating.has(f.flightInstanceId))duplicateRows++;seenOperating.add(f.flightInstanceId);}
      if(!previous||compare(rank,previous.rank)>0)flights.set(f.flightInstanceId,{rank,flight:canonical});
    }catch(error){
      if(error.message==='OUT_OF_SOURCE_SCOPE'){outOfScopeRows++;continue;}
      rejected.push({index:i,reason:/^[A-Z_]+$/.test(error.message)?error.message:'MALFORMED_ROW'});
    }
  }
  if(rows.length>outOfScopeRows&&!flights.size)throw new Error('ALL_FLIGHT_ROWS_REJECTED');
  return {flights:[...flights.values()].map(v=>v.flight),aliases:[...aliases.values()],
    diagnostics:{rawRows:rows.length,operatingFlights:flights.size,marketingAliases:aliases.size,duplicateRows,outOfScopeRows,rejectedRows:rejected.length,rejected}};
}
