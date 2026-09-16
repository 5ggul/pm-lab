# Interior v41 handoff QA

검수 대상: `interior-v40-preview` / Draft PR #201

## 이번 수정

- `quote-check`에서 선택한 A/B/C 업체 칸으로 넘긴 견적을 `quote-compare`에서 자동 적용하지 않고 미리보기 후 적용/취소합니다.
- 적용된 비교 상태를 검수 전용 키 `interior-quote-compare-state-v41`에 저장해 새로고침 후에도 유지합니다.
- 원본 견적은 검수 전용 키 `interior-quote-source-v41`로 분리했습니다. 기존 `interior-quote-v5`를 사용하지 않습니다.
- 원본과 handoff는 v2 `transferId` + `createdAt` 쌍이 모두 일치할 때만 적용합니다.
- 저장 도중 일부 key 기록이 실패하면 source/handoff 두 검수 key를 정리해 혼합 상태를 남기지 않습니다.
- 비교 페이지 이동은 `/pm-lab/...` 절대 경로가 아니라 현재 quote-check 위치 기준 `../quote-compare/` 상대 경로로 계산합니다.
- 다른 업체 칸에 새 견적을 적용해도 기존 업체 칸은 보존합니다.
- 취소 시 handoff 플래그만 지우고 기존 비교표와 검수용 원본 견적 저장값은 유지합니다.
- 30분이 지난 stale handoff는 자동 제거합니다.
- 12개 필수 공종 또는 상태값이 누락·손상된 원본 견적은 적용하지 않고 handoff만 제거합니다.
- 검수 저장 초기화는 비교표 검수 전용 상태만 삭제하고 검수용 원본 견적은 유지합니다.
- URL에는 견적 payload를 넣지 않습니다.
- 페이지는 `noindex,nofollow,noarchive,nosnippet`을 유지합니다.

## 운영 스키마 대조

`main`의 `app-v21-bundle.js`와 quote-check 마크업을 기준으로 대조했습니다.

- 공종 id 12개 일치: `demolition`, `waste`, `waterproof`, `bathroom`, `kitchen`, `wallpaper`, `flooring`, `carpentry`, `electrical`, `window`, `management`, `vat`
- 상태값 일치: `included`, `separate`, `missing`
- 상세 필드 일치: `amount`, `qty`, `unit`, `spec`, `memo`
- 기본 조건 필드 6개를 v41 하네스에도 반영: `supply`, `exclusive`, `building`, `region`, `scope`, `bathrooms`
- 운영 compare 저장 키 `interior-compare-v5`, `interior-compare-v6`는 v41 하네스에서 쓰지 않음

## 추가 회귀에서 발견한 결함과 조치

### 1. 검수 하네스가 기존 원본 견적 키를 덮어쓸 수 있었음

기존 v41 handoff는 원본 견적에 `interior-quote-v5`를 사용하고 있었습니다. 같은 origin에서 실제 견적 확인 기능이 이 키를 사용하면 검수 하네스가 기존 저장값을 덮어쓸 수 있으므로 검수 격리가 불완전했습니다.

조치:

- 원본 견적 키를 `interior-quote-source-v41`로 변경
- 비교표 키 `interior-quote-compare-state-v41`와 함께 v41 검수 데이터 전체를 별도 namespace로 격리
- 테스트에서 `interior-quote-v5`, `interior-compare-v5`, `interior-compare-v6` sentinel 값이 변경되지 않는지 확인

### 2. fresh handoff + 누락/손상 quote가 반복해서 남을 수 있었음

handoff는 정상 시간이지만 quote JSON이 없거나 12개 공종 중 일부가 누락된 경우, 기존 로직은 handoff를 명시적으로 제거하지 않고 비교 페이지에 남길 수 있었습니다. 또한 불완전한 quote가 target 업체 칸에 적용될 여지가 있었습니다.

조치:

- 12개 공종 존재 여부 검증
- 상태값을 `included`, `separate`, `missing` 중 하나로 제한
- 불완전한 quote는 적용 금지
- 관련 handoff 즉시 제거
- 기존 A/B/C 저장 비교표는 보존

### 3. 외부 프리뷰 base path가 다르면 비교 이동 경로가 깨질 수 있었음

기존 handoff는 `/pm-lab/interior-v41-preview/quote-compare/`를 하드코딩했습니다. GitHub Pages에서는 맞더라도 Netlify/Vercel 등 다른 base path의 same-origin 프리뷰에서는 404가 날 수 있습니다.

조치:

- 현재 `quote-check/` URL 기준 `new URL('../quote-compare/', location.href)`로 목적지를 계산
- `/pm-lab/`, `/docs/`, root 하위 배치 3종을 대상으로 경로 회귀 확인

### 4. 여러 탭/연속 전송에서 이전 handoff와 새 source가 섞일 가능성

source와 handoff가 별도 key에 저장되는데 둘 사이를 식별하는 값이 없으면, 일부 저장 실패 또는 탭 간 연속 전송 상황에서 이전 target과 새 quote가 조합될 수 있습니다.

조치:

- source/handoff 모두 v2 `transferId`와 동일 `createdAt` 기록
- 두 값이 정확히 일치하는 쌍만 quote-compare에서 허용
- 불일치 pair는 적용하지 않고 handoff 제거
- source 저장 후 handoff 저장이 실패하는 경우 두 검수 key를 모두 정리

### 5. v41 quote-check 하네스가 운영 기본조건 6개를 모두 재현하지 못했음

기존 하네스는 `region`만 넣어 context 전달을 검사했습니다. 실제 quote-check는 공급평수, 전용평수, 건물유형, 지역, 공사범위, 욕실 수를 함께 사용합니다.

조치:

- 6개 context 필드를 하네스에 추가
- 공종 상세 입력도 운영과 동일한 `amount / qty / unit / spec / memo` 구조와 label을 사용

## 자동 검증 결과

- `quote-check-handoff-v41.js` Node 문법 검사: PASS
- transfer/validation 핵심 함수 Node 문법 검사: PASS
- 기존 VM persistence 로직: 13 / 13 PASS
- 기존 quote-check → quote-compare 통합 VM 회귀: 30 / 30 PASS
- 새 portable route + transfer pair 회귀: 13 / 13 PASS
- 실제 handoff 코드 VM 저장/이동 회귀: 14 / 14 PASS

새 13개 회귀 항목:

1. GitHub Pages형 `/pm-lab/...` base에서 상대 이동 정상
2. `/docs/...` base에서 상대 이동 정상
3. root 하위 preview base에서 상대 이동 정상
4. 운영형 12개 공종 quote 허용
5. v2 fresh handoff 허용
6. 정상 source/handoff transfer pair 허용
7. transferId 불일치 거부
8. createdAt 불일치 거부
9. legacy v1 handoff 거부
10. 잘못된 target 거부
11. 30분 초과 stale 거부
12. 필수 공종 누락 quote 거부
13. 허용되지 않은 state 거부

실제 handoff 코드 VM 14개 회귀 항목:

1. 외부 preview base 상대경로 이동
2. 반환 URL과 navigation URL 일치
3. source version 2 기록
4. handoff version 2 기록
5. source/handoff transferId 일치
6. source/handoff timestamp 일치
7. B target 보존
8. 운영 기본조건 6개 캡처
9. 12개 공종 전체 캡처
10. amount/spec 등 상세필드 캡처
11. handoff 저장 실패 시 오류 발생
12. 부분 실패 후 source 제거
13. 부분 실패 후 handoff 제거
14. 부분 실패 시 navigation 미실행

## 남은 실브라우저 검수

현재 실행 환경에서는 localhost 및 임의 로컬 origin 접근이 `ERR_BLOCKED_BY_ADMINISTRATOR`로 차단되어 실제 Chromium 클릭 자동화는 완료하지 못했습니다.

새 외부 프리뷰 호스팅 프로젝트는 만들지 않았습니다. 기존 원칙대로 명시적 승인 후에만 외부 프리뷰를 만들고 아래 순서를 실제 URL에서 다시 검증합니다.

1. 6개 기본조건 + 견적 입력
2. A / B / C 대상 선택
3. 비교표 이동
4. 미리보기 확인
5. 적용 / 취소
6. A → B → C 연속 전송
7. 새로고침
8. 재접속 후 저장 상태 확인
9. 360 / 375 / 390 / 430px 모바일 폭 및 터치 동작 확인
10. 기존 사이트 localStorage 값이 실제 브라우저에서도 변하지 않는지 확인
11. 두 탭에서 순차 전송 시 transferId 불일치가 잘 차단되는지 확인

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- Draft PR #201 유지
- 외부 preview 프로젝트 생성 없음
- 리뷰 승인 전 merge 금지
