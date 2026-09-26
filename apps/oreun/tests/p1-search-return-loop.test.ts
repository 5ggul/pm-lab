import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { curatedGameSlugs, getCuratedGameProfile } from "../lib/editorial/search-game-profiles";
import { GAME_IDENTITIES } from "../lib/seed";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const editorialMeta = /(?:이 공략은|이 가이드는|이 페이지는|이 페이지에서는|여기서는|별도 검증|검증된 공략|임의로|단정하지|만들지 않습니다|추정하지|검증되지|자동으로 채우|공개 설명만으로 확인되지|별도 최신 확인|우회해서 채우지)/;

test("P1 core search games have distinct decision profiles", () => {
  const slugs = curatedGameSlugs();
  assert.equal(slugs.length, 10);
  assert.deepEqual(new Set(slugs).size, 10);
  for (const slug of slugs) {
    const profile = getCuratedGameProfile(slug);
    assert.ok(profile);
    assert.ok(profile!.searchName.length >= 5);
    assert.ok(profile!.shortAnswer.length >= 35);
    assert.ok(profile!.playPattern.length >= 45);
    assert.ok(profile!.goodFit.length >= 35);
    assert.ok(profile!.checkBeforePlay.length >= 35);
    assert.ok(profile!.relatedIntent.length >= 3);
  }
});

test("P1 search profiles stay player-facing instead of explaining editorial policy", () => {
  for (const slug of curatedGameSlugs()) {
    const profile = getCuratedGameProfile(slug)!;
    const publicCopy = [profile.shortAnswer, profile.playPattern, profile.goodFit, profile.checkBeforePlay].join(" ");
    assert.doesNotMatch(publicCopy, editorialMeta, slug);
  }
});

test("fallback game descriptions also stay player-facing", () => {
  for (const game of GAME_IDENTITIES) {
    assert.doesNotMatch(game.descriptionKo, editorialMeta, game.slug);
  }
});

test("game detail renders search profile with live decision signals", () => {
  const page = read("../app/game/[slug]/page.tsx");
  assert.match(page, /<h1>\{game\.nameKo\}<\/h1>/);
  assert.doesNotMatch(page, /<h1>\{curatedProfile\?\.searchName/);
  assert.match(page, /getCuratedGameProfile/);
  assert.match(page, /game-decision-brief/);
  assert.match(page, /24H \{pct\(c24\)\}/);
  assert.match(page, /7D \{pct\(c7\)\}/);
  assert.match(page, /robots: indexEligible/);
});

test("home daily return loop is grounded in follows, notifications and observed history", () => {
  const home = read("../app/page.tsx");
  const component = read("../components/HomeReturnLoop.tsx");
  assert.match(home, /getFollowingIds/);
  assert.match(home, /getNotifications/);
  assert.match(home, /changeForWindow\(gameHistory, 24, 60\)/);
  assert.match(home, /changeForWindow\(gameHistory, 168, 60\)/);
  assert.match(home, /HomeReturnLoop/);
  assert.match(component, /내 게임 변화/);
  assert.match(component, /안 읽은 알림/);
  assert.doesNotMatch(component, /sampleRows|mockNotifications|fakeUnread/);
});
