import assert from "node:assert/strict";
import test from "node:test";
import { changeForWindow } from "../lib/metrics";
import type { HistoryPoint } from "../lib/types";

const point = (at: string, playing: number | null, coverageRatio = 1): HistoryPoint => ({
  at,
  playing,
  coverageRatio,
});

test("1H change compares against an earlier trusted observation, not itself", () => {
  const points = [
    point("2026-09-23T00:00:00.000Z", 100),
    point("2026-09-23T01:00:00.000Z", 200),
  ];
  assert.equal(changeForWindow(points, 1, 60), 1);
});

test("change is unavailable with only one trusted point", () => {
  assert.equal(
    changeForWindow([point("2026-09-23T01:00:00.000Z", 200)], 1, 60),
    null,
  );
});

test("low-coverage baseline is not treated as a real comparison", () => {
  const points = [
    point("2026-09-23T00:00:00.000Z", 100, 0.4),
    point("2026-09-23T01:00:00.000Z", 200, 1),
  ];
  assert.equal(changeForWindow(points, 1, 60), null);
});

test("zero and missing baselines are not reported as zero growth", () => {
  assert.equal(
    changeForWindow([
      point("2026-09-23T00:00:00.000Z", 0),
      point("2026-09-23T01:00:00.000Z", 200),
    ], 1, 60),
    null,
  );
  assert.equal(
    changeForWindow([
      point("2026-09-23T00:00:00.000Z", null),
      point("2026-09-23T01:00:00.000Z", 200),
    ], 1, 60),
    null,
  );
});
