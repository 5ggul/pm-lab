import fs from 'node:fs';
import path from 'node:path';
import { request } from 'playwright';

const OUT=path.resolve('interior-cost-core/v33-assets');
fs.mkdirSync(OUT,{recursive:true});
const photos={
  renovation:{id:'hPfrYoKkxp0',page:'https://unsplash.com/photos/interior-renovation-with-construction-materials-and-supplies-hPfrYoKkxp0'},
  bathroom:{id:'VSD5og2FSW0',page:'https://unsplash.com/photos/modern-bathroom-with-glass-shower-and-toilet-VSD5og2FSW0'},
  kitchen:{id:'J77Yzq9_Hcg',page:'https://unsplash.com/photos/modern-kitchen-with-island-and-stainless-steel-appliances-J77Yzq9_Hcg'},
  floor:{id:'PYIHZs8y6Rk',page:'https://unsplash.com/photos/sunlight-shines-on-a-polished-wooden-floor-inside-PYIHZs8y6Rk'},
  framing:{id:'Ls6mShbvdpw',page:'https://unsplash.com/photos/interior-view-of-a-room-under-construction-with-wooden-framing-Ls6mShbvdpw'},
  insulation:{id:'irnH6JieSgI',page:'https://unsplash.com/photos/interior-room-under-construction-with-exposed-brick-and-insulation-irnH6JieSgI'},
  electrical:{id:'el9nujeXlvw',page:'https://unsplash.com/photos/interior-framing-and-wiring-during-construction-renovation-el9nujeXlvw'},
  window:{id:'p9uDc9WQUTA',page:'https://unsplash.com/photos/an-empty-room-with-a-door-and-a-window-p9uDc9WQUTA'}
};
const client=await request.newContext({
  userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36',
  extraHTTPHeaders:{Accept:'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'}
});
const manifest=[];
for(const [name,p] of Object.entries(photos)){
  const download=`https://unsplash.com/photos/${p.id}/download?force=true&w=1600`;
  const res=await client.get(download,{timeout:60000,headers:{Referer:p.page}});
  if(!res.ok()) throw new Error(`${name}: download ${res.status()} ${res.url()}`);
  const type=res.headers()['content-type']||'';
  if(!type.startsWith('image/')) throw new Error(`${name}: unexpected content type ${type}`);
  const body=await res.body();
  if(body.length<30000) throw new Error(`${name}: image too small ${body.length}`);
  fs.writeFileSync(path.join(OUT,`${name}.jpg`),body);
  manifest.push({name,id:p.id,page_url:p.page,download_url:download,resolved_url:res.url(),bytes:body.length,content_type:type,license:'Unsplash License'});
}
await client.dispose();
fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify({version:'33.0.0',downloaded_at:new Date().toISOString(),sources:manifest},null,2));
console.log(JSON.stringify({assets:manifest.map(x=>({name:x.name,bytes:x.bytes,type:x.content_type}))},null,2));