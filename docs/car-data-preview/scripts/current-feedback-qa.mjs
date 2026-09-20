import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=(process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const rect=locator=>locator.evaluate(element=>element.getBoundingClientRect().toJSON());

try{
  const initialization=await browser.newPage({viewport:{width:390,height:844}});
  await initialization.route('**/all-car-calc-index.json',async route=>{await new Promise(resolve=>setTimeout(resolve,500));await route.continue()});
  await initialization.goto(`${base}/compare/`,{waitUntil:'domcontentloaded'});
  assert(await initialization.locator('#allMode').isDisabled(),'comparison mode must stay disabled while data loads');
  assert(await initialization.locator('#reviewedMode').isDisabled(),'reviewed mode must stay disabled while data loads');
  await initialization.waitForFunction(()=>!document.getElementById('allMode').disabled&&!document.getElementById('reviewedMode').disabled);
  await initialization.close();
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
    await compare.waitForFunction(()=>document.querySelectorAll('#carA option').length>0);
    for(const [selector,button] of [['#allSelectors','#allMode'],['#reviewedSelectors','#reviewedMode']]){
      await compare.locator(button).click();
      const pair=compare.locator(selector);
      await pair.waitFor({state:'visible'});
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

  const comparisonPairs=['sorento-vs-santafe','grandeur-gasoline-vs-hybrid','ioniq5-vs-ev6','sportage-vs-tucson','ev3-vs-ev6'];
  for(const width of [375,1280]){
    const page=await browser.newPage({viewport:{width,height:900}});
    for(const slug of comparisonPairs){
      await page.goto(`${base}/compare/${slug}/`,{waitUntil:'domcontentloaded'});
      const alignment=await page.evaluate(()=>{
        const left=selector=>document.querySelector(selector)?.getBoundingClientRect().left;
        const inputs=[...document.querySelectorAll('.decision-calculator form input')].map(input=>input.getBoundingClientRect().toJSON());
        return {
          metric:left('.metric-chart .metric-track'),
          distance:left('.distance-pair i'),
          inputs,
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
        };
      });
      assert(Number.isFinite(alignment.metric)&&Number.isFinite(alignment.distance),`${slug}: comparison bars missing at ${width}`);
      assert(Math.abs(alignment.metric-alignment.distance)<=1,`${slug}: comparison chart start lines differ at ${width}`);
      assert(alignment.overflow<=1,`${slug}: comparison overflows at ${width}`);
      assert.equal(alignment.inputs.length,2,`${slug}: comparison inputs missing at ${width}`);
      if(width===1280)assert(Math.abs(alignment.inputs[0].top-alignment.inputs[1].top)<=1,`${slug}: input top edges differ`);
      else assert(alignment.inputs[0].bottom<alignment.inputs[1].top,`${slug}: mobile inputs overlap`);
    }
    await page.close();
  }
  console.log('PASS current feedback: compare A/B grouping, shared graph start line and aligned inputs, mobile tax form, consolidated ranking credits, five-column Sorento specs.');
}finally{await browser.close()}
