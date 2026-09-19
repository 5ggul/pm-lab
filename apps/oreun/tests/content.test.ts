import test from "node:test";
import assert from "node:assert/strict";
import {
  isFreshCodeCheck,
  type GameCode,
} from "../lib/content/queries";

const base: GameCode = {
  id: "code",
  universe_id: 1,
  code: "HELLO",
  reward_text: "reward",
  code_status: "active",
  visibility: "published",
  source_id: "source",
  review_status: "approved",
  reviewed_at: "2026-09-19T00:00:00.000Z",
  reviewed_by: "00000000-0000-0000-0000-000000000001",
  review_note: "",
  verified_at: "2026-09-19T00:00:00.000Z",
  last_checked_at: "2026-09-19T00:00:00.000Z",
  expires_at: null,
  notes: "",
  created_at: "2026-09-19T00:00:00.000Z",
  updated_at: "2026-09-19T00:00:00.000Z",
};

test("verified code freshness uses a strict seven-day review window", () => {
  assert.equal(
    isFreshCodeCheck(base, new Date("2026-09-25T23:59:59.000Z")),
    true,
  );
  assert.equal(
    isFreshCodeCheck(base, new Date("2026-09-26T00:00:01.000Z")),
    false,
  );
});

test("code without last_checked_at is never fresh", () => {
  assert.equal(
    isFreshCodeCheck({ ...base, last_checked_at: null }),
    false,
  );
});
