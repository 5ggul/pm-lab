# R1 Roblox Relay — Vercel

Brookhaven의 Roblox Public Games current-state가 Supabase Edge egress에서 content-restricted placeholder로 변환되는 경우에만 사용하는 read-only relay입니다.

## 범위

- 공식 Roblox `https://games.roblox.com/v1/games`만 호출
- Brookhaven universe `1686885941`만 허용
- current `playing`이 유효하지 않으면 503
- cache 없음
- 쓰기 API / Roblox credential / Supabase secret 없음
- 사용자 데이터 없음

## Endpoint

`GET /api/roblox?universeId=1686885941`

collector는 relay 결과를 저장하기 전에 universe ID, rootPlaceId, current playing, source marker, fetchedAt freshness를 다시 검증합니다.
