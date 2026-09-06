# Continuous collection — September 6, 2026

The user approved continuous collection on September 6. The public preview remains noindex while reliability is measured. Enabling a schedule is not evidence of a 99% service level.

## Operation

- GitHub Actions `airport-now-collector.yml`: every ten minutes at minutes 7/17/27/37/47/57. GitHub may delay scheduled jobs; the freshness monitor measures actual completion times.
- Five independent jobs: IIAC arrival, IIAC departure, KAC arrival, KAC departure and METAR. A failed flight source does not stop weather or other flights.
- Worker acquisition first, based on observed successful runs. On transient failure, try an independent runner IPv4 capture, then one final Worker recovery after a short pause. The entire recovery sequence is bounded to 390 seconds; authorization and quota errors stop that sequence. Only a complete, recent, ordered capture can be imported. Provider secrets remain in GitHub; raw provider responses and secrets are not uploaded as artifacts.
- Worker requests retry transient connection, HTTP 429/5xx and gateway 01/04/05/23 failures, within a 120-second source deadline. Authorization errors are not retried as transient failures.
- One lease per source, five-minute expiry, and a workflow concurrency lock prevent overlapping writes. Replaying unchanged flights adds no change events.
- Stop collection with `gh workflow disable airport-now-collector.yml`; restore with `gh workflow enable airport-now-collector.yml`. Existing data is retained, but expired values are hidden by public freshness checks.

## Measurement

`GET /api/status` reports last attempts/successes and time coverage over the observed portion of the last 24 hours. `collection_runs` retains completed source executions in D1. Availability artifacts retain the report from each workflow for 30 days.

A successful flight collection covers only the following 30 minutes, starting no earlier than actual publication. Overlapping intervals count once. Overall availability is the intersection of all four flight sources. A failed poll does not erase a still-valid last successful collection; clients show a retrying label. After 30 minutes, or for a different KST service date, it is unavailable. Short initial windows are not representative of a full day.

`GET /api/airports/summary` returns separate departure/arrival coverage, counts and recent METAR for 15 airports. Missing data uses null, not zero. Counts are today's observed operating-flight records, not a prediction of remaining movements. The database retains flights already observed that day even if a later provider response omits them.

## Observed evidence before scheduled operation

- Runs 34022999104 and 34023250869: intermittent upstream timeouts; KAC departure recovered in the second run (719 operating flights).
- Runs 34023365863 and 34023520076: IIAC arrivals and departures succeeded in both runs; 1,181/1,193 raw rows were collected in two pages per source instead of twelve. KAC still had failures; its larger-page behavior required separate verification.
- METAR completed in each run; old RKJK observations remain excluded from current weather.
- Run 34023699227 recovered KAC arrival (713 operating flights, nine pages). The public summary subsequently had valid last-good departure and arrival coverage for all 15 airports, but later polls still failed. KAC retains the verified 100-row page size; larger-page experiments did not establish reliability.
- Public home verification: 15 national cards, separate source timestamps and degraded labels, no horizontal overflow at 390px, and all four navigation links available through a 44px menu button. The home rechecks its summary every minute while visible and when returning to the tab. Airport boards refresh every five minutes and on tab return; expiry timers hide a displayed flight board after its last successful collection reaches 30 minutes, even without another API response.
- Security, completeness, SQL replay, source isolation, freshness and time-coverage tests passed. These checks verify implementation, not a long-term availability target.

Do not unlock indexing or claim 99% availability until measured operation supports it. The 7–14-day observation period starts with continuous collection; historical comparisons require accumulated real data.
