# Interior v41 production handoff

검수 브랜치: `interior-v40-preview` / Draft PR #201

이 문서는 hosted QA 이후의 **운영 반영 준비 경계**만 고정합니다. 이 문서 추가 자체는 Ready 전환, main merge, 운영 배포 승인이 아닙니다.

## 현재 증거

- pinned production source verified through main `2fa0d48fc4a13f1401a319e3690b3122fa06da97`
- production quote 4개 blob exact match: 4 / 4
- hosted automatic: 109 / 109 PASS
- browser runner: 110 / 110 PASS
- A → B → C / refresh / revisit / new-tab / native storage event / mobile 360·375·390·430: PASS
- production-named storage baseline: unchanged
- PR #201: Draft / 미병합
- 상시 외부 preview 프로젝트: 없음

## PR #201의 역할

PR #201은 production release PR이 아니라 **검수 증거와 review-only production-shell harness**입니다.

따라서 운영 반영 시 PR #201 전체를 그대로 production 기능으로 취급하지 않습니다. 특히 아래 항목은 검수 전용입니다.

- `docs/interior-v41-preview/**`
- review-only storage keys
  - `interior-quote-source-v41`
  - `interior-quote-compare-handoff-v41`
  - `interior-quote-compare-state-v41`
  - `interior-quote-compare-shell-v41`
- production storage read-mask / shell guard
- noindex review pages
- hosted failure/concurrency/recovery/stale/robustness probes

## 운영 반영 승인 후의 안전한 순서

1. **현재 main에서 새 production integration branch를 시작**
2. 아래 현재 production 4개 경로 blob을 다시 대조
   - `docs/interior-cost-preview/quote-check/index.html`
   - `docs/interior-cost-preview/quote-compare/index.html`
   - `docs/interior-cost-preview/assets/site-v21-bundle.css`
   - `docs/interior-cost-preview/assets/app-v21-bundle.js`
3. main이 snapshot boundary 이후 바뀌었고 4개 중 하나라도 달라졌으면 v41 snapshot/selector/event 가정을 다시 검수
4. review-only namespace/guard를 그대로 복사하지 말고, production에서 필요한 handoff/apply/cancel/persistence 동작만 현재 production 구조에 통합
5. URL payload 금지, explicit preview-before-Apply, A/B/C 보존, stale transfer ownership, Web Locks writer serialization을 유지
6. production storage migration이 필요하다면 별도 migration/rollback 계획과 key-by-key 검증을 추가
7. production candidate에서 동일한 browser E2E를 다시 실행
8. 승인된 release PR만 Ready → review → merge → deploy 순서로 진행

## production candidate 필수 회귀

- quote-check → quote-compare same-origin navigation
- A/B/C 각각 12공종 state+amount
- 6 context + qty/unit/spec/memo metadata
- Apply 전 자동 적용 없음
- stale Apply/Cancel이 newer transfer를 건드리지 않음
- refresh/revisit/new-tab persistence
- 실제 two-tab native storage event
- negative / non-finite / unsafe integer / aggregate overflow 차단
- 360 / 375 / 390 / 430px page overflow 없음
- dialog viewport 내부
- 주요 action >= 44px
- no uncaught page errors

## 중단 조건

다음 중 하나라도 해당하면 운영 반영을 중단합니다.

- current main 4개 blob 재대조 미완료
- production integration branch가 current main에서 시작되지 않음
- 실제 production-named storage migration 범위가 확정되지 않음
- hosted/release-candidate E2E 실패
- noindex/검수 전용 guard/storage key가 production 기능으로 잘못 유입됨
- 별도 사용자 승인 없이 Ready/merge/deploy를 시도하는 경우

## 자동으로 하지 않는 것

- PR #201 Ready for review 전환
- PR #201 main merge
- production integration branch 생성
- production 파일 수정
- 운영 도메인 배포
- production storage migration
