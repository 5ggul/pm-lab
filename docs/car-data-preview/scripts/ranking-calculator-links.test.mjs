import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {applyHybridRankingCalculatorLinks} from './ranking-calculator-links.mjs';

const stripLinks = html => html.replace(/<a class="rank-calc-link"[^>]*>이 사양으로 계산<\/a>/g, '');
// The same source fixture may be read before or after the ranking generator ran.
// Remove only this helper's owned anchors; every other source byte stays in the baseline.
const original = stripLinks(fs.readFileSync(new URL('../rankings/hybrid-fuel-economy/index.html', import.meta.url), 'utf8'));
const realIndex = JSON.parse(fs.readFileSync(new URL('../data/generated/all-car-calc-index.json', import.meta.url), 'utf8'));
const originalArticles = [...original.matchAll(/<article class="rank-row"[\s\S]*?<\/article>/g)].map(match => match[0]);
const realArticle = originalArticles[0];
const realId = realArticle.match(/data-calc-id="([^"]+)"/)[1];
const realFamily = realArticle.match(/data-family-id="([^"]+)"/)[1];
const realRow = realIndex.rows.find(row => row.calc_id === realId);
const links = html => html.match(/<a class="rank-calc-link"[^>]*>이 사양으로 계산<\/a>/g) ?? [];

test('actual ranking rows link to their exact source IDs and otherwise remain byte-for-byte unchanged', () => {
  const result = applyHybridRankingCalculatorLinks(original, realIndex);
  let expected = 0;
  for (const article of originalArticles) {
    const id = article.match(/data-calc-id="([^"]+)"/)[1];
    const family = article.match(/data-family-id="([^"]+)"/)[1];
    const source = realIndex.rows.filter(row => row.calc_id === id);
    const eligible = source.length === 1 && source[0].family_id === family && source[0].powertrain === 'hybrid' && source[0].full_cost_ready === true;
    const rowResult = applyHybridRankingCalculatorLinks(article, realIndex);
    assert.equal(links(rowResult).length, eligible ? 1 : 0, id);
    if (eligible) {
      expected++;
      assert.ok(rowResult.includes(`href="../../tools/annual-cost/?mode=all&amp;calc=${encodeURIComponent(id)}"`), id);
      assert.match(rowResult, /이 사양으로 계산<\/a><\/div><div class="rank-value">/);
    }
  }
  assert.ok(expected > 0);
  assert.equal(links(result).length, expected);
  assert.equal(stripLinks(result), original);
  assert.equal(applyHybridRankingCalculatorLinks(result, realIndex), result);
});

test('missing, duplicated or mismatched calculation IDs never use family or model fallbacks', () => {
  const wrongId = {...realRow, calc_id: realId + '-different'};
  for (const index of [undefined, {}, {rows: []}, {rows: [wrongId]}, {rows: [realRow, {...realRow}]}, {rows: [realRow, {...realRow, family_id: 'another-family'}]}, {rows: [{...realRow, family_id: realFamily + '-different'}]}]) {
    assert.equal(applyHybridRankingCalculatorLinks(realArticle, index), realArticle);
  }
  for (const article of [realArticle.replace(`data-calc-id="${realId}"`, ''), realArticle.replace(`data-family-id="${realFamily}"`, ''), realArticle.replace(`data-calc-id="${realId}"`, 'data-calc-id=""'), realArticle.replace(`data-family-id="${realFamily}"`, 'data-family-id=""'), realArticle.replace(`data-calc-id="${realId}"`, `data-calc-id="${realId}" data-calc-id="${realId}"`), realArticle.replace(`data-family-id="${realFamily}"`, `data-family-id="${realFamily}" data-family-id="${realFamily}"`)]) {
    assert.equal(applyHybridRankingCalculatorLinks(article, realIndex), article);
  }
  assert.equal(applyHybridRankingCalculatorLinks(realArticle + realArticle, realIndex), realArticle + realArticle);
});

test('only hybrid rows with strict full-cost readiness receive links', () => {
  for (const row of [{...realRow, powertrain: 'gasoline'}, {...realRow, full_cost_ready: false}, {...realRow, full_cost_ready: 'true'}, {...realRow, full_cost_ready: undefined}]) {
    assert.equal(applyHybridRankingCalculatorLinks(realArticle, {rows: [row]}), realArticle);
  }
});

test('stale owned links are removed when their source becomes ineligible', () => {
  const linked = applyHybridRankingCalculatorLinks(realArticle, {rows: [realRow]});
  assert.equal(links(linked).length, 1);
  assert.equal(applyHybridRankingCalculatorLinks(linked, {rows: [{...realRow, full_cost_ready: false}]}), realArticle);
});

test('attribute entities are matched exactly and calculation URL values are encoded and HTML escaped', () => {
  const id = 'calc<&"\'';
  const family = 'family&"';
  const html = '<article class="rank-row extra" data-calc-id="calc&lt;&amp;&quot;&#39;" data-family-id="family&amp;&quot;"><div><h2>원래 차명</h2><p>17인치</p><a href="../../cars/existing/">상세 사양</a></div><div class="rank-value">15.7</div></article>';
  const result = applyHybridRankingCalculatorLinks(html, {rows: [{calc_id: id, family_id: family, powertrain: 'hybrid', full_cost_ready: true}]});
  assert.equal(stripLinks(result), html);
  assert.ok(result.includes(`href="../../tools/annual-cost/?mode=all&amp;calc=${encodeURIComponent(id).replaceAll("'", '&#39;')}"`));
  assert.equal(applyHybridRankingCalculatorLinks(result, {rows: [{calc_id: id, family_id: family, powertrain: 'hybrid', full_cost_ready: true}]}), result);
});

test('missing information containers and unrelated articles receive no inferred insertion', () => {
  const noInformation = realArticle.replace(/<h3>[\s\S]*?<\/h3>/, '차명');
  assert.equal(applyHybridRankingCalculatorLinks(noInformation, realIndex), noInformation);
  const unrelated = realArticle.replace('class="rank-row"', 'class="vehicle-card"');
  assert.equal(applyHybridRankingCalculatorLinks(unrelated, realIndex), unrelated);
});
