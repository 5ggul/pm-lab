import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const folders=fs.readdirSync(path.join(root,'compare'),{withFileTypes:true})
  .filter(entry=>entry.isDirectory()&&fs.existsSync(path.join(root,'compare',entry.name,'index.html')));
const amount=value=>Number(value.replace(/[^\d-]/g,''));
let checked=0;
for(const folder of folders){
  const html=fs.readFileSync(path.join(root,'compare',folder.name,'index.html'),'utf8');
  const a=html.match(/id="decision-a">([\d,]+)원/),b=html.match(/id="decision-b">([\d,]+)원/),difference=html.match(/id="decision-saving">[^<]*?([\d,]+)원/);
  if(!a||!b||!difference)continue;
  assert.equal(amount(difference[1]),Math.abs(amount(a[1])-amount(b[1])),folder.name+' static totals and difference');
  checked++;
}
assert(checked>=20,'expected static comparison pages');

const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});
try{
  const page=await browser.newPage({viewport:{width:375,height:812}});
  await page.goto(base+'/cars/hyundai/grandeur-gn7/');
  await page.locator('[data-variant="gas35"]').click();
  await page.locator('#wheelSelect').selectOption('19');
  await page.locator('#annualKm').selectOption('30000');
  const link=page.locator('a[href*="tools/annual-cost/"]').first();
  const url=new URL(await link.getAttribute('href'),page.url());
  assert.equal(url.searchParams.get('variant'),'gn7-g35-2wd-19');
  assert.equal(url.searchParams.get('km'),'30000');
  await link.click();
  await page.waitForFunction(()=>document.querySelector('#variant')?.value==='gn7-g35-2wd-19');
  assert.equal(await page.locator('#km').inputValue(),'30000');
  await page.goto(base+'/compare/grandeur-vs-k8/');
  await page.locator('#decision-km').fill('30000');
  for(const [a,b,d] of [['#decision-a','#decision-b','#decision-saving']]){
    assert.equal(amount(await page.locator(d).innerText()),Math.abs(amount(await page.locator(a).innerText())-amount(await page.locator(b).innerText())));
  }
  await page.goto(base+'/cars/');
  assert(await page.locator('.catalog-chip-row').first().evaluate(el=>el.scrollWidth<=el.clientWidth+1),'mobile fuel chips must wrap');
  await page.goto(base+'/cars/hyundai/grandeur-gn7/');
  assert.equal(await page.locator('.reference-section-nav:visible').count(),0,'Grandeur has one section navigation');
  console.log(`Displayed cost consistency PASS: ${checked} comparisons, Grandeur handoff and 375px UI`);
}finally{await browser.close()}
