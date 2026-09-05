-- Compact aggregates: unchanged polls are not history rows.
INSERT INTO airport_hourly_metrics(service_date,hour_kst,airport_iata,direction,eligible_flights,delayed_flights,cancelled_flights,delay_minutes_sum)
SELECT service_date,CAST(substr(COALESCE(scheduled_departure,scheduled_arrival),12,2) AS INTEGER),CASE WHEN direction='DEPARTURE' THEN origin ELSE destination END,direction,SUM(CASE WHEN status<>'UNKNOWN' THEN 1 ELSE 0 END),SUM(CASE WHEN status='DELAYED' THEN 1 ELSE 0 END),SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END),SUM(COALESCE(delay_minutes,0)) FROM flight_current WHERE service_date=?1 AND COALESCE(scheduled_departure,scheduled_arrival) IS NOT NULL GROUP BY 1,2,3,4
ON CONFLICT(service_date,hour_kst,airport_iata,direction) DO UPDATE SET eligible_flights=excluded.eligible_flights,delayed_flights=excluded.delayed_flights,cancelled_flights=excluded.cancelled_flights,delay_minutes_sum=excluded.delay_minutes_sum;

INSERT INTO route_daily_metrics(service_date,origin,destination,eligible_flights,delayed_flights,cancelled_flights,delay_minutes_sum,scheduled_duration_minutes_sum)
SELECT service_date,origin,destination,SUM(CASE WHEN status<>'UNKNOWN' THEN 1 ELSE 0 END),SUM(CASE WHEN status='DELAYED' THEN 1 ELSE 0 END),SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END),SUM(COALESCE(delay_minutes,0)),SUM(CASE WHEN scheduled_departure IS NOT NULL AND scheduled_arrival IS NOT NULL THEN CAST((julianday(scheduled_arrival)-julianday(scheduled_departure))*1440 AS INTEGER) ELSE 0 END) FROM flight_current WHERE service_date=?1 AND direction='DEPARTURE' GROUP BY 1,2,3
ON CONFLICT(service_date,origin,destination) DO UPDATE SET eligible_flights=excluded.eligible_flights,delayed_flights=excluded.delayed_flights,cancelled_flights=excluded.cancelled_flights,delay_minutes_sum=excluded.delay_minutes_sum,scheduled_duration_minutes_sum=excluded.scheduled_duration_minutes_sum;

INSERT INTO flight_number_daily_metrics(service_date,flight_number,origin,destination,operated,delayed,cancelled,departure_delay_minutes,arrival_delay_minutes)
SELECT service_date,operating_flight_number,origin,destination,
MAX(CASE WHEN status NOT IN ('UNKNOWN','CANCELLED') THEN 1 ELSE 0 END),
MAX(CASE WHEN status='DELAYED' THEN 1 ELSE 0 END),
MAX(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END),
MAX(CASE WHEN direction='DEPARTURE' THEN delay_minutes END),
MAX(CASE WHEN direction='ARRIVAL' THEN delay_minutes END)
FROM flight_current WHERE service_date=?1 GROUP BY 1,2,3,4
ON CONFLICT(service_date,flight_number,origin,destination) DO UPDATE SET operated=excluded.operated,delayed=excluded.delayed,cancelled=excluded.cancelled,departure_delay_minutes=excluded.departure_delay_minutes,arrival_delay_minutes=excluded.arrival_delay_minutes;
