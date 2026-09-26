import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  isLikelyJunkCommunityText,
  isPublishableCommunityPost,
  publicCommunityAuthorName,
} from "../lib/community/content-quality";
import { evaluateGameIndexEligibility } from "../lib/index-eligibility";
import type { GameView, HistoryPoint } from "../lib/types";

const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");

function eligibleGame(): GameView {
  return {
    indexState: "indexable",
    heroImageUrl: "https://example.invalid/game.webp",
    thumbnailUrl: null,
    descriptionKo: "두 팀이 라운드마다 무기와 이동을 활용해 먼저 목표 점수를 만드는 대전 게임입니다.",
    regionalAvailability: "available_kr",
    freshnessState: "fresh",
    playing: 12000,
    fallbackReason: null,
    availabilityNote: null,
  } as unknown as GameView;
}

function sevenDayHistory(): HistoryPoint[] {
  const start = Date.UTC(2026, 8, 19, 6, 0, 0);
  return Array.from({ length: 169 }, (_, index) => ({
    at: new Date(start + index * 60 * 60 * 1000).toISOString(),
    playing: 10000 + index * 10,
    coverageRatio: 1,
    sampleCount: 1,
    qualityState: "trusted",
    dataSource: "public-api",
  })) as HistoryPoint[];
}

test("free-talk quality rejects keyboard-smash content and masks generated handles", () => {
  for (const value of ["ㄴㅇㄹㄴㅇㄹ", "ㅁㄴㅇㅁㄴㅇ", "   "]) {
    assert.equal(isLikelyJunkCommunityText(value), true, value);
  }
  assert.equal(
    isPublishableCommunityPost(
      "오늘 라이벌즈 해본 분?",
      "맵이 바뀐 뒤에 초반 무기 선택이 달라진 것 같은데 다들 어떻게 하고 있나요?",
    ),
    true,
  );
  assert.equal(isPublishableCommunityPost("ㅁㄴㅇㅁㄴㅇ", "ㅁㄴㅇㅁㄴㅇ"), false);
  assert.equal(isPublishableCommunityPost("ㅊ퓿퓨", "ㅊ퓿퓨"), false);
  assert.equal(publicCommunityAuthorName("u_a7b4865f8bcf"), "로블잼 이용자");
});

test("game indexing is fail-closed until every value condition is met", () => {
  const game = eligibleGame();
  const missing = evaluateGameIndexEligibility(game, {
    history: [],
    hasIndexableGuide: false,
    hasFreshCode: false,
    hasAnsweredQuestion: false,
  });
  assert.equal(missing.eligible, false);
  assert.ok(missing.reasons.includes("seven-day-baseline"));
  assert.ok(missing.reasons.includes("independent-content"));

  const ready = evaluateGameIndexEligibility(game, {
    history: sevenDayHistory(),
    hasIndexableGuide: true,
    hasFreshCode: false,
    hasAnsweredQuestion: false,
  });
  assert.equal(ready.eligible, true, ready.reasons.join(","));
});

test("thin child surfaces and timestamp-only updates stay out of search", () => {
  const sitemap = read("../app/sitemap.ts");
  const updates = read("../app/updates/page.tsx");
  const gameUpdates = read("../app/game/[slug]/updates/page.tsx");
  const questions = read("../app/game/[slug]/questions/page.tsx");
  const free = read("../app/game/[slug]/free/page.tsx");
  const party = read("../app/game/[slug]/party/page.tsx");
  const compare = read("../app/compare/page.tsx");
  const search = read("../app/search/page.tsx");
  const browserQa = read("../scripts/browser-qa.mjs");
  assert.match(sitemap, /getGameIndexEligibility/);
  assert.doesNotMatch(sitemap, /\/updates`|"\/updates"/);
  assert.doesNotMatch(sitemap, /"\/rising"/);
  assert.match(sitemap, /indexableGuideCount >= 3/);
  assert.match(browserQa, /home must not promote timestamp-only update detection/);
  assert.match(browserQa, /home exposes junk QA community content/);
  assert.match(browserQa, /Brookhaven restricted response contract changed/);
  assert.doesNotMatch(browserQa, /home detected-update section missing|home verified-guide section missing/);
  for (const source of [updates, gameUpdates, questions, free, party, compare, search]) {
    assert.match(source, /index:\s*false/);
  }
});

test("game detail keeps Roblox source as a reference instead of copied body", () => {
  const gamePage = read("../app/game/[slug]/page.tsx");
  assert.match(gamePage, /공식 설명 전문은 복제하지 않습니다/);
  assert.doesNotMatch(gamePage, /official-game-description/);
  assert.match(gamePage, /getGameIndexEligibility/);
});

test("stable preview canonical is pinned while hosted preview indexing stays locked", () => {
  const workflow = read("../../../.github/workflows/r1-oreun-stable-vercel-preview.yml");
  const indexing = read("../lib/indexing.ts");
  assert.match(workflow, /NEXT_PUBLIC_SITE_URL="\$STABLE_URL"/);
  assert.match(workflow, /rel=\\\"canonical\\\" href=\\\"\$STABLE_URL\\\"/);
  assert.match(indexing, /\.vercel\.app/);
  assert.match(indexing, /\.workers\.dev/);
});
