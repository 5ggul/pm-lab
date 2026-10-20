# 추가 기능 로컬 검토 메모

기준일: 2026-10-20. 이 메모는 로컬 생성본의 검증 범위와 계산 가정을 기록한다. 운영 배포는 실행하지 않았다.

## 검토하는 5가지 기능

1. **공식 신고 현황**: 공개 파일의 접수일자·제작사·차명·모델연도를 집계한다. 기존 최근 리콜 공지와 연간 파일의 리콜 이력은 구분하며 합산하지 않는다. 상세 증상·주행거리·수리비·확정 결함 여부를 제공하는 기능은 아니다.
2. **실연비 계산기** (`/tools/fuel-efficiency/`): 같은 기록 구간의 거리 ÷ 사용량으로 연비·전비를 계산한다. 내연기관은 가득 주유한 뒤 다음 가득 주유까지의 거리와 두 번째 주유량을 기록한다. 전기차는 같은 기간의 거리와 전력량을 사용하며 충전기 계량량과 차량 표시 사용량을 섞지 않는다. 충전기 계량량에는 충전손실이 포함될 수 있다. 단가를 비우면 효율만 표시하고, 입력한 단가는 양수여야 한다.
3. **자동차 할부 계산기** (`/tools/car-installment/`): 차량 가격 전체 대신 실제 차입 원금, 견적서의 고정 연금리, 정수 개월 수를 입력한다. 연금리 ÷ 12의 월 이율로 원리금균등·원금균등을 계산하며 첫 달·마지막 달 납입금, 총이자, 총납입금과 접힌 상환표를 제공한다. 0%는 무이자, 원금 0원은 상환할 차입금 없음으로 처리한다. 계약일별 일수·수수료·중도상환·거치기간·보험료·연료비는 제외하며 원 단위 반올림 차이가 있을 수 있다.
4. **전기차 충전비 확장** (`/tools/ev-charge-cost/`): 기존 계산기와 별도로 1회 충전량 × 직접 입력한 단가, 급속·완속 혼합 월·연 비용을 계산한다. 혼합 단가는 두 단가를 **kWh 전력량 비중**으로 가중평균하며 횟수·시간 비중이 아니다. 월 전력량은 월 거리 ÷ 전비, 연 비용은 반올림 전 월 비용 × 12이다. 자동 현행 요금이나 별도 손실률을 더하지 않는다. 빈 단가는 미입력이고 명시적인 0원은 무료이며, 주차료·점유 요금·구독료·할인은 제외한다.
5. **조건 저장**: 현재 입력을 반영한 허용된 계산 조건을 `localStorage`에 최대 12개 저장한다. 같은 브라우저·사이트에서만 유지되며 서버 계정이나 다른 기기로 동기화하지 않는다. 저장·새로고침·열기·삭제, 저장소 손상·차단 시 동작을 확인한다. 조건 링크에는 허용된 도구 매개변수만 남기고 인증값 등은 제외한다.

## 자료 시점과 해석 한계

공식 신고는 한국교통안전공단의 [연간 공개 파일](https://www.data.go.kr/data/15016450/fileData.do)을 사용한다. 현재 스냅샷에서 관측한 접수일 범위는 **2025-01-02~2025-12-31**, 원천 갱신일은 2026-07-29이다. 범위의 양끝은 파일 행의 최소·최대 날짜이며 해당 기간 전체가 빠짐없이 수록되었다는 뜻이 아니다. 파일 변경 확인 시각과 원천 자료의 갱신일도 구분한다.

차명이 연결되지 않거나 자료가 없거나 조회에 실패한 상태를 신고 0건·결함 없음으로 해석하지 않는다. 연결된 접수 건수도 고장률이나 안전성 순위가 아니다. 같은 이름의 이전 연식·세대가 섞일 수 있으며 세대·엔진을 추정해 나누지 않는다.

## 생성·색인 상태

현재 생성 소스는 HTML **157개**다. 기존 색인 허용 147개와 사이트맵 대상은 유지한다. 신규 실연비·할부 페이지 2개는 로컬 검토 보류(`excluded`, `noindex`)이며 사이트맵에 추가하지 않았다. 이 검토와 로컬 production 묶음 생성은 운영 배포나 색인 승인으로 간주하지 않는다.

## 재현 명령과 확인 항목

저장소 루트에서 실행한다. 브라우저 검증은 `build/peekmycar-production` 생성이 끝난 뒤 실행하며, 필요하면 기존 환경의 `PLAYWRIGHT_EXECUTABLE_PATH`로 Chrome 실행 파일을 지정한다.

```powershell
node --test docs/car-data-preview/scripts/measured-efficiency.test.mjs docs/car-data-preview/scripts/car-installment.test.mjs docs/car-data-preview/scripts/ev-charge-planner.test.mjs docs/car-data-preview/scripts/saved-conditions.test.mjs
node --test docs/car-data-preview/scripts/official-issues-data.test.mjs docs/car-data-preview/scripts/official-issues-links.test.mjs docs/car-data-preview/scripts/official-issues-refresh-plan.test.mjs
node docs/car-data-preview/scripts/validate-official-issues.mjs
node docs/car-data-preview/scripts/feature-tools-integrity-qa.mjs
node docs/car-data-preview/scripts/feature-tools-ui-qa.mjs
```

- 수치: 실연비 600km·40L·1,800원 → 15km/L·100km당 12,000원, 할부 100만원·12%·2개월 → 총이자 15,025원, EV 40kWh·300원 → 12,000원, 혼합 1,000km·5km/kWh·완속 200원·급속 400원·급속 25% → 단가 250원·월 50,000원·연 600,000원.
- 상태: 빈 값·음수·범위 초과 입력 후 이전 결과 제거, 0%·무료 단가 구분, 상환 원금 합계·잔액 0, 조건 전달·URL 복원·저장 후 다시 열기 일치, 비밀 매개변수 제거와 저장소 오류 시 계산 유지.
- 화면: 375×812, 390×844, 430×932, 768×1024, 1280×900, 1440×900에서 가로 넘침·라벨 겹침·입력 정렬·44px 조작 영역·패널 여백과 상환표를 확인한다. 외부 분석 요청은 차단한다.

실행 결과는 `output/feature-tools-20261020/integrity-report.json`과 `output/playwright/feature-tools/report.json`, 같은 UI 출력 폴더의 화면 캡처로 확인한다. 이 메모 자체는 테스트 통과를 증명하지 않는다.
