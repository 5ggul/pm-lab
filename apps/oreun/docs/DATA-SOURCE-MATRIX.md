# Data Source Matrix

| Field / Feature | Class | Provider | Endpoint / Source | Freshness target | Cache | Retention | Failure behavior |
|---|---|---|---|---:|---:|---|---|
| universe_id | ROBLOX_PUBLIC_API + R1 identity | Roblox Public Games / R1 | verified identity | entity | long | entity lifetime | never replace identity from a missing response |
| root_place_id | ROBLOX_PUBLIC_API + R1 identity | Roblox Public Games / R1 | verified identity | entity | long | entity lifetime | mismatch raises data quality flag |
| canonical slug | R1_EDITORIAL | Oreun | games | manual | long | history kept | old slug redirect later |
| Korean name | R1_EDITORIAL | Oreun | games | manual | long | entity lifetime | English/source name remains separate |
| aliases | R1_EDITORIAL | Oreun | game_aliases | manual | long | entity lifetime | no-result query can feed future alias review |
| game icon | ROBLOX_PUBLIC_API | Roblox Thumbnail API | `thumbnails.roblox.com/v1/games/icons` | 5m cache | 5m | presentation only | glyph fallback if unavailable |
| source game name | ROBLOX_PUBLIC_API | Roblox Public Games | /v1/games | adaptive | ≤ cadence | current | keep last-good |
| description | ROBLOX_PUBLIC_API | Roblox Public Games | /v1/games | adaptive | ≤ cadence | current | keep last-good |
| creator | ROBLOX_PUBLIC_API | Roblox Public Games | /v1/games | adaptive | ≤ cadence | current | keep last-good |
| playing | ROBLOX_PUBLIC_API | Roblox Public Games | /v1/games | 5–120m by tier | ≤ cadence | raw 7d + rollups | no response = no new value, never 0 |
| visits | ROBLOX_PUBLIC_API | Roblox Public Games | /v1/games | 5–120m | ≤ cadence | raw + rollup last | no response = no new value |
| favorites | ROBLOX_PUBLIC_API | Roblox Public Games | /v1/games | 5–120m | ≤ cadence | raw + rollup last | no response = no new value |
| source updated time | ROBLOX_PUBLIC_API | Roblox Public Games | /v1/games | adaptive | ≤ cadence | current | unknown stays NULL |
| fetched_at | R1 operational provenance | Collector | ingestion time | each observation | none | provenance | required for freshness |
| expected interval | R1_DERIVED operational | Adaptive Collector | collector tier | each observation | none | raw lifetime | used for coverage |
| current state | ROBLOX_PUBLIC_API persisted by R1 | Oreun DB | game_provider_state | collector cadence | page 60s | last-good | UI recomputes freshness |
| Hourly history | R1_DERIVED | Oreun | game_rollups_hourly | after collection | short | 180d | gap remains gap |
| Daily history | R1_DERIVED | Oreun | game_rollups_daily | after collection | short | long-term | gap remains gap |
| raw sample coverage | R1_DERIVED | Oreun | sample/expected sample | each rollup | short | rollup lifetime | low coverage reduces confidence |
| 1H/24H/7D change | R1_DERIVED | Oreun | actual history | after sufficient coverage | short | recomputable | insufficient = data collecting |
| Popularity | R1_DERIVED | Oreun | latest current state | 5m class | short | optional history | unavailable sorted separately |
| Trending | R1_DERIVED | Oreun Trend Engine v1.1 | Hourly rollups | after sufficient history | short | versioned result | coverage <70% not eligible |
| update freshness component | ROBLOX_PUBLIC_API + R1_DERIVED | Roblox/Oreun | upstream updated | adaptive | short | trend payload | unknown component 0 |
| internal interest | R1_DERIVED | future Oreun events | unique actor/session | Sprint 02+ | n/a | bounded | disabled until real actor data |
| codes | R1_EDITORIAL / future UGC | future | Sprint 03 | content-specific | n/a | content policy | explicit verification dates |
| guides | R1_EDITORIAL / COMMUNITY_UGC | future | Sprint 03 | content-specific | n/a | content policy | editorial/UGC separated |
| Q&A | COMMUNITY_UGC | future | Sprint 02 | realtime-ish | n/a | moderation policy | ads gate/moderation |
| Community analytics | OFFICIAL_OPEN_CLOUD where authorized | future CommunityProvider | Sprint 05 | TBD | TBD | TBD | feature flag |

## Source classes

### ROBLOX_PUBLIC_API
Current main Experience data source.

It is isolated behind Provider Adapter and is not treated as equivalent to Open Cloud stability guarantees.

Observed real exception:
- Brookhaven universe `1686885941`
- identity is valid
- current Public Games request omits the actual Universe row and can return a zero-id placeholder

R1 behavior:
- zero-id row discarded
- no fake zero-valued Snapshot
- target failure recorded
- adaptive backoff

### OFFICIAL_OPEN_CLOUD
Preferred where a stable authorized endpoint fits the product.

Community APIs remain Sprint 05 behind a feature flag.

### R1_DERIVED
Examples:
- rollup
- coverage
- Trend
- changes
- freshness presentation
- scheduling metadata

Every algorithm has an explicit version when semantic meaning may change.

### R1_EDITORIAL
Examples:
- Korean name
- aliases
- Korean description

### COMMUNITY_UGC
Sprint 02+ only.

Never mixed with official/source values.

## Provenance

Roblox observation:

```text
data_sources
 → ingestion_runs
 → game_provider_state
 → game_snapshots
 → rollups
 → derived metric
```

Minimum provenance:
- source provider
- endpoint/source class
- ingestion run
- fetched/captured time
- raw or derived
- calculation version for derived data

## Freshness

Freshness is **not a permanent DB label**.

UI recalculates it from current time minus `fetched_at`.

If collection stops:
- stored value remains available as last-good
- UI changes delayed → stale
- it is never called live forever

## Current Preview reality

The Preview DB is actively collecting real Roblox Public Games data.

Current historical coverage is intentionally immature. Until sufficient real time passes:
- 24H/7D Trends remain unavailable
- QA Fixture is allowed only under explicit Preview fixture mode
- actual product metrics never borrow synthetic history

## Retention

- Raw: 7d
- Hourly: 180d
- Daily: long-term
- ingestion/provenance retained according to operational policy
- Cron run history cleaned after 7d

## Selective purge

`data_sources.purge_group` lets R1 identify data derived from a provider.

If Roblox access/policy changes require deletion, records can be selected by source/provenance instead of deleting unrelated R1 Editorial or Community data.
