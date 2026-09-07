import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import {comparisonReadiness} from '../src/stats/comparison-readiness.js';
test('comparison readiness uses exact weekday slots, version and source; never publishes prematurely',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync(new URL('../src/storage/schema.sql',import.meta.url),'utf8'));
 const db={prepare(q){return{bind(...a){return{async all(){return{results:sql.prepare(q).all(...a)}}}}}}};
 const insert=(date,known=20,unknown=0,version='status-share-v1')=>sql.prepare('INSERT INTO airport_observations VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(version,'IIAC_PASSENGER_ARRIVAL',date,date,16,0,date+'T07:01:00.000Z',date+'T07:00:00.000Z','ICN','ARRIVAL',known,unknown,0,0);
 insert('2026-09-07');insert('2026-08-31');insert('2026-08-24',19);insert('2026-08-17',20,1);insert('2026-08-10',20,0,'old-version');insert('2026-09-06');
 const d=await comparisonReadiness(db,'ICN',Date.parse('2026-09-07T07:03:00Z'));const a=d.results[1];assert.equal(a.qualifyingWeeks,1);assert.equal(a.reason,'HISTORY_INSUFFICIENT');assert.equal(a.current.knownCount,20);assert.equal(a.history[3].recorded,false);assert.equal(d.results[0].reason,'CURRENT_OBSERVATION_MISSING');assert.equal(a.comparisonAvailable,false);
 const later=await comparisonReadiness(db,'ICN',Date.parse('2026-09-07T07:13:00Z'));assert.equal(later.results[1].current,null);
 await assert.rejects(comparisonReadiness(db,'XYZ'),/INVALID_AIRPORT/);sql.close();
});
