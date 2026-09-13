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

// Reproduce the real-browser transition that exposed premature menu closing.
// Use the actual handler source with BODY temporarily focused during focusout.
function focusOutFixture() {
 const app=fs.readFileSync(new URL('./assets/app.js',import.meta.url),'utf8');
 const code=app.slice(app.indexOf("  header.addEventListener('focusout'"),app.indexOf("  document.addEventListener('pointerdown'"));
 const button={}, link={}, outside={}, timers=[], closes=[];let handler;
 const document={activeElement:outside};
 vm.runInNewContext(code,{header:{addEventListener:(type,fn)=>handler=fn,contains:el=>el===button||el===link},document,lastHeaderFocus:null,compact:()=>true,isOpen:()=>true,setOpen:value=>closes.push(value),setTimeout:fn=>timers.push(fn)});
 return {button,link,outside,document,handler,timers,closes};
}
test('focusout keeps the menu open when BODY is transiently active but next focus is an internal link',()=>{
 const f=focusOutFixture();f.handler({relatedTarget:f.link});assert.deepEqual(f.closes,[]);assert.equal(f.timers.length,0);
});
test('focusout closes when keyboard focus actually leaves the header',()=>{
 const f=focusOutFixture();f.handler({relatedTarget:f.outside});assert.deepEqual(f.closes,[false]);
});
test('null focus destination waits for focus to settle before deciding',()=>{
 const f=focusOutFixture();f.handler({relatedTarget:null});assert.deepEqual(f.closes,[]);assert.equal(f.timers.length,1);
 f.document.activeElement=f.link;f.timers[0]();assert.deepEqual(f.closes,[]);
 const g=focusOutFixture();g.handler({relatedTarget:null});g.timers[0]();assert.deepEqual(g.closes,[false]);
});

function resizeFixture(mode,activeKind,previousKind){
 const app=fs.readFileSync(new URL('./assets/app.js',import.meta.url),'utf8');
 const code=app.slice(app.indexOf("  addEventListener('resize'"),app.indexOf("  addEventListener('blur'"));
 const moved=[],body={},html={},outside={},link={focus:()=>moved.push('link')},toggle={focus:()=>moved.push('toggle')};
 const nodes={body,html,outside,link,toggle};let handler;
 vm.runInNewContext(code,{document:{body,documentElement:html,activeElement:nodes[activeKind]},lastHeaderFocus:nodes[previousKind],toggle,primaryNav:{contains:n=>n===link,querySelector:()=>link},compact:()=>mode==='mobile',isOpen:()=>false,setOpen:()=>{},addEventListener:(type,fn)=>handler=fn});
 handler();return moved;
}
test('resize restores mobile toggle after CSS already blurred its hidden link',()=>{
 assert.deepEqual(resizeFixture('mobile','body','link'),['toggle']);
});
test('resize restores desktop link after CSS already blurred its hidden toggle',()=>{
 assert.deepEqual(resizeFixture('desktop','body','toggle'),['link']);
});
test('resize never steals focus from an unrelated control',()=>{
 assert.deepEqual(resizeFixture('mobile','outside','link'),[]);
 assert.deepEqual(resizeFixture('desktop','outside','toggle'),[]);
});
