import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});
const dir=new URL('../output/community-qa/',import.meta.url);fs.mkdirSync(dir,{recursive:true});
const results=[];
try{
 for(const width of [375,390,768,1280]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4190/community/');
  await page.locator('#serviceNotice').waitFor({state:'visible'});
  assert.equal(await page.locator('#vehicleFilter option').count(),441);
  await page.locator('#vehicleQuery').fill('쏘렌토');
  assert.equal(await page.locator('#vehicleFilter option').count(),2);
  await page.locator('#vehicleFilter').selectOption('kia-sorento');
  await page.getByRole('button',{name:'실사용 후기',exact:true}).click();
  assert.equal(new URL(page.url()).searchParams.get('vehicle'),'kia-sorento');
  assert.equal(new URL(page.url()).searchParams.get('kind'),'review');
  assert(await page.locator('#login').isDisabled());
  assert(await page.locator('#writePost').isDisabled());
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert(overflow<=0,`overflow at ${width}: ${overflow}`);assert.deepEqual(errors,[]);
  await page.screenshot({path:fileURLToPath(new URL(`community-${width}.png`,dir)),fullPage:true});
  results.push({width,overflow,errors,vehicleOptions:440,writeDisabledUntilConnected:true});await page.close();
 }
 fs.writeFileSync(new URL('preview.json',dir),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
