# v27 external-feedback triage

## Valid and implemented
- Global top navigation still had seven equal-priority links in v26 -> reduced to three direct tasks plus one `더보기` menu.
- Home still had two primary actions plus four utility links and a four-step flow -> replaced with one dominant estimate-check action and two secondary user-situation actions.
- Quote check still exposed amount/quantity/unit/spec/memo for all 12 items -> keep all 12 status rows visible, collapse advanced fields per row.
- Mobile quote-check wizard conflicted with the senior checklist use case -> all 12 status rows remain visible; only advanced details are progressive.
- Quote compare showed totals/chart before meaningful input -> totals/chart stay hidden until user changes a condition/amount; a difference summary is shown first.
- Quote compare assumed three vendors -> default to two, optional third vendor.
- Calculator exposed all trade rows immediately -> ask trade first, then reveal only relevant rows; full-list mode remains available.
- Header search and secondary information competed with primary actions -> search moved under `더보기`.

## Already fixed in v26; not reimplemented
- Visitor-facing `PRIMARY ANSWER`, `EVIDENCE TYPE`, `RELEASE CANDIDATE`, `OPEN`, `GO`, `PREVIEW`, `NOINDEX` chrome on the audited public surfaces.
- Empty N=0/P25/median KPI presentation on pyeong landing pages.
- Missing `/cost/insulation/` hub.
- Launch indexing of all 25 pyeong x trade pages and 17 regional detail pages: v26 already holds them from launch indexing.
- Public-data title intent for `/data/public-unit-cost/` and `/data/cost-index/`.

## Rejected or reframed
- `site-v21-bundle.css` remaining in the HTML is not evidence by itself that the UX did not change. It is the legacy base bundle; v26/v27 layers are loaded after it. The real issue was visible behavior, so v27 adds browser assertions instead of deleting a stable base asset without need.
- The current public GitHub Pages URL is not the v26/v27 review branch. It is expected to remain old until explicit deployment approval.
- Preview `noindex` is intentional and is preserved.

## Safety boundary
v27 is a review branch only. It does not merge to main, change CNAME, enable index/follow, submit Search Console, or add AdSense.
