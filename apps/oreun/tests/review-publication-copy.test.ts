import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergePublicGuides, guideKey, type GuideState } from "../lib/content/publication";
import { publicGuideParagraphs } from "../lib/content/public-guide";
import { applyKnownEditorialRevision } from "../lib/content/editorial-revisions";
import changes from "../lib/content/editorial-revisions.json";
import { VERIFIED_EDITORIAL_GUIDES as guides } from "../lib/content/verified-guides";
import type { GameGuide } from "../lib/content/queries";
const fallback=guides as GameGuide[];
const states=(state:GuideState["state"]):GuideState[]=>fallback.map(g=>({universe_id:g.universe_id,slug:g.slug,state}));
test("missing DB entries may fallback, withheld entries can never reappear",()=>{
 assert.equal(mergePublicGuides([],fallback,states("missing")).length,23);
 assert.equal(mergePublicGuides([],fallback,states("withheld")).length,0);
 assert.equal(mergePublicGuides([],fallback,states("published")).length,0);
 assert.throws(()=>mergePublicGuides([],fallback,[]));
 assert.throws(()=>mergePublicGuides([],fallback,states("unknown" as any)));
 const withdrawn=states("withheld");assert.equal(mergePublicGuides(fallback,fallback,withdrawn).length,0);
});
test("DB content remains authoritative and render formatting never deletes factual clauses",()=>{
 const changed={...fallback[0],body:"별도 검증 없이 시간을 단정하지 마세요.\n\n10분 뒤 사라집니다."};
 assert.equal(mergePublicGuides([changed],fallback,states("published"))[0]?.body,changed.body);
 assert.deepEqual(publicGuideParagraphs(changed.body),["별도 검증 없이 시간을 단정하지 마세요.","10분 뒤 사라집니다."]);
 assert.equal(applyKnownEditorialRevision(changed).body,changed.body);
});
test("known original copyedits are exact-match scoped, keep review dates, never republish withdrawn source",()=>{
 for(const r of changes){const source=fallback.find(g=>Number(g.universe_id)===r.universeId&&g.slug===r.slug)!;
  const old={...source,title:r.expectedTitle,summary:r.expectedSummary,body:r.expectedBody,content_status:"published" as const};
  const corrected=applyKnownEditorialRevision(old);assert.equal(corrected.body,r.body);assert.equal(corrected.reviewed_at,old.reviewed_at);assert.equal(corrected.updated_at,old.updated_at);
  assert.equal(applyKnownEditorialRevision({...old,content_status:"archived"}).body,old.body);
  assert.equal(applyKnownEditorialRevision({...old,body:old.body+" 변경됨"}).body,old.body+" 변경됨");
 }
});
test("edited guide originals retain promised instructions and remove orphan editorial endings",()=>{
 const bySlug=(slug:string)=>fallback.find(g=>g.slug===slug)!;
 for(const [slug,facts] of [["fruit-basics",["1시간","20분","4시간","Dealer"]],["fishing-controls",["흰색","파란","진행 바"]],["planting-basics",["씨앗","갈색","접속하지 않은"]],["first-duel",["듀얼 패드","1대1","5대5","5라운드","키","계약"]],["roles",["Innocent","Sheriff","Murderer"]]] as const){for(const fact of facts)assert.ok(bySlug(slug).body.includes(fact),slug+" lost "+fact);}
 assert.match(bySlug("first-duel").body.split(/\n\s*\n/)[0],/듀얼 패드/);
 for(const g of fallback){assert.doesNotMatch(g.body,/이 가이드는|여기서는|이 페이지에서는|그런 내용은|만 정리합니다|만 설명합니다|만 다룹니다|정리하면/);}
 for(const slug of ["before-you-enter","camp-basics","survival-basics"])assert.equal(bySlug(slug).content_status,"archived");
});
test("home and hub use the same moderated catalogue, no direct array shortcut",()=>{
 for(const file of ["../app/page.tsx","../app/guides/page.tsx"]){const source=readFileSync(new URL(file,import.meta.url),"utf8");assert.match(source,/getPublicGuideCatalog/);assert.doesNotMatch(source,/VERIFIED_EDITORIAL_GUIDES/);}
 const source=readFileSync(new URL("../app/game/[slug]/guides/[guideSlug]/page.tsx",import.meta.url),"utf8");assert.ok(source.indexOf('className="guide-question-cta"')<source.indexOf('className="guide-media-section"'));
});
