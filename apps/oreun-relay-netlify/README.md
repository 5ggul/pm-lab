# R1 Roblox Relay — Netlify

Brookhaven의 Roblox Public Games current-state가 Supabase Edge egress에서 content-restricted placeholder로 변환되는 경우에만 사용하는 최소 read-only relay 후보입니다.

## 범위

- 공식 Roblox `https://games.roblox.com/v1/games`만 호출
- Brookhaven universe `1686885941`만 허용
- current `playing`이 유효하지 않으면 503
- 캐시하지 않음
- 쓰기 API / Supabase secret / Roblox credential 없음
- 사용자 데이터 없음

## Endpoint

`GET /api/roblox?universeId=1686885941`

collector는 다음을 모두 만족할 때만 relay 결과를 저장합니다.

- HTTPS endpoint
- source marker allowlist
- exact universe ID
- positive rootPlaceId
- non-restricted response
- finite non-negative playing
- fetchedAt가 현재 기준 2분 이내

## 배포 후

실제 endpoint가 외부에서 반복 검증된 뒤에만 Supabase Edge Function의
`R1_ROBLOX_RELAY_URL`에 전체 endpoint URL을 설정합니다.

예:
`https://<relay-site>.netlify.app/api/roblox`

설정 전에는 collector가 relay를 호출하지 않으며 Brookhaven current value를 만들어내지 않습니다.
