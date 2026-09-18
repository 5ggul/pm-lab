# QA Report — Sprint 01

Status: branch implementation created; GitHub CI/browser verification must pass before this document is marked complete.

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
- collector/search/trend unit tests and Playwright browser QA script

## Deliberately not implemented
Auth, Follow, notifications, Q&A/comments, codes/guides UI, party, Community API, actual ads, Roblox OAuth.

## Known limitations before CI
1. R1 has no dedicated Supabase project. No migration has been applied; the unrelated `밈 레이더` project was not touched.
2. No Vercel R1 project is connected. This branch does not perform a production or preview deployment.
3. Real Historical Data cannot exist on day zero. Default UI therefore shows data collection state. Browser QA enables an explicitly labeled synthetic history fixture only to exercise Trend/chart UI.
4. Seed fallback snapshots are intentionally stale and never labeled live.
5. The seed catalog is below the long-term 24-game goal until IDs are individually verified; unverified experiences are not fabricated to hit a count.

## Required CI evidence
- npm dependency resolution/lockfile
- typecheck
- unit tests
- Next build
- 360/375/390/430 screenshots
- Home → search `라이벌즈` → Game Hub → chart period flow
- no console/hydration errors
