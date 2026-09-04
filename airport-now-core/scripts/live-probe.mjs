import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildKmaMetarUrl, buildKmaTafUrl } from '../core.js';
import { buildKacFlightSearchUrl } from '../src/kac-live.js';
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
  console.error('Usage: npm run probe -- iiac-arr | iiac-arr-congestion T1 | iiac-passenger-announcement | kma-metar RKSI | kma-taf RKSI | kma-warning | kma-airinfo RKPC | kma-sigmet | kma-airmet | kac-search KE1814');
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
function normalizePublicDataServiceKey(value){
  const raw=(value||'').trim();
  if(!raw) throw new Error('DATA_GO_KR_SERVICE_KEY is required');
  if(!/%[0-9A-Fa-f]{2}/.test(raw)) return raw;
  try{return decodeURIComponent(raw)}catch{return raw}
}
async function writeFixture(sourceId,{httpStatus=null,contentType=null,body='',transport='fetch',transportError=null}){
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const file=path.join(outDir,`${sourceId.toLowerCase()}-${stamp}.json`);
  const payload={sourceId,capturedAt:new Date().toISOString(),transport,httpStatus,contentType,body,transportError};
  await fs.writeFile(file,JSON.stringify(payload,null,2));
  return path.relative(root,file);
}
async function capture(sourceId,url){
  try{
    const response=await fetch(url,{headers:{accept:'application/json, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5'}});
    const body=await response.text();
    const fixture=await writeFixture(sourceId,{httpStatus:response.status,contentType:response.headers.get('content-type'),body,transport:'fetch'});
    console.log(`${sourceId}: HTTP ${response.status}; transport=fetch; fixture=${fixture}`);
    if(!response.ok) process.exitCode=1;
  }catch(error){
    const fixture=await writeFixture(sourceId,{transport:'fetch',transportError:{name:error?.name||'Error',message:error?.message||String(error),causeCode:error?.cause?.code||null}});
    console.error(`${sourceId}: fetch transport failed (${error?.cause?.code||error?.name||'ERROR'}); fixture=${fixture}`);
    process.exitCode=1;
  }
}
async function captureCurl4(sourceId,url){
  const marker='\n__AIRPORT_NOW_CURL_META__';
  const result=spawnSync('curl',[
    '-4','--silent','--show-error','--location',
    '--connect-timeout','20','--max-time','60',
    '--retry','2','--retry-delay','2','--retry-connrefused',
    '--header','accept: application/json, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
    '--write-out',`${marker}%{http_code}|%{content_type}`,
    String(url)
  ],{encoding:'utf8',maxBuffer:20*1024*1024});
  const stdout=result.stdout||'';
  const index=stdout.lastIndexOf(marker);
  if(result.status!==0||index<0){
    const message=(result.stderr||'curl failed').trim().replace(/https?:\/\/\S+/g,'[redacted-url]').slice(0,1000);
    const fixture=await writeFixture(sourceId,{transport:'curl4',transportError:{exitCode:result.status,message}});
    console.error(`${sourceId}: curl4 transport failed (exit=${result.status}); fixture=${fixture}`);
    process.exitCode=1;
    return;
  }
  const body=stdout.slice(0,index);
  const [statusText,contentType='']=stdout.slice(index+marker.length).trim().split('|');
  const httpStatus=Number(statusText)||null;
  const fixture=await writeFixture(sourceId,{httpStatus,contentType:contentType||null,body,transport:'curl4'});
  console.log(`${sourceId}: HTTP ${httpStatus}; transport=curl4; fixture=${fixture}`);
  if(httpStatus==null||httpStatus<200||httpStatus>=300) process.exitCode=1;
}
const dataKey=()=>normalizePublicDataServiceKey(process.env.DATA_GO_KR_SERVICE_KEY);
const kmaKey=()=>{const k=(process.env.KMA_API_HUB_KEY||'').trim();if(!k)throw new Error('KMA_API_HUB_KEY is required');return k};

if(kind==='iiac-arr'){
  const u=new URL('https://apis.data.go.kr/B551177/StatusOfPassengerFlightsOdp/getPassengerArrivalsOdp');
  u.searchParams.set('serviceKey',dataKey());
  u.searchParams.set('type','json');
  u.searchParams.set('numOfRows','20');
  await captureCurl4('IIAC_PASSENGER_ARRIVAL',u);
}else if(kind==='iiac-arr-congestion'){
  await captureCurl4('IIAC_ARRIVAL_CONGESTION',buildIiacArrivalCongestionUrl({serviceKey:dataKey(),terminal:arg||'T1'}));
}else if(kind==='iiac-passenger-announcement'){
  await captureCurl4('IIAC_PASSENGER_ANNOUNCEMENT',buildIiacPassengerAnnouncementUrl({serviceKey:dataKey()}));
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
  await captureCurl4('KAC_FLIGHT_SEARCH_GW',buildKacFlightSearchUrl({serviceKey:dataKey(),flightNumber:arg||'KE1814',type:'json'}));
}else{
  throw new Error(`unknown probe: ${kind}`);
}
