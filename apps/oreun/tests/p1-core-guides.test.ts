import assert from "node:assert/strict";
import test from "node:test";
import { coreGuideExpansionCount, getCoreGuideExpansion } from "../lib/content/core-guide-expansions";
import { isActionablePublicGuide } from "../lib/content/public-guide";

const editorialMeta = /(?:이 공략은|이 가이드는|이 페이지는|이 페이지에서는|여기서는|별도 검증|임의로|단정하지|만들지 않습니다|추정하지|검증되지|자동으로 채우|고정 정보로 다룹니다)/;

const targets = [
  [6035872082, "first-duel", "beginner"],
  [994732206, "fruit-basics", "beginner"],
  [66654135, "roles", "mechanic"],
  [5203828273, "runway-basics", "beginner"],
  [1176784616, "defense-basics", "beginner"],
  [383310974, "pet-home-basics", "beginner"],
  [7436755782, "planting-basics", "beginner"],
  [245662005, "roles-basics", "beginner"],
] as const;

test("P1 reviewed guide expansions are substantial without opening indexing", () => {
  assert.equal(coreGuideExpansionCount(), targets.length);
  for (const [universeId, slug, guideType] of targets) {
    const guide = getCoreGuideExpansion(universeId, slug);
    assert.ok(guide, slug);
    assert.ok(guide!.summary.length >= 45, slug);
    assert.ok(isActionablePublicGuide({ guide_type: guideType, body: guide!.body }), slug);
  }
});

test("guide expansions keep volatile meta claims out of fixed copy", () => {
  const joined = targets.map(([id, slug]) => getCoreGuideExpansion(id, slug)?.body ?? "").join("\n");
  assert.doesNotMatch(joined, /최강은|무조건 .*써야|확정 티어|현재 시세는 \d|승률 \d/);
});

test("public search guide expansions contain player-facing copy, not editorial defenses", () => {
  for (const [id, slug] of targets) {
    const guide = getCoreGuideExpansion(id, slug);
    assert.ok(guide, slug);
    assert.doesNotMatch(guide!.body, editorialMeta, slug);
  }
});

test("TDS expansion keeps the reviewed gameplay advice that made the guide useful", () => {
  const guide = getCoreGuideExpansion(1176784616, "defense-basics");
  assert.ok(guide);
  for (const phrase of ["Farm", "사거리", "중반", "후반", "시작 현금"]) {
    assert.match(guide!.body, new RegExp(phrase), "TDS lost gameplay advice: " + phrase);
  }
});

test("reviewed search expansions stay separate from legacy copy edits", async () => {
  const source = await import("../lib/content/search-guide-expansions");
  assert.equal(typeof source.applyReviewedSearchExpansion, "function");
});
