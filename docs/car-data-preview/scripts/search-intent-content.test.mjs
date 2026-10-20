import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {applySearchIntentContent} from './search-intent-content.mjs';

const routes = ['cars/kia/sorento-mq4/index.html', 'cars/hyundai/grandeur-gn7/hybrid/index.html', 'compare/sorento-vs-santafe/index.html'];
const readPage = route => fs.readFileSync(new URL('../' + route, import.meta.url), 'utf8');
const scripts = html => html.match(/<script\b[\s\S]*?<\/script>/gi) ?? [];
const preserved = html => ({
  scripts: scripts(html),
  robots: html.match(/<meta\b[^>]*name="robots"[^>]*>/gi),
  canonical: html.match(/<link\b[^>]*rel="canonical"[^>]*>/gi),
  photos: html.match(/<(?:picture|figure)\b[\s\S]*?<\/(?:picture|figure)>/gi),
  credits: html.match(/<span class="pilot-credit">[\s\S]*?<\/span>/gi),
  inputs: html.match(/<input\b[^>]*>/gi)
});

test('all three changes are idempotent and preserve calculation payloads, inputs, policy and photos', () => {
  for (const route of routes) {
    const before = readPage(route);
    const after = applySearchIntentContent(before, route);
    assert.equal(applySearchIntentContent(after, route), after, route);
    assert.deepEqual(preserved(after), preserved(before), route);
  }
});

test('Sorento renders only two exact reviewed hybrid conditions without changing the gasoline default', () => {
  const html = applySearchIntentContent(readPage(routes[0]), routes[0]);
  const block = html.match(/<!-- SEARCH:HYBRID:START -->([\s\S]*?)<!-- SEARCH:HYBRID:END -->/)[1];
  assert.match(block, /id="hybrid-efficiency"/);
  assert.match(block, /<h2[^>]*>쏘렌토 하이브리드 연비<\/h2>/);
  assert.match(block, /2WD · 17인치 · 5인승 · 빌트인캠 미적용<\/span><strong>15\.7 km\/L/);
  assert.match(block, /4WD · 17인치 · 5\/6\/7인승 · 빌트인캠 미적용<\/span><strong>13\.8 km\/L/);
  assert.equal((block.match(/class="row"/g) ?? []).length, 2);
  assert.match(block, /href="#variantButtons"/);
  assert.match(block, /href="\.\.\/\.\.\/\.\.\/compare\/sorento-vs-santafe\/"/);
  assert.match(html, /id="selectedLabel">2\.5 가솔린 터보 2WD 5\/6\/7인승 18인치/);
});

const sorentoHero = html => html.match(/<section\b[^>]*class="[^"]*\bmodel-lite-hero\b[^"]*"[^>]*>[\s\S]*?<\/section>/)?.[0] ?? '';
const removeHeroShortcut = html => html.replace(sorentoHero(html), sorentoHero(html).replace(/<a class="spec-action" href="#hybrid-efficiency">하이브리드 연비 보기<\/a>/g, ''));

test('Sorento adds one shortcut inside the hero while preserving the section nav and gasoline answer', () => {
  const before = removeHeroShortcut(readPage(routes[0]));
  const after = applySearchIntentContent(before, routes[0]);
  const hero = sorentoHero(after);
  assert.match(hero, /<\/p><a class="spec-action" href="#hybrid-efficiency">하이브리드 연비 보기<\/a><div class="model-metrics">/);
  assert.equal((hero.match(/href="#hybrid-efficiency"/g) ?? []).length, 1);
  const sectionNav = html => html.match(/<nav class="reference-section-nav"[\s\S]*?<\/nav>/)?.[0];
  assert.equal(sectionNav(after), sectionNav(before));
  const answer = html => html.match(/<p class="model-lite-answer">[\s\S]*?<\/p>/)?.[0];
  assert.equal(answer(after), answer(before));
  assert.match(hero, /id="selectedLabel">2\.5 가솔린 터보 2WD 5\/6\/7인승 18인치/);
  assert.deepEqual(preserved(after), preserved(before));
  assert.equal(applySearchIntentContent(after, routes[0]), after);
});

test('Sorento does not duplicate an existing hero hybrid link or invent an empty hero introduction', () => {
  const before = removeHeroShortcut(readPage(routes[0]));
  const hero = sorentoHero(before);
  const existing = before.replace(hero, hero.replace('</h1>', '</h1><a href="#hybrid-efficiency">기존 하이브리드 바로가기</a>'));
  const after = sorentoHero(applySearchIntentContent(existing, routes[0]));
  assert.equal((after.match(/href="#hybrid-efficiency"/g) ?? []).length, 1);
  assert.match(after, /기존 하이브리드 바로가기/);
  assert.doesNotMatch(after, />하이브리드 연비 보기<\/a>/);
  for (const intro of ['', '<p class="model-lite-answer"></p>']) {
    const emptyHero = `<html><body><main><section class="model-lite-hero"><div class="model-lite-copy">${intro}</div></section></main></body></html>`;
    assert.doesNotMatch(sorentoHero(applySearchIntentContent(emptyHero, routes[0])), /href="#hybrid-efficiency"/);
  }
  assert.equal(applySearchIntentContent('', routes[0]), '');
});

test('missing or invalid reviewed values do not create guessed readings', () => {
  for (const sorento of [null, {variants: null}, {variants: [null]}, {variants: []}, {variants: [{variant_id: 'mq4-hev16-2wd-17-0', fuel_type: 'hybrid', fuel_economy_combined: NaN}]}]) {
    const html = applySearchIntentContent(readPage(routes[0]), routes[0], {sorento});
    const block = html.match(/<!-- SEARCH:HYBRID:START -->([\s\S]*?)<!-- SEARCH:HYBRID:END -->/)[1];
    assert.doesNotMatch(block, /km\/L|NaN|undefined/);
    assert.match(block, /전체 사양 선택/);
  }
});

test('Grandeur keeps its title and official efficiency rows while adding a heading and precise links', () => {
  const before = readPage(routes[1]);
  const after = applySearchIntentContent(before, routes[1]);
  assert.equal(after.match(/<title>[\s\S]*?<\/title>/)[0], before.match(/<title>[\s\S]*?<\/title>/)[0]);
  const officialRows = html => (html.match(/<div class="row">[\s\S]*?<\/div>/g) ?? []).slice(0, 4);
  assert.deepEqual(officialRows(after), officialRows(before));
  assert.match(after, /<h2 id="hybrid-wheel-efficiency">그랜저 하이브리드 휠별 연비<\/h2>/);
  assert.match(after, /href="\.\.\/\.\.\/\.\.\/\.\.\/compare\/grandeur-gasoline-vs-hybrid\/"/);
  assert.match(after, /href="\.\/automobile-tax\/">그랜저 하이브리드 자동차세 기준/);
});

const costCatalog = (overrides = {}) => ({annualKm: 20000, taxYear: 2026, gasPrice: 1800, fuelPriceAsOf: '2026-10-19', cars: [{id: 'grandeur-gn7', variants: [{id: 'gn7-hev16-2wd-18', fuelType: 'hybrid', drive: '2WD', wheel: 18, cc: 1598, combined: 18}]}], ...overrides});
const grandeurGenericCta = html => html.replace(/<a class="spec-action" href="[^\"]*tools\/annual-cost\/[^\"]*">내 조건으로 계산<\/a>/, '<a href="../../../../compare/">다른 차량과 비교</a>');

test('Grandeur replaces one generic action with the exact reviewed hybrid calculator without adding actions', () => {
  const before = grandeurGenericCta(readPage(routes[1]));
  const after = applySearchIntentContent(before, routes[1], {catalog: costCatalog()});
  const href = after.match(/<a class="spec-action" href="([^"]+)">내 조건으로 계산<\/a>/)?.[1];
  assert(href);
  const target = new URL(href.replaceAll('&amp;', '&'), 'https://peekmycar.com/cars/hyundai/grandeur-gn7/hybrid/');
  assert.equal(target.pathname, '/tools/annual-cost/');
  assert.equal(target.searchParams.get('mode'), 'reviewed');
  assert.equal(target.searchParams.get('car'), 'grandeur-gn7');
  assert.equal(target.searchParams.get('variant'), 'gn7-hev16-2wd-18');
  assert.equal((after.match(/>내 조건으로 계산<\/a>/g) ?? []).length, 1);
  assert.equal((after.match(/<a\b/g) ?? []).length, (before.match(/<a\b/g) ?? []).length);
  assert.doesNotMatch(after, /href="\.\.\/\.\.\/\.\.\/\.\.\/compare\/">다른 차량과 비교/);
  assert.match(after, /href="\.\.\/\.\.\/\.\.\/\.\.\/compare\/grandeur-gasoline-vs-hybrid\/"/);
  assert.match(after, /href="\.\/automobile-tax\/">그랜저 하이브리드 자동차세 기준/);
  assert.deepEqual(preserved(after), preserved(before));
  assert.equal(applySearchIntentContent(after, routes[1], {catalog: costCatalog()}), after);
});

test('Grandeur keeps its generic action when the exact reviewed hybrid identity is missing', () => {
  const before = grandeurGenericCta(readPage(routes[1]));
  for (const data of [null, {}, {catalog: null}, {catalog: {cars: null}}, {catalog: {cars: [null]}}, {catalog: costCatalog({cars: [{id: 'grandeur-gn7', variants: [null]}]})}, {catalog: costCatalog({cars: [{id: 'grandeur-gn7', variants: [{id: 'gn7-hev16-2wd-18', fuelType: 'hybrid', drive: '4WD', wheel: 18, cc: 1598, combined: 18}]}]})}]) {
    const after = applySearchIntentContent(before, routes[1], data);
    assert.match(after, /href="\.\.\/\.\.\/\.\.\/\.\.\/compare\/">다른 차량과 비교/);
    assert.doesNotMatch(after, />내 조건으로 계산<\/a>/);
  }
  assert.equal(applySearchIntentContent('', routes[1], {}), '');
});

test('Grandeur uses current catalog distance, price and shared new-car tax rounding', () => {
  const before = readPage(routes[1]);
  const data = {catalog: costCatalog()};
  const after = applySearchIntentContent(before, routes[1], data);
  assert.match(after, /연 2만km 유류비 · 18인치<\/span><strong>2,000,000원/);
  assert.match(after, /세금 \+ 유류비 · 18인치<\/span><strong>2,290,836원/);
  assert.match(after, /오피넷 2026\.10\.19 전국 휘발유 평균 1,800\.00원\/L/);
  assert.equal(applySearchIntentContent(after, routes[1], data), after);
  const changed = applySearchIntentContent(before, routes[1], {catalog: costCatalog({annualKm: 10000, gasPrice: 1800.01, taxYear: 2027})});
  assert.match(changed, /연 10,000km 유류비 · 18인치<\/span><strong>1,000,006원/);
  assert.match(changed, /세금 \+ 유류비 · 18인치<\/span><strong>1,290,842원/);
  assert.deepEqual(preserved(after), preserved(before));
});

test('missing catalog or a mismatched hybrid variant never changes monetary rows or the fuel source', () => {
  const before = readPage(routes[1]);
  const moneyRows = html => (html.match(/<div class="row">[\s\S]*?<\/div>/g) ?? []).slice(4);
  const source = html => html.match(/<p class="source-line">유류비 가정:[\s\S]*?<\/p>/)[0];
  for (const data of [{}, {catalog: costCatalog({gasPrice: NaN})}, {catalog: costCatalog({cars: []})}, {catalog: costCatalog({cars: [{id: 'grandeur-gn7', variants: [{id: 'gn7-hev16-2wd-18', fuelType: 'hybrid', drive: '4WD', wheel: 18, cc: 1598, combined: 18}]}]})}]) {
    const after = applySearchIntentContent(before, routes[1], data);
    assert.deepEqual(moneyRows(after), moneyRows(before));
    assert.equal(source(after), source(before));
  }
});

test('Sorento versus Santa Fe metadata identifies the actual gasoline conditions', () => {
  const html = applySearchIntentContent(readPage(routes[2]), routes[2]);
  assert.match(html, /<title>쏘렌토 vs 싼타페 2\.5 가솔린 터보 비교 \| 픽마이카<\/title>/);
  assert.match(html, /name="description" content="2WD·18인치 기준 쏘렌토 MQ4와 싼타페 MX5/);
  assert.match(html, /싼타페 5·6인승 공시 사양입니다\./);
});

test('unrelated routes remain byte-for-byte unchanged', () => {
  const html = '<html><head><title>기존 제목</title></head><body><main>기존 본문</main></body></html>';
  assert.equal(applySearchIntentContent(html, 'cars/index.html'), html);
});
