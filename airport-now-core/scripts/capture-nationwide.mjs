import fs from 'node:fs/promises';
import {setDefaultResultOrder} from 'node:dns';
import {setDefaultAutoSelectFamily} from 'node:net';
import { buildKmaMetarUrl } from '../core.js';
import {providerFetch} from './provider-fetch.mjs';
setDefaultResultOrder('ipv4first');
setDefaultAutoSelectFamily(false);

if (process.env.APP_ENV === 'production') throw new Error('PRODUCTION_REFUSED');
const dir = new URL('../tests/fixtures/live-local/', import.meta.url);
await fs.mkdir(dir, { recursive: true });
const date = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul'}).format(new Date()).replaceAll('-', '');
const keys = [...new Set([process.env.DATAKEY, process.env.DATA_GO_KR_SERVICE_KEY].filter(Boolean))];
const decode = key => /%[0-9a-f]{2}/i.test(key) ? decodeURIComponent(key.trim()) : key.trim();
const specs = [
  ['kac-arrival','https://apis.data.go.kr/B551178/flight-status/arrival'],
  ['kac-departure','https://apis.data.go.kr/B551178/flight-status/depart'],
  ['iiac-departure','https://apis.data.go.kr/B551177/StatusOfPassengerFlightsDeOdp/getPassengerDeparturesDeOdp'],
  ['iiac-arrival-detail','https://apis.data.go.kr/B551177/StatusOfPassengerFlightsDeOdp/getPassengerArrivalsDeOdp'],
  ['iiac-arrival','https://apis.data.go.kr/B551177/StatusOfPassengerFlightsOdp/getPassengerArrivalsOdp']
];
async function capture(name, url) {
  try {
    const r = await providerFetch(url);
    let body = await r.text();
    for (const key of [...keys,process.env.KMAKEY].filter(Boolean)) {
      for (const v of [key,decode(key),encodeURIComponent(decode(key))]) body=body.replaceAll(v,'[REDACTED]');
    }
    const payload={capturedAt:new Date().toISOString(),httpStatus:r.status,body};
    await fs.writeFile(new URL(name+'.json',dir),JSON.stringify(payload,null,2));
    let parsed; try { parsed=JSON.parse(body); } catch {}
    const root=parsed?.response||parsed;
    console.log(JSON.stringify({name,status:r.status,code:root?.header?.resultCode||parsed?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode,total:root?.body?.totalCount,bytes:body.length}));
    return root;
  } catch(error) { console.log(JSON.stringify({name,error:'FETCH_FAILED',cause:error.cause?.code||error.code||null})); }
}
for(const [name, endpoint] of specs) {
  for(let i=0;i<Math.min(keys.length,1);i++) {
    const u=new URL(endpoint);
    for(const [k,v] of Object.entries({serviceKey:decode(keys[i]),type:'json',pageNo:1,numOfRows:1000,searchday:date,from_time:'0000',to_time:'2400'})) u.searchParams.set(k,v);
    if(name.startsWith('kac')) {
      const variants=[{}, {airport_code:'GMP'}, {airport_code:'CJU',numOfRows:10}, {airport_code:'GMP',searchday:date}, {airport_code:'GMP',from_time:'0000',to_time:'2359',searchday:date}, {airport_code:'GMP',type:'xml'}];
      for(let j=0;j<variants.length;j++) {
        const v=new URL(endpoint);
        for(const [k,x] of Object.entries({serviceKey:decode(keys[i]),type:'json',pageNo:1,numOfRows:10,...variants[j]}))v.searchParams.set(k,x);
        const r=await capture(name+'-variant'+j,v);
        if(r?.header?.resultCode==='00')break;
      }
    } else {
      const first=await capture(name+'-key'+i,u);
      const total=Number(first?.body?.totalCount||0);
      for(let page=2;page<=Math.ceil(total/1000)&&page<=10;page++) {
        u.searchParams.set('pageNo',page);
        await capture(name+'-page'+page,u);
      }
    }
  }
}
if(process.env.KMAKEY) await capture('kma-rkpc',buildKmaMetarUrl({icao:'RKPC',authKey:process.env.KMAKEY}));
if(keys[0])for(const operation of ['info','detail','taxfree']) {
  const u=new URL('https://apis.data.go.kr/B551178/flight-status/'+operation);
  for(const [k,v] of Object.entries({serviceKey:decode(keys[0]),type:'json',numOfRows:10,pageNo:1,...(operation==='info'?{schAirCode:'GMP',schIOType:'O'}:{})}))u.searchParams.set(k,v);
  await capture('kac-'+operation,u);
}
