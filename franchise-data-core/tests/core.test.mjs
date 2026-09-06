import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCES, buildSourceStatus, normalizeCatalog, probeSbiz, statusToJavascript} from '../src/core.mjs';
import {extractPublicPreviewKey} from '../src/ftc-registry.mjs';

test('catalog metadata preserves license and modified date', () => {
  const out=normalizeCatalog({name:'상권 API',license:'이용허락범위 제한 없음',dateModified:'2026-08-14',encodingFormat:'JSON+XML',creator:{name:'소상공인시장진흥공단'}},SOURCES.sbiz);
  assert.equal(out.license,'이용허락범위 제한 없음');assert.equal(out.modifiedAt,'2026-08-14');assert.equal(out.availability,'METADATA_VERIFIED');
});

test('sbiz probe does not fail when secret is absent',async()=>{const out=await probeSbiz('');assert.equal(out.live,'KEY_REQUIRED')});

test('sbiz probe validates totalCount envelope',async()=>{const fetchImpl=async()=>new Response(JSON.stringify({body:{totalCount:123}}),{status:200,headers:{'content-type':'application/json'}});const out=await probeSbiz('dummy-key',{fetchImpl});assert.equal(out.live,'LIVE_VERIFIED');assert.equal(out.sampleTotalCount,123)});

test('source status builds in metadata-only mode',async()=>{
 const fetchImpl=async url=>{const u=String(url);if(u.includes('15012005'))return new Response(JSON.stringify({name:'상권',license:'이용허락범위 제한 없음',dateModified:'2026-08-14',creator:{name:'소상공인시장진흥공단'}}),{status:200});if(u.includes('15157660'))return new Response(JSON.stringify({name:'가맹 업종',license:'이용허락범위 제한 없음',dateModified:'2026-06-18',creator:{name:'공정거래위원회'}}),{status:200});if(u.includes('fairdata.go.kr'))return new Response('<html>2026-09-03 2026-09-05</html>',{status:200});throw new Error(`unexpected url ${u}`)};
 const out=await buildSourceStatus({env:{},fetchImpl});assert.equal(out.dataMode,'METADATA_ONLY_READINESS');assert.equal(out.sources.find(x=>x.id==='sbiz').live,'KEY_REQUIRED');assert.equal(out.sources.find(x=>x.id==='ftcIndustry').license,'이용허락범위 제한 없음');assert.equal(out.sources.find(x=>x.id==='fairdata').latestPortalDate,'2026-09-05');
});

test('public preview key parser only extracts a labelled key',()=>{
 const key='AbCdEf0123456789+/AbCdEf0123456789+/AbCdEf0123456789+/AbCdEf0123456789+/AbCdEf0123==';
 assert.equal(extractPublicPreviewKey(`<script>const sampleKey = "${key}";</script>`),key);
 assert.equal(extractPublicPreviewKey('<html><body>no credential here</body></html>'),null);
});

test('status javascript is a classic-script global',()=>{const js=statusToJavascript({schemaVersion:1,sources:[]});assert.match(js,/globalThis\.SOURCE_STATUS=/)});
