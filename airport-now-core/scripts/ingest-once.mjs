import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setDefaultResultOrder} from 'node:dns';
import {setDefaultAutoSelectFamily} from 'node:net';
import {getPlatformProxy} from 'wrangler';
import {ingestOnce} from '../src/ingest/once.js';
import {verifyReadPath} from './verify-read-path.mjs';
import {providerFetch} from './provider-fetch.mjs';

setDefaultResultOrder('ipv4first');setDefaultAutoSelectFamily(false);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const file of ['.env','.dev.vars']){try{process.loadEnvFile(path.join(root,file));}catch(error){if(error.code!=='ENOENT')throw error;}}
if(process.env.APP_ENV==='production')throw new Error('PRODUCTION_REFUSED');
const replayIndex=process.argv.indexOf('--replay');
const replay=replayIndex<0?null:path.resolve(process.argv[replayIndex+1]);
const out=replay||path.join(root,'tests/fixtures/live-local',new Date().toISOString().replace(/[:.]/g,'-'));
await fs.mkdir(out,{recursive:true});
const fileName=({provider,direction,icao,pageNo})=>[provider,direction||icao,pageNo||1].join('-')+'.json';
const keys=[process.env.DATA_GO_KR_SERVICE_KEY,process.env.DATAKEY,process.env.KMAKEY,process.env.KMA_API_HUB_KEY].filter(Boolean);
function redact(body){for(const key of keys){let decoded=key;try{decoded=decodeURIComponent(key);}catch{}for(const v of [key,decoded,encodeURIComponent(decoded)])body=body.replaceAll(v,'[REDACTED]');}return body;}
const captures=[];
const capture=async item=>{
  captures.push({provider:item.provider,direction:item.direction,icao:item.icao,pageNo:item.pageNo,httpStatus:item.httpStatus});
  if(!replay)await fs.writeFile(path.join(out,fileName(item)),JSON.stringify({...item,body:redact(item.body)},null,2));
};
const replayFetch=async url=>{
  const u=new URL(url),provider=u.hostname.includes('kma.go.kr')?'KMA':u.pathname.includes('B551178')?'KAC':'IIAC';
  const direction=provider==='KMA'?undefined:/[Aa]rrival/.test(u.pathname)?'ARRIVAL':'DEPARTURE';
  const item=JSON.parse(await fs.readFile(path.join(out,fileName({provider,direction,icao:u.searchParams.get('icao'),pageNo:u.searchParams.get('pageNo')||1})),'utf8'));
  return new Response(item.body,{status:item.httpStatus});
};
const proxy=await getPlatformProxy({configPath:path.join(root,'wrangler.local.jsonc'),persist:{path:path.join(out,'d1')}});
try {
  const schema=await fs.readFile(path.join(root,'src/storage/schema.sql'),'utf8');
  await proxy.env.DB.exec(schema);
  const env={...process.env,APP_ENV:'development',DB:proxy.env.DB};
  if(replay){env.DATA_GO_KR_SERVICE_KEY='REPLAY';env.KMA_API_HUB_KEY='REPLAY';}
  const options={capture,fetchImpl:replay?replayFetch:providerFetch};
  const result=await ingestOnce(env,options);
  const reads=await verifyReadPath(env.DB,result.serviceDate);
  const summary={mode:replay?'replay':'live',result,reads,captures};
  await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
  console.log('Verification directory: '+out);
  if(!['iiacArrival','iiacDeparture','kacArrival','kacDeparture','metar'].every(k=>result[k].ok))process.exitCode=1;
}finally{await proxy.dispose();}
