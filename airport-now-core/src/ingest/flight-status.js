import { collapseIiacDepartureRows, collapseKacFlightStatusRows, parseDataGoKrEnvelope } from '../flight-status-adapters.js';
import { persistenceDecision, recordSourceHealth } from '../storage/writer.js';

const SELECT_EXISTING_SQL=`SELECT * FROM flight_current WHERE flight_instance_id IN (SELECT json_extract(value,'$.flightInstanceId') FROM json_each(?1))`;
const UPSERT_CHANGED_SQL=`INSERT INTO flight_current (
flight_instance_id,service_date,flight_number,operating_flight_number,operating_airline,marketing_airline,is_codeshare,master_flight_number,origin,destination,direction,scheduled_departure,estimated_departure,actual_departure,scheduled_arrival,estimated_arrival,actual_arrival,terminal,gate,checkin_counter,baggage_carousel,status_raw,status,delay_minutes,status_updated_at,source_id,source_updated_at,observed_at,source_record_key,updated_at)
SELECT json_extract(value,'$.flightInstanceId'),json_extract(value,'$.serviceDate'),json_extract(value,'$.flightNumber'),json_extract(value,'$.operatingFlightNumber'),json_extract(value,'$.operatingAirline'),json_extract(value,'$.marketingAirline'),COALESCE(json_extract(value,'$.isCodeshare'),0),json_extract(value,'$.masterFlightNumber'),json_extract(value,'$.origin'),json_extract(value,'$.destination'),json_extract(value,'$.direction'),json_extract(value,'$.scheduledDeparture'),json_extract(value,'$.estimatedDeparture'),json_extract(value,'$.actualDeparture'),json_extract(value,'$.scheduledArrival'),json_extract(value,'$.estimatedArrival'),json_extract(value,'$.actualArrival'),json_extract(value,'$.terminal'),json_extract(value,'$.gate'),json_extract(value,'$.checkinCounter'),json_extract(value,'$.baggageCarousel'),json_extract(value,'$.statusRaw'),json_extract(value,'$.status'),json_extract(value,'$.delayMinutes'),json_extract(value,'$.statusUpdatedAt'),json_extract(value,'$.sourceId'),json_extract(value,'$.sourceUpdatedAt'),json_extract(value,'$.observedAt'),json_extract(value,'$.sourceRecordKey'),CURRENT_TIMESTAMP FROM json_each(?1)
WHERE true ON CONFLICT(flight_instance_id) DO UPDATE SET service_date=excluded.service_date,flight_number=excluded.flight_number,operating_flight_number=excluded.operating_flight_number,operating_airline=excluded.operating_airline,marketing_airline=excluded.marketing_airline,is_codeshare=excluded.is_codeshare,master_flight_number=excluded.master_flight_number,origin=excluded.origin,destination=excluded.destination,direction=excluded.direction,scheduled_departure=excluded.scheduled_departure,estimated_departure=excluded.estimated_departure,actual_departure=excluded.actual_departure,scheduled_arrival=excluded.scheduled_arrival,estimated_arrival=excluded.estimated_arrival,actual_arrival=excluded.actual_arrival,terminal=excluded.terminal,gate=excluded.gate,checkin_counter=excluded.checkin_counter,baggage_carousel=excluded.baggage_carousel,status_raw=excluded.status_raw,status=excluded.status,delay_minutes=excluded.delay_minutes,status_updated_at=excluded.status_updated_at,source_id=excluded.source_id,source_updated_at=excluded.source_updated_at,observed_at=excluded.observed_at,source_record_key=excluded.source_record_key,updated_at=CURRENT_TIMESTAMP`;
const UPSERT_ALIASES_SQL=`INSERT INTO flight_codeshares (flight_instance_id,service_date,marketing_flight_number,marketing_airline,operating_flight_number,source_id,observed_at,updated_at)
SELECT json_extract(value,'$.flightInstanceId'),json_extract(value,'$.serviceDate'),json_extract(value,'$.marketingFlightNumber'),json_extract(value,'$.marketingAirline'),json_extract(value,'$.operatingFlightNumber'),json_extract(value,'$.sourceId'),json_extract(value,'$.observedAt'),CURRENT_TIMESTAMP FROM json_each(?1)
WHERE true ON CONFLICT(flight_instance_id,marketing_flight_number) DO UPDATE SET service_date=excluded.service_date,marketing_airline=excluded.marketing_airline,operating_flight_number=excluded.operating_flight_number,source_id=excluded.source_id,observed_at=excluded.observed_at,updated_at=CURRENT_TIMESTAMP`;
const INSERT_EVENTS_SQL=`INSERT INTO flight_events (flight_instance_id,changed_at,changed_fields_json,snapshot_json,source_id)
SELECT json_extract(value,'$.flightInstanceId'),json_extract(value,'$.changedAt'),json_extract(value,'$.changedFieldsJson'),json_extract(value,'$.snapshotJson'),json_extract(value,'$.sourceId') FROM json_each(?1)`;

function payload(v){const s=JSON.stringify(v);if(new TextEncoder().encode(s).byteLength>1_800_000)throw new Error('D1_BULK_JSON_TOO_LARGE');return s}
function rowToFlight(r){return r?{flightInstanceId:r.flight_instance_id,serviceDate:r.service_date,flightNumber:r.flight_number,operatingFlightNumber:r.operating_flight_number,operatingAirline:r.operating_airline,marketingAirline:r.marketing_airline,isCodeshare:Boolean(r.is_codeshare),masterFlightNumber:r.master_flight_number,origin:r.origin,destination:r.destination,direction:r.direction,scheduledDeparture:r.scheduled_departure,estimatedDeparture:r.estimated_departure,actualDeparture:r.actual_departure,scheduledArrival:r.scheduled_arrival,estimatedArrival:r.estimated_arrival,actualArrival:r.actual_arrival,terminal:r.terminal,gate:r.gate,checkinCounter:r.checkin_counter,baggageCarousel:r.baggage_carousel,statusRaw:r.status_raw,status:r.status,delayMinutes:r.delay_minutes,statusUpdatedAt:r.status_updated_at,sourceId:r.source_id,sourceUpdatedAt:r.source_updated_at,observedAt:r.observed_at,sourceRecordKey:r.source_record_key}:null}

export function planBulkFlightChanges(existing,flights){
  const byId=new Map((existing||[]).map(r=>[r.flight_instance_id,rowToFlight(r)]));
  const changedFlights=[],events=[];
  for(const f of flights){const d=persistenceDecision(byId.get(f.flightInstanceId)||null,f);if(!d.writeFlight)continue;changedFlights.push(f);events.push({flightInstanceId:f.flightInstanceId,changedAt:f.observedAt,changedFieldsJson:JSON.stringify(d.changedFields),snapshotJson:JSON.stringify(f),sourceId:f.sourceId})}
  return {changedFlights,events};
}

async function persistCollapsed(db,collapsed){
  const ids=collapsed.flights.map(f=>({flightInstanceId:f.flightInstanceId}));
  const current=ids.length?(await db.prepare(SELECT_EXISTING_SQL).bind(payload(ids)).all()).results||[]:[];
  const plan=planBulkFlightChanges(current,collapsed.flights);
  const statements=[];
  if(plan.changedFlights.length) statements.push(db.prepare(UPSERT_CHANGED_SQL).bind(payload(plan.changedFlights)));
  if(collapsed.aliases.length) statements.push(db.prepare(UPSERT_ALIASES_SQL).bind(payload(collapsed.aliases)));
  if(plan.events.length) statements.push(db.prepare(INSERT_EVENTS_SQL).bind(payload(plan.events)));
  if(statements.length) await db.batch(statements);
  return {...collapsed.diagnostics,changedFlights:plan.changedFlights.length,emittedEvents:plan.events.length,dbStatements:1+statements.length};
}

async function ingest(db,payloadValue,{serviceDate,observedAt,sourceId,collapse,direction=null}){
  if(!db) throw new Error('D1_REQUIRED');
  if(!serviceDate||!observedAt) throw new Error('serviceDate and observedAt required');
  try{
    const {rows,totalCount}=parseDataGoKrEnvelope(payloadValue,{sourceId});
    const collapsed=collapse(rows,{serviceDate,observedAt,...(direction?{direction}:{})});
    const result=await persistCollapsed(db,collapsed);
    await recordSourceHealth(db,{sourceId,readiness:'LIVE_CAPTURED',attemptedAt:observedAt,succeededAt:observedAt,consecutiveFailures:0});
    return {...result,totalCount};
  }catch(error){
    try{await recordSourceHealth(db,{sourceId,readiness:'ERROR',attemptedAt:observedAt,errorAt:observedAt,errorCode:String(error?.message||'INGEST_ERROR').split(':')[0],errorMessage:String(error?.message||error),consecutiveFailures:1})}catch{}
    throw error;
  }
}

export function ingestIiacDeparturePayload(db,payloadValue,ctx){return ingest(db,payloadValue,{...ctx,sourceId:'IIAC_PASSENGER_DEPARTURE',collapse:collapseIiacDepartureRows})}
export function ingestKacDeparturePayload(db,payloadValue,ctx){return ingest(db,payloadValue,{...ctx,sourceId:'KAC_FLIGHT_STATUS_GW',direction:'DEPARTURE',collapse:collapseKacFlightStatusRows})}
export function ingestKacArrivalPayload(db,payloadValue,ctx){return ingest(db,payloadValue,{...ctx,sourceId:'KAC_FLIGHT_STATUS_GW',direction:'ARRIVAL',collapse:collapseKacFlightStatusRows})}

export const FLIGHT_STATUS_BULK_SQL=Object.freeze({SELECT_EXISTING_SQL,UPSERT_CHANGED_SQL,UPSERT_ALIASES_SQL,INSERT_EVENTS_SQL});
