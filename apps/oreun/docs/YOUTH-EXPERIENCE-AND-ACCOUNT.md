# Playful discovery, resilient writing and account erasure

2026-09-23. Preview-only. Keep PR Draft/Open and noindex. No actual operator permissions were altered. No real user was deleted.

## UI
Lime/cyan/pink/lavender on readable navy, rounded real-image cards, a prominent search-first home, game shortcut chips, unanswered-question/party/guide actions, actual-catalog genre filters, visual guide covers, active five-item mobile navigation and a full-menu disclosure. No fake activity, fake urgency, streaks or endless animation. Reduced motion disables animation/transition. Game photos retain their existing provenance.

## Writing
AnswerComposer fixes immediate-success draft resurrection and adds explicit discard. Comments and parties use DraftForm: same-tab account/target-scoped 24-hour drafts, whitelisted restore, stable request UUID, storage-blocked fallback, pending lock, failed-request retention and success-only removal. Questions retain the earlier tested composer. New comment/party RPCs run with caller RLS, require an active signed-in account, validate parent context and serialize retries. Existing contact/Roblox URL restrictions remain. Failed party reads are not presented as zero parties.

## Deletion
/me/delete requires an explicit checkbox and typed confirmation. Its server action sends only the authenticated caller token to r1-delete-account. The Edge function validates Auth getUser, Google identity, recent sign-in AND this JWT's persisted recent session, requires role user, checks erasure readiness, and calls Auth Admin hard deletion for getUser.id (never a request-provided ID). Service credentials are confined to Edge built-in environment. Custom authentication is why the Edge gateway JWT check is disabled; missing/invalid bearer tokens are rejected by the handler.

A profile-delete trigger redacts only the departing user's own question/answer/comment content, removes author identity, closes/redacts hosted parties and clears their copied notification payload. Other authors' replies remain visible through left-joined anonymous-author feed views. Membership is removed and other hosts' parties are recounted. Existing restrictive FKs stay fail-closed; an overlooked relationship aborts the whole transaction. Admin/moderator accounts require separate role cleanup and cannot self-delete here. No birth date, school or location is added.

Live DB erasure is not a promise that host backup/security logs disappear immediately. The privacy screen distinguishes these, and no unsupported retention period is invented. The client clears its current account's drafts in this tab only after successful deletion.

## Verification scope
Local typecheck and 117 unit tests passed before repository application. Tests cover delete-target forgery, missing authentication, expired/revoked session, role/provider guards, failed deletion, oversized requests and draft isolation.

Two SQL suites used generated temporary identities inside a rolled-back subtransaction. They passed: answer/comment/party idempotency and payload conflicts; active-account/anonymous checks; cross-question comment denial; unsafe party link denial; unprivileged erasure denial; profile/identity/content redaction; preservation of other replies; accepted-answer reset; hosted-party closure; shared-party recount and private-capability cleanup. No temporary users or content persisted. These tests are NOT Google browser E2E.

CI adds finish-ux-browser-qa (Chromium/WebKit mocked local forms) and discovery-browser-qa (375/390/768/1440 real hosted navigation). The original broad browser suite remains unchanged and is invoked first by full-browser-qa. Production never contains the qa-finish harness; CI copies its .txt fixture locally. Final PASS results must be read from the final commit's runs, not inferred from this document.

## Still explicitly unconfirmed
Real Google two-account question-answer-acceptance-notification E2E, actual iPhone keyboard/session behavior, and a real sacrificial Google user's end-to-end self-deletion have not been performed. Do not mark their manual release confirmations complete from mock/SQL tests. Community writing now uses signed-in active-account status; the retired age self-attestation is not an access gate. Public launch/indexing/domain/AdSense and admin handover remain separate user decisions.
