import test from 'node:test';
import assert from 'node:assert/strict';
import {renderAnnualMileagePlanner} from './annual-mileage-page.mjs';
import {MILEAGE_FIELDS,calculateAnnualMileage} from '../assets/annual-mileage.js';
import {guides} from './utility-content.mjs';

test('published annual example adds unrounded annual components instead of a rounded monthly average',()=>{
  const guide=guides.find(g=>g.slug==='annual-mileage-estimate');
  const result=calculateAnnualMileage({oneWayKm:20,monthlyDays:21,weekendKm:80,extraAnnualKm:0});
  assert.equal(result.commuteAnnual,10080);
  assert.equal(result.weekendAnnual,4160);
  assert.equal(result.annual,14240);
  assert.match(guide.body,/10,080km/);assert.match(guide.body,/4,160km/);assert.match(guide.body,/14,240km/);
  assert.doesNotMatch(guide.body,/14,244/);
  assert.match(guide.body,/먼저 반올림/);
  assert.equal(guide.title,'연간 주행거리 계산기');
});

test('guide retains readable arithmetic and limits when JavaScript is unavailable',()=>{
  const html=renderAnnualMileagePlanner();
  const fallback=html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1];assert.ok(fallback);
  assert.match(fallback,/편도 출퇴근 거리 × 2 × 월평균 출근일 × 12/);
  assert.match(fallback,/주말 거리 × 52/);assert.match(fallback,/그 밖의 연간 거리/);
  assert.match(html,/겹치지 않게/);assert.match(html,/이미 입력한/);
  for(const field of Object.values(MILEAGE_FIELDS)){
    const input=[...html.matchAll(/<input\b[^>]+>/g)].map(m=>m[0]).find(tag=>tag.includes(`id="${field.id}"`));
    assert.ok(input);assert.ok(input.includes(`max="${field.max}"`));
  }
  assert.ok(html.includes('href="../../tools/annual-cost/"'));
  assert.ok(html.includes('href="../../tools/fuel-cost/"'));
  assert.ok(html.includes('href="../../tools/ev-charge-cost/"'));
});
