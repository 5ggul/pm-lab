import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { gameSeoTitle } from "../lib/editorial/game-seo";
import { getCuratedGameProfile } from "../lib/editorial/search-game-profiles";
import { isPublicRisingCandidate } from "../lib/rising-quality";
import type { GameView, TrendResult } from "../lib/types";
import type { RecentRiseSignal } from "../lib/recent-rise";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

const game = {
  slug: "rivals",
  nameKo: "RIVALS",
  playing: 12000,
  regionalAvailability: "available_kr",
} as unknown as GameView;

const trend = {
  eligible: true,
  confidence: "high",
} as unknown as TrendResult;

const signal: RecentRiseSignal = {
  windowHours: 1,
  relativeGrowth: 0.2,
  absoluteGrowth: 2000,
  score: 40,
};

test("SEO titles promise guide intent only when the guide exists", () => {
  const profile = getCuratedGameProfile("rivals");
  assert.ok(profile);
  assert.match(gameSeoTitle(game, profile, [{ slug: "first-duel" }]), /초보 공략/);
  assert.doesNotMatch(gameSeoTitle(game, profile, []), /공략/);
  const restricted = {
    ...game,
    slug: "brookhaven",
    nameKo: "Brookhaven",
    regionalAvailability: "restricted_kr",
  } as unknown as GameView;
  assert.match(
    gameSeoTitle(restricted, getCuratedGameProfile("brookhaven"), []),
    /한국 이용 상태/,
  );
});

test("public rising signals reject tiny or implausibly explosive movements", () => {
  assert.equal(isPublicRisingCandidate(game, trend, signal), true);
  assert.equal(
    isPublicRisingCandidate({ ...game, playing: 3000 } as GameView, trend, signal),
    false,
  );
  assert.equal(
    isPublicRisingCandidate(game, trend, { ...signal, relativeGrowth: 2.5 }),
    false,
  );
  assert.equal(
    isPublicRisingCandidate(game, trend, { ...signal, absoluteGrowth: 500 }),
    false,
  );
});

test("rising indexing is readiness-gated instead of permanently open or closed", () => {
  const rising = read("../app/rising/page.tsx");
  const sitemap = read("../app/sitemap.ts");
  assert.match(rising, /getRisingIndexReadiness/);
  assert.match(rising, /robots: readiness\.ready/);
  assert.doesNotMatch(rising, /export const metadata: Metadata/);
  assert.match(sitemap, /getRisingIndexReadiness/);
  assert.match(sitemap, /indexableGames\.length >= 3/);
});

test("game and guide pages expose BreadcrumbList structured data", () => {
  assert.match(read("../app/game/[slug]/page.tsx"), /"@type": "BreadcrumbList"/);
  assert.match(
    read("../app/game/[slug]/guides/[guideSlug]/page.tsx"),
    /"@type": "BreadcrumbList"/,
  );
});

test("timestamp-only provider detections stay out of the return notification loop", () => {
  const migration = read("../supabase/migrations/20260927154000_suppress_timestamp_update_notifications.sql");
  const homeReturn = read("../components/HomeReturnLoop.tsx");
  assert.match(migration, /return new;/);
  assert.doesNotMatch(migration, /insert into public\.notifications/);
  assert.doesNotMatch(homeReturn, /업데이트 시각 변경 감지/);
});


test("reviewed guide expansion preserves explicit index review state", () => {
  const source = read("../lib/content/search-guide-expansions.ts");
  assert.match(source, /index_state: guide\.index_state/);
  assert.doesNotMatch(source, /index_state: "noindex"/);
  const page = read("../app/game/[slug]/guides/[guideSlug]/page.tsx");
  assert.match(page, /guide\.index_state === "indexable"/);
  assert.match(page, /parentReady/);
});
