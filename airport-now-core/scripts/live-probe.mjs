import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildKmaMetarUrl, buildKmaTafUrl } from '../core.js';

if(process.env.APP_ENV==='production') throw new Error('LIVE_PROBE_REFUSED_IN_PRODUCTION');
const [kind,arg]=process.argv.slice(2);
if(!kind){
  console.error('Usage: npm run probe -- iiac-arr | kma-metar RKSI | kma-taf RKSI | kac-search');
  process.exit(2);
}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const outDir=path.join(root,'tests','fixtures','live-local');
await fs.mkdir(outDir,{recursive:true});

async function capture(sourceId,url){
  const response=await fetch(url,{headers:{accept:'application/json, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5'}});
  const body=await response.text();
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const file=path.join(outDir,`${sourceId.toLowerCase()}-${stamp}.json`);
  const payload={sourceId,capturedAt:new Date().toISOString(),httpStatus:response.status,contentType:response.headers.get('content-type'),body};
  await fs.writeFile(file,JSON.stringify(payload,null,2));
  console.log(`${sourceId}: HTTP ${response.status}; fixture=${path.relative(root,file)}`);
  if(!response.ok) process.exitCode=1;
}

if(kind==='iiac-arr'){
  const key=process.env.DATA_GO_KR_SERVICE_KEY;
  if(!key) throw new Error('DATA_GO_KR_SERVICE_KEY is required (use decoded key value)');
  const u=new URL('https://apis.data.go.kr/B551177/StatusOfPassengerFlightsOdp/getPassengerArrivalsOdp');
  u.searchParams.set('serviceKey',key);
  await capture('IIAC_PASSENGER_ARRIVAL',u);
}else if(kind==='kma-metar'){
  const key=process.env.KMA_API_HUB_KEY;if(!key)throw new Error('KMA_API_HUB_KEY is required');
  await capture('KMA_METAR_SPECI',buildKmaMetarUrl({icao:arg||'RKSI',authKey:key}));
}else if(kind==='kma-taf'){
  const key=process.env.KMA_API_HUB_KEY;if(!key)throw new Error('KMA_API_HUB_KEY is required');
  await capture('KMA_TAF',buildKmaTafUrl({icao:arg||'RKSI',authKey:key}));
}else if(kind==='kac-search'){
  throw new Error('KAC_LIVE_FIXTURE_REQUIRED: exact operation path is not exposed in the indexed official page; do not guess it. Capture Swagger/live operation after API approval.');
}else{
  throw new Error(`unknown probe: ${kind}`);
}
