import fs from 'node:fs/promises';
import { buildKmaMetarUrl } from '../core.js';

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
    const r = await fetch(url, {signal:AbortSignal.timeout(25000)});
    let body = await r.text();
    for (const key of [...keys,process.env.KMAKEY].filter(Boolean)) {
      for (const v of [key,decode(key),encodeURIComponent(decode(key))]) body=body.replaceAll(v,'[REDACTED]');
    }
    const payload={capturedAt:new Date().toISOString(),httpStatus:r.status,body};
    await fs.writeFile(new URL(name+'.json',dir),JSON.stringify(payload,null,2));
    let parsed; try { parsed=JSON.parse(body); } catch {}
    const root=parsed?.response||parsed;
    console.log(JSON.stringify({name,status:r.status,code:root?.header?.resultCode,total:root?.body?.totalCount,bytes:body.length}));
  } catch { console.log(JSON.stringify({name,error:'FETCH_FAILED'})); }
}
for(const [name, endpoint] of specs) {
  for(let i=0;i<keys.length;i++) {
    const u=new URL(endpoint);
    for(const [k,v] of Object.entries({serviceKey:decode(keys[i]),type:'json',pageNo:1,numOfRows:1000,searchday:date,from_time:'0000',to_time:'2400'})) u.searchParams.set(k,v);
    await capture(name+'-key'+i,u);
  }
}
if(process.env.KMAKEY) await capture('kma-rkpc',buildKmaMetarUrl({icao:'RKPC',authKey:process.env.KMAKEY}));
