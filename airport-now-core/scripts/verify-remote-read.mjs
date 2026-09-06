import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base='https://airport-now-preview-core.dhkim8704.workers.dev',checks=[];
async function read(path,status=200){const r=await fetch(base+path,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,status,path);assert.equal(r.headers.get('access-control-allow-origin'),'*');const body=await r.json();checks.push({path,status,rows:body.results?.length,current:body.current,collection:body.collection});return body;}
for(const [airport,direction] of [['ICN','ARRIVAL'],['ICN','DEPARTURE'],['CJU','ARRIVAL'],['GMP','DEPARTURE']]){
  const rows=[];let date;
  for(let offset=0;offset<10000;offset+=200){
    const b=await read(`/api/airports/${airport}/flights?direction=${direction}&limit=200&offset=${offset}${date?'&date='+date:''}`);date=b.date;
    rows.push(...b.results);if(b.results.length<200)break;
  }
  assert.ok(rows.length>0,airport+' '+direction+' has no live rows');
  assert.equal(new Set(rows.map(x=>x.flight_instance_id)).size,rows.length);
  assert.ok(rows.every(x=>x.direction===direction&&(direction==='ARRIVAL'?x.destination:x.origin)===airport));
  checks.push({airport,direction,totalRows:rows.length});
}
const alias=await read('/api/search/flights?q=QF8233');assert.ok(alias.results.some(x=>x.flight_number==='CX426'));
const weather=await read('/api/weather/RKPC');assert.equal(weather.current,true);
const batch=await read('/api/weather?icaos=RKSI,RKSS,RKPC,RKPK');assert.equal(batch.results.length,4);
const stale=await read('/api/weather/RKJK');assert.equal(stale.current,false);assert.equal(stale.weather,null);
for(const p of ['/api/airports/ZZZ/flights','/api/airports/ICN/flights?direction=SIDEWAYS','/api/airports/ICN/flights?limit=-1','/api/airports/ICN/flights?offset=-1','/api/airports/ICN/flights?date=2026-02-30','/api/search/flights?q=%27%20OR%201=1'])await read(p,400);
assert.equal((await fetch(base+'/api/health',{method:'OPTIONS'})).status,204);
const hidden=await fetch(base+'/internal/ingest/once',{method:'POST'});assert.equal(hidden.status,404);assert.equal(hidden.headers.get('access-control-allow-origin'),null);
const report={verifiedAt:new Date().toISOString(),base,checks};
await fs.mkdir(new URL('../tests/fixtures/live-local/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../tests/fixtures/live-local/remote-read-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
