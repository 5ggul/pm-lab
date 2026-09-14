# Interior v43 quote review flow

Non-production review flow:

1. `quote-check`: click `검수 리포트 보기` to save the current quote form to `interior-quote-v5`, then open the report.
2. `quote-compare`: click `검수 리포트 보기` to save the current A/B/C DOM values to both `interior-compare-v5` and `interior-compare-v6`, then open the report.
3. `quote-review-report`: reads saved values only. Rendering the report does not mutate quote/compare persistence.

The review route does not create `interior-quote-compare-handoff-v42`, does not put quote values in the URL, and does not submit values to a server.

Temporary review wrapper:

`https://raw.githack.com/5ggul/pm-lab/interior-v43-review-report/docs/interior-v43-preview/index.html?page=quote-check`

Available wrapper pages: `quote-check`, `quote-compare`, `quote-review-report`.

Production rule: no `main` merge or production promotion without explicit user approval.
