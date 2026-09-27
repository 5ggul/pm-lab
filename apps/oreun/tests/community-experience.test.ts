import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { draftKey, parseDraft, persistDraft, loadDraft, DRAFT_TTL_MS, type QuestionDraft } from "../lib/community/question-draft";
import { writeAccess, normalizeFeedFilters, questionFeedQuery, feedHref, questionInputError, questionSaveError, notificationFilter, notificationQuery } from "../lib/community/experience-model";
const userId = "b4a744ad-0716-47f4-a7b0-111111111111";
const requestId = "b4a744ad-0716-47f4-a7b0-222222222222";
const now = 100000000;
const draft: QuestionDraft = { version: 1, userId, gameSlug: "rivals", requestId, title: "임시 질문입니다", body: "실제 데이터를 만들지 않는 테스트 본문입니다.", savedAt: now };
test("question draft is scoped by user and game", () => {
  assert.deepEqual(parseDraft(JSON.stringify(draft), userId, "rivals", now), draft);
  assert.equal(parseDraft(JSON.stringify(draft), "other-user", "rivals", now), null);
  assert.equal(parseDraft(JSON.stringify(draft), userId, "arsenal", now), null);
  assert.notEqual(draftKey(userId, "rivals"), draftKey(userId, "arsenal"));
});
test("draft rejects invalid, expired, oversized and future values", () => {
  for (const value of ["{", "null", "x".repeat(24001), JSON.stringify({ ...draft, requestId: "no" }), JSON.stringify({ ...draft, body: "x".repeat(5001) }), JSON.stringify({ ...draft, version: 2 }), JSON.stringify({ ...draft, savedAt: now + 61_000 }), JSON.stringify({ ...draft, savedAt: now - DRAFT_TTL_MS })]) assert.equal(parseDraft(value, userId, "rivals", now), null);
});
test("only whitelisted fields are restored; empty and expired drafts are removed", () => {
  assert.deepEqual(parseDraft(JSON.stringify({ ...draft, password: "must-not-restore", token: "not-a-real-token" }), userId, "rivals", now), draft);
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  persistDraft(storage, draft);
  assert.equal(loadDraft(storage, userId, "rivals", now)?.requestId, requestId);
  assert.equal(loadDraft(storage, userId, "rivals", now + DRAFT_TTL_MS), null);
  assert.equal(values.size, 0);
  persistDraft(storage, draft);
  persistDraft(storage, { ...draft, title: "", body: "" });
  assert.equal(values.size, 0);
});
test("write states distinguish login, restriction and provider errors", () => {
  assert.equal(writeAccess(false, null), "guest");
  assert.equal(writeAccess(true, null), "unavailable");
  assert.equal(writeAccess(true, { active: false }), "restricted");
  assert.equal(writeAccess(true, { active: true }), "ready");
});
test("unanswered and resolved filters are sent to DB before pagination", () => {
  const filters = normalizeFeedFilters({ state: "unanswered", game: "rivals", page: "2" });
  assert.deepEqual(questionFeedQuery(filters), { select: "*", order: "created_at.desc,id.desc", limit: 21, offset: 20, game_slug: "eq.rivals", answer_count: "eq.0", status: "eq.open" });
  assert.equal(questionFeedQuery({ ...filters, state: "resolved" })?.accepted_answer_id, "not.is.null");
  assert.equal(questionFeedQuery({ ...filters, scope: "following" }, []), null);
  assert.equal(questionFeedQuery({ ...filters, scope: "following" }, [123,456])?.game_universe_id, "in.(123,456)");
});
test("feed navigation preserves filters and bounds input", () => {
  const filters = normalizeFeedFilters({ state: "resolved", game: "rivals", scope: "following", page: "2" });
  const url = new URL(feedHref("/community", filters), "https://oreun.example");
  assert.equal(url.searchParams.get("state"), "resolved");
  assert.equal(url.searchParams.get("scope"), "following");
  assert.deepEqual(normalizeFeedFilters({ state: "invalid", game: "//bad.example", scope: "all", page: "0" }), { state: "latest", game: "", scope: "all", page: 1 });
  assert.equal(normalizeFeedFilters({ page: "999999" }).page, 100);
});
test("question server validation requires bounded input and a request UUID", () => {
  assert.equal(questionInputError(draft.title, draft.body, requestId), null);
  assert.ok(questionInputError("x", draft.body, requestId));
  assert.ok(questionInputError(draft.title, "x".repeat(5001), requestId));
  assert.ok(questionInputError(draft.title, draft.body, "not-a-uuid"));
  assert.match(questionSaveError("restricted contact or credential pattern"), /계정 인증정보/);
  assert.doesNotMatch(questionSaveError("private database secret failure"), /private database secret/);
});
test("notification filters are owner-scoped before limit", () => {
  assert.equal(notificationFilter("unknown"), "all");
  assert.equal(notificationQuery("unread", userId).user_id, `eq.${userId}`);
  assert.equal(notificationQuery("unread", userId).read_at, "is.null");
  assert.match(notificationQuery("replies", userId).kind ?? "", /question_answer/);
  assert.match(notificationQuery("games", userId).kind ?? "", /followed_game_update/);
});
test("new writes use caller RLS, nonce serialization and immutable routing", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260922000300_r1_community_experience_idempotency.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /security definer/i);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /author_id=v_user and client_request_id=p_request_id/);
  assert.match(sql, /where id=p_notification_id and user_id=auth.uid\(\)/);
  assert.match(sql, /revoke all on function public.r1_mark_notification_read\(uuid\) from public, anon/);
  const action = readFileSync(new URL("../app/actions/community-experience.ts", import.meta.url), "utf8");
  assert.match(action, /user_id: `eq.\$\{user.id\}`/);
  assert.doesNotMatch(action, /form.get\("(?:href|next|destination|user_id)"\)/);
});
