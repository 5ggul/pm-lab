import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const OUT=path.resolve('interior-cost-core/v33-assets');
fs.mkdirSync(OUT,{recursive:true});
const pages={
  renovation:'https://unsplash.com/photos/interior-renovation-with-construction-materials-and-supplies-hPfrYoKkxp0',
  bathroom:'https://unsplash.com/photos/modern-bathroom-with-glass-shower-and-toilet-VSD5og2FSW0',
  kitchen:'https://unsplash.com/photos/modern-kitchen-with-island-and-stainless-steel-appliances-J77Yzq9_Hcg',
  floor:'https://unsplash.com/photos/sunlight-shines-on-a-polished-wooden-floor-inside-PYIHZs8y6Rk',
  framing:'https://unsplash.com/photos/interior-view-of-a-room-under-construction-with-wooden-framing-Ls6mShbvdpw',
  insulation:'https://unsplash.com/photos/interior-room-under-construction-with-exposed-brick-and-insulation-irnH6JieSgI',
  electrical:'https://unsplash.com/photos/interior-framing-and-wiring-during-construction-renovation-el9nujeXlvw',
  window:'https://unsplash.com/photos/an-empty-room-with-a-door-and-a-window-p9uDc9WQUTA'
};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900},userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36'});
const manifest=[];
for(const [name,pageUrl] of Object.entries(pages)){
  const page=await context.newPage();
  const response=await page.goto(pageUrl,{waitUntil:'domcontentloaded',timeout:60000});
  const status=response?.status()??0;
  if(status>=400) throw new Error(`${name}: page status ${status}`);
  const imageUrl=await page.locator('meta[property="og:image"]').getAttribute('content');
  if(!imageUrl) throw new Error(`${name}: og:image missing`);
  const u=new URL(imageUrl);
  if(u.hostname!=='images.unsplash.com') throw new Error(`${name}: unexpected image host ${u.hostname}`);
  u.searchParams.set('fm','jpg');
  u.searchParams.set('fit','crop');
  u.searchParams.set('w','1600');
  u.searchParams.set('q','82');
  u.searchParams.delete('auto');
  const img=await context.request.get(u.toString(),{timeout:60000});
  if(!img.ok()) throw new Error(`${name}: image ${img.status()}`);
  const body=await img.body();
  if(body.length<30000) throw new Error(`${name}: image too small ${body.length}`);
  fs.writeFileSync(path.join(OUT,`${name}.jpg`),body);
  manifest.push({name,page_url:pageUrl,image_url:u.toString(),bytes:body.length,license:'Unsplash License'});
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify({version:'33.0.0',downloaded_at:new Date().toISOString(),sources:manifest},null,2));
console.log(JSON.stringify({assets:manifest.map(x=>({name:x.name,bytes:x.bytes}))},null,2));