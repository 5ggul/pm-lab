import assert from "node:assert/strict";
async function assertFits(page,label){
 const result=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main *')].map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,cls:e.className,x:Math.round(r.x),right:Math.round(r.right),width:Math.round(r.width),text:e.textContent?.slice(0,70)};}).filter(r=>r.width>0&&(r.right>innerWidth+1||r.x< -1)).slice(0,16)}));
 if(result.scrollWidth>result.width)console.error(label,JSON.stringify(result));
 assert.ok(result.scrollWidth<=result.width,label);
}
export async function checkDiscovery({browser,base}) {
 const results=[];
 for(const width of [375,390,768,1440]) {
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:"reduce"});
  await page.goto(base,{waitUntil:"networkidle"});
  assert.equal((await page.getByRole("heading",{level:1}).innerText()).replace(/\s/g,""),"오늘은뭐하고놀까?");
  await assertFits(page,"home overflow "+width);
  const search=await page.locator(".play-hero .search-wrap").boundingBox();
  const featured=await page.locator(".spotlight-grid").boundingBox();
  assert.ok(search&&featured&&search.y<featured.y,"search remains above images");
  const buttonTextLines=await page.locator('.play-hero button[type=submit]').evaluate(e=>{const r=document.createRange();r.selectNodeContents(e);return r.getClientRects().length;});
  assert.equal(buttonTextLines,1,"search button label must stay on one line");
  assert.equal(await page.locator(".play-actions>a").count(),3);
  assert.equal(await page.locator(".play-action.action-blue").getAttribute("href"),"/games?intent=party");
  if(width<760){assert.equal(await page.locator('.mobile-nav a[aria-current="page"]').innerText(),"홈");await page.locator(".mobile-menu summary").click();await page.locator('.mobile-menu a[href="/updates"]').waitFor();await page.locator(".mobile-menu summary").click();}
  const chips=page.locator('.genre-chips button');
  if(await chips.count()>1){await chips.nth(1).click();assert.equal(await chips.nth(1).getAttribute("aria-pressed"),"true");assert.ok(await page.locator(".discovery-cards .visual-game-card").count()>0);await chips.first().click();}
  const reduced=await page.locator(".play-action").first().evaluate(e=>getComputedStyle(e).transitionDuration);
  assert.equal(reduced,"0s");
  await page.screenshot({path:`qa-energy-home-${width}.png`,fullPage:true});
  await page.goto(base+"/games?intent=party",{waitUntil:"networkidle"});
  assert.ok(await page.locator('.visual-game-card[href$="/party"]').count()>0,"party cards retain destination");
  await assertFits(page,"game list overflow "+width);
  await page.goto(base+"/game/dress-to-impress",{waitUntil:"networkidle"});
  await page.screenshot({path:`qa-energy-dti-${width}.png`,fullPage:true});
  await assertFits(page,"DTI overflow "+width);
  await page.goto(base+"/game/rivals/guides/first-duel",{waitUntil:"networkidle"});
  await page.screenshot({path:`qa-energy-guide-${width}.png`,fullPage:true});
  await assertFits(page,"guide overflow "+width);
  const text=await page.locator("main").innerText();assert.doesNotMatch(text,/VERIFIED EDITORIAL|POINT 01|핵심 답|이 가이드는/);
  const protectedPage=await page.request.get(base+"/me/delete",{maxRedirects:0});assert.ok([302,303,307,308].includes(protectedPage.status()));
  await page.close();results.push({width,status:"PASS"});
 }
 console.log("Discovery youth UI QA:",JSON.stringify(results));
}
