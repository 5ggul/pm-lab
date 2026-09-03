import { meaningfulDiff } from '../../core.js';

const UPSERT_FLIGHT_SQL = `INSERT INTO flight_current (
  flight_instance_id, service_date, flight_number, operating_flight_number,
  operating_airline, marketing_airline, is_codeshare, master_flight_number,
  origin, destination, direction, scheduled_departure, estimated_departure,
  actual_departure, scheduled_arrival, estimated_arrival, actual_arrival,
  terminal, gate, checkin_counter, baggage_carousel, status_raw, status,
  delay_minutes, status_updated_at, source_id, source_updated_at, observed_at,
  source_record_key, updated_at
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
ON CONFLICT(flight_instance_id) DO UPDATE SET
  flight_number=excluded.flight_number,
  operating_flight_number=excluded.operating_flight_number,
  operating_airline=excluded.operating_airline,
  marketing_airline=excluded.marketing_airline,
  is_codeshare=excluded.is_codeshare,
  master_flight_number=excluded.master_flight_number,
  origin=excluded.origin,
  destination=excluded.destination,
  direction=excluded.direction,
  scheduled_departure=excluded.scheduled_departure,
  estimated_departure=excluded.estimated_departure,
  actual_departure=excluded.actual_departure,
  scheduled_arrival=excluded.scheduled_arrival,
  estimated_arrival=excluded.estimated_arrival,
  actual_arrival=excluded.actual_arrival,
  terminal=excluded.terminal,
  gate=excluded.gate,
  checkin_counter=excluded.checkin_counter,
  baggage_carousel=excluded.baggage_carousel,
  status_raw=excluded.status_raw,
  status=excluded.status,
  delay_minutes=excluded.delay_minutes,
  status_updated_at=excluded.status_updated_at,
  source_id=excluded.source_id,
  source_updated_at=excluded.source_updated_at,
  observed_at=excluded.observed_at,
  source_record_key=excluded.source_record_key,
  updated_at=CURRENT_TIMESTAMP`;

const INSERT_EVENT_SQL = `INSERT INTO flight_events
  (flight_instance_id,changed_at,changed_fields_json,snapshot_json,source_id)
  VALUES (?,?,?,?,?)`;

const UPSERT_SOURCE_HEALTH_SQL = `INSERT INTO source_health
  (source_id,readiness,last_attempt_at,last_success_at,last_error_at,last_error_code,last_error_message,consecutive_failures,payload_hash,schema_hash)
  VALUES (?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(source_id) DO UPDATE SET
    readiness=excluded.readiness,
    last_attempt_at=excluded.last_attempt_at,
    last_success_at=COALESCE(excluded.last_success_at,source_health.last_success_at),
    last_error_at=excluded.last_error_at,
    last_error_code=excluded.last_error_code,
    last_error_message=excluded.last_error_message,
    consecutive_failures=excluded.consecutive_failures,
    payload_hash=COALESCE(excluded.payload_hash,source_health.payload_hash),
    schema_hash=COALESCE(excluded.schema_hash,source_health.schema_hash)`;

function dbRowToFlight(r){
  if(!r) return null;
  return {
    flightInstanceId:r.flight_instance_id, serviceDate:r.service_date,
    flightNumber:r.flight_number, operatingFlightNumber:r.operating_flight_number,
    operatingAirline:r.operating_airline, marketingAirline:r.marketing_airline,
    isCodeshare:Boolean(r.is_codeshare), masterFlightNumber:r.master_flight_number,
    origin:r.origin, destination:r.destination, direction:r.direction,
    scheduledDeparture:r.scheduled_departure, estimatedDeparture:r.estimated_departure,
    actualDeparture:r.actual_departure, scheduledArrival:r.scheduled_arrival,
    estimatedArrival:r.estimated_arrival, actualArrival:r.actual_arrival,
    terminal:r.terminal, gate:r.gate, checkinCounter:r.checkin_counter,
    baggageCarousel:r.baggage_carousel, statusRaw:r.status_raw, status:r.status,
    delayMinutes:r.delay_minutes, statusUpdatedAt:r.status_updated_at,
    sourceId:r.source_id, sourceUpdatedAt:r.source_updated_at,
    observedAt:r.observed_at, sourceRecordKey:r.source_record_key
  };
}

function flightBindings(f){
  return [f.flightInstanceId,f.serviceDate,f.flightNumber,f.operatingFlightNumber,
    f.operatingAirline,f.marketingAirline,f.isCodeshare?1:0,f.masterFlightNumber,
    f.origin,f.destination,f.direction,f.scheduledDeparture,f.estimatedDeparture,
    f.actualDeparture,f.scheduledArrival,f.estimatedArrival,f.actualArrival,
    f.terminal,f.gate,f.checkinCounter,f.baggageCarousel,f.statusRaw,f.status,
    f.delayMinutes,f.statusUpdatedAt,f.sourceId,f.sourceUpdatedAt,f.observedAt,
    f.sourceRecordKey];
}

export function persistenceDecision(previousRow,next){
  const previous=dbRowToFlight(previousRow);
  const diff=meaningfulDiff(previous,next);
  return {writeFlight:diff.changed,writeEvent:diff.changed,changedFields:diff.fields};
}

export async function persistFlightObservation(db,next){
  const previous=await db.prepare('SELECT * FROM flight_current WHERE flight_instance_id=?').bind(next.flightInstanceId).first();
  const decision=persistenceDecision(previous,next);
  if(!decision.writeFlight) return {changed:false,changedFields:[]};
  const statements=[
    db.prepare(UPSERT_FLIGHT_SQL).bind(...flightBindings(next)),
    db.prepare(INSERT_EVENT_SQL).bind(next.flightInstanceId,next.observedAt,JSON.stringify(decision.changedFields),JSON.stringify(next),next.sourceId)
  ];
  await db.batch(statements);
  return {changed:true,changedFields:decision.changedFields};
}

export async function recordSourceHealth(db,{sourceId,readiness,attemptedAt,succeededAt=null,errorAt=null,errorCode=null,errorMessage=null,consecutiveFailures=0,payloadHash=null,schemaHash=null}){
  return db.prepare(UPSERT_SOURCE_HEALTH_SQL).bind(sourceId,readiness,attemptedAt,succeededAt,errorAt,errorCode,errorMessage,consecutiveFailures,payloadHash,schemaHash).run();
}
