export const SQL = Object.freeze({
  airportCurrent:`SELECT
    SUM(CASE WHEN status<>'UNKNOWN' THEN 1 ELSE 0 END) AS eligible_flights,
    SUM(CASE WHEN status='DELAYED' THEN 1 ELSE 0 END) AS delayed_flights,
    SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END) AS cancelled_flights,
    ROUND(100.0*SUM(CASE WHEN status='DELAYED' THEN 1 ELSE 0 END)/NULLIF(SUM(CASE WHEN status<>'UNKNOWN' THEN 1 ELSE 0 END),0),1) AS delay_rate,
    MAX(observed_at) AS data_as_of
  FROM flight_current
  WHERE service_date=?1 AND direction=?2
    AND (CASE WHEN direction='DEPARTURE' THEN origin ELSE destination END)=?3`,

  airportBaseline4Weeks:`SELECT
    SUM(eligible_flights) AS baseline_sample_size,
    SUM(delayed_flights) AS baseline_delayed,
    ROUND(100.0*SUM(delayed_flights)/NULLIF(SUM(eligible_flights),0),1) AS baseline_delay_rate
  FROM airport_hourly_metrics
  WHERE airport_iata=?1 AND direction=?2 AND hour_kst=?3
    AND service_date < ?4
    AND service_date >= date(?4,'-28 days')
    AND strftime('%w',service_date)=strftime('%w',?4)`,

  routePeriod:`SELECT
    SUM(eligible_flights) AS eligible_flights,
    SUM(delayed_flights) AS delayed_flights,
    SUM(cancelled_flights) AS cancelled_flights,
    ROUND(100.0*SUM(delayed_flights)/NULLIF(SUM(eligible_flights),0),1) AS delay_rate,
    ROUND(100.0*SUM(cancelled_flights)/NULLIF(SUM(eligible_flights),0),1) AS cancellation_rate,
    ROUND(1.0*SUM(delay_minutes_sum)/NULLIF(SUM(delayed_flights),0),1) AS avg_delay_minutes,
    COUNT(*) AS observed_days
  FROM route_daily_metrics
  WHERE origin=?1 AND destination=?2 AND service_date>=date(?3,?4) AND service_date<=?3`,

  flightNumber30d:`SELECT
    COUNT(*) AS observed_instances,
    SUM(operated) AS operated,
    SUM(delayed) AS delayed,
    SUM(cancelled) AS cancelled,
    ROUND(100.0*SUM(CASE WHEN operated=1 AND delayed=0 AND cancelled=0 THEN 1 ELSE 0 END)/NULLIF(SUM(operated),0),1) AS on_time_rate,
    ROUND(AVG(CASE WHEN departure_delay_minutes IS NOT NULL THEN departure_delay_minutes END),1) AS avg_departure_delay_minutes,
    ROUND(AVG(CASE WHEN arrival_delay_minutes IS NOT NULL THEN arrival_delay_minutes END),1) AS avg_arrival_delay_minutes
  FROM flight_number_daily_metrics
  WHERE flight_number=?1 AND service_date>=date(?2,'-30 days') AND service_date<=?2`
});

export async function airportCurrentSummary(db,{serviceDate,direction='DEPARTURE',airportIata}){
  return db.prepare(SQL.airportCurrent).bind(serviceDate,direction,airportIata).first();
}
export async function airportFourWeekBaseline(db,{serviceDate,hourKst,direction='DEPARTURE',airportIata}){
  return db.prepare(SQL.airportBaseline4Weeks).bind(airportIata,direction,hourKst,serviceDate).first();
}
export async function routeStats(db,{origin,destination,asOfDate,days=30}){
  if(![7,30,90].includes(days)) throw new Error('routeStats days must be 7, 30 or 90');
  return db.prepare(SQL.routePeriod).bind(origin,destination,asOfDate,`-${days-1} days`).first();
}
export async function flightNumber30d(db,{flightNumber,asOfDate}){
  return db.prepare(SQL.flightNumber30d).bind(flightNumber,asOfDate).first();
}
