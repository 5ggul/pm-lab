import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(here,'..','data','fuel-price.json');
const key=process.env.OPINET_CERTKEY;
if(!key){console.error('OPINET_CERTKEY is required. Existing last-good prices were not changed.');process.exit(2)}
const url=`https://www.opinet.co.kr/api/avgAllPrice.do?code=${encodeURIComponent(key)}&out=json`;
const codes={B027:'gasoline',D047:'diesel',K015:'lpg'};
try{
  const res=await fetch(url,{headers:{accept:'application/json'}});
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const json=await res.json();
  const rows=Array.isArray(json?.RESULT?.OIL)?json.RESULT.OIL:Array.isArray(json?.RESULT)?json.RESULT:[];
  const next={};
  for(const row of rows){const k=codes[row.PRODCD];if(k&&Number(row.PRICE)>0)next[k]=Number(row.PRICE)}
  for(const k of Object.values(codes)) if(!(k in next)) throw new Error(`Missing ${k} in Opinet response`);
  const prev=JSON.parse(fs.readFileSync(file,'utf8'));
  const now=new Date();
  const kst=new Date(now.getTime()+9*60*60*1000);
  const isoKst=kst.toISOString().replace('Z','+09:00');
  const out={...prev,price_as_of:isoKst.slice(0,10),last_successful_at:isoKst,stale:false,prices:next};
  fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');
  console.log(`Updated fuel prices: gasoline ${next.gasoline}, diesel ${next.diesel}, LPG ${next.lpg}`);
}catch(err){
  console.error(`Opinet update failed: ${err.message}. Existing last-good prices were not changed.`);
  process.exit(1);
}
