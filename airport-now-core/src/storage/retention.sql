-- Run daily. Current state is retained; event history is bounded.
DELETE FROM flight_events WHERE changed_at < datetime('now','-90 days');
DELETE FROM airport_hourly_metrics WHERE service_date < date('now','-100 days');
-- Keep daily aggregates longer than raw events so route/flight trend pages do not require raw history.
DELETE FROM route_daily_metrics WHERE service_date < date('now','-400 days');
DELETE FROM flight_number_daily_metrics WHERE service_date < date('now','-400 days');
