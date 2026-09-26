import assert from "node:assert/strict";
import test from "node:test";
import { coreGuideExpansionCount, getCoreGuideExpansion } from "../lib/content/core-guide-expansions";
import { isActionablePublicGuide } from "../lib/content/public-guide";

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
  assert.doesNotMatch(joined, /최강|무조건|확정 티어|현재 시세는|승률 \d/);
});
