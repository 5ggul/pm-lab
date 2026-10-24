import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const builder=fileURLToPath(new URL('./build-reference-design.mjs',import.meta.url));
const inline='<script>function render(gen){document.querySelector("#app").innerHTML=`<section class="spec-panel"><h2>제조사 추가 제원 없음</h2></section><section class="generation"><h2>${esc(gen.generation_label)}</h2></section>`;}</script>';
const shell=body=>'<!doctype html><html><head></head><body><header class="db-header"></header>'+body+'<footer></footer></body></html>';

test('family templates remain untouched while static pages keep real section anchors',()=>{
  const prefix=path.join(os.tmpdir(),'peekmycar-reference-family-');
  const root=fs.mkdtempSync(prefix);
  try{
    fs.mkdirSync(path.join(root,'scripts'),{recursive:true});fs.mkdirSync(path.join(root,'assets'));
    fs.copyFileSync(builder,path.join(root,'scripts/build-reference-design.mjs'));
    for(const name of ['reference-ui.css','reference-ui.js','page-design.css'])fs.writeFileSync(path.join(root,'assets',name),'/* fixture */');
    const family=path.join(root,'cars/family/index.html'),detail=path.join(root,'cars/example/index.html');
    fs.mkdirSync(path.dirname(family),{recursive:true});fs.mkdirSync(path.dirname(detail),{recursive:true});
    fs.writeFileSync(family,shell('<main><section><div id="app"></div></section><!-- REF:NAV:START --><nav class="reference-section-nav"><a href="#stale">stale</a></nav><!-- REF:NAV:END --><section id="vehicle-issues"><h2>공식 신고·리콜</h2></section></main>'+inline));
    fs.writeFileSync(detail,shell('<main><section><h1>차량</h1></section><section id="efficiency"><h2>연비</h2></section><section id="cost"><h2>비용</h2></section><section id="recall"><h2>리콜</h2></section></main>'));
    execFileSync(process.execPath,[path.join(root,'scripts/build-reference-design.mjs')],{stdio:'pipe'});
    const familyHtml=fs.readFileSync(family,'utf8'),detailHtml=fs.readFileSync(detail,'utf8');
    assert.equal(familyHtml.includes('reference-section-nav'),false,'The dynamic shell cannot expose stale or template-derived navigation');
    assert.ok(familyHtml.includes(inline),'Do not insert static IDs into the renderer template');
    const nav=detailHtml.match(/<nav class="reference-section-nav"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(nav,'Static details retain their section navigation');
    for(const id of ['efficiency','cost','recall'])assert.ok(nav.includes('href="#'+id+'"'),id+' anchor');
    execFileSync(process.execPath,[path.join(root,'scripts/build-reference-design.mjs')],{stdio:'pipe'});
    assert.equal(fs.readFileSync(family,'utf8').includes('reference-section-nav'),false,'Repeated generation cannot reintroduce template navigation');
  }finally{
    const absolute=path.resolve(root);
    assert.ok(absolute.startsWith(path.resolve(prefix)),'Remove only the fixture created by this test');
    fs.rmSync(absolute,{recursive:true,force:true});
  }
});
