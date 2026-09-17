import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {applyTrustConsistency,validateTrustConsistency} from './trust-consistency-integrator.mjs';

const robots='<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">';
const old='2026-09-12: 2025 기준 공식 스냅샷 11,724건을 확인했고 기존 170개 카탈로그 중 149개를 정확명 또는 수동검토 별칭으로 매칭했습니다. 0개는 미매칭, 0개는 명칭 중복 확인이 필요합니다.';
function fixture(updateText=old){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'trust-consistency-'));
  for(const dir of ['updates','methodology','sources','assets'])fs.mkdirSync(path.join(root,dir),{recursive:true});
  fs.writeFileSync(path.join(root,'assets/trust-consistency.css'),'/* test */');
  fs.writeFileSync(path.join(root,'updates/index.html'),`<html><head>${robots}</head><body><main><h1>데이터 변경 기록</h1><p>${updateText}</p></main></body></html>`);
  fs.writeFileSync(path.join(root,'methodology/index.html'),`<html><head>${robots}</head><body><main><article><h1>계산 기준</h1><p>기존 기준</p></article></main></body></html>`);
  fs.writeFileSync(path.join(root,'sources/index.html'),`<html><head>${robots}</head><body><main><h1>데이터</h1><section data-v47-source-funnel="1">카탈로그 170개 공식 매칭 149개 신뢰 게이트 136개</section></main></body></html>`);
  return root;
}

test('unit: contradictory zero-status copy is replaced by staged gate language',()=>{
  const root=fixture();
  const result=applyTrustConsistency(root);assert.equal(result.changed,true);assert.equal(result.dataSemanticsChanged,false);
  const updates=fs.readFileSync(path.join(root,'updates/index.html'),'utf8');
  assert.ok(!updates.includes('0개는 미매칭'));for(const n of ['170','149','136'])assert.ok(updates.includes(n));
  const methodology=fs.readFileSync(path.join(root,'methodology/index.html'),'utf8');
  assert.equal((methodology.match(/data-v52-trust-gate-item=/g)||[]).length,3);
  assert.ok(methodology.includes('/sources/'));assert.ok(methodology.includes('/updates/'));assert.ok(methodology.includes('/disclaimer/'));
  assert.equal(validateTrustConsistency(root).publicCandidates,136);
});

test('unit: postpass is idempotent',()=>{
  const root=fixture();applyTrustConsistency(root);const once=fs.readFileSync(path.join(root,'methodology/index.html'),'utf8');
  const result=applyTrustConsistency(root);const twice=fs.readFileSync(path.join(root,'methodology/index.html'),'utf8');
  assert.equal(result.changed,false);assert.equal(once,twice);assert.equal((twice.match(/data-v52-trust-gate="1"/g)||[]).length,1);
});

test('unit: an unknown updates baseline is not silently rewritten',()=>{
  const root=fixture('2026-09-12: 170개 중 일부를 확인했습니다.');
  assert.throws(()=>applyTrustConsistency(root),/baseline sentence changed/);
});

test('unit: explicit absolute preview root is required',()=>{
  assert.throws(()=>applyTrustConsistency('relative/path'),/absolute preview root/);
  assert.throws(()=>validateTrustConsistency('relative/path'),/absolute preview root/);
});
