import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildKmaMetarUrl, buildKmaTafUrl } from '../core.js';
import {
  buildIiacArrivalCongestionUrl,
  buildIiacPassengerAnnouncementUrl,
  buildKmaDepartureForecastUrl,
  buildKmaAirportWarningUrl,
  buildKmaSigmetUrl,
  buildKmaAirmetUrl
} from '../src/secondary-adapters.js';

if(process.env.APP_ENV==='production') throw new Error('LIVE_PROBE_REFUSED_IN_PRODUCTION');
const [kind,arg]=process.argv.slice(2);
if(!kind){
  console.error('Usage: npm run probe -- iiac-arr | iiac-arr-congestion T1 | iiac-passenger-announcement | kma-metar RKSI | kma-taf RKSI | kma-warning | kma-airinfo RKPC | kma-sigmet | kma-airmet | kac-search');
  process.exit(2);
}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const outDir=path.join(root,'tests','fixtures','live-local');
await fs.mkdir(outDir,{recursive:true});

function kstForecastHour(){
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hour12:false}).formatToParts(new Date());
  const x=Object.fromEntries(p.map(v=>[v.type,v.value]));
  return `${x.year}${x.month}${x.day}${x.hour}00`;
}
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
const dataKey=()=>{const k=process.env.DATA_GO_KR_SERVICE_KEY;if(!k)throw new Error('DATA_GO_KR_SERVICE_KEY is required (decoded key value)');return k};
const kmaKey=()=>{const k=process.env.KMA_API_HUB_KEY;if(!k)throw new Error('KMA_API_HUB_KEY is required');return k};

if(kind==='iiac-arr'){
  const u=new URL('https://apis.data.go.kr/B551177/StatusOfPassengerFlightsOdp/getPassengerArrivalsOdp');u.searchParams.set('serviceKey',dataKey());u.searchParams.set('type','json');await capture('IIAC_PASSENGER_ARRIVAL',u);
}else if(kind==='iiac-arr-congestion'){
  await capture('IIAC_ARRIVAL_CONGESTION',buildIiacArrivalCongestionUrl({serviceKey:dataKey(),terminal:arg||'T1'}));
}else if(kind==='iiac-passenger-announcement'){
  await capture('IIAC_PASSENGER_ANNOUNCEMENT',buildIiacPassengerAnnouncementUrl({serviceKey:dataKey()}));
}else if(kind==='kma-metar'){
  await capture('KMA_METAR_SPECI',buildKmaMetarUrl({icao:arg||'RKSI',authKey:kmaKey()}));
}else if(kind==='kma-taf'){
  await capture('KMA_TAF',buildKmaTafUrl({icao:arg||'RKSI',authKey:kmaKey()}));
}else if(kind==='kma-warning'){
  await capture('KMA_AIRPORT_WARNING',buildKmaAirportWarningUrl({authKey:kmaKey()}));
}else if(kind==='kma-airinfo'){
  await capture('KMA_DEPARTURE_FORECAST',buildKmaDepartureForecastUrl({icaoCode:arg||'RKPC',fctm:kstForecastHour(),authKey:kmaKey()}));
}else if(kind==='kma-sigmet'){
  await capture('KMA_SIGMET',buildKmaSigmetUrl({authKey:kmaKey()}));
}else if(kind==='kma-airmet'){
  await capture('KMA_AIRMET',buildKmaAirmetUrl({authKey:kmaKey()}));
}else if(kind==='kac-search'){
  throw new Error('KAC_LIVE_FIXTURE_REQUIRED: exact operation path is not exposed in the indexed official page; do not guess it. Capture Swagger/live operation after API approval.');
}else{
  throw new Error(`unknown probe: ${kind}`);
}
