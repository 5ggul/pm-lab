import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");

test("R2 hero is one integrated HD visual and CTAs stay single-line by contract",()=>{
  const hero=read("../components/HeroWorld.tsx");
  const css=read("../app/energy.css");
  const asset=statSync(new URL("../public/brand/roblejam-hero-approved-hd.webp",import.meta.url));
  assert.ok(asset.size>30000);
  assert.match(hero,/roblejam-hero-approved-hd\.webp/);
  assert.match(hero,/hero-world-scene-art/);
  assert.doesNotMatch(hero,/hero-float-card|hero-avatar-v2|hero-world-slogan-v2/);
  assert.match(css,/\.hero-secondary-cta[\s\S]*?white-space:nowrap!important/);
  assert.match(css,/\.hero-world-v2\.hero-world-approved[\s\S]*?inset:0!important/);
});

test("R2 comparison prioritizes data and cannot force page-wide horizontal scrolling",()=>{
  const compare=read("../app/compare/page.tsx");
  const css=read("../app/energy.css");
  assert.match(compare,/gridTemplateColumns: "92px repeat\(" \+ selected\.length \+ ", minmax\(0, 1fr\)\)"/);
  assert.match(compare,/width=\{64\} height=\{48\}/);
  assert.match(css,/\.compare-matrix-wrap[\s\S]*?overflow-x:hidden!important/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*?\.compare-game-head img\{display:none!important\}/);
});

test("R2 free board writes at the bottom and general posts identify 자유게시판",()=>{
  const free=read("../app/community/free/page.tsx");
  const home=read("../app/page.tsx");
  assert.match(free,/href="\?write=1#write"/);
  assert.match(free,/free-compose-bottom/);
  assert.match(free,/open=\{openComposer\}/);
  assert.match(free,/post\.game_name_ko \?\? "자유게시판"/);
  assert.match(home,/post\.game_name_ko \?\? "자유게시판"/);
});

test("R2 free-benefit hub keeps the requested concise copy",()=>{
  const hub=read("../app/codes/page.tsx");
  assert.match(hub,/공식 게임 설명·공식 개발자 출처에서 직접 확인한 무료 보상 코드만 공개합니다\./);
  assert.doesNotMatch(hub,/codes-policy-card/);
  assert.doesNotMatch(hub,/아무 보상 코드나 채워 넣지 않습니다/);
  assert.doesNotMatch(hub,/블로그·영상에서만 떠도는 보상 코드/);
});

test("R2 profile update privilege and friendly errors are both encoded",()=>{
  const migration=read("../supabase/migrations/20260925000100_r1_profile_write_and_community_guides.sql");
  const action=read("../app/actions/auth.ts");
  assert.match(migration,/grant update\(handle, display_name, bio\) on public\.profiles to authenticated/);
  assert.match(action,/이미 사용 중인 아이디입니다/);
  assert.match(action,/프로필 저장 권한을 확인하지 못했습니다/);
});

test("R2 community guides are active-user UGC with idempotency and public feed",()=>{
  const migration=read("../supabase/migrations/20260925000100_r1_profile_write_and_community_guides.sql");
  const action=read("../app/actions/extra-composers.ts");
  const queries=read("../lib/community/queries.ts");
  const globalGuides=read("../app/guides/page.tsx");
  const gameGuides=read("../app/game/[slug]/guides/page.tsx");
  assert.match(migration,/create table if not exists public\.community_guides/);
  assert.match(migration,/community_guides_author_request_unique/);
  assert.match(migration,/private\.r1_consume_rate_limit\('community_guide',5,interval '1 hour'\)/);
  assert.match(migration,/create or replace view public\.r1_community_guide_feed/);
  assert.match(migration,/public\.r1_submit_community_guide/);
  assert.match(action,/submitCommunityGuide/);
  assert.match(queries,/getCommunityGuideFeed/);
  assert.match(globalGuides,/내 공략 올리기/);
  assert.match(gameGuides,/내 공략 올리기/);
});

test("R2 rising pages expose current data timestamps and honest fallback",()=>{
  const home=read("../app/page.tsx");
  const rising=read("../app/rising/page.tsx");
  assert.match(home,/rising-data-stamp/);
  assert.match(home,/지금 인기/);
  assert.match(rising,/rising-data-stamp/);
  assert.match(rising,/지금은 상승 판정 대신 인기 게임을 보여드려요/);
  assert.match(rising,/displayFallback/);
});


test("R2 header hides login after an authenticated session is resolved",()=>{
  const header=read("../components/Header.tsx");
  assert.match(header,/getCurrentUser/);
  assert.match(header,/const user = await getCurrentUser\(\)/);
  assert.match(header,/user \? \(/);
  assert.match(header,/header-login-link/);
  assert.match(header,/header-me-link/);
});

test("R2 community game picker scales beyond the original fixed catalogue",()=>{
  const picker=read("../components/GamePicker.tsx");
  const free=read("../app/community/free/page.tsx");
  const guide=read("../components/CommunityGuideComposer.tsx");
  const thumbs=read("../lib/providers/roblox-thumbnails.ts");
  const history=read("../lib/repository/supabase-public.ts");
  const migration=read("../supabase/migrations/20260925111500_r2_expand_community_game_catalog.sql");
  const css=read("../app/energy.css");
  const art=statSync(new URL("../public/brand/community-game-picker.webp",import.meta.url));
  assert.ok(art.size>15000);
  assert.match(picker,/게임 이름 검색/);
  assert.match(picker,/slice\(0, 12\)/);
  assert.match(picker,/allowGeneral/);
  assert.match(picker,/PlayIcon name="game"/);
  assert.match(picker,/PlayIcon name="chat"/);
  assert.doesNotMatch(picker,/🎮|💬/);
  assert.match(free,/GamePicker games=\{games\} allowGeneral/);
  assert.match(guide,/GamePicker games=\{games\}/);
  assert.match(thumbs,/for \(let i = 0; i < ids\.length; i \+= 80\)/);
  assert.match(history,/ids\.length > 500/);
  assert.match(history,/for \(let i = 0; i < ids\.length; i \+= 80\)/);
  assert.match(migration,/r2_expand_community_game_catalog|Expand community-selectable Roblox catalog/);
  assert.match(css,/community-game-picker\.webp/);
});

test("R2 expanded community catalogue does not widen the curated release gate",()=>{
  const preflight=read("../scripts/release-preflight.ts");
  assert.match(preflight,/GAME_IDENTITIES/);
  assert.match(preflight,/launchUniverseIds/);
  assert.match(preflight,/launchReadiness/);
  assert.match(preflight,/catalogGames: launchReadiness\.length/);
});


test("R2 community filters stay inside the mobile viewport with the expanded catalogue",()=>{
  const css=read("../components/community-experience.module.css");
  assert.match(css,/\.tabs, \.filters \{ min-width: 0; max-width: 100%; width: 100%; \}/);
  assert.match(css,/\.filters select \{ width: 100%; min-width: 0; \}/);
  assert.match(css,/@media\(max-width:430px\)[\s\S]*?grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
});
