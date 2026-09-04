import { collapseIiacArrivalRows } from '../iiac-live.js';
import { persistenceDecision, recordSourceHealth } from '../storage/writer.js';

const SELECT_EXISTING_SQL=`SELECT * FROM flight_current
WHERE flight_instance_id IN (
  SELECT json_extract(value,'$.flightInstanceId') FROM json_each(?1)
)`;

const UPSERT_CHANGED_SQL=`INSERT INTO flight_current (
  flight_instance_id,service_date,flight_number,operating_flight_number,
  operating_airline,marketing_airline,is_codeshare,master_flight_number,
  origin,destination,direction,scheduled_departure,estimated_departure,
  actual_departure,scheduled_arrival,estimated_arrival,actual_arrival,
  terminal,gate,checkin_counter,baggage_carousel,status_raw,status,
  delay_minutes,status_updated_at,source_id,source_updated_at,observed_at,
  source_record_key,updated_at
)
SELECT
  json_extract(value,'$.flightInstanceId'),json_extract(value,'$.serviceDate'),
  json_extract(value,'$.flightNumber'),json_extract(value,'$.operatingFlightNumber'),
  json_extract(value,'$.operatingAirline'),json_extract(value,'$.marketingAirline'),
  COALESCE(json_extract(value,'$.isCodeshare'),0),json_extract(value,'$.masterFlightNumber'),
  json_extract(value,'$.origin'),json_extract(value,'$.destination'),json_extract(value,'$.direction'),
  json_extract(value,'$.scheduledDeparture'),json_extract(value,'$.estimatedDeparture'),
  json_extract(value,'$.actualDeparture'),json_extract(value,'$.scheduledArrival'),
  json_extract(value,'$.estimatedArrival'),json_extract(value,'$.actualArrival'),
  json_extract(value,'$.terminal'),json_extract(value,'$.gate'),json_extract(value,'$.checkinCounter'),
  json_extract(value,'$.baggageCarousel'),json_extract(value,'$.statusRaw'),json_extract(value,'$.status'),
  json_extract(value,'$.delayMinutes'),json_extract(value,'$.statusUpdatedAt'),json_extract(value,'$.sourceId'),
  json_extract(value,'$.sourceUpdatedAt'),json_extract(value,'$.observedAt'),json_extract(value,'$.sourceRecordKey'),
  CURRENT_TIMESTAMP
FROM json_each(?1)
WHERE true
ON CONFLICT(flight_instance_id) DO UPDATE SET
  service_date=excluded.service_date,
  flight_number=excluded.flight_number,
  operating_flight_number=excluded.operating_flight_number,
  operating_airline=excluded.operating_airline,
  marketing_airline=excluded.marketing_airline,
  is_codeshare=excluded.is_codeshare,
  master_flight_number=excluded.master_flight_number,
  origin=excluded.origin,destination=excluded.destination,direction=excluded.direction,
  scheduled_departure=excluded.scheduled_departure,estimated_departure=excluded.estimated_departure,
  actual_departure=excluded.actual_departure,scheduled_arrival=excluded.scheduled_arrival,
  estimated_arrival=excluded.estimated_arrival,actual_arrival=excluded.actual_arrival,
  terminal=excluded.terminal,gate=excluded.gate,checkin_counter=excluded.checkin_counter,
  baggage_carousel=excluded.baggage_carousel,status_raw=excluded.status_raw,status=excluded.status,
  delay_minutes=excluded.delay_minutes,status_updated_at=excluded.status_updated_at,
  source_id=excluded.source_id,source_updated_at=excluded.source_updated_at,
  observed_at=excluded.observed_at,source_record_key=excluded.source_record_key,
  updated_at=CURRENT_TIMESTAMP`;

const INSERT_ALIASES_SQL=`INSERT OR IGNORE INTO flight_codeshares (
  flight_instance_id,service_date,marketing_flight_number,marketing_airline,
  operating_flight_number,source_id,observed_at,updated_at
)
SELECT
  json_extract(value,'$.flightInstanceId'),json_extract(value,'$.serviceDate'),
  json_extract(value,'$.marketingFlightNumber'),json_extract(value,'$.marketingAirline'),
  json_extract(value,'$.operatingFlightNumber'),json_extract(value,'$.sourceId'),
  json_extract(value,'$.observedAt'),CURRENT_TIMESTAMP
FROM json_each(?1)`;

const INSERT_EVENTS_SQL=`INSERT INTO flight_events (
  flight_instance_id,changed_at,changed_fields_json,snapshot_json,source_id
)
SELECT
  json_extract(value,'$.flightInstanceId'),json_extract(value,'$.changedAt'),
  json_extract(value,'$.changedFieldsJson'),json_extract(value,'$.snapshotJson'),
  json_extract(value,'$.sourceId')
FROM json_each(?1)`;

function encodedSize(value){return Buffer.byteLength(JSON.stringify(value),'utf8')}
function ensurePayloadSize(value,label){
  const size=encodedSize(value);
  if(size>1_800_000) throw new Error(`${label}_JSON_TOO_LARGE:${size}`);
  return JSON.stringify(value);
}

export function parseIiacArrivalEnvelope(payload){
  const root=typeof payload==='string'?JSON.parse(payload):payload;
  const response=root?.response;
  const code=String(response?.header?.resultCode??'');
  if(code!=='00') throw new Error(`IIAC_RESPONSE_ERROR:${code||'MISSING_CODE'}:${response?.header?.resultMsg||''}`);
  const items=response?.body?.items;
  const rows=Array.isArray(items)?items:Array.isArray(items?.item)?items.item:[];
  if(!rows.length) throw new Error('IIAC_EMPTY_ITEMS');
  return rows;
}

async function existingRows(db,flights){
  if(!flights.length) return [];
  const payload=ensurePayloadSize(flights.map(x=>({flightInstanceId:x.flightInstanceId})),'IIAC_IDS');
  const result=await db.prepare(SELECT_EXISTING_SQL).bind(payload).all();
  return result.results||[];
}

export function planFlightChanges(existing,flights){
  const byId=new Map((existing||[]).map(x=>[x.flight_instance_id,x]));
  const changedFlights=[];
  const events=[];
  for(const flight of flights){
    const decision=persistenceDecision(byId.get(flight.flightInstanceId)||null,flight);
    if(!decision.writeFlight) continue;
    changedFlights.push(flight);
    events.push({
      flightInstanceId:flight.flightInstanceId,
      changedAt:flight.observedAt,
      changedFieldsJson:JSON.stringify(decision.changedFields),
      snapshotJson:JSON.stringify(flight),
      sourceId:flight.sourceId
    });
  }
  return {changedFlights,events};
}

async function persistBulk(db,{changedFlights,aliases,events}){
  let queryCount=0;
  if(changedFlights.length){
    await db.prepare(UPSERT_CHANGED_SQL).bind(ensurePayloadSize(changedFlights,'IIAC_CHANGED_FLIGHTS')).run();
    queryCount++;
  }
  if(aliases.length){
    await db.prepare(INSERT_ALIASES_SQL).bind(ensurePayloadSize(aliases,'IIAC_ALIASES')).run();
    queryCount++;
  }
  if(events.length){
    await db.prepare(INSERT_EVENTS_SQL).bind(ensurePayloadSize(events,'IIAC_EVENTS')).run();
    queryCount++;
  }
  return queryCount;
}

export async function ingestIiacArrivalPayload(db,payload,{serviceDate,observedAt}){
  if(!db) throw new Error('D1_REQUIRED');
  if(!serviceDate||!observedAt) throw new Error('serviceDate and observedAt required');
  const attemptedAt=observedAt;
  try{
    const rows=parseIiacArrivalEnvelope(payload);
    const collapsed=collapseIiacArrivalRows(rows,{serviceDate,observedAt});
    const current=await existingRows(db,collapsed.flights);
    const plan=planFlightChanges(current,collapsed.flights);
    let queryCount=1;
    queryCount+=await persistBulk(db,{...plan,aliases:collapsed.aliases});
    await recordSourceHealth(db,{sourceId:'IIAC_PASSENGER_ARRIVAL',readiness:'LIVE_CAPTURED',attemptedAt,succeededAt:observedAt,consecutiveFailures:0});
    queryCount++;
    return {
      ...collapsed.diagnostics,
      changedFlights:plan.changedFlights.length,
      emittedEvents:plan.events.length,
      queryCount
    };
  }catch(error){
    try{
      await recordSourceHealth(db,{sourceId:'IIAC_PASSENGER_ARRIVAL',readiness:'ERROR',attemptedAt,errorAt:observedAt,errorCode:error?.message?.split(':')[0]||'INGEST_ERROR',errorMessage:String(error?.message||error),consecutiveFailures:1});
    }catch{}
    throw error;
  }
}

export const IIAC_BULK_SQL=Object.freeze({SELECT_EXISTING_SQL,UPSERT_CHANGED_SQL,INSERT_ALIASES_SQL,INSERT_EVENTS_SQL});
