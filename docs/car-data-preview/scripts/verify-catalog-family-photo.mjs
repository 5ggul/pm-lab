import {chromium} from 'playwright';

const [query,familyId,expectedText]=process.argv.slice(2);
if(!query||!familyId||!expectedText)throw new Error('Usage: node verify-catalog-family-photo.mjs <query> <family-id> <expected-text>');
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{headless:true});
try{
  const page=await browser.newPage({viewport:{width:390,height:900}});
  await page.goto(base+'/cars/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.consumerCatalog==='ready',null,{timeout:12000});
  await page.locator('#catalogSearch').fill(query);
  await page.waitForTimeout(250);
  const matching=page.locator(`.vehicle-card[data-family-id="${familyId}"]`).filter({hasText:expectedText});
  if(await matching.count()!==1)throw new Error(`Expected one ${expectedText} card`);
  const image=matching.locator('img');
  await image.scrollIntoViewIfNeeded();
  await image.evaluate(img=>img.complete&&img.naturalWidth>=300?true:new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Photo load timeout')),30000);
    img.addEventListener('load',()=>{clearTimeout(timeout);resolve(true)},{once:true});
    img.addEventListener('error',()=>{clearTimeout(timeout);reject(new Error('Photo load failed'))},{once:true});
  }));
  const photo=await image.evaluate(img=>({src:img.currentSrc||img.src,complete:img.complete,naturalWidth:img.naturalWidth}));
  if(!photo.complete||photo.naturalWidth<300)throw new Error(`Invalid photo ${JSON.stringify(photo)}`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  if(overflow>1)throw new Error(`Mobile overflow ${overflow}px`);
  console.log(`PASS ${expectedText}: photo loaded at ${photo.naturalWidth}px; 390px overflow ${overflow}`);
}finally{
  await browser.close();
}
