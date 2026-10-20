import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {patchOfficialIssuesHtml, configForPage} from './patch-official-issues-links.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticPages = JSON.parse(fs.readFileSync(path.join(root, 'data/static-model-pages.json'), 'utf8')).records;
const hierarchy = JSON.parse(fs.readFileSync(path.join(root, 'data/generated/service-hierarchy.json'), 'utf8'));
const families = new Map(hierarchy.families.map(family => [family.family_id, family]));
const existingScripts = html => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(match => !/official-issues/.test(match[1])).map(match => match[0]);

test('detail patch is idempotent, preserves all calculation scripts and puts links after the recall section', () => {
  const input = fs.readFileSync(path.join(root, 'cars/hyundai/grandeur-gn7/index.html'), 'utf8');
  const config = configForPage('cars/hyundai/grandeur-gn7/index.html', input, staticPages, families);
  assert.equal(config.families[0].family_id, 'hyundai-grandeur');
  const result = patchOfficialIssuesHtml(input, config, '../../../');
  assert.equal(patchOfficialIssuesHtml(result, config, '../../../'), result);
  assert.deepEqual(existingScripts(result), existingScripts(input));
  assert.equal((result.match(/id="vehicle-issues"/g) || []).length, 1);
  assert.ok(result.indexOf('id="vehicle-issues"') > result.indexOf('id="recall"'));
  assert.match(result, /tab=reports&amp;family=hyundai-grandeur/);
  assert.equal(result.match(/<meta name="robots"[^>]*>/)[0], input.match(/<meta name="robots"[^>]*>/)[0]);
  assert.deepEqual(result.match(/<link\b[^>]*rel="stylesheet"[^>]*>/g), input.match(/<link\b[^>]*rel="stylesheet"[^>]*>/g));
});

test('legacy feature-owned recall styles are removed without injecting a page stylesheet', () => {
  const input = '<html><head><link rel="stylesheet" href="../../../assets/base.css"><link rel="stylesheet" href="../../../assets/recalls.css?v=old" data-official-issues-style></head><body><main></main></body></html>';
  const result = patchOfficialIssuesHtml(input, {kind:'static',families:[{family_id:'hyundai-grandeur',name:'그랜저'}]}, '../../../');
  assert.match(result, /href="\.\.\/\.\.\/\.\.\/assets\/base\.css"/);
  assert.doesNotMatch(result, /assets\/recalls\.css|data-official-issues-style/);
  assert.equal(patchOfficialIssuesHtml(result, {kind:'static',families:[{family_id:'hyundai-grandeur',name:'그랜저'}]}, '../../../'), result);
});

test('all 25 fixed pairs have exact reviewed family identities and keep original numeric and formula payloads', () => {
  let count = 0;
  for (const entry of fs.readdirSync(path.join(root, 'compare'), {withFileTypes:true}).filter(entry => entry.isDirectory())) {
    const file = path.join(root, 'compare', entry.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    const input = fs.readFileSync(file, 'utf8');
    const config = configForPage(`compare/${entry.name}/index.html`, input, staticPages, families);
    if (!config) continue;
    assert.equal(config.kind, 'pair');
    assert.equal(config.families.length, 2);
    assert.ok(config.families.every(family => families.has(family.family_id)));
    const result = patchOfficialIssuesHtml(input, config, '../../');
    assert.deepEqual(existingScripts(result), existingScripts(input));
    assert.equal(patchOfficialIssuesHtml(result, config, '../../'), result);
    count++;
  }
  assert.equal(count, 25);
});

test('maker hubs, unknown paths and ambiguous pairs are not assigned inferred families', () => {
  assert.equal(configForPage('cars/hyundai/index.html', '', staticPages, families), null);
  assert.equal(configForPage('cars/hyundai/not-reviewed/index.html', '', staticPages, families), null);
  const input = '<script id="decision-data">'+JSON.stringify({kind:'compare',pairs:[{left:{model:'그랜저'},right:{path:'cars/kia/k8-gl3/'}}]})+'</script>';
  assert.equal(configForPage('compare/unknown/index.html', input, staticPages, families), null);
});

const sample = {
  schema_version:1,
  sources:{reports:{available:true,period:{from:'2005-01-01',to:'2025-12-31'},provider_updated_at:'2026-05-07',checked_at:'2026-10-14T01:00:00Z'}},
  families:[
    {family_id:'hyundai-grandeur',name:'그랜저',match_status:'verified',report_count:6},
    {family_id:'kia-k8',name:'K8',match_status:'unmapped',report_count:0},
    {family_id:'kia-sorento',name:'쏘렌토',match_status:'verified',report_count:0}
  ]
};
async function runtime(config, search='', extra={}) {
  const host = {innerHTML:'fallback'};
  const handlers = {};
  const nodes = extra.nodes || {};
  const window = {addEventListener:(name,fn) => {handlers[name]=fn;},...extra.window};
  const context = {
    URL, URLSearchParams, queueMicrotask, location:{search}, window,
    document:{currentScript:{src:'http://localhost/car-data-preview/assets/vehicle-official-issues.js'},
      scripts:[],querySelector:selector => selector.includes('vehicle-official-issues-content') ? host : selector.includes('#compareTable') && extra.hasRows ? {} : null,
      getElementById:id => id==='official-issues-config' ? {textContent:JSON.stringify(config)} : nodes[id]},
    fetch:async () => ({ok:true,json:async () => extra.index || sample})
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/vehicle-official-issues.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  return {host,handlers,context};
}

test('unmapped and verified-zero families are distinguished and source dates do not claim current-generation rates', async () => {
  const result = await runtime({kind:'pair',families:[{family_id:'kia-k8',name:'K8'},{family_id:'kia-sorento',name:'쏘렌토'}]});
  assert.match(result.host.innerHTML, /차종명 연결을 검토 중/);
  assert.match(result.host.innerHTML, /공개자료에 연결된 신고 0건 · 차종 전체 기준/);
  assert.match(result.host.innerHTML, /2005-01-01~2025-12-31/);
  assert.doesNotMatch(result.host.innerHTML, /리콜 없음|고장률 0|결함 없음/);
});

test('custom comparison updates A/B links and clears previous cars on invalid/loading events', async () => {
  const result = await runtime({kind:'custom'}, '?fa=hyundai-grandeur&fb=kia-k8', {hasRows:true});
  assert.match(result.host.innerHTML, /A 그랜저/);
  assert.match(result.host.innerHTML, /B K8/);
  result.handlers['car:comparison']({detail:null});
  assert.doesNotMatch(result.host.innerHTML, /family=hyundai-grandeur|A 그랜저/);
  result.context.location.search='?fa=kia-sorento&fb=hyundai-grandeur';
  result.handlers['car:comparison']({detail:{}});
  assert.match(result.host.innerHTML, /A 쏘렌토/);
  assert.match(result.host.innerHTML, /B 그랜저/);
});

test('reviewed mode uses current catalog path identities rather than stale raw URL selections', async () => {
  const result = await runtime({kind:'custom',reviewed_paths:{'cars/kia/k8-gl3/':'kia-k8','cars/hyundai/grandeur-gn7/':'hyundai-grandeur'}}, '?fa=kia-sorento&fb=kia-sorento', {
    hasRows:true,nodes:{reviewedSelectors:{classList:{contains:() => false}},carA:{value:'k8-gl3'},carB:{value:'grandeur-gn7'}},
    window:{CAR_CATALOG:{byId:{'k8-gl3':{path:'./cars/kia/k8-gl3/'},'grandeur-gn7':{path:'./cars/hyundai/grandeur-gn7/'}}}}
  });
  assert.match(result.host.innerHTML, /A K8/);
  assert.match(result.host.innerHTML, /B 그랜저/);
  assert.doesNotMatch(result.host.innerHTML, /A 쏘렌토/);
});

test('family waits for the loader-resolved alias and does not use an unverified query ID', async () => {
  const result = await runtime({kind:'family'}, '?id=legacy-unverified');
  assert.match(result.host.innerHTML, /차종을 선택하면/);
  result.handlers['car-family-data-ready']();
  result.context.window.__carFamilyId='hyundai-grandeur';
  await new Promise(resolve => setImmediate(resolve));
  assert.match(result.host.innerHTML, /공개자료에 연결된 신고 6건/);
});
