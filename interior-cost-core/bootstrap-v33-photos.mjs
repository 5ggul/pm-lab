import fs from 'node:fs';
import path from 'node:path';

const OUT=path.resolve('interior-cost-core/v33-assets');
fs.mkdirSync(OUT,{recursive:true});
const photos={
  renovation:{image:'https://images.unsplash.com/photo-1768321902156-9358b5373d0a',page:'https://unsplash.com/photos/interior-renovation-with-construction-materials-and-supplies-hPfrYoKkxp0'},
  bathroom:{image:'https://images.unsplash.com/photo-1772476361253-90a9be5e0c19',page:'https://unsplash.com/photos/modern-bathroom-with-glass-shower-and-toilet-VSD5og2FSW0'},
  kitchen:{image:'https://images.unsplash.com/photo-1758240689297-d8613ca753f3',page:'https://unsplash.com/photos/modern-kitchen-with-island-and-stainless-steel-appliances-YFzqRFFyauw'},
  floor:{image:'https://images.unsplash.com/photo-1776433055252-2c961e596e4c',page:'https://unsplash.com/photos/sunlight-shines-on-a-polished-wooden-floor-inside-PYIHZs8y6Rk'},
  framing:{image:'https://images.unsplash.com/photo-1768321903220-76b379d7bf22',page:'https://unsplash.com/photos/interior-view-of-a-room-under-construction-with-wooden-framing-Ls6mShbvdpw'},
  insulation:{image:'https://images.unsplash.com/photo-1768321902869-85d1f596c9cf',page:'https://unsplash.com/photos/interior-room-under-construction-with-exposed-brick-and-insulation-irnH6JieSgI'},
  electrical:{image:'https://images.unsplash.com/photo-1768321916292-ade0ca9c091d',page:'https://unsplash.com/photos/interior-framing-and-wiring-during-construction-renovation-el9nujeXlvw'},
  window:{image:'https://images.unsplash.com/photo-1722764373642-264f63b61a35',page:'https://unsplash.com/photos/an-empty-room-with-a-large-window-in-it-9vdXv6EN5IU'}
};
const manifest=[];
for(const [name,p] of Object.entries(photos)){
  const url=`${p.image}?fm=jpg&fit=crop&w=1600&q=82`;
  const res=await fetch(url,{headers:{'user-agent':'Mozilla/5.0','accept':'image/jpeg,image/*;q=0.9,*/*;q=0.8'}});
  if(!res.ok) throw new Error(`${name}: CDN ${res.status} ${url}`);
  const type=res.headers.get('content-type')||'';
  if(!type.startsWith('image/')) throw new Error(`${name}: unexpected content type ${type}`);
  const body=Buffer.from(await res.arrayBuffer());
  if(body.length<30000) throw new Error(`${name}: image too small ${body.length}`);
  fs.writeFileSync(path.join(OUT,`${name}.jpg`),body);
  manifest.push({name,page_url:p.page,image_url:url,bytes:body.length,content_type:type,license:'Unsplash License'});
}
fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify({version:'33.0.0',downloaded_at:new Date().toISOString(),sources:manifest},null,2));
console.log(JSON.stringify({assets:manifest.map(x=>({name:x.name,bytes:x.bytes,type:x.content_type}))},null,2));