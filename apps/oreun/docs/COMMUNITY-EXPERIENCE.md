# Community experience — 2026-09-22

Scope: question drafts and duplicate submission protection, contextual access guidance, unanswered/resolved/followed-game discovery, individual notification reads. Admin roles and all release/indexing latches are unchanged.

## Question writing

- The question composer uses controlled inputs and retains text on validation, network or authentication errors.
- SessionStorage drafts are isolated by account and game, expire after 24 hours and are not synchronized to another device. No credentials or tokens are stored in drafts.
- Successful server confirmation or explicit discard clears the draft; merely pressing Submit does not.
- Immediate client lock + disabled pending button prevents double activation. A stable request UUID is retained across retries and reloads.
- `r1_submit_question` uses caller RLS, explicit current-user/age checks, an advisory transaction lock and an author/request unique index. Identical retries return the existing question ID without re-running insertion notifications/rate limits. A mismatched payload is rejected.
- The new app action validates both the canonical game and the authenticated draft owner. The older unused insert action is not a claim of global idempotency for arbitrary raw PostgREST writes.
- Drafts currently cover **questions**, not every answer/comment/party input.

## Discovery and notifications

- Latest, unanswered (open + no visible answer), resolved (accepted answer), exact game and followed-game filters are applied in the DB query before 20-row pagination.
- Signed-out users choosing followed games receive a login link; an empty followed-game list never falls back to all games.
- Write notices distinguish signed out, age confirmation required, restricted account and failed permission lookup. Logged-in users needing age confirmation go to `/me?next=...`, not back through login.
- Opening a notification is a POST action with its target resolved from the authenticated owner's stored row. No client-provided destination is accepted.
- Single reads are caller-RLS scoped, idempotent, and cannot mark another user's notification or unrelated rows as read.
- The new `update_event_id` immutability trigger closes a gap in the older notification guard.
- Unread totals use the existing DB count RPC rather than counting only the most recent 100 list rows.
- Notification and account pages are revalidated after read changes. Question lists are revalidated after successful creation.

## QA boundaries

- Migration: `20260922000300_r1_community_experience_idempotency.sql`.
- Preview DB rollback tests passed: identical retry, payload conflict, request-key immutability, cross-account isolation, active-account gate, one-notification-only read, repeated read, routing immutability, unanswered/resolved filters. Anonymous RPC execution is denied. Temporary account/question residues were checked as zero.
- Unit tests cover drafts, expiry/corruption/size limits, account/game separation, input validation, permission states, filter query construction and notification ownership scope.
- `r1 oreun community ux qa` generates a clearly marked local-only test page from a text template. It is never committed under app/, never deployed, and writes no real UGC. Chromium/WebKit test simulated success/error/session expiry and real public navigation.
- Browser harness results are **not** real Google two-account login/notification E2E, nor physical-iPhone keyboard tests. Exact final runs and results are recorded on PR #236.

## Remaining

Real Google two-account community E2E, physical-device session/keyboard/back-button verification, and account deletion/content-retention UX still need separate work. Hosted Email provider shutdown remains separate from the already-removed app email login. No user identity or role is deleted or promoted by this change.
