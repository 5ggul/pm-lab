import test from "node:test";
import assert from "node:assert/strict";
import {
  VERIFIED_EDITORIAL_GUIDES,
  VERIFIED_EDITORIAL_SOURCES,
  getVerifiedEditorialGuide,
} from "../lib/content/verified-guides";

test("verified editorial guides all have matching checked sources", () => {
  const sourceIds = new Set(VERIFIED_EDITORIAL_SOURCES.map((source) => source.id));
  assert.equal(VERIFIED_EDITORIAL_GUIDES.length, 26);
  assert.equal(VERIFIED_EDITORIAL_SOURCES.length, 26);
  for (const guide of VERIFIED_EDITORIAL_GUIDES) {
    assert.equal(guide.content_status, "published");
    assert.equal(guide.review_status, "approved");
    assert.equal(guide.index_state, "indexable");
    assert.ok(guide.reviewed_at);
    assert.ok(guide.summary.trim().length >= 20);
    assert.ok(guide.body.trim().length >= 100);
    assert.ok(sourceIds.has(guide.source_id));
  }
});

test("verified guide lookup is scoped by universe and slug", () => {
  const guide = getVerifiedEditorialGuide(5750914919, "fishing-controls");
  assert.equal(guide?.title, "Fisch 낚시하는 법: 캐스팅부터 릴인까지");
  assert.equal(getVerifiedEditorialGuide(5750914919, "controls"), null);
});

test("verified source URLs point to Roblox experience pages", () => {
  for (const source of VERIFIED_EDITORIAL_SOURCES) {
    assert.match(source.source_url, /^https:\/\/www\.roblox\.com\/games\/\d+\//);
    assert.ok(source.last_checked_at);
  }
});
