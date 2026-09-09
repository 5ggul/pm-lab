import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const config=JSON.parse(fs.readFileSync(path.join(root,'data/static-model-pages.json'),'utf8')).records.filter(r=>r.status==='kea_editorial');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/generated/catalog-list-index.json'),'utf8')).families;
assert.equal(config.length,15);
assert.equal(new Set(config.map(r=>r.path)).size,15);
assert.equal(new Set(config.map(r=>r.lead)).size,15);
assert.equal(new Set(config.map(r=>r.reading)).size,15);
for(const item of config){
 const html=fs.readFileSync(path.join(root,item.path,'index.html'),'utf8');
 assert.match(html,/noindex,nofollow,noarchive/);
 assert.match(html,new RegExp(`<h1>${item.model}`));
 assert.match(html,/class="dossier-photo"/);
 assert.match(html,/assets\/vehicle-images\//);
 assert.match(html,/한국에너지공단 자동차 표시연비·에너지효율/);
 assert.doesNotMatch(html,/준비 중|검수 상태|1년 유지비|갈립니다/);
 assert.ok((html.match(/<tr>/g)||[]).length>=2,`${item.family_id}: representative rows`);
 const schema=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(schema);JSON.parse(schema);
 assert.equal(catalog.find(f=>f.family_id===item.family_id)?.path,item.path);
}
const executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.goto(`${base}/${config[0].path}`);
  await page.locator('.dossier-photo img').evaluate(i=>i.decode());
  assert.equal(await page.locator('h1').count(),1);
  assert.ok((await page.locator('.dossier-photo').boundingBox()).height>=300);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('.dossier-table-wrap').scrollIntoViewIfNeeded();
  assert.ok(await page.locator('.dossier-table tbody tr').count()>=2);
  await page.close();
 }
 const catalogPage=await browser.newPage({viewport:{width:1280,height:900}});
 await catalogPage.goto(`${base}/cars/?q=${encodeURIComponent('아이오닉 6')}`);
 await catalogPage.waitForFunction(()=>document.querySelectorAll('.vehicle-card').length>0);
 const target=config.find(item=>item.model==='아이오닉 6');
 assert.equal(await catalogPage.locator('.vehicle-card').first().getAttribute('data-family-id'),target.family_id);
 const href=await catalogPage.locator(`.vehicle-card[data-family-id="${target.family_id}"] .vehicle-card-actions .primary`).getAttribute('href');
 assert.ok(href?.endsWith(target.path),`catalog direct link: ${href}`);
 await catalogPage.close();
}finally{await browser.close()}
console.log('PASS 15 priority static model pages, unique editorial copy, licensed photos, official rows, direct catalog paths and responsive layout.');
