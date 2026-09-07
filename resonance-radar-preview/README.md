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
Tracked Solana wallets
        │
        ├── Helius Enhanced Webhook (push-first, 준비됨)
        │          ↓
        │   Supabase Edge Function
        │   resonance-radar-collector
        │          ↓
        └── Supabase Cron every 1 minute
                   ↓
          5m / 15m / 60m recompute
                   ↓
              Supabase DB
            ↙             ↘
 GitHub Pages noindex      Telegram(optional)
        Radar
```

**Cloudflare Worker는 더 이상 기본 런타임이 아닙니다.** `worker/` 코드는 대체 배포 경로와 비교용으로 남겨두지만 현재 기본 수집기는 Supabase Edge Function + Supabase Cron입니다.

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
- Supabase Cron `* * * * *` — 매 1분
- Helius Enhanced Webhook receiver
- Helius token-balance delta → BUY / SELL normalize
- DEX Screener batch enrichment
- threshold crossing / reversal alert hooks
- `provider_trade_id` UNIQUE 중복 방지
- raw wallet/trade 데이터와 공개용 projection 분리

## Supabase 프로젝트

현재 연결 프로젝트:

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

## Supabase Edge Function

Source:

```text
supabase/functions/resonance-radar-collector/index.ts
```

배포 함수명:

```text
resonance-radar-collector
```

현재 상태:

- ACTIVE
- `verify_jwt=false`
- 외부 webhook은 private `helius_webhook_secret` 검증
- cron tick은 private `edge_cron_secret` 검증
- secrets는 `collector_state`에 저장하며 anon/authenticated 접근 불가

### 1분 Cron

DB에 등록된 job:

```text
resonance-radar-minute-tick
* * * * *
```

`pg_cron + pg_net`이 Edge Function에 `{ "action": "tick" }`을 전송합니다.

데이터가 한 건도 없으면 Function은:

```json
{"ok":true,"mode":"ready","affected":0}
```

을 반환하며, 프리뷰가 이를 LIVE 거래 데이터로 오해하지 않습니다.

## Helius 실시간 경로

Edge Function은 Helius Enhanced Webhook payload를 받을 준비가 되어 있습니다.

1. 추적 Solana wallet을 `traders` + `wallets`에 등록
2. Helius webhook의 accountAddresses에 해당 wallets 등록
3. webhook delivery의 `Authorization` 헤더를 DB의 private `helius_webhook_secret`과 일치시킴
4. Helius delivery를 즉시 acknowledge하고 background 처리
5. tracked wallet token delta를 BUY/SELL로 normalize
6. DEX Screener에서 price/liquidity/market cap 보강
7. raw trade + safe public trade projection 저장
8. affected token만 즉시 resonance 재계산
9. 이후 매 1분 cron이 rolling window decay를 계속 계산

Helius API key는 정식 사이트 공개와 무관하며, 실시간 데이터 수집을 켤 때 Supabase Edge Function Secret으로만 추가합니다.

## Score / Alert 기본값

- BUY threshold: 70
- Strong threshold: 85
- Low liquidity: $150k 미만이면 score 최대 60
- 15분 unique buyers >= 3 + net buy > 0 → BUY candidate
- 5분 buyers >= 3 및 15분 buyers의 55% 이상 → ACCELERATION
- 15분 sellers >= 3 + sell volume > buy volume → SELL pressure
- 이전 BUY/ACCELERATION 이후 SELL pressure → REVERSAL

동일 score 변화마다 반복 알림하지 않고 threshold crossing / signal transition만 알립니다.

## 레거시 / 대체 런타임

`worker/`에는 동일 아이디어의 Cloudflare Worker 구현이 남아 있습니다. 현재 운영 기본값은 Supabase Edge Function이며, Cloudflare 코드는 다음 경우에만 다시 사용합니다.

- Supabase Edge Function 한도를 실제 측정 후 초과하는 경우
- 별도 멀티리전/격리 런타임이 필요한 경우
- Supabase 장애와 완전히 독립된 fallback이 필요한 경우

정식 도메인 배포 전까지는 위 조건이 발생해도 프론트 공개 방식은 변경하지 않습니다.
