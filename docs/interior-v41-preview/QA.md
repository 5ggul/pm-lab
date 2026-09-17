# Interior v41 handoff QA

검수 대상: `interior-v40-preview` / Draft PR #201

## 현재 상태

- main / 운영 배포 없음
- 외부 preview 생성 없음
- review-only storage만 사용
- 운영 이름 storage key 보호
- quote-check → quote-compare same-origin handoff 검수
- URL에는 견적 payload 없음
- review pages noindex 유지

## handoff contract

- v2 `transferId + createdAt`
- source/handoff exact pair만 유효
- target: A/B/C
- 공종 12개
- 상태: `included`, `separate`, `missing`
- context 6개
- 상세 필드: `amount`, `qty`, `unit`, `spec`, `memo`

## 동시성 / cleanup / recovery

- writer Web Locks exclusive lock: `interior-v41-handoff-write-v41`
- fresh complete pair와 fresh source-only / handoff-only partial은 모두 점유 상태
- 두 번째 writer는 기존 pending을 덮어쓰지 않음
- write failure cleanup은 ownership-aware
- production-shell compare Apply/Cancel cleanup도 같은 lock 사용
- navigation 실패 후 quote-check recovery panel 제공
- complete pending: 비교표 재열기 / 안전 취소
- partial: 불완전 전송 정리만 제공
- stale recovery action은 newer transfer를 삭제하지 않음
- 기본 v41 compare 하네스는 별도 cleanup lock 없이도 fresh partial writer 차단 + ownership check로 cleanup-window 새 writer 진입을 막음

## 운영 스키마 대조

현재 main의 quote-check/quote-compare와 app-v21 기준으로 대조했습니다.

- 공종 id 12개 일치
- 상태값 일치
- 상세 필드 일치
- 기본 조건 6개 일치
- production compare visible input은 A/B/C × `state + amount`
- 운영 이름 저장키 `interior-quote-v5`, `interior-compare-v5`, `interior-compare-v6`는 review flow에서 변경하지 않음

## 누적 비호스팅 QA

- persistence: **13 / 13 PASS**
- quote-check → quote-compare integration: **30 / 30 PASS**
- portable route + transfer pair: **13 / 13 PASS**
- handoff code VM: **14 / 14 PASS**
- Chromium 360/375/390/430px: overflow/dialog/touch target/B Apply PASS
- stale Apply/storage-event: **17 / 17 PASS**
- Cancel/ownership/orphan: **9 / 9 PASS**
- production-shell adapter: **26 / 26 PASS**
- writer VM: **8 / 8 PASS**
- partial/cleanup-window VM: **11 / 11 PASS**
- writer↔compare cleanup lock interleaving: **9 / 9 PASS**

## hosted 자동검사 준비

- `production-shell/self-check.html`: **44**
- `production-shell/failure-probe.html`: **8**
- `production-shell/writer-concurrency-probe.html`: **7**
- `production-shell/pending-recovery-probe.html`: **9**

합계: **68개**

외부 HTTPS preview 전이므로 hosted PASS로 기록하지 않습니다.

## main snapshot

- captured from: `26b8f66b14316743e3bfaff73912a5b15901c48c`
- verified unchanged through: `c12aa7b523715d08e779408f2a59926b185333c7`
- 확인 구간의 main 변경은 scan/franchise bot 산출물이며 pinned interior quote HTML/CSS/JS는 동일

Pinned blobs:

- quote-check HTML: `17027e5b3c2370c8b34be14187d33ca973e9cc99`
- quote-compare HTML: `04a41335095677a0ac13aea33390dd60b411ede2`
- site-v21 CSS: `42839ad56e96b1f5c49245fd1ca518482a45bd66`
- app-v21 JS: `4a82f3be0d598d9593f6eff21259f98e32ff231d`

## 남은 실호스팅 검수

1. hosted 자동검사 68개
2. quote-check URL → quote-compare URL 실제 navigation
3. real-origin localStorage 지속성
4. 새로고침 / 브라우저 재접속 복원
5. A → B → C 연속 handoff
6. 실제 서로 다른 탭 사이 native `storage` event 타이밍
7. 모바일 실제 touch / horizontal scroll
8. storage inspector 기준점 불변 확인

## 배포 상태

- main 변경 없음
- 운영 배포 없음
- 외부 preview 프로젝트 생성 없음
- Draft PR #201 유지
- 리뷰 승인 전 merge 금지
