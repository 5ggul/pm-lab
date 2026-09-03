PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS flight_current (flight_instance_id TEXT PRIMARY KEY,service_date TEXT NOT NULL,flight_number TEXT NOT NULL,operating_flight_number TEXT NOT NULL,operating_airline TEXT,marketing_airline TEXT,is_codeshare INTEGER NOT NULL DEFAULT 0,master_flight_number TEXT,origin TEXT NOT NULL,destination TEXT NOT NULL,direction TEXT NOT NULL CHECK(direction IN ('DEPARTURE','ARRIVAL')),scheduled_departure TEXT,estimated_departure TEXT,actual_departure TEXT,scheduled_arrival TEXT,estimated_arrival TEXT,actual_arrival TEXT,terminal TEXT,gate TEXT,checkin_counter TEXT,baggage_carousel TEXT,status_raw TEXT,status TEXT NOT NULL,delay_minutes INTEGER,status_updated_at TEXT,source_id TEXT NOT NULL,source_updated_at TEXT,observed_at TEXT NOT NULL,source_record_key TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_flight_current_service_origin ON flight_current(service_date,origin,direction);
CREATE INDEX IF NOT EXISTS idx_flight_current_service_dest ON flight_current(service_date,destination,direction);
CREATE INDEX IF NOT EXISTS idx_flight_current_number_date ON flight_current(flight_number,service_date DESC);
CREATE INDEX IF NOT EXISTS idx_flight_current_status_date ON flight_current(status,service_date);

CREATE TABLE IF NOT EXISTS flight_events (id INTEGER PRIMARY KEY AUTOINCREMENT,flight_instance_id TEXT NOT NULL,changed_at TEXT NOT NULL,changed_fields_json TEXT NOT NULL,snapshot_json TEXT NOT NULL,source_id TEXT NOT NULL,FOREIGN KEY(flight_instance_id) REFERENCES flight_current(flight_instance_id));
CREATE INDEX IF NOT EXISTS idx_flight_events_instance_time ON flight_events(flight_instance_id,changed_at DESC);

CREATE TABLE IF NOT EXISTS source_health (source_id TEXT PRIMARY KEY,readiness TEXT NOT NULL,last_attempt_at TEXT,last_success_at TEXT,last_error_at TEXT,last_error_code TEXT,last_error_message TEXT,consecutive_failures INTEGER NOT NULL DEFAULT 0,payload_hash TEXT,schema_hash TEXT);

CREATE TABLE IF NOT EXISTS weather_current (icao TEXT PRIMARY KEY,kind TEXT NOT NULL,phenomenon_time TEXT,air_temperature REAL,dewpoint_temperature REAL,qnh REAL,mean_wind_direction REAL,mean_wind_speed REAL,wind_gust_speed REAL,visibility REAL,present_weather TEXT,source_id TEXT NOT NULL,observed_at TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS airport_warning_current (warning_key TEXT PRIMARY KEY,icao TEXT,airport_name TEXT,warning_type TEXT,issued_at TEXT,valid_from TEXT,valid_to TEXT,warning_message TEXT,source_id TEXT NOT NULL,observed_at TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_airport_warning_icao_valid ON airport_warning_current(icao,valid_to);

CREATE TABLE IF NOT EXISTS airport_forecast_current (icao TEXT NOT NULL,forecast_for TEXT NOT NULL,issued_at TEXT,wind_direction REAL,wind_speed REAL,air_temperature REAL,qnh REAL,source_id TEXT NOT NULL,observed_at TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(icao,forecast_for));

CREATE TABLE IF NOT EXISTS congestion_current (source_id TEXT NOT NULL,scope_key TEXT NOT NULL,airport_iata TEXT,terminal TEXT,zone TEXT,direction TEXT,flight_number TEXT,waiting_local INTEGER,waiting_foreigner INTEGER,waiting_total INTEGER,queue_count INTEGER,data_as_of TEXT,observed_at TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(source_id,scope_key));
CREATE INDEX IF NOT EXISTS idx_congestion_airport_terminal ON congestion_current(airport_iata,terminal,direction);

CREATE TABLE IF NOT EXISTS parking_current (source_id TEXT NOT NULL,airport_iata TEXT NOT NULL,terminal TEXT,lot_id TEXT NOT NULL,lot_name TEXT,capacity INTEGER,occupied INTEGER,available INTEGER,data_as_of TEXT,observed_at TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(source_id,airport_iata,lot_id));

CREATE TABLE IF NOT EXISTS process_time_current (source_id TEXT NOT NULL,airport_iata TEXT NOT NULL,terminal TEXT,segment TEXT NOT NULL,duration_minutes REAL,data_as_of TEXT,observed_at TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(source_id,airport_iata,segment));

CREATE TABLE IF NOT EXISTS airport_hourly_metrics (service_date TEXT NOT NULL,hour_kst INTEGER NOT NULL,airport_iata TEXT NOT NULL,direction TEXT NOT NULL,eligible_flights INTEGER NOT NULL,delayed_flights INTEGER NOT NULL,cancelled_flights INTEGER NOT NULL,delay_minutes_sum INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(service_date,hour_kst,airport_iata,direction));
CREATE TABLE IF NOT EXISTS route_daily_metrics (service_date TEXT NOT NULL,origin TEXT NOT NULL,destination TEXT NOT NULL,eligible_flights INTEGER NOT NULL,delayed_flights INTEGER NOT NULL,cancelled_flights INTEGER NOT NULL,delay_minutes_sum INTEGER NOT NULL DEFAULT 0,scheduled_duration_minutes_sum INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(service_date,origin,destination));
CREATE TABLE IF NOT EXISTS flight_number_daily_metrics (service_date TEXT NOT NULL,flight_number TEXT NOT NULL,origin TEXT NOT NULL,destination TEXT NOT NULL,operated INTEGER NOT NULL DEFAULT 0,delayed INTEGER NOT NULL DEFAULT 0,cancelled INTEGER NOT NULL DEFAULT 0,departure_delay_minutes INTEGER,arrival_delay_minutes INTEGER,PRIMARY KEY(service_date,flight_number,origin,destination));
