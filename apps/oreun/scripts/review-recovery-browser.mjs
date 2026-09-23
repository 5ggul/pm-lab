import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
const base=process.env.QA_BASE_URL||"http://localhost:3100";
if(!["localhost","127.0.0.1"].includes(new URL(base).hostname))throw new Error("local-only fixture");
const results=[];
for(const [engineName,engine] of [["chromium",chromium],["webkit",webkit]]) {
 const browser=await engine.launch({headless:true});
 try {for(const kind of ["question","answer","comment","party"]){
  const context=await browser.newContext({viewport:{width:375,height:900}});const page=await context.newPage();
  const path=`/qa-recovery?kind=${kind}&scope=${engineName}-${kind}-${Date.now()}`;
  await page.goto(base+path,{waitUntil:"networkidle"});
  const input=page.locator(kind==="question"||kind==="party"?'input[name="title"]':'[name="body"]');
  const submit=page.locator('button[type="submit"]');
  async function fill(text){await input.fill(text);if(kind==="question")await page.locator('textarea[name="body"]').fill("A concrete problem with a sufficiently long body.");if(kind==="party")await page.locator('textarea[name="note"]').fill("party QA note");}
  await fill("[SERVER_FAIL] not committed");await submit.click();await page.getByRole("alert").filter({hasText:"QA server failure"}).waitFor();assert.equal(await input.inputValue(),"[SERVER_FAIL] not committed");
  await fill("[LOST] original content");const nonce=await page.locator('input[name="request_id"]').inputValue();
  await submit.click();await page.getByRole("alert").filter({hasText:/연결이 끊어졌습니다/}).waitFor();assert.equal(await input.inputValue(),"[LOST] original content");
  // Changed payload AFTER an invisible committed insert must never be treated as saved.
  await input.fill("modified current draft, not stored");await submit.click();const conflict=page.getByTestId("write-conflict");await conflict.waitFor();assert.equal(await input.inputValue(),"modified current draft, not stored");assert.equal(await page.locator('input[name="request_id"]').inputValue(),nonce);
  const link=conflict.getByRole("link",{name:/이미 등록된/});assert.equal(await link.getAttribute("target"),"_blank");
  const href=await link.getAttribute("href");const original=await context.newPage();await original.goto(base+href,{waitUntil:"networkidle"});assert.match(await original.locator("main").innerText(),/\[LOST\] original content/);await original.close();
  await page.reload({waitUntil:"networkidle"});assert.equal(await input.inputValue(),"modified current draft, not stored");assert.equal(await page.locator('input[name="request_id"]').inputValue(),nonce);
  await submit.click();await conflict.waitFor();page.once("dialog",d=>d.accept());await conflict.getByRole("button",{name:"현재 내용으로 새 글 작성하기"}).click();
  assert.notEqual(await page.locator('input[name="request_id"]').inputValue(),nonce);assert.equal(await input.inputValue(),"modified current draft, not stored");assert.ok(!page.url().includes("original="));
  await page.waitForTimeout(450);await page.reload({waitUntil:"networkidle"});assert.equal(await input.inputValue(),"modified current draft, not stored");
  await submit.click();await page.getByRole("heading",{name:"QA original",exact:true}).waitFor();assert.match(await page.locator("main").innerText(),/modified current draft/);
  await page.goto(base+path,{waitUntil:"networkidle"});assert.equal(await input.inputValue(),"");
  // Identical retry after lost response recovers the one original.
  await fill("[LOST] identical retry");await submit.click();await page.getByRole("alert").filter({hasText:/연결이 끊어졌습니다/}).waitFor();await submit.click();await page.getByRole("heading",{name:"QA original",exact:true}).waitFor();assert.match(await page.locator("main").innerText(),/identical retry/);
  await page.goto(base+path,{waitUntil:"networkidle"});assert.equal(await input.inputValue(),"");
  await fill("network failure preserves draft");await page.route('**/qa-recovery**',route=>route.request().method()==="POST"?route.abort("failed"):route.continue());await submit.click();await page.getByRole("alert").filter({hasText:/연결이 끊어졌습니다/}).waitFor();assert.equal(await input.inputValue(),"network failure preserves draft");
  await page.screenshot({path:`qa-response-recovery-${engineName}-${kind}.png`,fullPage:true});await context.close();
  results.push({engine:engineName,kind,checks:["server failure","commit and lost response","identical retry recovery","edited conflict preserves draft","original new tab","explicit new request preserves inputs","network failure","success-only cleanup"],status:"PASS"});
 }} finally{await browser.close();}
}
console.log(JSON.stringify({scope:"isolated in-memory local actions, no real users or posts",results},null,2));
