# Interior v41 basic-harness parity QA

검수 브랜치: `interior-v40-preview` / Draft PR #201

## 목적

production-shell은 compare Apply/Cancel cleanup을 writer Web Lock 안에서 수행합니다. 기본 `quote-compare/`는 ownership-aware 순차 cleanup을 유지하므로 두 경로의 안전 조건이 같은지 별도로 검증했습니다.

## 공통 안전 조건

- fresh complete pair → writer 점유
- fresh source-only/handoff-only → partial writer 점유
- pair/partial 동안 새 writer 금지
- stale artifact는 writer 영구 차단 금지
- cleanup은 expected snapshot ownership만 삭제

따라서 기본 compare의 순차 삭제 중간도 writer에게 partial 점유 상태입니다.

## 상태 머신

**6 / 6 PASS**

1. cleanup 전 writer 차단
2. source-only 중간 writer 차단
3. handoff→source cleanup 완료 뒤 writer 성공
4. handoff-only 중간 writer 차단
5. source→handoff cleanup 완료 뒤 writer 성공
6. stale cleanup은 newer pair 보존

## production-shell 추가 안전성

- compare cleanup 자체 same Web Lock
- stale exact ownership/freshness 분리
- fresh exact but unusable pair owned cleanup
- production storage read-mask로 app-v21 초기 상태 오염 차단

관련 회귀:

- writer 8/8
- partial cleanup-window 11/11
- writer↔production compare lock 9/9
- basic parity 6/6
- stale ownership 8/8
- malformed exact 6/6
- numeric/autosave 11/11
- storage read mask 10/10

## hosted 전체 자동검사

- self-check 55
- failure 8
- writer concurrency 7
- pending recovery 9
- stale/invalid transfer 9
- robustness 18

총 **106개**. 외부 HTTPS preview 전에는 PASS로 기록하지 않습니다.

## 배포 상태

- main 수정 없음
- 운영 배포 없음
- 외부 preview 생성 없음
- Draft PR #201 유지
- 승인 전 merge 금지
