import fs from 'node:fs';
import path from 'node:path';

const ASSET_DIR=path.resolve('interior-cost-core/v33-assets');
const OUT_ROOT=path.resolve('docs/interior-cost-preview');
const manifest=JSON.parse(fs.readFileSync(path.join(ASSET_DIR,'manifest.json'),'utf8'));
const sourceByName=Object.fromEntries(manifest.sources.map(x=>[x.name,x]));
const pageToName={
  'https://unsplash.com/photos/interior-renovation-with-construction-materials-and-supplies-hPfrYoKkxp0':'renovation',
  'https://unsplash.com/photos/modern-bathroom-with-glass-shower-and-toilet-VSD5og2FSW0':'bathroom',
  'https://unsplash.com/photos/modern-kitchen-with-island-and-stainless-steel-appliances-J77Yzq9_Hcg':'kitchen',
  'https://unsplash.com/photos/sunlight-shines-on-a-polished-wooden-floor-inside-PYIHZs8y6Rk':'floor',
  'https://unsplash.com/photos/interior-view-of-a-room-under-construction-with-wooden-framing-Ls6mShbvdpw':'framing',
  'https://unsplash.com/photos/interior-room-under-construction-with-exposed-brick-and-insulation-irnH6JieSgI':'insulation',
  'https://unsplash.com/photos/interior-framing-and-wiring-during-construction-renovation-el9nujeXlvw':'electrical',
  'https://unsplash.com/photos/an-empty-room-with-a-door-and-a-window-p9uDc9WQUTA':'window'
};
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
  const raw=typeof input==='string'?input:input instanceof URL?input.toString():input?.url||String(input);
  const clean=raw.split('?')[0];
  if(pageToName[clean]){
    const name=pageToName[clean];
    return new Response(`<html><head><meta property="og:image" content="https://images.unsplash.com/local-${name}"></head></html>`,{status:200,headers:{'content-type':'text/html'}});
  }
  try{
    const u=new URL(raw);
    if(u.hostname==='images.unsplash.com'&&u.pathname.startsWith('/local-')){
      const name=u.pathname.slice('/local-'.length);
      const file=path.join(ASSET_DIR,`${name}.jpg`);
      if(!fs.existsSync(file))return new Response('missing',{status:404});
      return new Response(fs.readFileSync(file),{status:200,headers:{'content-type':'image/jpeg'}});
    }
  }catch{}
  return nativeFetch(input,init);
};
await import('./enhance-v33-stratton-visual.mjs');
globalThis.fetch=nativeFetch;
const cleanSources=manifest.sources.map(({name,page_url,image_url,bytes,content_type,license})=>({name,page_url,image_url,bytes,content_type,license}));
fs.writeFileSync(path.join(OUT_ROOT,'data/v33-photo-sources.json'),JSON.stringify({version:'33.0.0',sources:cleanSources},null,2));
const statusPath=path.join(OUT_ROOT,'data/v33-stratton-visual.json');
const status=JSON.parse(fs.readFileSync(statusPath,'utf8'));
status.photos=cleanSources.map(x=>({name:x.name,page_url:x.page_url,license:x.license}));
status.asset_mode='committed-local';
fs.writeFileSync(statusPath,JSON.stringify(status,null,2));
console.log(JSON.stringify({version:'33.0.0',asset_mode:'committed-local',photos:cleanSources.length},null,2));