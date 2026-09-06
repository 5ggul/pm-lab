# Resonance Radar PRD v0.1 — Implementation Baseline

## Product goal

성과가 있는 여러 **독립** 트레이더가 동일 토큰에 같은 방향으로 짧은 시간 안에 움직이기 시작하는 순간을 가능한 빠르게 탐지한다.

우선순위는 `속도 → 데이터 정확도 → 독립 트레이더 판별 → 신호 품질 → UI`다.

## P0

- 1분 polling fallback
- Webhook/WebSocket 우선 구조
- 5/15/60분 rolling windows
- unique cluster 기준 buyer/seller count
- trader quality 반영
- BUY/SELL/ACCELERATION/REVERSAL state
- Telegram alert
- dashboard + token detail + collector health
- noindex preview

## Non-goals

- 자동매매
- 주문 API
- 수익 보장
- 유료 결제

## Score v1

```text
Trader Quality      25%
Unique Trader       25%
Time Density        15%
Net Flow            15%
Volume              10%
Liquidity           10%
```

저유동성 토큰은 score cap을 적용하며, 독립성은 wallet 수가 아니라 `cluster_key`로 집계한다.
