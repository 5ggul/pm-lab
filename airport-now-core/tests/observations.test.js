import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import {recordObservation,observationContext} from '../src/stats/observations.js';
test('observation uses KST bucket, separates sources and does not duplicate retries',async()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync(new URL('../src/storage/schema.sql',import.meta.url),'utf8'));
 const db={prepare(sql){return{bind(...args){return{async run(){return sqlite.prepare(sql).run(...args)}}}}}};
 sqlite.prepare(`INSERT INTO flight_current(flight_instance_id,service_date,flight_number,operating_flight_number,origin,destination,direction,scheduled_arrival,status,source_id,observed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run('one','2026-09-08','KE1','KE1','NRT','ICN','ARRIVAL','2026-09-07T15:30:00Z','DELAYED','IIAC_PASSENGER_ARRIVAL','2026-09-07T15:01:00Z');
 const args={sourceId:'IIAC_PASSENGER_ARRIVAL',runId:'first',at:'2026-09-07T15:01:00Z'};
 sqlite.prepare("INSERT INTO source_health(source_id,readiness,last_success_at) VALUES (?,?,?)").run(args.sourceId,'LIVE_CAPTURED',args.at);
 await recordObservation(db,args);await recordObservation(db,{...args,runId:'retry'});
 const rows=sqlite.prepare('SELECT * FROM airport_observations').all();assert.equal(rows.length,1);assert.equal(rows[0].hour_kst,0);assert.equal(rows[0].service_date,'2026-09-08');assert.equal(rows[0].known_count,1);assert.equal(rows[0].delayed_count,1);assert.equal(rows[0].run_id,'first');
 assert.equal(observationContext('KAC_FLIGHT_DEPARTURE',args.at).airports.length,14);sqlite.close();
});
test('observations reject late windows and distinguish missing collections from real zero flights',async()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync(new URL('../src/storage/schema.sql',import.meta.url),'utf8'));
 const db={prepare(sql){return{bind(...args){return{async run(){return sqlite.prepare(sql).run(...args)}}}}}};
 const args={sourceId:'KAC_FLIGHT_ARRIVAL',runId:'cron.test',at:'2026-09-07T15:01:00Z'};
 await recordObservation(db,args);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM airport_observations').get().n,0);
 sqlite.prepare('INSERT INTO source_health(source_id,readiness,last_success_at) VALUES (?,?,?)').run(args.sourceId,'PARTIAL',args.at);
 await recordObservation(db,args);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM airport_observations').get().n,0);
 sqlite.prepare("UPDATE source_health SET readiness='LIVE_CAPTURED'").run();await recordObservation(db,args);
 const rows=sqlite.prepare('SELECT * FROM airport_observations').all();assert.equal(rows.length,14);assert.ok(rows.every(r=>r.known_count===0&&r.unknown_count===0));
 await assert.rejects(recordObservation(db,{...args,at:'2026-09-07T15:03:00Z'}),/OBSERVATION_WINDOW_MISSED/);sqlite.close();
});
