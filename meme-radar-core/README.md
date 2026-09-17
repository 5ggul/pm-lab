# Meme Radar V1

Second-level Robinhood Chain meme-token radar focused on **market cap below $1M**, with the highest alert sensitivity below **$100K**.

This branch is research/preview only. It does not place trades.

## Signal policy

| Market cap | Band | Base score gate | 10s buyers | Independent smart buyers |
|---|---:|---:|---:|---:|
| `< $100K` | `PRIME_EARLY` | 60 | 3 | 1 |
| `$100K–300K` | `EARLY` | 70 | 5 | 2 |
| `$300K–600K` | `MOMENTUM` | 79 | 8 | 2 |
| `$600K–1M` | `LATE_EARLY` | 87 | 12 | 3 |
| `>= $1M` | excluded | — | — | — |

Market cap is a routing gate, not a safety score. A low market cap never overrides risk checks.

## What counts as a smart-wallet buy

The bootstrap roster is refreshed from the public FOMO Robinhood Radar leaderboard, which exposes resolved EVM wallets and its current trader score. That external score is only the starting prior. Once this radar has settled local `<$100K` outcomes, `earlyModelQuality` can override or reduce the weight of that external prior.

A tracked wallet receives smart-money credit only when the confirmed on-chain swap can be attributed to that wallet. Direct router injections and buys below the dust threshold are excluded. Three or more pushed/dust wallets that outnumber real attributed buyers mark the token as `seeded`, which is a hard reject.

Wallet independence is not address-counting. The sequencer feed watches direct native-ETH funding transfers into tracked smart wallets, recovers the signed transaction sender, and groups wallets sharing the same meaningful funder. If one funder touches more than the configured wallet limit, it is treated as shared infrastructure and those wallets are split again rather than being collapsed into one trader. Blockscout is optional historical bootstrap only; live clustering does not depend on explorer indexing.

## Current Robinhood Chain path

V1 prioritizes the current Uniswap V4 path and also keeps V2/V3 discovery for compatible native-ETH/WETH/USDG pairs:

1. Watch PoolManager `Initialize` for new native-ETH/token pools and legacy V2/V3 pool creation events.
2. Recognize the current era-2 V4 launch shape (`fee=10000`, `tickSpacing=200`, zero hook).
3. Start a HoodWatch `audit --json --fast` immediately for live candidates.
4. Watch confirmed swaps and derive buy/sell direction using the correct V4/V3/V2 sign semantics.
5. Derive live market cap from pool price, token supply, and ETH/USD or USDG quote value.
6. Ignore swaps once the token is already `>= $1M`.
7. For `<$1M`, resolve token-side buyer identity from the receipt and apply smart-wallet provenance rules.
8. Feed 10-second rolling buyer velocity, capital velocity, imbalance, independent smart buyers, safety, and liquidity into the radar score.

The Robinhood sequencer feed is subscribed in parallel. It provides pre-confirmation launch/buy telemetry and live direct-funder observations for tracked wallets. Final token identity, market cap, and trade accounting still come from confirmed on-chain events.

## Two-stage alert

- `PRIME WATCH`: `<$100K` + smart-wallet/buyer gates met while safety audit is still pending.
- `PRIME VERIFIED`: the same candidate after HoodWatch has returned a non-hard-fail result and the score gate is met.

This avoids hiding the earliest useful event behind an external audit while still refusing to label an unverified token as a confirmed signal.

## Shadow learning store

`ShadowStore` persists research data in SQLite. It records:

- every normalized `<$1M` trade used by the radar;
- WATCH and VERIFIED signals plus the smart wallets credited to each signal;
- live or historical funding-cluster evidence;
- outcome checkpoints at 1m / 5m / 15m / 1h / 6h when a later trade supplies a fresh market-cap observation.

The current checkpoint mechanism is **trade-driven**. If a token has no later observed trade after a horizon, that horizon remains unsettled instead of inventing a price. A dedicated horizon price sampler is still required before outcome statistics can be treated as unbiased production calibration data.

The six-hour settled outcomes feed `walletEarlyStats`, which can learn local win rate, 2x/5x hit rate, and severe-loss rate for `<$100K` entries.

## Run

```bash
cd meme-radar-core
npm install

export RH_WS_URL='wss://<production Robinhood websocket provider>'
export RH_RPC_URL='https://<production Robinhood RPC provider>'
export TELEGRAM_BOT_TOKEN='...'
export TELEGRAM_CHAT_ID='...'

npm test
npm run check
npm start
```

For real second-level operation, use a production WebSocket/RPC provider. The public Robinhood RPC is useful for development but should not be the latency-sensitive production transport.

### Optional environment variables

```text
RADAR_DB_PATH=meme-radar-shadow.sqlite
RH_POLL_MS=300
RH_BACKFILL_BLOCKS=6000
RH_DISABLE_FEED=0
HOODWATCH_TIMEOUT_MS=15000
HOODWATCH_DISABLE=0
SMART_WALLET_DIRECTORY_URL=https://fomoradar.app/api/leaderboard?status=active&limit=400
WALLET_ROSTER_REFRESH_MS=600000
DUST_ABS_USD=5
DUST_RATIO=0.02
FOMO_DIRECT_ROUTERS=0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f
FUNDING_MIN_ETH=0.001
FUNDING_MAX_WALLETS_PER_FUNDER=5
FUNDING_BOOTSTRAP_BLOCKSCOUT=0
BLOCKSCOUT_API_KEY=
LOG_RADAR=0
LOG_TELEMETRY=0
```

Set `FUNDING_BOOTSTRAP_BLOCKSCOUT=1` or provide `BLOCKSCOUT_API_KEY` only when historical explorer bootstrap is wanted. Live sequencer funding observations remain active without it.

## Scoring

`Radar score = 30% wallet quality + 20% independent smart buyers + 15% buyer velocity + 10% capital velocity + 10% buy/sell imbalance + 10% safety + 5% liquidity.`

Multiple addresses in the same resolved `fundingCluster` count as one independent smart buyer.

## Still required before a 24/7 live release

- long-lived collector hosting plus durable database backup/rotation;
- horizon-time price sampling so inactive tokens are not systematically missing from outcome evaluation;
- enough real `<$100K` samples to calibrate false positives, missed runners, and band thresholds;
- production Robinhood WebSocket/RPC transport, health checks, restart supervision, and alert-delivery monitoring;
- backend WebSocket/SSE fan-out if the dashboard is made live;
- Solana adapter using the same normalized event schema.

The first release should remain alerts-only until measured false-positive/false-negative rates are available.
