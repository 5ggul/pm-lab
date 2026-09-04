import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../src/storage/schema.sql',import.meta.url),'utf8');
for(const table of ['flight_current','flight_codeshares','flight_events','source_health','weather_current','airport_warning_current','airport_forecast_current','congestion_current','parking_current','process_time_current','airport_hourly_metrics','route_daily_metrics','flight_number_daily_metrics']) test(`schema includes ${table}`,()=>assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`)));
