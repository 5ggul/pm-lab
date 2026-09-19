# QA Report — Sprint 01

Status: **QA PASSED for the implemented Sprint 01 scope.**

Full implementation validation completed in GitHub Actions run **35344434076** after the mobile Game Hub UX fixes. That run passed provider smoke, TypeScript typecheck, unit tests, Next.js production build, Chromium browser QA, Game Hub search visibility, KST provenance display, and the feature-branch cleanup/materialization step.

## Implemented
- Provider Adapter for Roblox public game detail endpoint
- verified fallback snapshots with explicit stale handling
- alias search ranking and normalization
- freshness/null-vs-zero behavior
- preview-only historical fixture switch (off by default)
- Trend v1 with low-baseline protection and coverage eligibility
- Home / Games / Rising / Search / Game Hub / Methodology / Data Status
- responsive CSS for 360/375/390/430 and desktop target widths
- RLS-first Supabase reference migration
- collector/search/trend unit tests and Playwright browser QA script\n- server-only persistent Collector store/runner, protected trigger route and rollup/retention SQL runtime

## Verified
- Roblox provider smoke request succeeded
- TypeScript typecheck passed
- collector/search/trend unit tests passed
- Next.js production build passed
- Chromium QA passed at 360, 375, 390, and 430px
- desktop Rising page QA passed
- Home → search `라이벌즈` → `/game/rivals` → 7D chart interaction passed
- browser QA reported no console/page errors
- Play button remained explicit external navigation
- `.next`, `node_modules`, and QA screenshots are excluded from the final PR diff

## Defects found and fixed during QA
1. Bootstrap payload part04 lost seven Base64 characters, causing `Z_BUF_ERROR: unexpected end of file`. The missing bytes were restored and bootstrap then passed.
2. The initial browser script could match both the header search and the main search. QA was scoped to the primary main search.
3. The first materialization commit accidentally tracked `.next` and `node_modules`. Cleanup logic and an app-level `.gitignore` were added; the final PR contains no build/dependency artifacts.\n4. Visual screenshot review found the required primary search missing from the mobile Game Hub. A Game Hub search was added above the game identity block and browser QA now asserts it is visible.\n5. Visual screenshot review found the provenance timestamp rendered as raw UTC ISO text. It is now formatted in Asia/Seoul time and browser QA asserts the source block contains `KST`.

## Deliberately not implemented
Auth, Follow, notifications, Q&A/comments, codes/guides UI, party, Community API, actual ads, Roblox OAuth.

## Known limitations
1. R1 has no dedicated Supabase project. No migration has been applied; the unrelated `밈 레이더` project was not touched.
2. No Vercel R1 project is connected. This branch performs **no Production deployment** and currently has no hosted Preview URL.
3. Real Historical Data cannot exist on day zero. Default UI therefore shows data collection state. Browser QA enables an explicitly labeled synthetic history fixture only to exercise Trend/chart UI.
4. Seed fallback snapshots are intentionally stale and never labeled live.
5. The verified seed catalog is below the long-term 24-game goal. Unverified experiences are not fabricated to hit a count.
6. Supabase persistence code and migrations are implemented but cannot be integration-tested against a real database until a dedicated R1 project is approved. No unrelated project was used.\n7. Hosted scheduling is intentionally not enabled until the dedicated DB and a hosted Preview exist.

## Data distinction
- Live attempt: Roblox public game detail API through the provider adapter.
- Fallback: previously verified Roblox snapshots, explicitly stale when used.
- Historical QA fixture: synthetic and enabled only by `R1_PREVIEW_FIXTURES=1`.
- Production/default historical UI: no fabricated history; insufficient windows display data-collection state.
