# Resonance Radar Preview

여러 독립 트레이더가 짧은 시간 안에 같은 토큰을 같은 방향으로 거래하는 **공진(convergence)** 을 탐지하는 개인용 레이더 MVP입니다.

이 폴더는 `pm-lab` 안에서 독립된 Next.js 앱으로 동작하도록 만들어졌습니다. Vercel 프로젝트의 **Root Directory를 `resonance-radar-preview`** 로 지정하면 기존 `pm-lab` 프로젝트들과 충돌하지 않습니다.

> 이 도구는 시장 데이터 모니터링 및 정보 제공용이며 투자 권유나 수익을 보장하지 않습니다.

## 현재 구현

- Next.js 모바일 우선 Live Radar UI
- 10초 Dashboard refresh
- 5m / 15m / 60m 독립 트레이더 집계
- Trader quality + unique trader + time density + net flow + volume + liquidity 기반 0~100 score
- BUY_RESONANCE / ACCELERATION / SELL_RESONANCE / REVERSAL
- 저유동성 score cap
- Cloudflare Worker 1분 cron (`* * * * *`)
- **Helius Enhanced Webhook 실시간 Solana 감시** (거래 확정 후 push)
- Helius payload의 토큰 잔고 delta로 BUY / SELL 판별
- DEX Screener 무료 batch API로 가격·유동성·시총 보강
- Webhook 즉시 수신 + 1분 rolling-window 재계산 + optional polling fallback
- Supabase schema + RLS
- Telegram threshold / reversal alert
- 중복 trade 방지 (`provider_trade_id` UNIQUE)
- Collector health 기록
- 외부 API 미연결 시 Demo Mode
- 전체 프리뷰 noindex (`robots.txt` + metadata + `X-Robots-Tag`)

## 구조

```text
resonance-radar-preview/
├─ app/                   # Next.js App Router
├─ components/            # Live dashboard
├─ lib/                   # live/demo data adapter
├─ supabase/schema.sql    # DB schema
└─ worker/                # Cloudflare Worker collector
   └─ src/
      ├─ provider.ts      # optional FOMO API polling adapter
      ├─ helius.ts        # real-time Solana webhook parser / sync
      ├─ market.ts        # DEX Screener market enrichment
      ├─ scoring.ts       # resonance score
      ├─ db.ts            # Supabase REST
      ├─ alerts.ts        # Telegram
      └─ index.ts         # cron/webhook/run endpoints
```

## 1. 프리뷰만 바로 배포

Vercel에서 GitHub repo `5ggul/pm-lab`을 Import하고 Root Directory를:

```text
resonance-radar-preview
```

로 설정합니다.

환경변수를 하나도 넣지 않아도 **DEMO DATA**로 화면이 뜹니다. 검색엔진에는 노출되지 않도록 noindex가 강제됩니다.

## 2. Supabase 연결

새 Supabase 프로젝트에서 `supabase/schema.sql`을 SQL Editor에 실행합니다.

Vercel 환경변수:

```text
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
```

서비스 역할 키는 Vercel 프론트 환경변수에 넣지 않습니다.

## 3. Cloudflare Worker 1분 수집기

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put HELIUS_API_KEY
npx wrangler secret put HELIUS_WEBHOOK_URL
npx wrangler secret put HELIUS_WEBHOOK_AUTH
# Optional polling fallback only:
npx wrangler secret put DATA_PROVIDER_URL
npx wrangler secret put DATA_PROVIDER_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put COLLECTOR_SECRET
npm run deploy
```

`wrangler.toml`에 이미 다음 cron이 들어 있습니다.

```toml
[triggers]
crons = ["* * * * *"]
```

즉 **매 1분** 실행됩니다. Helius가 연결된 기본 모드에서는 active signal의 5m/15m/60m window를 재계산하고, `DATA_PROVIDER_URL`이 설정된 경우에는 같은 실행에서 polling 누락 복구도 수행합니다.

## 4. 가장 빠른 무료 실데이터 경로 — Helius + DEX Screener

Solana 추적은 generic polling API보다 Helius Enhanced Webhook을 우선합니다.

1. Worker를 먼저 배포합니다.
2. `POST /watchlist` 로 추적할 Solana 주소를 등록합니다.
3. `POST /helius/sync` 를 호출하면 현재 watchlist 전체를 Helius webhook의 `accountAddresses`에 동기화합니다.
4. Helius가 거래 관련 enhanced transaction을 `/webhook/helius` 로 push합니다.
5. Worker는 `accountData.tokenBalanceChanges`의 **tracked wallet token delta**를 읽어 BUY/SELL을 판별합니다.
6. DEX Screener `/tokens/v1/solana/{tokenAddresses}`를 최대 30개씩 batch 호출하여 USD 가격, 유동성, 시총을 붙입니다.
7. 거래를 저장하고 공진 점수를 갱신하며 threshold crossing 시 Telegram을 보냅니다.

Helius webhook은 즉시 200으로 acknowledge하고, DB/점수/Telegram 작업은 Cloudflare `ctx.waitUntil()`에서 비동기로 처리합니다.

Watchlist 추가 예시:

```bash
curl -X POST https://<worker>.workers.dev/watchlist \
  -H "x-collector-secret: $COLLECTOR_SECRET" \
  -H "content-type: application/json" \
  -d '{
    "address":"<solana-wallet>",
    "traderKey":"fomo-handle-or-stable-id",
    "traderLabel":"Trader A",
    "traderScore":88,
    "clusterKey":"owner-a"
  }'

curl -X POST https://<worker>.workers.dev/helius/sync \
  -H "x-collector-secret: $COLLECTOR_SECRET"
```

`HELIUS_WEBHOOK_AUTH`는 Helius가 webhook delivery의 `Authorization` 헤더에 넣을 긴 랜덤 문자열입니다.

## 5. 선택 사항 — 외부 FOMO polling API 계약

현재 provider는 실제 API를 아직 확정하지 않은 상태라 generic adapter로 만들어졌습니다.

기본 요청:

```http
GET {DATA_PROVIDER_URL}?since=2026-09-06T08:00:00.000Z&cursor=optional
Authorization: Bearer {DATA_PROVIDER_KEY}
```

기본 응답:

```json
{
  "trades": [
    {
      "id": "trade-1",
      "chain": "solana",
      "wallet": "wallet-address",
      "traderId": "trader-a",
      "traderLabel": "Trader A",
      "clusterId": "owner-cluster-a",
      "traderScore": 88,
      "tokenAddress": "token-address",
      "symbol": "TOKEN",
      "side": "BUY",
      "amountUsd": 5200,
      "liquidityUsd": 950000,
      "marketCapUsd": 12000000,
      "txHash": "...",
      "executedAt": "2026-09-06T08:00:08.000Z"
    }
  ],
  "nextCursor": "optional"
}
```

실제 FOMO/API 응답이 다르면 **`worker/src/provider.ts`의 `normalizeTrade()`와 응답 배열 추출 부분만 수정**하면 됩니다.

## 6. Generic webhook이 필요한 경우

원본 서비스가 Webhook을 지원하면 다음 endpoint로 즉시 넣을 수 있습니다.

```text
POST https://<worker>.workers.dev/webhook
x-collector-secret: <COLLECTOR_SECRET>
```

Webhook으로 이벤트를 받더라도 1분 cron은 데이터 누락 복구용 fallback으로 계속 유지합니다.

## 7. 수동 collector 실행

```text
POST https://<worker>.workers.dev/run
x-collector-secret: <COLLECTOR_SECRET>
```

Health:

```text
GET https://<worker>.workers.dev/health
```

## 8. Alert 정책

초기값:

- BUY threshold: 70
- Strong threshold: 85
- Low liquidity: $150k 미만이면 score 최대 60
- 15분 unique buyers >= 3 + net buy > 0 → BUY candidate
- 5분 buyers가 15분 buyers의 55% 이상이며 3명 이상 → ACCELERATION
- 15분 sellers >= 3 + sell volume > buy volume → SELL pressure
- 이전 BUY/ACCELERATION 이후 SELL pressure → REVERSAL

동일 score 변화마다 Telegram을 반복 전송하지 않고 threshold crossing / signal type transition만 알립니다.

## 현재 남은 계정 연결

코드 레벨 실시간 경로는 완성되어 있습니다. 실제 LIVE 전환에는 다음 계정 값만 필요합니다.

- Supabase project URL / anon key / service-role key
- Helius free API key
- Cloudflare Worker 배포 URL
- Telegram bot token / chat id (알림을 쓸 경우)
- 추적할 FOMO trader의 검증 Solana 주소 목록

FomoScan은 검증된 handle↔wallet 신원 확인에 사용할 수 있고, 실제 buy/sell 감지는 Helius가 온체인에서 직접 받기 때문에 FOMO API의 거래 endpoint에 종속되지 않습니다.
