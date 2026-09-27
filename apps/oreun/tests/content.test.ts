import test from "node:test";
import assert from "node:assert/strict";
import { getVerifiedEditorialCodes } from "../lib/content/verified-codes";
import {
  isFreshCodeCheck,
  resolveGuideSource,
  type ContentSource,
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


test("fallback guide source resolves to DB UUID source by official URL", () => {
  const sources: ContentSource[] = [
    {
      id: "00000000-0000-0000-0000-000000000010",
      universe_id: 6035872082,
      source_type: "official_game_page",
      label: "RIVALS Roblox 공식 페이지",
      source_url: "https://www.roblox.com/games/17625359962/RIVALS",
      last_checked_at: "2026-09-20T06:35:00.000Z",
      created_at: "2026-09-21T00:00:00.000Z",
      updated_at: "2026-09-21T00:00:00.000Z",
    },
  ];

  const resolved = resolveGuideSource(
    {
      universe_id: 6035872082,
      source_id: "editorial-source:rivals",
    },
    sources,
  );

  assert.equal(resolved?.id, "00000000-0000-0000-0000-000000000010");
  assert.equal(
    resolved?.source_url,
    "https://www.roblox.com/games/17625359962/RIVALS",
  );
});


test("reviewed editorial codes remain available outside preview but still expire by freshness policy", () => {
  const [code] = getVerifiedEditorialCodes(1176784616);
  assert.ok(code);
  assert.equal(code.code, "2MILLION");
  assert.equal(code.visibility, "published");
  assert.equal(code.review_status, "approved");
  assert.equal(
    isFreshCodeCheck(code, new Date("2026-10-03T06:19:59.000Z")),
    true,
  );
  assert.equal(
    isFreshCodeCheck(code, new Date("2026-10-04T06:20:01.000Z")),
    false,
  );
});
