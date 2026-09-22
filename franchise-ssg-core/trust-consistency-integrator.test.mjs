import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {applyTrustConsistency,validateTrustConsistency} from './trust-consistency-integrator.mjs';

const robots='<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">';
const old='2026-09-12: 2025 기준 공식 스냅샷 11,724건을 확인했고 기존 170개 카탈로그 중 149개를 정확명 또는 수동검토 별칭으로 매칭했습니다. 0개는 미매칭, 0개는 명칭 중복 확인이 필요합니다.';
const oldDesc='브랜드별 창업비용·가맹점 수·평균매출·점포 변동에 사용하는 공정위·공공데이터포털 등 1차 출처와 기준연도를 안내합니다.';
function fixture(updateText=old,sourceDesc=oldDesc){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'trust-consistency-'));
  for(const dir of ['updates','methodology','sources','assets'])fs.mkdirSync(path.join(root,dir),{recursive:true});
  fs.writeFileSync(path.join(root,'assets/trust-consistency.css'),'/* test */');
  fs.writeFileSync(path.join(root,'updates/index.html'),`<html><head>${robots}</head><body><main><h1>데이터 변경 기록</h1><p>${updateText}</p></main></body></html>`);
  fs.writeFileSync(path.join(root,'methodology/index.html'),`<html><head>${robots}</head><body><main><div><article><h1>계산 기준</h1><p>기존 기준</p></article></div></main></body></html>`);
  fs.writeFileSync(path.join(root,'sources/index.html'),`<html><head>${robots}<meta name="description" content="${sourceDesc}"></head><body><main><div><article><h1>데이터</h1><section data-v47-source-funnel="1">카탈로그 170개 공식 매칭 149개 신뢰 게이트 136개</section></article></div></main></body></html>`);
  return root;
}

test('unit: contradictory zero-status copy is replaced and first-party evidence scope is published',()=>{
  const root=fixture();
  const result=applyTrustConsistency(root);assert.equal(result.changed,true);assert.equal(result.dataSemanticsChanged,false);assert.equal(result.operatorEvidenceBrands,12);
  const updates=fs.readFileSync(path.join(root,'updates/index.html'),'utf8');
  assert.ok(!updates.includes('0개는 미매칭'));for(const n of ['170','149','136'])assert.ok(updates.includes(n));
  const methodology=fs.readFileSync(path.join(root,'methodology/index.html'),'utf8');
  assert.equal((methodology.match(/data-v52-trust-gate-item=/g)||[]).length,3);assert.ok(methodology.includes('데이터 검수 단계'));assert.ok(!methodology.includes('DATA GATE'));
  assert.ok(methodology.includes('/sources/'));assert.ok(methodology.includes('/updates/'));assert.ok(methodology.includes('/disclaimer/'));
  const sources=fs.readFileSync(path.join(root,'sources/index.html'),'utf8');
  assert.equal((sources.match(/data-v52-operator-brand=/g)||[]).length,12);
  assert.ok(sources.includes('현재 본사 개설비 직접 검증 범위'));assert.ok(sources.includes('가맹본부 직접 확인'));assert.ok(!sources.includes('FIRST-PARTY COST EVIDENCE'));assert.ok(sources.includes('>12개<'));assert.ok(sources.includes('45일 이내'));
  assert.ok(sources.includes('2026-09-09 ~ 2026-09-17'));assert.ok(sources.includes('가맹본부 자체 공개 페이지'));
  const validated=validateTrustConsistency(root);assert.equal(validated.publicCandidates,136);assert.equal(validated.operatorEvidenceBrands,12);assert.equal(validated.operatorFreshnessGateDays,45);
});

test('unit: operator evidence summary exposes exact first-party links without ranking unlike bases',()=>{
  const root=fixture();applyTrustConsistency(root);const sources=fs.readFileSync(path.join(root,'sources/index.html'),'utf8');
  for(const token of ['메가MGC커피','빽다방','이디야커피','교촌치킨','굽네치킨','더벤티','한솥','프랭크버거','설빙','CU','GS25','이마트24'])assert.ok(sources.includes(token),token);
  for(const url of ['https://www.goobne.co.kr/brd/const/franchise','https://franchise.hsd.co.kr/magazine/?bmode=view&amp;idx=162572923','https://frankburger.co.kr/html/fran_3.html','https://sulbing.com/startup/guide/expense.php','https://emart24.co.kr/founded/model'])assert.ok(sources.includes(url),url);
  assert.ok(sources.includes('금액을 같은 기준의 순위로 재가공하지 않습니다'));
  assert.ok(sources.includes('확인일은 해당 공식 페이지를 직접 검수한 날짜'));
});

test('unit: postpass is byte-for-byte idempotent across methodology and sources',()=>{
  const root=fixture();applyTrustConsistency(root);
  const once=[fs.readFileSync(path.join(root,'methodology/index.html'),'utf8'),fs.readFileSync(path.join(root,'sources/index.html'),'utf8')];
  const result=applyTrustConsistency(root);
  const twice=[fs.readFileSync(path.join(root,'methodology/index.html'),'utf8'),fs.readFileSync(path.join(root,'sources/index.html'),'utf8')];
  assert.equal(result.changed,false);assert.deepEqual(once,twice);assert.equal((twice[0].match(/data-v52-trust-gate="1"/g)||[]).length,1);assert.equal((twice[1].match(/data-v52-operator-evidence="1"/g)||[]).length,1);
});

test('unit: an unknown updates baseline is not silently rewritten',()=>{
  const root=fixture('2026-09-12: 170개 중 일부를 확인했습니다.');
  assert.throws(()=>applyTrustConsistency(root),/baseline sentence changed/);
});

test('unit: an unknown sources metadata baseline is not silently rewritten',()=>{
  const root=fixture(old,'전혀 다른 설명');
  assert.throws(()=>applyTrustConsistency(root),/Sources meta description baseline changed/);
});

test('unit: explicit absolute preview root is required',()=>{
  assert.throws(()=>applyTrustConsistency('relative/path'),/absolute preview root/);
  assert.throws(()=>validateTrustConsistency('relative/path'),/absolute preview root/);
});
