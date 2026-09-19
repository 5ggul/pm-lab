import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=(process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const rect=locator=>locator.evaluate(element=>element.getBoundingClientRect().toJSON());

try{
  for(const width of [375,390,1280]){
    const tax=await browser.newPage({viewport:{width,height:900}}),errors=[];
    tax.on('pageerror',error=>errors.push(error.message));
    await tax.goto(`${base}/tools/car-tax/`,{waitUntil:'domcontentloaded'});
    const labels=tax.locator('.utility-fields>label');
    assert.equal(await labels.count(),3,'car-tax must expose three labeled fields');
    const boxes=[];
    for(const label of await labels.all())boxes.push(await rect(label));
    if(width<=390){
      assert(boxes[0].y<boxes[1].y&&boxes[1].y<boxes[2].y,`car-tax fields overlap at ${width}`);
      for(const box of boxes)assert(box.width>=width-40,`car-tax field too narrow at ${width}`);
      const button=await rect(tax.locator('.utility-button'));
      assert(button.width>=width-40&&button.height>=44,`car-tax button is not mobile friendly at ${width}`);
    }
    assert(await tax.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1,`car-tax horizontal overflow at ${width}`);
    assert.deepEqual(errors,[],`car-tax console errors at ${width}`);
    await tax.close();

    const compare=await browser.newPage({viewport:{width,height:900}});
    await compare.goto(`${base}/compare/`,{waitUntil:'domcontentloaded'});
    for(const [selector,button] of [['#allSelectors','#allMode'],['#reviewedSelectors','#reviewedMode']]){
      await compare.locator(button).click();
      const pair=compare.locator(selector);
      const fields=pair.locator('.compare-vehicle-fields');
      assert.equal(await fields.count(),2,`${selector}: A/B grouping missing`);
      const a=await rect(fields.nth(0)),b=await rect(fields.nth(1));
      assert(a.y<b.y,`${selector}: vehicle B must follow the complete vehicle A group`);
    }
    assert(await compare.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1,`compare horizontal overflow at ${width}`);
    await compare.close();
  }

  const ranking=await browser.newPage({viewport:{width:390,height:844}});
  for(const slug of ['fuel-economy','hybrid-fuel-economy','ev-efficiency','annual-energy-cost','car-tax','suv-fuel-economy','sedan-fuel-economy','electric-suv-efficiency']){
    await ranking.goto(`${base}/rankings/${slug}/`,{waitUntil:'domcontentloaded'});
    assert(await ranking.locator('.rank-photo img,.rank-photo-empty').count()>0,`${slug}: ranking photos missing`);
    assert.equal(await ranking.locator('.rank-photo details,.rank-photo summary').count(),0,`${slug}: photo source repeats inside rows`);
    assert.equal(await ranking.locator('a[href="../../media-policy/#vehicle-photo-credits"]').count(),1,`${slug}: consolidated photo source missing`);
  }
  await ranking.close();

  const detail=await browser.newPage({viewport:{width:1280,height:900}});
  await detail.goto(`${base}/cars/kia/sorento-mq4/`,{waitUntil:'domcontentloaded'});
  const columns=await detail.locator('.variant-row.head').first().locator(':scope>*').evaluateAll(nodes=>nodes.map(node=>Math.round(node.getBoundingClientRect().x)));
  assert.equal(columns.length,5,'Sorento specification header must have five columns');
  assert.equal(new Set(columns).size,5,'Sorento specification columns overlap');
  await detail.close();
  console.log('PASS current feedback: compare A/B grouping and graph-safe layout, mobile tax form, consolidated ranking credits, five-column Sorento specs.');
}finally{await browser.close()}
