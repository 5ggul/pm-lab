import { normalizeIiacArrival } from '../core.js';

const HOUR=3600000;

function airlinePrefix(flightNumber){
  const m=String(flightNumber||'').toUpperCase().replace(/\s+/g,'').match(/^([A-Z0-9]{2})(?=\d)/);
  return m?.[1]||null;
}

function toKstIso(instant){
  const ms=Date.parse(instant);
  if(!Number.isFinite(ms)) return instant||null;
  return `${new Date(ms+9*HOUR).toISOString().slice(0,19)}+09:00`;
}

export function normalizeIiacArrivalLive(row,ctx){
  const f=normalizeIiacArrival(row,ctx);
  const operatingAirline=airlinePrefix(f.operatingFlightNumber);
  const marketingAirline=airlinePrefix(f.flightNumber);
  const estimatedArrival=f.estimatedArrival?.endsWith('+00:00')?toKstIso(f.estimatedArrival):f.estimatedArrival;
  return {
    ...f,
    operatingAirline,
    marketingAirline,
    estimatedArrival
  };
}

function rowRank(row){
  const shareBase=row?.codeshare==='Master'?300:row?.codeshare==='Slave'?100:200;
  const active=row?.remark?40:0;
  const completeness=['estimatedDateTime','gatenumber','carousel','exitnumber','terminalId','airportCode']
    .reduce((n,k)=>n+(row?.[k]!=null&&row[k]!==''?1:0),0);
  return shareBase+active+completeness;
}

function canonicalOperatingFlight(f,row){
  if(row?.codeshare!=='Slave'){
    return {
      ...f,
      flightNumber:f.operatingFlightNumber,
      marketingAirline:null,
      masterFlightNumber:null
    };
  }
  return {
    ...f,
    flightNumber:f.operatingFlightNumber,
    marketingAirline:null,
    masterFlightNumber:null,
    sourceRecordKey:`${f.serviceDate}:${f.operatingFlightNumber}:${f.origin}:${f.destination}:OPERATING`
  };
}

export function collapseIiacArrivalRows(rows,ctx){
  if(!Array.isArray(rows)) throw new Error('IIAC arrival rows must be an array');
  const byOperating=new Map();
  const aliases=[];
  for(const row of rows){
    const normalized=normalizeIiacArrivalLive(row,ctx);
    if(row?.codeshare==='Slave'){
      aliases.push({
        flightInstanceId:normalized.flightInstanceId,
        serviceDate:normalized.serviceDate,
        marketingFlightNumber:normalized.flightNumber,
        marketingAirline:normalized.marketingAirline,
        operatingFlightNumber:normalized.operatingFlightNumber,
        sourceId:normalized.sourceId,
        observedAt:normalized.observedAt
      });
    }
    const candidate=canonicalOperatingFlight(normalized,row);
    const existing=byOperating.get(candidate.flightInstanceId);
    const rank=rowRank(row);
    if(!existing||rank>existing.rank) byOperating.set(candidate.flightInstanceId,{rank,flight:candidate});
  }
  return {
    flights:[...byOperating.values()].map(x=>x.flight),
    aliases,
    diagnostics:{
      rawRows:rows.length,
      operatingFlights:byOperating.size,
      marketingAliases:aliases.length,
      duplicateOperatingRows:rows.length-byOperating.size-aliases.length
    }
  };
}
