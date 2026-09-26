import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import test from "node:test";
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");

test("header exposes free-talk community and approved Roblejam branding",()=>{
 const header=read("../components/Header.tsx");
 assert.match(header,/roblejam-logo-approved\.webp/);
 assert.match(header,/roblejam-character-v3\.webp/);
 assert.match(header,/href:\s*"\/community\/free"/);
 assert.match(header,/href=\{item\.href\}/);
 assert.match(header,/질문답변/);
 assert.doesNotMatch(header,/Roblox logo/i);
});

test("approved brand artwork is local, integrated and non-trivial",()=>{
 const logo=statSync(new URL("../public/brand/roblejam-logo-approved.webp",import.meta.url));
 const character=statSync(new URL("../public/brand/roblejam-character-v3.webp",import.meta.url));
 const hero=statSync(new URL("../public/brand/roblejam-hero-approved-hd.webp",import.meta.url));
 const heroSource=read("../components/HeroWorld.tsx");
 const mobileNav=read("../components/MobileNav.tsx");
 assert.ok(logo.size>3000);
 assert.ok(character.size>8000);
 assert.ok(hero.size>30000);
 assert.match(heroSource,/roblejam-hero-approved-hd\.webp/);
 assert.match(heroSource,/hero-world-scene-art/);
 assert.doesNotMatch(heroSource,/hero-float-card|hero-avatar-v2|hero-world-slogan-v2/);
 assert.match(mobileNav,/roblejam-character-v3\.webp/);
});

test("game media uses branded recovery instead of browser broken-image UI",()=>{
 const resilient=read("../components/ResilientGameImage.tsx");
 const card=read("../components/GameVisualCard.tsx");
 const home=read("../app/page.tsx");
 assert.match(resilient,/onError=\{\(\) => setIndex/);
 assert.match(resilient,/game-image-fallback/);
 assert.match(card,/ResilientGameImage/);
 assert.match(home,/ResilientGameImage/);
 assert.doesNotMatch(resilient,/\?\?/);
});

test("community tiles never fabricate large activity counts",()=>{
 const source=read("../components/CommunityTiles.tsx");
 assert.doesNotMatch(source,/만개|12\.4|8\.1|4\.8/);
 assert.match(source,/자유/);assert.match(source,/파티 모집/);
});
test("game detail links free talk separately from questions",()=>{
 const source=read("../app/game/[slug]/page.tsx");
 assert.match(source,/CommunityTiles/);assert.match(source,/\/free/);assert.match(source,/\/questions/);
});
