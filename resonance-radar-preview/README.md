# Resonance Radar Preview

여러 독립 트레이더가 짧은 시간 안에 같은 토큰을 같은 방향으로 거래하는 **공진(convergence)** 을 탐지하는 개인용 레이더 MVP입니다.

> 이 도구는 시장 데이터 모니터링 및 연구용이며 투자 권유나 수익을 보장하지 않습니다.

## 배포 원칙

정식 도메인을 구매하고 별도 승인하기 전까지는 **GitHub Pages noindex 피드백 사이트만 유지**합니다.

- Feedback URL: `https://5ggul.github.io/pm-lab/resonance-radar-preview/`
- `noindex,nofollow,noarchive,nosnippet,noimageindex`
- 정식 도메인 연결 금지
- Vercel production 배포 금지
- sitemap/canonical/indexing 활성화 금지
- 백엔드는 실제 데이터를 수집해도 프론트는 위 noindex preview만 사용

## 현재 운영 구조

```text
Tracked Solana wallets (feedback set: 3)
        │
        ├── Helius Enhanced Webhook (push-first, receiver ready)
        │          ↓
        │   resonance-radar-collector
        │
        └── temporary public Solana RPC poller (every 1 minute)
                   ↓
          resonance-rpc-poller
                   ↓
          raw trade + safe public projection
                   ↓
          5m / 15m / 60m recompute every minute
                   ↓
              Supabase DB
            ↙             ↘
 GitHub Pages noindex      Telegram(optional)
        Radar
```

**Cloudflare Worker는 더 이상 기본 런타임이 아닙니다.** 현재 기본 백엔드는 Supabase Edge Functions + Supabase Cron입니다.

Public Solana RPC fallback은 **정식 운영용이 아니라 Helius/전용 RPC 연결 전 피드백 기간의 임시 검증 수단**입니다. 정식 사이트 공개 전 또는 Helius 연결 시 `resonance-radar-rpc-poll` cron을 끕니다.

## 현재 구현

- Next.js 모바일 우선 Live Radar UI
- GitHub Pages noindex feedback UI
- Supabase 실제 읽기, 10초 refresh
- 실데이터가 없을 때 명확한 `DB READY` + sample fallback
- 5m / 15m / 60m 독립 trader/cluster 집계
- Trader quality + unique trader + time density + net flow + volume + liquidity 기반 0~100 score
- BUY_RESONANCE / ACCELERATION / SELL_RESONANCE / REVERSAL
- 저유동성 score cap
- Supabase Edge Function collector
- Supabase Cron `* * * * *` — rolling recompute
- temporary Solana public RPC poller `* * * * *`
- Helius Enhanced Webhook receiver
- DEX Screener batch enrichment
- threshold crossing / reversal alert hooks
- `provider_trade_id` UNIQUE 중복 방지
- raw wallet/trade 데이터와 공개용 projection 분리

## Supabase 프로젝트

```text
name: 밈 레이더
ref: uxhlpmdneqkdydkuyqoj
region: ap-southeast-1
```

프론트는 **publishable key만** 사용합니다. secret/service-role key는 Edge Function 내부 기본 환경변수에서만 사용합니다.

### 공개 읽기 surface

anon SELECT 허용:

- `radar_current`
- `collector_runs`
- `traders` — active rows only
- `radar_recent_trades_public`

anon 접근 차단:

- `wallets`
- `trades`
- `signals`
- `collector_state`

`radar_recent_trades_public`에는 다음 안전 필드만 복제합니다.

```text
id
trader_label
side
symbol
amount_usd
executed_at
```

원시 wallet address / trader key / cluster key / tx 내부 정보는 브라우저에 공개하지 않습니다.

## Edge Functions

### `resonance-radar-collector`

Source:

```text
supabase/functions/resonance-radar-collector/index.ts
```

역할:

- Helius Enhanced Webhook receiver
- raw Helius payload → tracked wallet BUY/SELL normalize
- DEX Screener enrichment
- resonance score calculation
- radar/signals update
- optional Telegram alert
- 1분 rolling-window decay/recompute

### `resonance-rpc-poller`

Source:

```text
supabase/functions/resonance-rpc-poller/index.ts
```

피드백 기간 전용 fallback입니다.

- Solana public mainnet RPC 사용
- 최대 5개 tracked wallet만 읽음
- `getSignaturesForAddress` + `getTransaction`
- 최초 실행은 최신 signature만 cursor로 저장하고 과거 거래를 backfill하지 않음
- 이후 새 confirmed transaction만 처리
- 에어드롭/단순 token transfer 오탐을 줄이기 위해 **non-base token delta와 SOL/USDC/USDT 반대 방향 delta가 동시에 있을 때만 BUY/SELL**로 판정
- RPC 호출 사이에 간격을 둬 public endpoint rate limit을 완화
- 신규 trade가 있으면 즉시 `resonance-radar-collector` tick 호출
- 새 trade가 없으면 `collector_runs`를 만들지 않아 프리뷰가 가짜 LIVE 상태가 되지 않음

Supabase Cron:

```text
resonance-radar-minute-tick  * * * * *
resonance-radar-rpc-poll     * * * * *
```

Private request secrets:

```text
edge_cron_secret
rpc_poll_secret
helius_webhook_secret
```

모두 `collector_state`에 있고 anon/authenticated에서는 읽을 수 없습니다.

## 초기 피드백 지갑

파일:

```text
supabase/seed-feedback-wallets.sql
```

현재 피드백 set:

- `wrldsol`
- `remus`
- `frankdegods`

초기 `score`는 2026-09-07 FomoTop의 **picker hit-rate**를 사용했습니다. 이 값은 realised PnL이나 계좌 수익률이 아닙니다. 정식 출시 전에는 별도 장기 성과/표본수/드로다운 모델로 다시 산출해야 합니다.

## Helius 실시간 경로

Edge Function은 Helius Enhanced Webhook payload를 받을 준비가 되어 있습니다.

1. tracked wallets를 Helius accountAddresses에 등록
2. delivery `Authorization`을 private `helius_webhook_secret`과 일치시킴
3. webhook delivery 즉시 acknowledge
4. background normalize/enrich/store/recompute
5. Helius가 주 소스가 되면 `resonance-radar-rpc-poll`을 disable
6. 1분 `resonance-radar-minute-tick`은 rolling-window decay 용도로 계속 유지

## Score / Alert 기본값

- BUY threshold: 70
- Strong threshold: 85
- Low liquidity: $150k 미만이면 score 최대 60
- 15분 unique buyers >= 3 + net buy > 0 → BUY candidate
- 5분 buyers >= 3 및 15분 buyers의 55% 이상 → ACCELERATION
- 15분 sellers >= 3 + sell volume > buy volume → SELL pressure
- 이전 BUY/ACCELERATION 이후 SELL pressure → REVERSAL

동일 score 변화마다 반복 알림하지 않고 threshold crossing / signal transition만 알립니다.

## 재현 파일

```text
supabase/schema.sql
supabase/feedback-infra.sql
supabase/seed-feedback-wallets.sql
supabase/functions/resonance-radar-collector/index.ts
supabase/functions/resonance-rpc-poller/index.ts
```

## 대체 런타임

`worker/`에는 Cloudflare Worker 구현이 남아 있습니다. 다음 조건에서만 다시 검토합니다.

- Supabase Edge Function 한도를 실제 측정 후 초과
- 별도 멀티리전/격리 런타임 필요
- Supabase 장애와 완전히 독립된 fallback 필요

정식 도메인 배포 전까지는 어떤 백엔드 변경을 하더라도 프론트 공개 방식은 GitHub Pages noindex로 유지합니다.
