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
- Apply/Cancel/stale/mismatch 정리 시 현재 탭이 소유한 transfer만 삭제합니다.
- handoff 없는 source는 저장 중간 상태일 수 있으므로 fresh 상태에서는 보존하고 30분 지난 stale orphan만 정리합니다.
- 30분이 지난 stale handoff는 자동 제거합니다.
- 12개 필수 공종 또는 상태값이 누락·손상된 원본 견적은 적용하지 않습니다.
- 검수 저장 초기화는 비교표 검수 전용 상태만 삭제합니다.
- URL에는 견적 payload를 넣지 않습니다.
- 페이지는 `noindex,nofollow,noarchive,nosnippet`을 유지합니다.

## 운영 스키마 대조

`main`의 `app-v21-bundle.js`와 quote-check 마크업을 기준으로 대조했습니다.

- 공종 id 12개 일치: `demolition`, `waste`, `waterproof`, `bathroom`, `kitchen`, `wallpaper`, `flooring`, `carpentry`, `electrical`, `window`, `management`, `vat`
- 상태값 일치: `included`, `separate`, `missing`
- 상세 필드 일치: `amount`, `qty`, `unit`, `spec`, `memo`
- 기본 조건 6개 반영: `supply`, `exclusive`, `building`, `region`, `scope`, `bathrooms`
- 운영 compare 저장 키 `interior-compare-v5`, `interior-compare-v6`는 v41 하네스에서 쓰지 않음

## 추가 회귀에서 발견한 결함과 조치

### 1. 검수 하네스가 기존 원본 견적 키를 덮어쓸 수 있었음

- 원본 견적 키를 `interior-quote-source-v41`로 변경
- 비교표 키 `interior-quote-compare-state-v41`와 함께 v41 검수 데이터를 별도 namespace로 격리
- `interior-quote-v5`, `interior-compare-v5`, `interior-compare-v6` sentinel 미변경 확인

### 2. fresh handoff + 누락/손상 quote가 남거나 적용될 수 있었음

- 12개 공종 존재 여부 검증
- 상태값을 `included`, `separate`, `missing` 중 하나로 제한
- 불완전 quote 적용 금지
- 관련 handoff 제거
- 기존 A/B/C 저장 비교표 보존

### 3. 외부 프리뷰 base path가 다르면 비교 이동 경로가 깨질 수 있었음

- 현재 `quote-check/` URL 기준 `new URL('../quote-compare/', location.href)`로 목적지 계산
- `/pm-lab/`, `/docs/`, root 하위 배치 3종 경로 회귀 확인

### 4. 여러 탭/연속 전송에서 이전 handoff와 새 source가 섞일 가능성

- source/handoff 모두 v2 `transferId`와 동일 `createdAt` 기록
- 두 값이 정확히 일치하는 쌍만 quote-compare에서 허용
- 불일치 pair 적용 금지
- source 저장 후 handoff 저장 실패 시 두 검수 key 모두 정리

### 5. v41 quote-check 하네스가 운영 기본조건 6개를 모두 재현하지 못했음

- 공급평수, 전용평수, 건물유형, 지역, 공사범위, 욕실 수 6개 context 추가
- `amount / qty / unit / spec / memo` 구조 유지

### 6. 임시 source 견적이 handoff 종료 뒤에도 남았음

Apply 또는 Cancel 뒤에도 `interior-quote-source-v41`가 남아 임시 전달용 사용자 입력이 불필요하게 지속될 수 있었습니다.

조치:
- Apply 성공 후 현재 transfer의 source + handoff 삭제
- Cancel 후 현재 transfer의 source + handoff 삭제
- stale/mismatch 거부 후 해당 transfer만 삭제
- compare 저장 실패 시에는 재시도를 위해 source/handoff 유지
- handoff 없는 source는 source→handoff 순차 저장 중간일 수 있어 fresh 상태에서는 보존하고 30분 지난 stale orphan만 삭제

### 7. 다중탭에서 오래된 미리보기 Apply/Cancel이 새 transfer를 침범할 수 있었음

페이지 진입 때 transferId를 검증해도, 미리보기를 띄운 뒤 다른 탭이 새 transfer를 기록하면 기존 탭 메모리에는 예전 source/handoff가 남습니다.

두 문제가 있었습니다.

- 기존 탭에서 Apply 시 예전 견적을 그대로 적용할 수 있음
- storage 이벤트 도착 전에 기존 탭에서 Cancel 시 새 탭이 만든 transfer까지 삭제할 수 있음

조치:
- Apply 직전 localStorage source/handoff를 다시 읽어 target / transferId / createdAt / quote snapshot을 재검증
- 현재 미리보기와 저장소가 다르면 적용 금지 + preview 무효화
- source/handoff `storage` 이벤트를 감지해 오래된 preview 즉시 무효화
- 삭제 전에 source/handoff가 현재 탭이 처음 읽은 snapshot인지 재검증
- 현재 탭이 소유한 transfer만 삭제하고 다른 탭의 새 transfer는 보존

## 자동 검증 결과

- `quote-check-handoff-v41.js` Node 문법 검사: PASS
- `quote-compare/index.html` JS Node 문법 검사: PASS
- 기존 VM persistence: 13 / 13 PASS
- quote-check → quote-compare 통합 VM 회귀: 30 / 30 PASS
- portable route + transfer pair: 13 / 13 PASS
- 실제 handoff 코드 VM 저장/이동: 14 / 14 PASS

## Chromium 주입 실검수

외부 프로젝트를 새로 만들지 않고 실제 Chromium에 현재 branch HTML/JS를 직접 주입했습니다. `localStorage`만 메모리 shim으로 대체했습니다.

검수 폭: 360 / 375 / 390 / 430px

PASS:
- 페이지 전체 가로 overflow 없음
- H1 잘림 없음
- quote-check 기본조건 grid 반응형 정상
- 주요 action button 높이 44px
- native dialog viewport 내부 유지
- A/B/C radio 선택 정상
- dialog 최초 focus 진입 정상
- 취소 버튼 정상
- ESC 닫기 정상
- compare B target preview 정상
- Apply 후 B 업체 저장 정상
- 6개 context / 12개 공종 / 상세필드 보존
- Chromium page error 없음

360px compare 적용 후:
- document width: 360px
- grid client width: 328px
- grid scroll width: 388px
- 비교표만 내부 horizontal scroll, 페이지 전체는 밀리지 않음

기존 임시 전달 데이터 정리 Chromium 회귀:
- Apply cleanup: PASS
- Cancel cleanup: PASS
- stale cleanup: PASS

다중탭 Apply/storage-event 회귀: 17 / 17 PASS
- 정상 B Apply
- stale B Apply 차단
- stale Apply 시 compare 미저장
- 새 C transfer 보존
- storage 이벤트로 old preview 무효화
- 새 source 보존
- 360 / 375 / 390 / 430px overflow 및 44px 버튼 재확인

다중탭 Cancel/ownership 회귀: 9 / 9 PASS
- 정상 Cancel은 자기 transfer 삭제
- stale 탭 Cancel은 새 source/handoff 보존
- stale Apply 차단 후 새 transfer 보존
- fresh orphan source 보존
- stale orphan source 정리
- 정상 Apply는 B 저장 및 자기 transfer 정리

상세는 `BROWSER-QA.md`에 기록했습니다.

## 남은 실호스팅 검수

현재 환경에서는 localhost/file/임의 로컬 origin 직접 이동이 `ERR_BLOCKED_BY_ADMINISTRATOR`로 차단됩니다. 실제 외부 비운영 URL에서만 다음을 최종 확인할 수 있습니다.

1. quote-check URL → quote-compare URL 실제 navigation
2. 실제 origin localStorage 지속성
3. 새로고침 뒤 compare 복원
4. 브라우저 재접속 뒤 compare 복원
5. A → B → C 연속 전송
6. 실제 서로 다른 탭 사이의 native `storage` event 타이밍
7. 실제 모바일 touch/scroll 감각

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- 외부 preview 프로젝트 생성 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
