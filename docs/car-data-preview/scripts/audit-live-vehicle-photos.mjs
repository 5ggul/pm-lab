import {chromium} from 'playwright';
const base=process.env.CAR_PREVIEW_BASE||'http://127.0.0.1:4173/car-data-preview';
const families=(await fetch(base+'/data/generated/family-detail-index.json').then(r=>r.json())).families;
const records=(await fetch(base+'/data/vehicle-image-sources.json').then(r=>r.json())).records;
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.goto(base+'/cars/');
  await page.waitForFunction(()=>document.documentElement.dataset.consumerCatalog==='ready');
  const firstPage=await page.locator('.vehicle-card').evaluateAll(cards=>({cards:cards.length,with_photo:cards.filter(c=>c.querySelector('img')).length}));
  const results=await page.evaluate(async records=>{
    const results=[];
    for(let start=0;start<records.length;start+=6){
      results.push(...await Promise.all(records.slice(start,start+6).map(r=>new Promise(resolve=>{
        const img=new Image();
        const timer=setTimeout(()=>resolve({family_id:r.family_id,status:'timeout'}),15000);
        img.onload=()=>{clearTimeout(timer);resolve({family_id:r.family_id,status:'loaded',width:img.naturalWidth});};
        img.onerror=()=>{clearTimeout(timer);resolve({family_id:r.family_id,status:'failed'});};
        img.src=r.image_url;
      }))));
    }
    return results;
  },records);
  console.log(JSON.stringify({checked_at:new Date().toISOString(),base,advisory:true,families:families.length,with_reviewed_photo:records.length,without_photo:families.length-records.length,first_page:firstPage,loaded:results.filter(r=>r.status==='loaded').length,failures:results.filter(r=>r.status!=='loaded'),results},null,2));
}finally{await browser.close();}
