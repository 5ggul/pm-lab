import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {applySearchEditorialContext,stripSearchEditorialContext,searchEditorialMetadata,SEARCH_EDITORIAL_ROUTES} from './search-editorial-context.mjs';
import {searchEditorialNotes} from './search-editorial-notes.mjs';

const root=new URL('../',import.meta.url);
const read=route=>fs.readFileSync(new URL(route,root),'utf8');
const main=html=>html.match(/<main\b[\s\S]*?<\/main>/)?.[0];
const protectedTags=html=>[...html.matchAll(/<(?:link\b[^>]*rel="canonical"|meta\b[^>]*name="robots")[^>]*>|<script\b[\s\S]*?<\/script>/gi)].map(match=>match[0]);

test('reviewed interpretations leave all existing results, controls and schemas intact',()=>{
  assert.equal(SEARCH_EDITORIAL_ROUTES.length,16);
  assert.deepEqual(new Set(SEARCH_EDITORIAL_ROUTES),new Set(Object.keys(searchEditorialNotes)));
  for(const route of SEARCH_EDITORIAL_ROUTES){
    const before=stripSearchEditorialContext(read(route));
    const after=applySearchEditorialContext(before,route);
    assert.equal(main(stripSearchEditorialContext(after)),main(before),route+' calculator and existing body unchanged');
    assert.deepEqual(protectedTags(after),protectedTags(before),route+' policies and scripts unchanged');
    assert.equal((after.match(/id="search-editorial-context"/g)||[]).length,1,route);
    assert.equal(applySearchEditorialContext(after,route),after,route+' repeated generation');
    assert.equal((after.match(/<h1\b/g)||[]).length,(before.match(/<h1\b/g)||[]).length,route+' heading hierarchy');
  }
});

test('head metadata agrees without touching ownership verification or indexing',()=>{
  for(const route of SEARCH_EDITORIAL_ROUTES){
    const html=applySearchEditorialContext(read(route),route),meta=searchEditorialMetadata[route];
    const title=html.match(/<title>([\s\S]*?)<\/title>/)[1];
    assert.equal(title,meta.title+' | 픽마이카');
    assert.equal((html.match(/property="og:title"/g)||[]).length,1,route);
    assert.equal((html.match(/property="og:description"/g)||[]).length,1,route);
    assert(html.includes(`property="og:title" content="${title}"`));
    assert(html.includes(`property="og:description" content="${meta.description}"`));
    assert.equal(html.match(/<meta\b(?=[^>]*name="description")[^>]*content="([^"]*)"/)?.[1],meta.description);
    assert(meta.description.length>=25&&meta.description.length<=120);
    assert(!title.includes('유지비'));
  }
  for(const route of ['index.html','cars/index.html','cars/hyundai/grandeur-gn7/automobile-tax/index.html','cars/hyundai/grandeur-gn7/2-5-gasoline/automobile-tax/index.html','cars/hyundai/grandeur-gn7/3-5-gasoline/automobile-tax/index.html','cars/hyundai/grandeur-gn7/hybrid/automobile-tax/index.html']){
    const html=read(route);assert.equal(applySearchEditorialContext(html,route),html,route+' is outside content scope');
  }
});

test('links resolve to existing pages and the prose never duplicates live numeric results',()=>{
  const paragraphs=[];
  for(const [route,note] of Object.entries(searchEditorialNotes)){
    assert(note.links.length<=3);
    for(const link of note.links){assert(fs.existsSync(new URL(link.path.slice(1)+'index.html',root)),route+' '+link.path);}
    for(const section of note.sections)for(const paragraph of section.paragraphs){
      assert.doesNotMatch(paragraph,/[0-9][0-9,.]*\s*(?:원|만원|km\/L|km\/kWh)|20\d{2}[.-]\d{2}[.-]\d{2}/,route+' stale quantitative prose');
      assert.doesNotMatch(paragraph,/실연비는|오너들은|역대급|검수 상태|숫자를 읽는 기준/);
      if(paragraph.length>=80){assert(!paragraphs.includes(paragraph),route+' duplicated long paragraph');paragraphs.push(paragraph);}
    }
  }
});

test('the compared wheel conditions come from the reviewed comparison payload',()=>{
  const html=read('compare/grandeur-vs-k8/index.html');
  const data=JSON.parse(html.match(/<script\b[^>]*id="decision-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const pair=data.pairs.find(pair=>pair.slug==='grandeur-vs-k8');
  assert(pair,'reviewed pair must be present');
  const catalog=JSON.parse(read('data/generated/catalog.json'));
  const get=(id,variant)=>catalog.cars.find(car=>car.id===id)?.variants.find(row=>row.id===variant);
  assert.equal(get(pair.a,pair.av)?.wheel,18);
  assert.equal(get(pair.b,pair.bv)?.wheel,17);
  const prose=JSON.stringify(searchEditorialNotes['compare/grandeur-vs-k8/index.html']);
  assert(prose.includes('18인치')&&prose.includes('17인치'));
});

test('the existing price freshness notice stays last after narrative insertion',()=>{
  const html='<html><head><title>원래 제목</title></head><body><main><form>기존 계산</form><div class="page-fuel-status-foot">갱신 기준</div></main></body></html>';
  const after=applySearchEditorialContext(html,'cars/kia/ev6/index.html');
  assert(after.indexOf('id="search-editorial-context"')<after.indexOf('<div class="page-fuel-status-foot">'));
  assert.equal(main(stripSearchEditorialContext(after)),main(html));
});
