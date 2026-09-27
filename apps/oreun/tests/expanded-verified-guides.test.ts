import assert from "node:assert/strict";
import test from "node:test";
import {
  getVerifiedEditorialGuide,
  getVerifiedEditorialSources,
} from "../lib/content/verified-guides";
import { isActionablePublicGuide } from "../lib/content/public-guide";

const targets = [
  [10563114921, "egg-pet-loop"],
  [3508322461, "controls"],
  [7709344486, "money-rebirth-loop"],
  [6701277882, "fishing-basics"],
  [2711375305, "avatar-tryon"],
  [3647333358, "survival-controls"],
  [703124385, "no-checkpoint-basics"],
  [5361032378, "roll-craft-loop"],
  [5569032992, "machine-team-basics"],
  [2619619496, "bed-resource-basics"],
  [1516533665, "escape-item-basics"],
  [88070565, "first-money-home"],
] as const;

const editorialMeta = /(?:이 공략은|이 가이드는|이 페이지는|이 페이지에서는|여기서는|별도 검증|검증된 공략|임의로|단정하지|만들지 않습니다|추정하지|검증되지|자동으로 채우|우회해서 채우지)/;

test("expanded high-demand games have actionable official-source guides", () => {
  for (const [universeId, slug] of targets) {
    const guide = getVerifiedEditorialGuide(universeId, slug);
    assert.ok(guide, slug);
    assert.equal(guide!.content_status, "published", slug);
    assert.equal(guide!.review_status, "approved", slug);
    assert.equal(guide!.index_state, "indexable", slug);
    assert.ok(guide!.summary.length >= 45, slug);
    assert.ok(
      isActionablePublicGuide({
        guide_type: guide!.guide_type,
        body: guide!.body,
      }),
      slug,
    );
    assert.doesNotMatch(guide!.body, editorialMeta, slug);

    const source = getVerifiedEditorialSources(universeId).find(
      (item) => item.id === guide!.source_id,
    );
    assert.ok(source, slug + " source");
    assert.match(source!.source_url, /^https:\/\/www\.roblox\.com\/games\/\d+\//, slug);
  }
});

test("expanded guides use unique universe and slug pairs", () => {
  const keys = targets.map(([universeId, slug]) => `${universeId}|${slug}`);
  assert.equal(new Set(keys).size, keys.length);
});
