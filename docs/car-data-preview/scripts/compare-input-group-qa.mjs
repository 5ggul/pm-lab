import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';

const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const browser=await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{});
fs.mkdirSync('output/review/compare-inputs',{recursive:true});
try{
  for(const width of [375,390,1280]){
    const page=await browser.newPage({viewport:{width,height:900}});
    await page.goto(base+'/compare/',{waitUntil:'networkidle'});
    for(const [mode,button,selector,expected] of [
      ['all','#allMode','#allSelectors',[['familyA','genA','rowA'],['familyB','genB','rowB']]],
      ['reviewed','#reviewedMode','#reviewedSelectors',[['carA','varA'],['carB','varB']]],
    ]){
      await page.locator(button).click();
      const groups=page.locator(selector+' .compare-vehicle-fields');
      assert.equal(await groups.count(),2,`${mode} vehicle groups`);
      for(let i=0;i<2;i++){
        const ids=await groups.nth(i).locator('input,select').evaluateAll(nodes=>nodes.map(node=>node.id));
        assert.deepEqual(ids,expected[i],`${mode} group ${i} field order`);
      }
      const boxes=await groups.evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect();return {x:box.x,y:box.y,right:box.right,bottom:box.bottom}}));
      assert.ok(boxes[1].y>=boxes[0].bottom-1,`${width}px ${mode} groups must stack in A/B order`);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}px ${mode} horizontal overflow`);
      if(mode==='all')await page.locator(selector).screenshot({path:`output/review/compare-inputs/${width}.png`});
    }
    await page.close();
  }
  console.log('PASS comparison A/B groups, field order, responsive stacking and overflow');
}finally{await browser.close()}
