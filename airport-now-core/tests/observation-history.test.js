import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';import {observationHistory} from '../src/stats/observation-history.js';
test('history bounds time, count, source and metric without inventing missing records',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync(new URL('../src/storage/schema.sql',import.meta.url),'utf8'));const db={prepare(q){return{bind(...a){return{async all(){return{results:sql.prepare(q).all(...a)}}}}}}};
 const now=Date.parse('2026-09-07T08:00:00Z');function add(i,source='IIAC_PASSENGER_ARRIVAL',version='status-share-v1'){const t=new Date(now-i*600000).toISOString();sql.prepare('INSERT INTO airport_observations VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(version,source,t,'2026-09-07',16,0,t,t,'ICN','ARRIVAL',0,0,0,0);}
 for(let i=1;i<=8;i++)add(i);add(150);add(-1);add(0,'KAC_FLIGHT_ARRIVAL');add(0,'IIAC_PASSENGER_ARRIVAL','other');
 const d=await observationHistory(db,'ICN',now);assert.equal(d.results[0].observations.length,0);assert.equal(d.results[1].observations.length,6);assert.equal(d.results[1].observations[0].observed_at,new Date(now-600000).toISOString());assert.equal(d.results[1].observations[0].known_count,0);await assert.rejects(observationHistory(db,'XYZ',now),/INVALID_AIRPORT/);sql.close();
});
