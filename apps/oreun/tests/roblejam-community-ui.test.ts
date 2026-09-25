import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import test from "node:test";
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");

test("header exposes free-talk community and approved Roblejam branding",()=>{
 const header=read("../components/Header.tsx");
 assert.match(header,/roblejam-logo-v2\.webp/);
 assert.match(header,/roblejam-profile-v2\.webp/);
 assert.match(header,/href:\s*"\/community\/free"/);
 assert.match(header,/href=\{item\.href\}/);
 assert.match(header,/질문답변/);
 assert.doesNotMatch(header,/Roblox logo/i);
});

test("approved brand artwork is local and non-trivial",()=>{
 const logo=statSync(new URL("../public/brand/roblejam-logo-v2.webp",import.meta.url));
 const profile=statSync(new URL("../public/brand/roblejam-profile-v2.webp",import.meta.url));
 const heroSource=read("../components/HeroWorld.tsx");
 assert.ok(logo.size>10000);
 assert.ok(profile.size>5000);
 assert.match(heroSource,/roblejam-profile-v2\.webp/);
 assert.match(heroSource,/hero-world-slogan-v2/);
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
