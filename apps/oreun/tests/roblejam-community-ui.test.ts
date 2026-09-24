import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import test from "node:test";
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");
test("header exposes free-talk community and original mascot branding",()=>{
 const header=read("../components/Header.tsx");
 assert.match(header,/BrandMascot/);
 assert.match(header,/href:\s*"\/community\/free"/);
 assert.match(header,/href=\{item\.href\}/);
 assert.match(header,/질문답변/);
 assert.doesNotMatch(header,/Roblox logo/i);
});
test("brand artwork is local and non-trivial",()=>{
 const mascot=statSync(new URL("../public/brand/roblejam-mascot.png",import.meta.url));
 const hero=statSync(new URL("../public/brand/roblejam-hero-world.webp",import.meta.url));
 const mascotSource=read("../components/BrandMascot.tsx");
 const heroSource=read("../components/HeroWorld.tsx");
 assert.ok(mascot.size>2000);assert.ok(hero.size>2000);
 assert.match(mascotSource,/\/brand\/roblejam-mascot\.png/);
 assert.match(heroSource,/\/brand\/roblejam-hero-world\.webp/);
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
