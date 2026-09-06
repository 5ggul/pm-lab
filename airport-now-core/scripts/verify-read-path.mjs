import http from 'node:http';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/worker.js';

// Real TCP requests to the Worker fetch handler, backed by the local workerd D1 binding.
export async function verifyReadPath(db,date) {
  const server=http.createServer(async(req,res)=>{
    try {
      const response=await handleRequest(new Request('http://localhost'+req.url,{method:req.method}),{DB:db});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
    }catch{res.writeHead(500);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const endpoints=[];
  try {
    const alias=await db.prepare('SELECT marketing_flight_number FROM flight_codeshares LIMIT 1').first();
    const paths=[
      ['/api/search/flights?q='+encodeURIComponent(alias?.marketing_flight_number||'KE123'),200],
      ...[['ICN','ARRIVAL'],['ICN','DEPARTURE'],['CJU','ARRIVAL'],['GMP','DEPARTURE']].map(([a,d])=>[`/api/airports/${a}/flights?direction=${d}`,200]),
      ['/api/weather/RKPC',200],['/api/weather?icaos=RKSI,RKSS,RKPC,RKPK',200],
      ['/api/airports/GMP/flights?direction=SIDEWAYS',400],['/api/airports/ZZZ/flights',400],
      ['/api/search/flights?q=%27%20OR%201=1',400],['/api/airports/GMP/flights?limit=-1',400]
    ];
    for(const [p,status] of paths) {
      const r=await fetch(base+p+(p.includes('?')?'&':'?')+'date='+date);
      assert.equal(r.status,status,p);assert.equal(r.headers.get('access-control-allow-origin'),'*');
      const b=await r.json();
      if(b.results&&p.includes('/flights'))assert.equal(new Set(b.results.map(f=>f.flight_instance_id)).size,b.results.length);
      if(alias&&p.startsWith('/api/search/flights?q=')&&status===200)assert.ok(b.results.length>0);
      endpoints.push({path:p,status:r.status,rows:b.results?.length,current:b.current});
    }
    const options=await fetch(base+'/api/health',{method:'OPTIONS'});assert.equal(options.status,204);
    const counts={};
    for(const table of ['flight_current','flight_codeshares','flight_events','weather_current','weather_events','source_health'])counts[table]=(await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n;
    const sources=(await db.prepare('SELECT source_id,COUNT(*) AS n FROM flight_current GROUP BY source_id').all()).results;
    const health=(await db.prepare('SELECT source_id,readiness,last_error_code FROM source_health').all()).results;
    return {counts,sources,health,endpoints};
  }finally{await new Promise(resolve=>server.close(resolve));}
}
