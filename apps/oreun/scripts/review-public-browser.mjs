import assert from "node:assert/strict";
export async function checkReviewPublic({browser,base}) {
 const page=await browser.newPage({viewport:{width:375,height:900}});
 try {
  for(const [query,forbidden] of [["99 나이트","pls-donate"],["dress","doors"]]){await page.goto(base+"/search?q="+encodeURIComponent(query),{waitUntil:"networkidle"});assert.equal(await page.locator(`main a[href="/game/${forbidden}"]`).count(),0);}
  await page.goto(base+"/search?q="+encodeURIComponent("어돕미"),{waitUntil:"networkidle"});assert.ok(page.url().includes("/game/adopt-me")||await page.locator('main a[href="/game/adopt-me"]').count()>0);
  await page.goto(base+"/games",{waitUntil:"networkidle"});assert.equal(await page.locator('.explorer-card-wrap .visual-badge').count(),0,"popular sort must not show score badge");
  await page.goto(base+"/games?intent=party",{waitUntil:"networkidle"});for(const href of await page.locator('.visual-game-card').evaluateAll(els=>els.map(e=>e.getAttribute('href')))){if(href==='/game/brookhaven')continue;assert.ok(href?.endsWith('/party'),href);}
  for(const [game,guide] of [["blox-fruits","fruit-basics"],["fisch","fishing-controls"],["grow-a-garden","planting-basics"],["rivals","first-duel"],["murder-mystery-2","roles"]]){
   const res=await page.goto(`${base}/game/${game}/guides/${guide}`,{waitUntil:"networkidle"});assert.ok(res?.ok());const body=await page.locator('.guide-body').innerText();assert.doesNotMatch(body,/그런 내용은|이 가이드는|여기서는|만 정리합니다|만 설명합니다|만 다룹니다/);
   const reading=await page.locator('.guide-reading').boundingBox(),cta=await page.locator('.guide-question-next').boundingBox(),media=await page.locator('.guide-media-section').boundingBox();assert.ok(reading&&cta&&cta.y>=reading.y+reading.height-2&&(!media||cta.y<media.y));assert.equal(await page.locator('.guide-question-next a').getAttribute('href'),`/game/${game}/questions`);
   await page.screenshot({path:`qa-review-guide-${game}-375.png`,fullPage:true});
  }
  for(const path of ['/game/doors/guides/before-you-enter','/game/99-nights-in-the-forest/guides/camp-basics']){const r=await page.request.get(base+path);assert.equal(r.status(),404);}
  await page.goto(base+'/contact',{waitUntil:'networkidle'});assert.equal(await page.getByRole('link',{name:'공개 오류 제보 · GitHub ↗',exact:true}).count(),1);assert.ok(await page.getByText('이메일, 계정 정보 등 개인정보는 공개 제보에 적지 마세요.').isVisible());
  await page.goto(base+'/rising',{waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'qa-review-rising-375.png',fullPage:true});
 } finally{await page.close();}
 console.log('External review public regression PASS: actual read-only preview at 375px');
}
