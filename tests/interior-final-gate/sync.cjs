'use strict';

const fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE_URL = (process.env.QA_BASE_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');
const OUT = process.env.QA_RESULT_PATH || 'final-sync.json';
const SITE = '/pm-lab/interior-cost-preview';
const LEGACY_KEYS = ['interior-quote-v5','interior-compare-v5','interior-compare-v6'];
const SOURCE_KEY = 'interior-quote-handoff-source-v1';
const HANDOFF_KEY = 'interior-quote-handoff-v1';
const REVIEW_KEY = 'interior-compare-v7';
const RESET_KEY = 'interior-compare-v7-reset-v1';
const ITEMS = ['demolition','waste','waterproof','bathroom','kitchen','wallpaper','flooring','carpentry','electrical','window','management','vat'];
const VENDORS = ['a','b','c'];

const results = [];
const failures = [];
function record(name, ok, detail) {
  const d = String(detail == null ? '' : detail);
  results.push({name, ok: !!ok, detail: d});
  if (!ok) failures.push({name, detail: d});
  console.log('[' + (ok ? 'PASS' : 'FAIL') + '] ' + name + (d ? ' :: ' + d : ''));
}
function must(ok, name, detail) {
  record(name, ok, detail);
  if (!ok) throw new Error(name + (detail ? ': ' + detail : ''));
}
function siteUrl(rel) {
  return BASE_URL + SITE + '/' + rel.replace(/^\/+/, '');
}
async function goto(page, rel) {
  const response = await page.goto(siteUrl(rel), {waitUntil:'domcontentloaded', timeout:60000});
  must(!!response && response.ok(), 'HTTP ' + rel, response ? response.status() : 'no response');
}
async function readRaw(page, key) {
  return page.evaluate((k) => localStorage.getItem(k), key);
}
async function readJson(page, key) {
  const raw = await readRaw(page, key);
  return raw ? JSON.parse(raw) : null;
}
async function snapshot(page, keys) {
  return page.evaluate((ks) => Object.fromEntries(ks.map((k) => [k, localStorage.getItem(k)])), keys);
}
function validQuote(seed) {
  const items = {};
  ITEMS.forEach((id, i) => {
    items[id] = {
      name:id,
      state:'included',
      amount:String(seed + i + 1),
      qty:String(i + 1),
      unit:'식',
      spec:'SPEC-' + id,
      memo:'MEMO-' + id
    };
  });
  return {
    context:{supply:'32',exclusive:'25.7',building:'아파트',region:'서울',scope:'올수리',bathrooms:'2'},
    items
  };
}
async function setQuoteForm(page, vendorIndex) {
  const base = (vendorIndex + 1) * 1000;
  await page.locator('[data-context="supply"]').fill('32');
  await page.locator('[data-context="exclusive"]').fill('25.7');
  await page.locator('[data-context="building"]').selectOption({label:'아파트'});
  await page.locator('[data-context="region"]').fill('서울-' + (vendorIndex + 1));
  await page.locator('[data-context="scope"]').selectOption({label:'올수리'});
  await page.locator('[data-context="bathrooms"]').fill('2');

  for (let i = 0; i < ITEMS.length; i++) {
    const id = ITEMS[i];
    const row = page.locator('[data-qrow="' + id + '"]');
    await row.locator('input[type="radio"][value="included"]').check();
    await row.locator('[data-q-amount]').fill(String(base + i + 1));
    await row.locator('[data-q-qty]').fill(String(i + 1));
    await row.locator('[data-q-unit]').fill('식');
    await row.locator('[data-q-spec]').fill('RC-' + (vendorIndex + 1) + '-' + id);
    await row.locator('[data-q-memo]').fill('MEMO-' + (vendorIndex + 1) + '-' + id);
  }
  return base;
}

(async () => {
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:1280,height:900}, locale:'ko-KR'});
  const pageErrors = [];
  context.on('page', (p) => p.on('pageerror', (err) => pageErrors.push({url:p.url(),message:String(err?.message || err)})));

  try {
    const page = await context.newPage();
    await goto(page, 'quote-check/');

    const env = await page.evaluate(() => ({
      secureContext: window.isSecureContext,
      locks: !!navigator.locks && typeof navigator.locks.request === 'function'
    }));
    must(env.secureContext, 'secure context', JSON.stringify(env));
    must(env.locks, 'Web Locks available', JSON.stringify(env));

    await page.evaluate((keys) => {
      localStorage.setItem(keys[0], JSON.stringify({context:{region:'기존지역'},items:{}}));
      localStorage.setItem(keys[1], JSON.stringify({sentinel:'legacy-v5'}));
      localStorage.setItem(keys[2], JSON.stringify({sentinel:'legacy-v6'}));
    }, LEGACY_KEYS);
    const legacyBaseline = await snapshot(page, LEGACY_KEYS);
    must(LEGACY_KEYS.every((k) => legacyBaseline[k] !== null), 'legacy storage baseline seeded', JSON.stringify(legacyBaseline));

    // Numeric safety on the real quote-check page.
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForSelector('[data-send-to-compare]');
    const firstAmount = page.locator('[data-qrow="demolition"] [data-q-amount]');
    await firstAmount.evaluate((el) => { el.value='-1'; el.dispatchEvent(new Event('input',{bubbles:true})); });
    must((await firstAmount.inputValue()) === '', 'quote-check rejects negative amount');
    await firstAmount.evaluate((el) => { el.value='9007199254740992'; el.dispatchEvent(new Event('input',{bubbles:true})); });
    must((await firstAmount.inputValue()) === '', 'quote-check rejects unsafe integer');
    const secondAmount = page.locator('[data-qrow="waste"] [data-q-amount]');
    await firstAmount.evaluate((el) => { el.value='9007199254740991'; el.dispatchEvent(new Event('input',{bubbles:true})); });
    await secondAmount.evaluate((el) => { el.value='1'; el.dispatchEvent(new Event('input',{bubbles:true})); });
    must((await firstAmount.inputValue()) === '9007199254740991' && (await secondAmount.inputValue()) === '', 'quote-check rejects aggregate overflow');

    // Reset the form without touching the persisted legacy quote key.
    await page.reload({waitUntil:'domcontentloaded'});

    async function sendAndApply(target, vendorIndex) {
      await goto(page, 'quote-check/');
      await page.waitForSelector('[data-send-to-compare]', {timeout:30000});
      const base = await setQuoteForm(page, vendorIndex);

      await page.locator('[data-send-to-compare]').click();
      await page.waitForSelector('dialog.v40-handoff-dialog[open]', {timeout:15000});
      const dialogText = (await page.locator('dialog.v40-handoff-dialog').textContent()) || '';
      must(!dialogText.includes('검수용'), target.toUpperCase() + ' dialog has production wording', dialogText.trim());
      await page.locator('input[name="v40-target"][value="' + target + '"]').check();
      await page.locator('[data-v40-confirm]').click();

      await page.waitForURL(/\/pm-lab\/interior-cost-preview\/quote-compare\/?$/, {timeout:30000});
      const parsed = new URL(page.url());
      must(!parsed.search && !parsed.hash, target.toUpperCase() + ' URL carries no quote payload', page.url());

      await page.waitForSelector('[data-v41-shell-preview]', {timeout:30000});
      const beforeApply = await page.locator('[data-compare-row="demolition"] [data-vendor="' + target + '"][data-amount]').inputValue();
      must(beforeApply !== String(base + 1), target.toUpperCase() + ' import is not auto-applied', beforeApply);

      const statusBefore = (await page.locator('[data-v41-shell-status]').textContent()) || '';
      must(statusBefore.includes(target.toUpperCase() + ' 업체 handoff'), target.toUpperCase() + ' explicit preview status', statusBefore);

      await page.locator('[data-v41-shell-apply]').click();
      await page.waitForFunction(
        (t) => (document.querySelector('[data-v41-shell-status]')?.textContent || '').includes(t.toUpperCase() + ' 업체 적용 완료'),
        target,
        {timeout:30000}
      );
      must((await page.locator('[data-v41-shell-preview]').count()) === 0, target.toUpperCase() + ' preview removed after Apply');

      const saved = await readJson(page, REVIEW_KEY);
      for (let i = 0; i < ITEMS.length; i++) {
        const id = ITEMS[i];
        must(saved?.flat?.[id + ':' + target + ':state'] === 'included', target.toUpperCase() + ' ' + id + ' state persisted');
        must(saved?.flat?.[id + ':' + target + ':amount'] === String(base + i + 1), target.toUpperCase() + ' ' + id + ' amount persisted');
        must(saved?.vendors?.[target]?.items?.[id]?.spec === 'RC-' + (vendorIndex + 1) + '-' + id, target.toUpperCase() + ' ' + id + ' spec metadata persisted');
        must(saved?.vendors?.[target]?.items?.[id]?.memo === 'MEMO-' + (vendorIndex + 1) + '-' + id, target.toUpperCase() + ' ' + id + ' memo metadata persisted');
      }
      must(saved?.vendors?.[target]?.context?.region === '서울-' + (vendorIndex + 1), target.toUpperCase() + ' six-context metadata persisted');
      must((await readRaw(page, SOURCE_KEY)) === null, target.toUpperCase() + ' source cleaned');
      must((await readRaw(page, HANDOFF_KEY)) === null, target.toUpperCase() + ' handoff cleaned');
      return base;
    }

    const bases = {};
    for (let i = 0; i < VENDORS.length; i++) bases[VENDORS[i]] = await sendAndApply(VENDORS[i], i);

    const savedABC = await readJson(page, REVIEW_KEY);
    must(VENDORS.every((v, vi) => ITEMS.every((id, i) => savedABC?.flat?.[id + ':' + v + ':amount'] === String((vi + 1) * 1000 + i + 1))), 'A/B/C all 12-item states preserved');
    must(VENDORS.every((v) => !!savedABC?.vendors?.[v]?.context), 'A/B/C rich vendor metadata preserved');

    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForSelector('[data-compare-table]');
    for (let vi = 0; vi < VENDORS.length; vi++) {
      const v = VENDORS[vi];
      for (let i = 0; i < ITEMS.length; i++) {
        const id = ITEMS[i];
        const value = await page.locator('[data-compare-row="' + id + '"] [data-vendor="' + v + '"][data-amount]').inputValue();
        must(value === String((vi + 1) * 1000 + i + 1), 'refresh restores ' + v.toUpperCase() + ' ' + id, value);
      }
    }

    await goto(page, 'quote-check/');
    await goto(page, 'quote-compare/');
    await page.waitForSelector('[data-compare-table]');
    must((await page.locator('[data-compare-row="vat"] [data-vendor="c"][data-amount]').inputValue()) === String(3000 + ITEMS.length), 'revisit restores C VAT');

    const reopened = await context.newPage();
    await goto(reopened, 'quote-compare/');
    await reopened.waitForSelector('[data-compare-table]');
    must((await reopened.locator('[data-compare-row="kitchen"] [data-vendor="b"][data-amount]').inputValue()) === String(2000 + ITEMS.indexOf('kitchen') + 1), 'new-tab restores B kitchen');

    // Manual compare edit autosaves to v7 and survives refresh.
    const manual = reopened.locator('[data-compare-row="demolition"] [data-vendor="a"][data-amount]');
    await manual.fill('4321');
    await reopened.waitForTimeout(80);
    await reopened.reload({waitUntil:'domcontentloaded'});
    must((await reopened.locator('[data-compare-row="demolition"] [data-vendor="a"][data-amount]').inputValue()) === '4321', 'manual compare edit autosaves');

    // Compare numeric boundary.
    const unsafe = reopened.locator('[data-compare-row="waste"] [data-vendor="a"][data-amount]');
    await unsafe.evaluate((el) => { el.value='9007199254740992'; el.dispatchEvent(new Event('input',{bubbles:true})); });
    must((await unsafe.inputValue()) === '', 'quote-compare rejects unsafe integer');

    // Native two-tab storage-event invalidation + ownership protection.
    const stale = reopened;
    await goto(stale, 'quote-check/');
    await stale.waitForSelector('[data-send-to-compare]');
    await stale.locator('[data-qrow="demolition"] [data-q-amount]').fill('444');
    await stale.locator('[data-send-to-compare]').click();
    await stale.waitForSelector('dialog.v40-handoff-dialog[open]');
    await stale.locator('input[name="v40-target"][value="a"]').check();
    await stale.locator('[data-v40-confirm]').click();
    await stale.waitForURL(/\/pm-lab\/interior-cost-preview\/quote-compare\/?$/, {timeout:30000});
    await stale.waitForSelector('[data-v41-shell-preview]');
    const oldTransfer = await stale.evaluate(() => window.InteriorQuoteCompareAdapter41.readTransfer());
    must(!!oldTransfer?.source && !!oldTransfer?.handoff, 'stale tab captured exact transfer');

    const newer = await context.newPage();
    await goto(newer, 'quote-check/');
    const newerSnapshot = await newer.evaluate(({sourceKey,handoffKey}) => {
      const old = JSON.parse(localStorage.getItem(sourceKey));
      const transferId = 'candidate-newer-' + Date.now();
      const createdAt = new Date().toISOString();
      const source = {version:2,transferId,createdAt,quote:JSON.parse(JSON.stringify(old.quote))};
      source.quote.items.demolition.amount='555';
      const handoff={version:2,target:'b',transferId,createdAt};
      localStorage.setItem(sourceKey,JSON.stringify(source));
      localStorage.setItem(handoffKey,JSON.stringify(handoff));
      return {source,handoff};
    }, {sourceKey:SOURCE_KEY,handoffKey:HANDOFF_KEY});

    await stale.waitForFunction(
      () => (document.querySelector('[data-v41-shell-status]')?.textContent || '').includes('snapshot이 변경되어 기존 미리보기를 무효화'),
      null,
      {timeout:15000}
    );
    must((await stale.locator('[data-v41-shell-preview]').count()) === 0, 'stale preview invalidated by native storage event');
    const refused = await stale.evaluate(async (old) => window.InteriorQuoteCompareAdapter41.clearOwnedTransferExclusive(old.source, old.handoff), oldTransfer);
    must(refused === false, 'stale cleanup refuses newer transfer', String(refused));
    const persistedNewer = await newer.evaluate(({sourceKey,handoffKey}) => ({
      source:JSON.parse(localStorage.getItem(sourceKey)),
      handoff:JSON.parse(localStorage.getItem(handoffKey))
    }), {sourceKey:SOURCE_KEY,handoffKey:HANDOFF_KEY});
    must(persistedNewer.source?.transferId === newerSnapshot.source.transferId, 'newer source preserved');
    must(persistedNewer.handoff?.transferId === newerSnapshot.handoff.transferId && persistedNewer.handoff?.target === 'b', 'newer handoff target preserved');
    await newer.evaluate(({sourceKey,handoffKey}) => { localStorage.removeItem(sourceKey); localStorage.removeItem(handoffKey); }, {sourceKey:SOURCE_KEY,handoffKey:HANDOFF_KEY});
    await newer.close();
    await stale.close();

    // Partial transfer recovery on real quote-check.
    const recover = await context.newPage();
    await goto(recover, 'quote-check/');
    await recover.evaluate(({sourceKey,quote}) => {
      localStorage.setItem(sourceKey, JSON.stringify({version:2,transferId:'partial-' + Date.now(),createdAt:new Date().toISOString(),quote}));
    }, {sourceKey:SOURCE_KEY,quote:validQuote(7000)});
    await recover.reload({waitUntil:'domcontentloaded'});
    await recover.waitForSelector('[data-v41-pending-recovery]:not([hidden])');
    const recoveryText = (await recover.locator('[data-v41-pending-recovery]').textContent()) || '';
    must(recoveryText.includes('불완전한 전송'), 'partial transfer recovery panel appears', recoveryText.trim());
    await recover.locator('[data-v41-cancel-pending]').click();
    await recover.waitForFunction((k) => localStorage.getItem(k) === null, SOURCE_KEY);
    must((await readRaw(recover, SOURCE_KEY)) === null, 'partial transfer cleanup completed');
    await recover.close();

    // Stale exact pair is safely cleaned on compare.
    const staleClean = await context.newPage();
    await goto(staleClean, 'quote-check/');
    await staleClean.evaluate(({sourceKey,handoffKey,quote}) => {
      const createdAt = new Date(Date.now() - 31*60*1000).toISOString();
      const transferId='stale-' + Date.now();
      localStorage.setItem(sourceKey,JSON.stringify({version:2,transferId,createdAt,quote}));
      localStorage.setItem(handoffKey,JSON.stringify({version:2,target:'c',transferId,createdAt}));
    }, {sourceKey:SOURCE_KEY,handoffKey:HANDOFF_KEY,quote:validQuote(8000)});
    await goto(staleClean, 'quote-compare/');
    await staleClean.waitForFunction(({s,h}) => localStorage.getItem(s) === null && localStorage.getItem(h) === null, {s:SOURCE_KEY,h:HANDOFF_KEY}, {timeout:15000});
    must((await readRaw(staleClean, SOURCE_KEY)) === null && (await readRaw(staleClean, HANDOFF_KEY)) === null, 'stale exact pair cleaned');
    await staleClean.close();

    // v7 cross-tab compare synchronization: sequential edits must merge, not overwrite.
    const syncContext=await browser.newContext({viewport:{width:1280,height:900},locale:'ko-KR'});
    const syncA=await syncContext.newPage(),syncB=await syncContext.newPage();
    await goto(syncA,'quote-compare/');
    await goto(syncB,'quote-compare/');
    const syncAField=syncA.locator('[data-compare-row="demolition"] [data-vendor="a"][data-amount]');
    const syncBField=syncB.locator('[data-compare-row="waste"] [data-vendor="b"][data-amount]');
    await syncAField.fill('1111');
    await syncB.waitForFunction(()=>document.querySelector('[data-compare-row="demolition"] [data-vendor="a"][data-amount]')?.value==='1111',null,{timeout:15000});
    must((await syncBField.inputValue())!=='2222','cross-tab sync receives first remote edit');
    await syncBField.fill('2222');
    await syncA.waitForFunction(()=>document.querySelector('[data-compare-row="waste"] [data-vendor="b"][data-amount]')?.value==='2222',null,{timeout:15000});
    const sequentialSaved=await readJson(syncA,REVIEW_KEY);
    const sequentialRaw=await readRaw(syncA,REVIEW_KEY);
    must(sequentialSaved?.flat?.['demolition:a:amount']==='1111'&&sequentialSaved?.flat?.['waste:b:amount']==='2222','cross-tab sequential edits merge in v7');
    must(Number.isSafeInteger(sequentialSaved?.revision)&&sequentialSaved.revision>0,'compare snapshot carries monotonic revision',String(sequentialSaved?.revision));

    // Near-simultaneous disjoint edits must both survive the write lock + field patch merge.
    const simultaneousA=syncA.locator('[data-compare-row="carpentry"] [data-vendor="c"][data-amount]');
    const simultaneousB=syncB.locator('[data-compare-row="window"] [data-vendor="b"][data-amount]');
    await Promise.all([simultaneousA.fill('3333'),simultaneousB.fill('4444')]);
    await syncA.waitForFunction(()=>document.querySelector('[data-compare-row="window"] [data-vendor="b"][data-amount]')?.value==='4444',null,{timeout:15000});
    await syncB.waitForFunction(()=>document.querySelector('[data-compare-row="carpentry"] [data-vendor="c"][data-amount]')?.value==='3333',null,{timeout:15000});
    const simultaneousSaved=await readJson(syncA,REVIEW_KEY);
    must(
      simultaneousSaved?.flat?.['carpentry:c:amount']==='3333'&&
      simultaneousSaved?.flat?.['window:b:amount']==='4444'&&
      simultaneousSaved?.flat?.['demolition:a:amount']==='1111'&&
      simultaneousSaved?.flat?.['waste:b:amount']==='2222',
      'cross-tab simultaneous disjoint edits preserve all values'
    );
    must(simultaneousSaved.revision>sequentialSaved.revision,'simultaneous merge advances revision',simultaneousSaved.revision+'>'+sequentialSaved.revision);
    await syncB.evaluate(({key,raw})=>{
      window.dispatchEvent(new StorageEvent('storage',{key,newValue:raw,oldValue:null,url:location.href}));
    },{key:REVIEW_KEY,raw:sequentialRaw});
    await syncB.waitForTimeout(100);
    must(
      (await simultaneousA.inputValue())==='3333'&&
      (await simultaneousB.inputValue())==='4444',
      'delayed stale compare snapshot is ignored'
    );
    await syncContext.close();

    // Reset generation must reject stale autosave even before a storage event is delivered.
    const generationContext=await browser.newContext({viewport:{width:1280,height:900},locale:'ko-KR'});
    const generationPage=await generationContext.newPage();
    await goto(generationPage,'quote-compare/');
    const generationResult=await generationPage.evaluate(async ()=>{
      const api=window.InteriorQuoteCompareAdapter41;
      const host=document.querySelector('[data-compare-table]');
      const review=api.normalizeReview({flat:{},vendors:{a:null,b:null,c:null}});
      const field=document.querySelector('[data-compare-row="demolition"] [data-vendor="a"][data-amount]');
      field.value='8888';
      const oldToken=api.readResetToken();
      localStorage.setItem(api.RESET_KEY,'forced-reset-'+Date.now());
      localStorage.removeItem(api.REVIEW_KEY);
      const result=await api.commitAutosave(review,host,['demolition:a:amount'],()=>true,oldToken);
      return {
        resetChanged:result?.resetChanged===true,
        reviewRaw:localStorage.getItem(api.REVIEW_KEY),
        fieldValue:field.value
      };
    });
    must(generationResult.resetChanged,'reset generation rejects stale autosave without storage event',JSON.stringify(generationResult));
    must(generationResult.reviewRaw===null,'generation guard does not recreate v7 state',JSON.stringify(generationResult));
    await generationContext.close();

    // Reset in one tab must invalidate pending stale autosave in another tab and cannot resurrect the old snapshot.
    const raceContext=await browser.newContext({viewport:{width:1280,height:900},locale:'ko-KR'});
    const resetA=await raceContext.newPage(),resetB=await raceContext.newPage();
    await goto(resetA,'quote-compare/');
    await goto(resetB,'quote-compare/');
    const oldA=resetA.locator('[data-compare-row="demolition"] [data-vendor="a"][data-amount]');
    await oldA.fill('5555');
    await resetB.waitForFunction(()=>document.querySelector('[data-compare-row="demolition"] [data-vendor="a"][data-amount]')?.value==='5555',null,{timeout:15000});
    const preResetRaw=await readRaw(resetB,REVIEW_KEY);

    // Create a dirty edit in B, then reset A immediately. The old full snapshot must not return.
    await resetB.locator('[data-compare-row="electrical"] [data-vendor="c"][data-amount]').evaluate(el=>{
      el.value='6666';el.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await Promise.all([
      resetA.waitForLoadState('domcontentloaded'),
      resetA.locator('[data-reset-compare]').click()
    ]);
    await resetB.waitForFunction(()=>document.querySelector('[data-compare-row="demolition"] [data-vendor="a"][data-amount]')?.value==='',null,{timeout:15000});
    await resetB.waitForTimeout(150);
    must((await readRaw(resetB,REVIEW_KEY))===null,'remote reset remains deleted after pending autosave window');
    const resetStatus=(await resetB.locator('[data-v41-shell-status]').textContent())||'';
    must(resetStatus.includes('초기화'),'remote reset status is surfaced',resetStatus);
    await resetB.evaluate(({key,raw})=>{
      window.dispatchEvent(new StorageEvent('storage',{key,newValue:raw,oldValue:null,url:location.href}));
    },{key:REVIEW_KEY,raw:preResetRaw});
    await resetB.waitForTimeout(100);
    must(
      (await resetB.locator('[data-compare-row="demolition"] [data-vendor="a"][data-amount]').inputValue())==='',
      'delayed pre-reset snapshot is ignored'
    );

    // A new post-reset edit may create a fresh snapshot, but pre-reset values must stay gone.
    await resetB.locator('[data-compare-row="flooring"] [data-vendor="b"][data-amount]').fill('7777');
    await resetB.waitForFunction((key)=>{
      const raw=localStorage.getItem(key);if(!raw)return false;
      try{return JSON.parse(raw)?.flat?.['flooring:b:amount']==='7777';}catch{return false;}
    },REVIEW_KEY,{timeout:15000});
    const postReset=await readJson(resetB,REVIEW_KEY);
    must(postReset?.flat?.['flooring:b:amount']==='7777','post-reset new edit persists');
    must(postReset?.flat?.['demolition:a:amount']!=='5555','post-reset snapshot does not resurrect old A value');
    must(postReset?.flat?.['electrical:c:amount']!=='6666','post-reset snapshot does not resurrect stale pending edit');
    await raceContext.close();

    // Mobile touch/overflow regression.
    for (const width of [360,375,390,430]) {
      const mc = await browser.newContext({viewport:{width,height:800},hasTouch:true,isMobile:true,locale:'ko-KR'});
      const mp = await mc.newPage();
      await goto(mp, 'quote-check/');
      await mp.waitForSelector('[data-send-to-compare]');
      const qm = await mp.evaluate(() => ({
        overflow:document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        sendHeight:document.querySelector('[data-send-to-compare]')?.getBoundingClientRect().height || 0
      }));
      must(!qm.overflow, 'mobile ' + width + ' quote-check no page overflow');
      must(qm.sendHeight >= 44, 'mobile ' + width + ' send action >=44px', qm.sendHeight);
      await mp.locator('[data-send-to-compare]').tap();
      await mp.waitForSelector('dialog.v40-handoff-dialog[open]');
      const box=await mp.locator('dialog.v40-handoff-dialog').boundingBox();
      must(!!box && box.x >= -1 && box.x + box.width <= width + 1, 'mobile ' + width + ' dialog within viewport', JSON.stringify(box));
      const confirmHeight=await mp.locator('[data-v40-confirm]').evaluate((el)=>el.getBoundingClientRect().height);
      must(confirmHeight >= 44, 'mobile ' + width + ' dialog action >=44px', confirmHeight);
      await mp.locator('[data-v40-cancel]').tap();
      await goto(mp, 'quote-compare/');
      const cm=await mp.evaluate(() => ({
        overflow:document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        table:!!document.querySelector('[data-compare-table]')
      }));
      must(!cm.overflow, 'mobile ' + width + ' quote-compare no page overflow');
      must(cm.table, 'mobile ' + width + ' compare table present');
      await mc.close();
    }

    // Existing production keys must not be mutated by handoff/apply/autosave.
    const legacyAfter = await snapshot(page, LEGACY_KEYS);
    must(JSON.stringify(legacyBaseline) === JSON.stringify(legacyAfter), 'legacy production storage exact values unchanged', JSON.stringify(legacyAfter));

    // Reset clears only the new canonical compare v7 in an isolated context.
    const resetContext=await browser.newContext({viewport:{width:1280,height:900},locale:'ko-KR'});
    const rp=await resetContext.newPage();
    await goto(rp, 'quote-compare/');
    await rp.evaluate((k)=>localStorage.setItem(k,JSON.stringify({version:1,flat:{'demolition:a:amount':'99'},vendors:{a:null,b:null,c:null},updatedAt:new Date().toISOString()})), REVIEW_KEY);
    await rp.reload({waitUntil:'domcontentloaded'});
    must((await rp.locator('[data-compare-row="demolition"] [data-vendor="a"][data-amount]').inputValue()) === '99', 'v7 restore before reset');
    await Promise.all([
      rp.waitForNavigation({waitUntil:'domcontentloaded',timeout:15000}),
      rp.locator('[data-reset-compare]').click()
    ]);
    await rp.waitForLoadState('networkidle');
    await rp.waitForFunction((key)=>localStorage.getItem(key)===null,REVIEW_KEY,{timeout:15000});
    await rp.waitForTimeout(150);
    must((await readRaw(rp, REVIEW_KEY)) === null, 'reset clears v7 compare state');
    must(!!(await readRaw(rp, RESET_KEY)), 'reset generation token persists after reload');
    await resetContext.close();

    must(pageErrors.length === 0, 'no uncaught page errors', JSON.stringify(pageErrors));

    const report = {
      schema:'interior-v41-compare-sync-hotfix-qa/v1',
      generatedAt:new Date().toISOString(),
      baseUrl:BASE_URL,
      legacyKeys:LEGACY_KEYS,
      newKeys:[SOURCE_KEY,HANDOFF_KEY,REVIEW_KEY],
      mobileWidths:[360,375,390,430],
      passed:results.filter((r)=>r.ok).length,
      failed:failures.length,
      results,failures,pageErrors
    };
    await fs.writeFile(OUT, JSON.stringify(report,null,2) + '\n','utf8');
    console.log('QA_RESULT=' + OUT);
    console.log('QA_TOTAL_ASSERTIONS=' + results.length);
    console.log('QA_FAILURES=' + failures.length);
    if (failures.length) process.exitCode=1;
  } catch (err) {
    const report={schema:'interior-v41-compare-sync-hotfix-qa/v1',generatedAt:new Date().toISOString(),baseUrl:BASE_URL,passed:results.filter((r)=>r.ok).length,failed:failures.length+1,results,failures:[...failures,{name:'fatal',detail:String(err?.stack || err)}],pageErrors};
    await fs.writeFile(OUT,JSON.stringify(report,null,2) + '\n','utf8').catch(()=>{});
    console.error(err?.stack || err);
    process.exitCode=1;
  } finally {
    await browser.close();
  }
})();