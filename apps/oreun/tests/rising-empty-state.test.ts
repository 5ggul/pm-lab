import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { risingEmptyState } from "../lib/rising-empty-state";

test("an empty positive list with valid declining histories is not data collection", () => {
  const state = risingEmptyState([{ eligible: false }, { eligible: true }]);
  assert.equal(state.kind, "no-rise");
  assert.match(state.message, /상승 조건에 맞는 게임이 없습니다/);
  assert.doesNotMatch(state.message, /수집|모으|불러오지|충분하지/);
});
test("insufficient and stale histories are distinct from no rising games", () => {
  for (const inputs of [[], [{ eligible: false }]]) {
    assert.equal(risingEmptyState(inputs).kind, "insufficient");
  }
});
test("failed reads are never presented as an empty successful result", () => {
  const state = risingEmptyState([{ eligible: true }], true);
  assert.equal(state.kind, "unavailable");
  assert.match(state.message, /불러오지 못했습니다/);
});
test("home and dedicated rising list share the empty-state policy", () => {
  for (const path of ["../app/page.tsx", "../app/rising/page.tsx"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /risingEmptyState\(/);
    assert.match(source, /data-trend-state/);
    assert.doesNotMatch(source, /상승 데이터를 더 모으는 중/);
  }
});
