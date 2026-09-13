# v11.52 browser regression integration — 2026-09-13

## Scope and provenance

This is a preview-only follow-up stacked on PR #196 at
`c8564da71c855c13fc79833f8ec7f4aac34fd718`.
PR #195's reviewed calculator reader, mobile home-title and formula contrast fixes
were not connected to #196's rebuild path. The shared helper retains exactly that
reader and CSS, with stricter malformed-input guards and read-only validation.
The prior patch provenance is `79b7a6740142d06284d0cdfe7d017dacbc8bc1d9`.

## Integration

- The v11.52 generator applies the helper to its fixed preview output directory
  before declaring RC readiness. No additional top-level build command is added.
- Existing 77-step npm/workflow ordering, legacy npm guards and #196's compare
  hydration changes are retained; package.json and pipeline/workflow files are
  untouched by this follow-up.
- The RC validator inspects the real app.js and CSS and fails on missing repairs.
  It does not repair assets or trust an old rcReady report alone.
- The compatibility CLI remains available for #195-style local QA. Repeated use
  is idempotent. Only assets/app.js and assets/site.css may be written by the helper.
- The focused workflow runs the new tests with contents: read and has no build,
  commit or deployment step. Its result is not a full browser/SSG certification.

```bash
node --test franchise-ssg-core/browser-regression-assets.test.mjs
npm --prefix franchise-ssg-core test
npm --prefix franchise-ssg-core run build:preview
npm --prefix franchise-ssg-core run validate:preview
```

## Verification actually completed

- New local unit/contract suite: 21/21 passed on Node 22.16.0.
- Against #195's retained repaired preview artifact, the helper changed zero
  bytes, confirming parity with the reviewed reader and CSS.
- Targeted RC-stage replay and RC validation passed using its 311-page retained
  preview. For this test fixture only, the reader/CSS repairs were removed and
  manifest.uiVersion was set to 11.51 before running the modified #196 RC stage.
  This is NOT a complete 77-step rebuild or a newly generated #196 snapshot.
- A stale RC report with the old input reader was rejected by the modified RC
  validator without writing any file. All 311 fixture HTML pages retain noindex.
- Real Chromium 144 rendered the retained HTML with its actual assets inlined:
  home title, break-even and open-close calculator checks at 360/390/768/1440px
  passed (12 cases, 48 calculator assertions). The formula colors were checked.
- The form-based monthly-profit calculator produced all four expected numbers,
  but its History API updates errored under the offline about:blank origin.
  That case is PARTIAL, not a browser pass. The browser report overall is false.

## Limits and next verification

The environment blocked loopback navigation with ERR_BLOCKED_BY_ADMINISTRATOR;
no browser policy was changed. Offline DOM rendering does not validate actual URL
navigation, history updates, hosting, external requests or full-page coverage.
Agent-browser was unavailable. The full repository build and online CI success
are not claimed. Base #196 entrypoint CI last observed had startup_failure with
zero jobs; its underlying cause was not determined.

Before approval: run both test suites and the complete guarded preview build in
a full checkout, then repeat real-origin browser QA, including monthly-profit
URL state and #196's four-brand compare interactions. Existing desktop freshness
KPI clipping and long category-label checks remain separate follow-up tasks.

## Release boundary

No generated docs, franchise data, robots, sitemap, index policy, advertising IDs
or production configuration are committed here. No main merge, public preview
update, production candidate approval or deployment is authorized by this work.
The existing two explicit production approval gates remain unchanged.
