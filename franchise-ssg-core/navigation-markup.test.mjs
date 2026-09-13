import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {patchHeaderNavigation,NAV_ID} from './navigation-markup.mjs';
const fixture='<html><header class="site-header"><div class="header-inner"><a class="logo" href="/">홈</a><nav aria-label="주요 메뉴"><a href="/brands/">브랜드</a><a href="/tools/">계산기</a></nav><button class="nav-toggle" aria-label="메뉴 열기" aria-expanded="false">메뉴</button></div></header><main id="main">keep content</main></html>';
test('toggle precedes navigation in native keyboard order',()=>{
 const html=patchHeaderNavigation(fixture);
 assert.ok(html.indexOf('class="nav-toggle"')<html.indexOf('<nav '));
 assert.ok(html.includes(`aria-controls="${NAV_ID}"`));
 assert.ok(html.includes(`<nav aria-label="주요 메뉴" id="${NAV_ID}">`));
 assert.ok(html.includes('type="button"'));
});
test('preserves all links, visible labels and non-header content',()=>{
 const html=patchHeaderNavigation(fixture);
 assert.deepEqual([...html.matchAll(/<a[^>]*>.*?<\/a>/g)].map(x=>x[0]),[...fixture.matchAll(/<a[^>]*>.*?<\/a>/g)].map(x=>x[0]));
 assert.ok(html.endsWith('<main id="main">keep content</main></html>'));
 assert.ok(html.includes('>메뉴</button>'));
});
test('idempotent on already repaired markup',()=>{
 const html=patchHeaderNavigation(fixture);assert.equal(patchHeaderNavigation(html),html);
});
test('updates existing control attributes rather than duplicating them',()=>{
 const html=patchHeaderNavigation(fixture.replace('class="nav-toggle"','class="nav-toggle" type="submit" aria-controls="old"').replace('<nav ','<nav id="old" '));
 for(const attr of ['type="button"',`aria-controls="${NAV_ID}"`,`id="${NAV_ID}"`]) assert.equal(html.split(attr).length-1,1);
 assert.ok(!html.includes('"old"'));assert.ok(!html.includes('type="submit"'));
});
for(const [name,html] of [
 ['missing header','<main>empty</main>'],
 ['duplicate header',fixture+fixture],
 ['missing nav',fixture.replace(/<nav.*?<\/nav>/,'')],
 ['missing toggle',fixture.replace(/<button.*?<\/button>/,'')],
 ['duplicate toggle',fixture.replace('</header>','<button class="nav-toggle">duplicate</button></header>')],
 ['id collision',fixture.replace('id="main"',`id="${NAV_ID}"`)]] ) {
 test('rejects '+name,()=>assert.throws(()=>patchHeaderNavigation(html)));
}
test('actual app parses and includes keyboard/focus/responsive handling',()=>{
 const app=fs.readFileSync(new URL('./assets/app.js',import.meta.url),'utf8');new vm.Script(app);
 for(const text of ["event.key==='Escape'","'focusout'","'pointerdown'","'resize'","'pageshow'","toggle.focus()","메뉴 닫기"] )assert.ok(app.includes(text));
});
test('markup transform is wired into the existing generation stage',()=>{
 const code=fs.readFileSync(new URL('./run-generate-v11-43-control-ux.mjs',import.meta.url),'utf8');
 assert.ok(code.includes("import {patchHeaderNavigation} from './navigation-markup.mjs';"));
 assert.ok(code.includes('html=patchHeaderNavigation(patchBody(html));'));
});
