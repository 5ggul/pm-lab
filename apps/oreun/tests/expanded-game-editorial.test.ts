import assert from "node:assert/strict";
import test from "node:test";
import {
  expandedGameEditorialCount,
  getExpandedGameEditorial,
} from "../lib/editorial/expanded-game-editorial";

const targets = [
  10563114921,
  3508322461,
  7709344486,
  6701277882,
  2711375305,
  3647333358,
  703124385,
  5361032378,
  5569032992,
  2619619496,
  1516533665,
  88070565,
];

const editorialMeta = /(?:이 공략은|이 가이드는|이 페이지는|여기서는|별도 검증|검증된 공략|임의로|단정하지|만들지 않습니다|추정하지|검증되지|자동으로 채우|우회해서 채우지)/;

test("expanded catalog promotes a first batch of high-demand games with useful Korean copy", () => {
  assert.equal(expandedGameEditorialCount(), targets.length);
  for (const universeId of targets) {
    const item = getExpandedGameEditorial(universeId);
    assert.ok(item, String(universeId));
    assert.ok(item!.nameKo.trim().length >= 3, String(universeId));
    assert.ok(item!.descriptionKo.length >= 100, String(universeId));
    assert.ok(item!.aliases.length >= 3, String(universeId));
    assert.equal(new Set(item!.aliases.map((alias) => alias.toLowerCase())).size, item!.aliases.length, String(universeId));
    assert.doesNotMatch(item!.descriptionKo, editorialMeta, String(universeId));
  }
});

test("expanded coverage includes Korean search terms for representative popular games", () => {
  assert.ok(getExpandedGameEditorial(2619619496)?.aliases.includes("베드워즈"));
  assert.ok(getExpandedGameEditorial(703124385)?.aliases.includes("타워 오브 헬"));
  assert.ok(getExpandedGameEditorial(5569032992)?.aliases.includes("댄디스 월드"));
  assert.ok(getExpandedGameEditorial(88070565)?.aliases.includes("블록스버그"));
});
