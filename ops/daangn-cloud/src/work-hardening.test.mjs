import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { renderCommunityCandidates, selectCommunityCopy } from './copy-engine.mjs';
import { growthCopyFailures, planItem } from './growth-engine.mjs';
import { dealPriceFacts } from './deal-price-facts.mjs';
import { runReservedPublish, submissionHistory } from './publish-journal.mjs';
import { readSavedResult } from './publisher.mjs';
import { createHash } from 'node:crypto';
import { publicCondition, publicDealBody } from './editorial-language.mjs';
import { parsePublicPostEvidence } from './public-readback.mjs';
import { deadlineInfo, runtimeDraftFailures, verifyEditorTitle, verifyPublishedSnapshot, buildLifecycleQueue } from './work-hardening.mjs';

const config = JSON.parse(await fs.readFile(new URL('../growth-config.json', import.meta.url)));
const now = new Date('2026-10-14T20:00:00+09:00');

// Synthetic input only. No network, authentication or real publication.
function item(product = '베베숲 물티슈 70매 캡 20팩', price = 23900) {
  const sourceUrl = 'https://shop.example.test/product';
  return {
    id: 'synthetic-work-test',
    type: 'hotdeal',
    board: '🎁 핫딜 정보',
    sourceUrl,
    buyUrl: sourceUrl,
    price,
    trustScore: 96,
    expiresAt: '2026-10-26T23:59:00+09:00',
    verification: { status: 'verified', observedAt: now.toISOString() },
    copyContext: {
      kind: 'hotdeal',
      currentOffer: true,
      product,
      price,
      category: '생필품',
      merchant: '가상판매처',
      referencePrice: 34130,
      referenceLabel: '판매처 할인 전 표시가',
      saving: 34130 - price,
      buyUrl: sourceUrl,
      shipping: '기본배송 무료 (제주·도서산간 조건 별도)',
      delivery: { total: price },
      requiredConditions: ['즉시할인가 · 카드할인·적립금 제외', '행사 종료 10/26 23:59'],
      claims: [
        { verified: true, sourceUrl, value: price },
        { verified: true, sourceUrl, value: 34130 }
      ],
      returnReason: '생활비 정보 확인'
    }
  };
}

const draft = x => selectCommunityCopy(x, [], 'daangn');
const snapshot = x => ({
  title: x.postTitle,
  body: x.postBody,
  board: x.board,
  images: [],
  postUrl: 'https://cafe.daangn.com/test/posts/test',
  datePublished: '2026-10-14T11:00:00Z',
  errors: []
});
const savedOptions = {
  postUrl: 'https://cafe.daangn.com/test/posts/test',
  submissionStartedAt: '2026-10-14T10:59:59Z',
  expectedImageCount: 0,
  now
};

test('WORK-01 renders complete price and passes actual required-condition QA', () => {
  const x = draft(item());
  assert.equal(x.copyRejected, false);
  assert.ok(x.postTitle.length <= 50);
  assert.ok(x.postTitle.includes('23,900원'));
  assert.deepEqual(growthCopyFailures(x, x), []);
  assert.deepEqual(runtimeDraftFailures(x, { now }), []);
});

test('WORK-02 long rice bundle keeps both flavors, quantities and full price', () => {
  const candidates = renderCommunityCandidates(item('한우물 새우 볶음밥 250g x 5개 + 한우물 김치 볶음밥 250g x 5개', 14900));
  assert.ok(candidates.length);
  for (const candidate of candidates) {
    assert.ok(candidate.postTitle.length <= 50);
    assert.ok(candidate.postTitle.includes('새우5개+김치5개'));
    assert.ok(candidate.postTitle.includes('14,900원'));
  }
});

test('WORK-03 conditional gift is separated from basic pack', () => {
  const candidates = renderCommunityCandidates(item('바세린 핸드크림 60ml 5개 (5세트 구매시 1세트더 증정)', 5780));
  assert.ok(candidates.length);
  for (const candidate of candidates) {
    assert.ok(candidate.postTitle.includes('5개'));
    assert.ok(!/5세트|1세트/.test(candidate.postTitle));
    assert.ok(candidate.postBody.includes('5세트 구매시 1세트더 증정'));
  }
});

test('WORK-04 unreducible identity is held rather than cut', () => {
  const x = item('제품모델명'.repeat(35) + ' 60ml 2개');
  assert.equal(renderCommunityCandidates(x).length, 0);
  assert.equal(draft(x).copyRejected, true);
});

test('WORK-05 every coupon title keeps full amount and coupon condition', () => {
  const x = item();
  x.copyContext.coupon = true;
  const candidates = renderCommunityCandidates(x);
  assert.ok(candidates.length);
  assert.ok(candidates.every(candidate => candidate.postTitle.includes('쿠폰가') && candidate.postTitle.includes('23,900원')));
});

test('WORK-06 public label changes without altering source condition', () => {
  const x = item();
  const raw = structuredClone(x.copyContext.requiredConditions);
  for (const candidate of renderCommunityCandidates(x)) {
    assert.ok(candidate.postBody.includes('할인 기한: 10/26 23:59'));
    assert.deepEqual(growthCopyFailures(x, candidate), []);
  }
  assert.deepEqual(x.copyContext.requiredConditions, raw);
});

test('WORK-07 omitting deadline still fails despite label normalization', () => {
  const x = draft(item());
  const changed = { ...x, postBody: x.postBody.replace('할인 기한: 10/26 23:59', '') };
  assert.ok(growthCopyFailures(x, changed).includes('condition_omitted'));
});

test('WORK-08 deleted disclaimer is not reinserted or promoted to lowest-price claim', () => {
  const x = publicDealBody('가격을 비교했습니다. 다른 판매처의 최저가를 확인한 정보는 아닙니다.');
  assert.equal(x, '가격을 비교했습니다.');
  assert.ok(!draft(item()).postBody.includes('다른 판매처의 최저가'));
});

test('WORK-09 formatting keeps dates and application labels', () => {
  assert.equal(publicCondition('기재된 기한: 2026-10-26 23:59 (한국 시간)'), '할인 기한: 2026-10-26 23:59 (한국 시간)');
  assert.equal(publicCondition('신청 기간: 2026-10-26'), '신청 기간: 2026-10-26');
});

test('WORK-10 null delivery total never renders as zero', () => {
  assert.equal(dealPriceFacts({ ...item().copyContext, delivery: { total: null } }).deliveryLine, '');
});

test('WORK-11 date-only past expiry uses plan clock with no invented time', () => {
  const x = item();
  x.expiresAt = '20261013';
  assert.ok(planItem(x, config, now).reasons.includes('expired'));
  const deadline = deadlineInfo(x.expiresAt, now);
  assert.equal(deadline.timestamp, null);
  assert.equal(deadline.state, 'deadline_passed');
});

test('WORK-12 date-only future deadline remains time-unverified', () => {
  const x = item();
  x.expiresAt = '20261026';
  assert.ok(planItem(x, config, now).reasons.includes('invalid_expiry'));
  assert.equal(deadlineInfo(x.expiresAt, now).state, 'time_unverified');
});

test('WORK-13 invalid calendar date and ambiguous timezone fail', () => {
  assert.equal(deadlineInfo('2026-02-30', now).state, 'invalid');
  assert.equal(deadlineInfo('2026-10-26T23:59:00', now).state, 'invalid');
});

test('WORK-14 editor truncation fails before submission', () => {
  const x = draft(item());
  assert.equal(verifyEditorTitle(x.postTitle, x.postTitle.slice(0, 12), 12).ok, false);
  assert.equal(verifyEditorTitle(x.postTitle, x.postTitle, 50).ok, true);
});

test('WORK-15 saved complete title/body/board/identity/time can pass', () => {
  const x = draft(item());
  assert.equal(verifyPublishedSnapshot(x, snapshot(x), savedOptions).status, 'published');
});

test('WORK-16 saved numeric truncation is publish_unknown', () => {
  const x = draft(item());
  const result = verifyPublishedSnapshot(x, { ...snapshot(x), title: '물티슈 · 23,9' }, savedOptions);
  assert.equal(result.status, 'publish_unknown');
  assert.ok(result.errors.includes('SAVED_TITLE_MISMATCH'));
});

test('WORK-17 missing body condition fails saved verification', () => {
  const x = draft(item());
  assert.ok(verifyPublishedSnapshot(x, { ...snapshot(x), body: '다른 본문' }, savedOptions).errors.includes('SAVED_BODY_MISMATCH'));
});

test('WORK-18 wrong board/image count does not count as successful', () => {
  const x = draft(item());
  const result = verifyPublishedSnapshot(x, { ...snapshot(x), board: '자유 게시판', images: ['unexpected'] }, savedOptions);
  assert.ok(result.errors.includes('SAVED_BOARD_MISMATCH'));
  assert.ok(result.errors.includes('SAVED_IMAGE_COUNT_MISMATCH'));
});

test('WORK-19 old same-title post and wrong post URL cannot confirm current request', () => {
  const x = draft(item());
  const result = verifyPublishedSnapshot(x, {
    ...snapshot(x),
    postUrl: 'https://cafe.daangn.com/test/posts/old',
    datePublished: '2026-10-13T11:00:00Z'
  }, savedOptions);
  assert.ok(result.errors.includes('SAVED_POST_IDENTITY_MISMATCH'));
  assert.ok(result.errors.includes('SAVED_PUBLICATION_TIME_UNVERIFIED'));
});

test('WORK-20 readback mismatch locks original reservation against retry', async () => {
  const x = draft(item());
  const journal = {};
  let calls = 0;
  const options = {
    item: x,
    key: 'one-key',
    slot: 'first',
    journal,
    persist: async () => {},
    publish: async () => {
      calls += 1;
      return { status: 'publish_unknown', reason: 'SAVED_TITLE_MISMATCH' };
    },
    now: () => now
  };
  assert.equal((await runReservedPublish(options)).status, 'publish_unknown');
  assert.equal((await runReservedPublish({ ...options, slot: 'second' })).status, 'blocked_reservation');
  assert.equal(calls, 1);
});

test('WORK-21 reservation save failure means no publication', async () => {
  let calls = 0;
  await assert.rejects(() => runReservedPublish({
    item: draft(item()),
    key: 'k',
    slot: 's',
    journal: {},
    persist: async () => { throw new Error('simulated disk failure'); },
    publish: async () => { calls += 1; }
  }));
  assert.equal(calls, 0);
});

test('WORK-22 lifecycle queue distinguishes expired deadline from confirmed end', () => {
  const queue = buildLifecycleQueue([{
    status: 'published',
    title: 'fixture',
    postUrl: 'https://example.test/post',
    expiresAt: '2026-10-13T23:59:00+09:00'
  }], now);
  assert.equal(queue[0].state, 'deadline_passed');
});

test('WORK-23 real parser and readback validation compose without executing scripts', () => {
  const x = draft(item());
  const expected = snapshot(x);
  const article = {
    '@type': 'DiscussionForumPosting',
    headline: expected.title,
    text: expected.body,
    image: [],
    url: expected.postUrl,
    datePublished: expected.datePublished
  };
  const event = ['$', null, null, {
    event: 'web_shown_communityCafe_cafePostDetail',
    params: { cafeSlug: 'test', postTitle: x.postTitle, boardName: x.board }
  }];
  const html = '<script type="application/ld+json">' + JSON.stringify(article) + '</script>' +
    '<script>self.__next_f.push(' + JSON.stringify([1, '1:' + JSON.stringify(event) + '\n']) + ')</script>';
  assert.equal(verifyPublishedSnapshot(x, parsePublicPostEvidence(html, { cafeSlug: 'test' }), savedOptions).ok, true);
});

test('WORK-24 adaptive publishing preserves quality, mix and hard safety floors', () => {
  assert.equal(config.enabled, true);
  assert.equal(config.baseDailyTarget, 5);
  assert.equal(config.dailyMax, 8);
  assert.equal(config.commercialDailyMax, 4);
  assert.equal(config.utilityDailyTarget, 3);
  assert.equal(config.maxConsecutiveCommercial, 1);
  assert.equal(config.publishingMode, 'adaptive-quality');
  assert.deepEqual(config.slotHoursKst, [12, 14, 18, 20, 21, 22]);
  assert.deepEqual(config.utilitySlotHoursKst, [9, 11, 15, 17, 19]);
  assert.equal(config.minCopyQuality, 74);
  assert.equal(config.burstMinCopyQuality, 88);
  assert.equal(config.burstMinEditorialScore, 85);
  assert.equal(config.minPublishGapMinutes, 50);
});

// Minimal sanitized shape observed in the 2026-10-19 public post HTML. The
// creation-page DOM can have JSON-LD while lacking this full-document event.
const recoveryItem = {postTitle:'검증용 상품 · 23,900원',postBody:'상품가는 23,900원입니다.\n\n기본배송 무료.',board:'🎁 핫딜 정보',type:'hotdeal',sourceUrl:'https://shop.example.test/recovery',copyContext:{kind:'hotdeal',category:'생필품'}};
const recoveryUrl = 'https://cafe.daangn.com/don-akkineun-sa/posts/recovery-fixture';
const recoverySubmittedAt = '2026-10-19T06:10:00Z';
function recoveryHtml({includeEvent=true,board=recoveryItem.board,url=recoveryUrl,title=recoveryItem.postTitle,body=recoveryItem.postBody}={}) {
  const article={'@type':'DiscussionForumPosting',headline:title,text:body,image:[],url,datePublished:'2026-10-19T06:10:09Z'};
  const event=[['$','$L8a',null,{event:'web_shown_communityCafe_cafePostDetail',params:{cafeSlug:'don-akkineun-sa',postTitle:title,boardName:board}}]];
  // A UTF-8 byte-counted text row can end immediately before the next record.
  const text='가상 원문';
  const stream='7c:T'+Buffer.byteLength(text,'utf8').toString(16)+','+text+'7d:'+JSON.stringify(event)+'\n';
  return '<script type="application/ld+json">'+JSON.stringify(article)+'</script>'+(includeEvent?'<script>self.__next_f.push('+JSON.stringify([1,stream])+')</script>':'');
}
function recoveryPage(initial,full,{redirect=null,reloadError=false,fetchError=false,httpOk=true,initialUrl=recoveryUrl}={}) {
  const frame={},calls={navigations:[],requested:[],redirectsFollowed:[],fetchOptions:[],fulfilled:[],blocked:[],routeCalls:0,unroutes:0};
  let currentUrl=initialUrl,loaded=false,guard;
  const page={
    calls,url:()=>currentUrl,mainFrame:()=>frame,
    content:async()=>loaded?full:initial,
    waitForTimeout:async()=>{},
    route:async(pattern,handler)=>{guard=handler;},
    unroute:async()=>{guard=null;calls.unroutes+=1;},
    goto:async url=>{
      calls.navigations.push(url);
      if(reloadError)throw new Error('fixture reload error');
      let blocked=false,handled=false;
      const response=(target,status)=>({url:()=>target,status:()=>status,ok:()=>status>=200&&status<300,headers:()=>status===302?{location:redirect}:{}});
      let finalResponse=response(url,redirect?302:httpOk?200:503);
      const followRedirect=()=>{
        if(!redirect)return;
        // Playwright routes only the first request in an HTTP redirect chain.
        // Continuing or fulfilling a 302 follows Location without another guard.
        calls.redirectsFollowed.push(redirect);
        calls.requested.push(redirect);
        finalResponse=response(redirect,httpOk?200:503);
      };
      calls.routeCalls+=1;
      await guard({
        request:()=>({isNavigationRequest:()=>true,frame:()=>frame,url:()=>url}),
        abort:async()=>{blocked=true;calls.blocked.push(url);},
        continue:async()=>{handled=true;calls.requested.push(url);followRedirect();},
        fetch:async options=>{
          calls.fetchOptions.push({...options});
          calls.requested.push(url);
          if(fetchError)throw new Error('fixture fetch error');
          if(redirect&&options.maxRedirects!==0)followRedirect();
          return finalResponse;
        },
        fulfill:async({response:fetched})=>{
          handled=true;
          calls.fulfilled.push(fetched.status());
          finalResponse=fetched;
          if(fetched.status()===302)followRedirect();
        }
      });
      if(blocked)throw new Error('fixture navigation blocked');
      assert.equal(handled,true,'navigation must be continued or fulfilled');
      currentUrl=finalResponse.url();
      loaded=true;
      return finalResponse;
    }
  };
  return page;
}

test('READBACK-01 unavailable board is not falsely reported as a different board', () => {
  const x=draft(item());
  const check=verifyPublishedSnapshot(x,{...snapshot(x),board:null,errors:['PUBLIC_BOARD_UNVERIFIED']},savedOptions);
  assert.equal(check.status,'publish_unknown');
  assert.ok(check.errors.includes('SAVED_BOARD_UNVERIFIED'));
  assert.ok(!check.errors.includes('SAVED_BOARD_MISMATCH'));
  assert.equal(check.evidence.expectedBoard,x.board);
  assert.equal(check.evidence.observedBoard,null);
});

test('READBACK-02 observed full-document event identifies the matching board', () => {
  const parsed=parsePublicPostEvidence(recoveryHtml(),{cafeSlug:'don-akkineun-sa'});
  assert.equal(parsed.board,recoveryItem.board);
  assert.deepEqual(parsed.errors,[]);
  assert.equal(parsed.diagnostics.matchingDetailEventCount,1);
  assert.equal(parsed.diagnostics.distinctBoardCount,1);
});

test('READBACK-03 missing SPA event gets one read-only full navigation and all checks pass', async () => {
  const page=recoveryPage(recoveryHtml({includeEvent:false}),recoveryHtml());
  const result=await readSavedResult(page,recoveryItem,recoveryUrl,recoveryItem.board,false,recoverySubmittedAt);
  assert.equal(result.status,'published');
  assert.deepEqual(page.calls.navigations,[recoveryUrl]);
  assert.deepEqual(page.calls.requested,[recoveryUrl]);
  assert.equal(page.calls.fetchOptions[0].maxRedirects,0);
  assert.deepEqual(page.calls.fulfilled,[200]);
  assert.equal(result.savedVerification.evidence.navigationSource,'full_navigation');
  assert.equal(page.calls.unroutes,1);
});

test('READBACK-04 full document still missing board remains unknown', async () => {
  const html=recoveryHtml({includeEvent:false});
  const page=recoveryPage(html,html);
  const result=await readSavedResult(page,recoveryItem,recoveryUrl,recoveryItem.board,false,recoverySubmittedAt);
  assert.equal(result.status,'publish_unknown');
  assert.ok(result.savedVerification.errors.includes('SAVED_BOARD_UNVERIFIED'));
  assert.equal(result.board,null);
  assert.equal(result.selectedBoard,recoveryItem.board);
});

test('READBACK-05 real wrong board, title, body and identity still fail after navigation', async () => {
  for(const [changed,error] of [[{board:'자유 게시판'},'SAVED_BOARD_MISMATCH'],[{title:'다른 제목'},'SAVED_TITLE_MISMATCH'],[{body:'23,9'},'SAVED_BODY_MISMATCH'],[{url:recoveryUrl+'-other'},'SAVED_POST_IDENTITY_MISMATCH']]) {
    const page=recoveryPage(recoveryHtml({includeEvent:false}),recoveryHtml(changed));
    const result=await readSavedResult(page,recoveryItem,recoveryUrl,recoveryItem.board,false,recoverySubmittedAt);
    assert.equal(result.status,'publish_unknown');
    assert.ok(result.savedVerification.errors.includes(error));
  }
});

test('READBACK-06 foreign origin, another cafe and malformed post URL never navigate', async () => {
  for(const url of ['https://example.test/don-akkineun-sa/posts/x','https://cafe.daangn.com/another-cafe/posts/x','https://cafe.daangn.com/don-akkineun-sa/posts/x%2Fy','not a URL']) {
    const page=recoveryPage(recoveryHtml(),recoveryHtml());
    const result=await readSavedResult(page,recoveryItem,url,recoveryItem.board,false,recoverySubmittedAt);
    assert.equal(result.status,'publish_unknown');
    assert.ok(result.savedVerification.errors.includes('SAVED_POST_URL_UNTRUSTED'));
    assert.equal(page.calls.navigations.length,0);
  }
});

test('READBACK-07 HTTP redirects are blocked without following Location or relying on a second route callback', async () => {
  for(const redirect of ['https://example.test/redirect','https://cafe.daangn.com/another-cafe/posts/x',recoveryUrl+'-other']) {
    const page=recoveryPage(recoveryHtml({includeEvent:false}),recoveryHtml(),{redirect});
    const result=await readSavedResult(page,recoveryItem,recoveryUrl,recoveryItem.board,false,recoverySubmittedAt);
    assert.equal(result.status,'publish_unknown');
    assert.deepEqual(page.calls.requested,[recoveryUrl]);
    assert.deepEqual(page.calls.redirectsFollowed,[]);
    assert.deepEqual(page.calls.fulfilled,[]);
    assert.deepEqual(page.calls.blocked,[recoveryUrl]);
    assert.equal(page.calls.routeCalls,1);
    assert.equal(page.calls.fetchOptions[0].maxRedirects,0);
    assert.ok(result.savedVerification.errors.includes('SAVED_POST_REDIRECT_BLOCKED'));
  }
});

test('READBACK-08 failed reload and HTTP failure preserve unknown', async () => {
  for(const options of [{reloadError:true},{fetchError:true},{httpOk:false}]) {
    const page=recoveryPage(recoveryHtml({includeEvent:false}),recoveryHtml(),options);
    const result=await readSavedResult(page,recoveryItem,recoveryUrl,recoveryItem.board,false,recoverySubmittedAt);
    assert.equal(result.status,'publish_unknown');
    assert.equal(page.calls.navigations.length,1);
    assert.deepEqual(page.calls.fulfilled,[]);
  }
});

test('READBACK-13 a discovered post is checked from the home page before any candidate navigation', async () => {
  const homeUrl='https://cafe.daangn.com/don-akkineun-sa';
  const page=recoveryPage('<html>카페 글 목록</html>',recoveryHtml(),{initialUrl:homeUrl});
  const result=await readSavedResult(page,recoveryItem,recoveryUrl,recoveryItem.board,false,recoverySubmittedAt);
  assert.equal(result.status,'published');
  assert.deepEqual(page.calls.navigations,[recoveryUrl]);
  assert.deepEqual(page.calls.requested,[recoveryUrl]);
  for(const found of ['https://example.test/posts/same-title','https://cafe.daangn.com/another-cafe/posts/same-title']) {
    const untrusted=recoveryPage('<html>카페 글 목록</html>',recoveryHtml(),{initialUrl:homeUrl});
    const rejected=await readSavedResult(untrusted,recoveryItem,found,recoveryItem.board,false,recoverySubmittedAt);
    assert.equal(rejected.status,'publish_unknown');
    assert.ok(rejected.savedVerification.errors.includes('SAVED_POST_URL_UNTRUSTED'));
    assert.deepEqual(untrusted.calls.navigations,[]);
    assert.deepEqual(untrusted.calls.requested,[]);
  }
});

test('READBACK-09 expected content is durable before submission and unknown verification is retained', async () => {
  const x={...structuredClone(recoveryItem),authToken:'never persist',copyMeta:{contentIdentity:'stable-content-fixture',managedSurface:true,surfaceFamily:'deal-1',frameSignature:'price-mid-link',authToken:'never persist'}};
  const journal={},persisted=[];
  const result=await runReservedPublish({item:x,key:'recovery-key',slot:'recovery-slot',journal,persist:async()=>persisted.push(structuredClone(journal)),publish:async()=>{
    assert.equal(persisted[0]['recovery-slot'].status,'publishing');
    assert.equal(persisted[0]['recovery-slot'].expectedSnapshot.body,x.postBody);
    return {status:'publish_unknown',postUrl:recoveryUrl,imageAttached:false,reason:'SAVED_BOARD_UNVERIFIED',savedVerification:{ok:false,status:'publish_unknown',errors:['SAVED_BOARD_UNVERIFIED'],authToken:'never persist',evidence:{expectedBoard:x.board,observedBoard:null,authToken:'never persist'}}};
  },now:()=>new Date(recoverySubmittedAt)});
  const stored=journal['recovery-slot'];
  assert.equal(result.status,'publish_unknown');
  assert.equal(stored.expectedSnapshot.contentSha256,createHash('sha256').update(JSON.stringify({title:x.postTitle,body:x.postBody,board:x.board}),'utf8').digest('hex'));
  assert.equal(stored.expectedSnapshot.copyMeta.managedSurface,true);
  assert.equal(stored.expectedSnapshot.copyMeta.contentIdentity,'stable-content-fixture');
  assert.deepEqual(stored.savedVerification.errors,['SAVED_BOARD_UNVERIFIED']);
  assert.equal(stored.savedVerification.evidence.observedBoard,null);
  assert.ok(!JSON.stringify(stored).includes('never persist'));
  assert.equal(stored.record,undefined);
  const before=JSON.stringify(journal);
  assert.equal((await runReservedPublish({item:x,key:'recovery-key',slot:'another',journal,persist:async()=>{},publish:async()=>{throw new Error('must not republish');}})).status,'blocked_reservation');
  assert.equal(JSON.stringify(journal),before);
});

test('READBACK-10 submission history deduplicates confirmed index and ledger without promoting unknown', () => {
  const confirmed={status:'published',title:'confirmed',postUrl:recoveryUrl,idempotencyKey:'confirmed-key',publishedAt:'2026-10-18T03:00:00Z'};
  const ledger={confirmed:{status:'published',key:'confirmed-key',postUrl:recoveryUrl,record:confirmed},unknown:{status:'publish_unknown',key:'unknown-key',postUrl:recoveryUrl+'-unknown',title:'unknown',startedAt:'2026-10-19T03:00:00Z',expectedSnapshot:{title:'unknown',body:'retained body',type:'hotdeal',contentKind:'hotdeal',category:'생필품',copyMeta:{managedSurface:true,surfaceFamily:'deal-2'}}}};
  const before=JSON.stringify({confirmed,ledger});
  const rows=submissionHistory([confirmed],ledger);
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(x=>x.status),['published','publish_unknown']);
  assert.equal(rows[1].publishedAt,undefined);
  assert.equal(rows[1].submittedAt,'2026-10-19T03:00:00Z');
  assert.equal(rows[1].bodyText,'retained body');
  assert.equal(rows[1].copyMeta.managedSurface,true);
  rows[1].copyMeta.surfaceFamily='changed local view';
  assert.equal(JSON.stringify({confirmed,ledger}),before);
});

test('READBACK-11 legacy and undated reservations keep unknown fields unknown', () => {
  const rows=submissionHistory([],{legacy:{status:'publish_unknown',title:'legacy title',sourceUrl:'https://shop.example.test/legacy',finishedAt:'2026-10-19T06:00:00Z'},active:{status:'publishing',key:'active-key',startedAt:'invalid'},skipped:{status:'quality_or_category_skip',finishedAt:'2026-10-19T07:00:00Z'}});
  assert.equal(rows.length,2);
  assert.equal(rows[0].type,undefined);
  assert.equal(rows[0].contentKind,undefined);
  assert.equal(rows[0].bodyText,undefined);
  assert.equal(rows[0].publishedAt,undefined);
  assert.equal(rows[1].status,'publishing');
  assert.equal(rows[1].submittedAt,null);
});

test('READBACK-12 URL normalization and reservation aliases avoid duplicates but distinct actual URLs remain counted', () => {
  const confirmed={status:'published',postUrl:recoveryUrl+'?from=share',publishedAt:'2026-10-18T03:00:00Z'};
  const rows=submissionHistory([confirmed],{
    first:{status:'publish_unknown',postUrl:recoveryUrl,key:'shared',startedAt:'2026-10-18T03:00:00Z'},
    alias:{status:'publishing',key:'shared',startedAt:'2026-10-18T03:00:00Z'},
    distinct:{status:'publish_unknown',postUrl:recoveryUrl+'-different',key:'shared',startedAt:'2026-10-19T03:00:00Z'}
  });
  assert.equal(rows.length,2);
  assert.equal(rows[0].status,'published');
  assert.equal(rows[1].status,'publish_unknown');
});
