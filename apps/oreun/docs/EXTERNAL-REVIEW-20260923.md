# Independent-review corrections — 2026-09-23

Baseline: PR #236 HEAD 49da3ed59b1142517bbac08693e6821ff8861c85, exported at 87920af182dcc51d1addf24eb07d9d2c17f13591. Branch, technical oreun IDs, Google-only authentication, 14+ self-attestation, Draft/Open and all noindex gates remain unchanged. No redesign or engagement mechanics added.

## Verified defects and implementation

The actual public REST history request returned HTTP206, Content-Range `0-999/2531`: 1,000 rows instead of 2,531. The response ended at 2026-09-20T22:00:00Z whereas SQL had buckets through 2026-09-23T11:00:00Z. Read-only request 6177, checked on 2026-09-23. Pagination now requires consistent exact totals and stable timestamp/game-ID ordering, follows the actual returned range, detects duplicates/partial failures, and never silently uses a partial set. The query fixes its start/end bounds.

Trend eligibility includes the age of the last trusted nonnegative observation. `bucket_at` is an hourly bucket START, not a raw request timestamp; threshold is two declared intervals plus five minutes. Invalid/future/low-coverage values do not refresh it. Current zero is valid, null is not zero. Existing positive-momentum filters remain. Genuine 24h change is computed separately from the composite trend score. Popular-sort cards do not get trend badges; video and score are separate labels.

Request receipts use the authenticated owner + resource type + request UUID under caller RLS. Identical retry is a recovered success. Changed retry returns conflict with the existing visible destination, without calling INSERT or clearing modified text. An explicit confirmed new-request action rotates the nonce, keeps inputs and does not auto-submit. Lookup errors do not fabricate success. No live user content was registered to test this.

Visibility is shared by home, guide hub, game lists, detail and sitemap. A private registry contains only the 26 already-public fallback keys and a three-state missing/published/withheld marker. Trigger updates retain tombstones after deletion; public RPC exposes only these markers, not unpublished titles/bodies/authors. Existing approval guards and content RLS remain. Lookup/configuration failure is not treated as an absent guide. The registry migration and Adopt Me alias were applied without editing user content.

Notifications resolve the exact visible parent/answer/comment relationship, including deleted-author placeholders. Confirmed missing content gets an explanatory destination and only that owned notification is read. Read failures do not mark it read or claim deletion. No real notification was opened by this work.

Party intent is preserved for unavailable-current games; regional restrictions retain a labeled information-only exception. Existing guide/question actions move closer to the information. Public GitHub reporting is explicitly separated from a private-contact configuration, with personal-information warnings. No mailbox is invented; a verified operator destination must still be configured.

## Editorial scope — important

All 26 repository originals were read and edited individually, preserving facts already present in their cited source text. No new gameplay facts, play experience, probabilities, tiers or source review dates were fabricated. Three intro-only pieces (DOORS before-you-enter, 99 Nights camp-basics, Natural Disaster Survival survival-basics) are withheld rather than padded with invented instructions; the current corrected corpus has 23 published entries.

The live DB originals have a guard that downgrades any approved substantive edit and requires a real admin review. This work does NOT impersonate an admin, bypass that guard, issue new approvals or alter the live raw article body. An explicit exact-version copyedit compatibility table applies the reviewed copy only when universe/slug/title/summary/body match the known original. Independently edited DB content is untouched. DB withdrawal wins before any copyedit. The public formatter now only splits paragraphs and NEVER regex-deletes sentences or short factual warnings.

Thus repository and rendered originals are corrected; literal DB-body reconciliation and republication via the existing administrator review remain a separate follow-up. This is not a claim that live DB originals were rewritten or that new factual verification dates were earned. The mapping is auditable in editorial-revisions.json and must not become a generic filter.

## Verification plan / evidence

- Local typecheck and unit tests, including stale history, capped pagination, response-loss/edited conflict for all four resource kinds, owner scope, publication/withdrawal, exact copyedit boundaries, search false positives, child-notification targets and private contact.
- Real public read-only contract script records total rows versus pagination and unpaginated cap, source/body resolution, and no user writes.
- Chromium and WebKit local in-memory form actions simulate response loss for question/answer/comment/party and check modified draft retention, original new-tab link, explicit new nonce and success-only clearing. This is NOT Google two-account E2E.
- A disposable Postgres CI service tests the actual visibility migration through archived/rejected/deleted/missing/republication and no private-body privileges. No live records are modified by those tests.
- Existing browser QA stays in place, with factual assertions rather than a compulsory 26-public-guide quota. Additional 375px read-only checks cover search, guide CTA position, withheld guide links, party intent, score display and public-contact warning.

Final run IDs/results must be read from the final HEAD, not inferred from this document. Real Google accounts, physical iPhone Safari, actual account deletion and manual release confirmation flags remain unverified/untouched.

## Operator setup still required

Set a real monitored `R1_PRIVATE_CONTACT_EMAIL` or HTTPS `R1_PRIVATE_CONTACT_URL` and explicitly confirm `R1_PRIVATE_CONTACT_VERIFIED=1`. Do not copy example addresses. Actual backup/log retention, contractual processor relationships and any international-transfer details require owner verification before general release. Current privacy text distinguishes known implementation from these unknowns; no legal compliance guarantee is made.

Primary documentation consulted:
- https://supabase.com/docs/reference/javascript/v1/select
- https://postgrest.org/en/v11/references/api/tables_views.html
- https://pipc.go.kr/np/cop/bbs/selectBoardList.do?bbsId=BS217&mCode=G010030000

No production promotion, merger, domain, indexing or AdSense action is authorized by this patch.
