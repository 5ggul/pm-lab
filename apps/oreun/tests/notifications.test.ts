import test from "node:test";
import assert from "node:assert/strict";
import {
  notificationHref,
  notificationLabels,
} from "../lib/community/notifications";
import type { NotificationRow } from "../lib/community/queries";

const base: NotificationRow = {
  id: "notification",
  kind: "followed_game_update",
  actor_id: null,
  game_universe_id: 6035872082,
  question_id: null,
  answer_id: null,
  comment_id: null,
  update_event_id: "11111111-1111-4111-8111-111111111111",
  payload: {},
  read_at: null,
  created_at: "2026-09-19T20:00:00.000Z",
};

test("followed update notification deep-links to the exact detected event", () => {
  assert.equal(
    notificationHref(base, "rivals"),
    "/game/rivals/updates#event-11111111-1111-4111-8111-111111111111",
  );
});

test("followed update notification falls back to the game update timeline", () => {
  assert.equal(
    notificationHref({ ...base, update_event_id: null }, "rivals"),
    "/game/rivals/updates",
  );
});

test("question notification destination takes priority over game context", () => {
  assert.equal(
    notificationHref(
      {
        ...base,
        kind: "question_answer",
        question_id: "22222222-2222-4222-8222-222222222222",
      },
      "rivals",
    ),
    "/questions/22222222-2222-4222-8222-222222222222",
  );
});

test("content notification destinations remain game-context routes", () => {
  assert.equal(
    notificationHref({ ...base, kind: "followed_game_code" }, "rivals"),
    "/game/rivals/codes",
  );
  assert.equal(
    notificationHref({ ...base, kind: "followed_game_guide" }, "rivals"),
    "/game/rivals/guides",
  );
});

test("update notification label is explicit about detection", () => {
  assert.equal(
    notificationLabels.followed_game_update,
    "팔로우한 게임 업데이트 감지",
  );
});
