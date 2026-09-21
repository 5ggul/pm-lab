import test from "node:test";
import assert from "node:assert/strict";
import { getRegionalAvailability } from "../lib/regional-availability";

test("Brookhaven is explicitly marked as KR restricted", () => {
  const state = getRegionalAvailability(1686885941);
  assert.equal(state?.state, "restricted_kr");
  assert.match(state?.note ?? "", /대한민국 리전/);
  assert.match(state?.note ?? "", /우회 수집하지 않습니다/);
});

test("unverified games are not assigned a regional restriction", () => {
  assert.equal(getRegionalAvailability(6035872082), null);
});
