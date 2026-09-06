# Franchise Data Core

창업데이터랩 프리뷰를 실제 공공데이터로 전환하기 위한 서버측/CI 데이터 계층입니다.

## Source policy

- `sbiz`: 소상공인시장진흥공단 상가(상권)정보 API. 공공데이터포털 메타데이터 기준 이용허락범위 제한 없음. `storeListInDong` 실호출 프로브를 지원합니다.
- `ftcIndustry`: 공정거래위원회 주요 업종별 가맹점수·개폐점률 API. 메타데이터 및 라이선스를 검증하며, 상세 오퍼레이션 URL은 공식 활용가이드에서 확정한 뒤 `FTC_FRANCHISE_INDUSTRY_ENDPOINT` repository variable로 주입합니다.
- `fairdata`: FairData 가맹 브랜드 데이터. 데이터셋별 활용 조건이 다르고 일부는 승인 절차가 있으므로 승인 범위가 확인되기 전에는 운영 수치로 승격하지 않습니다.

## Runtime inputs

- `DATA_GO_KR_SERVICE_KEY`: 공공데이터포털 인증키. 없으면 workflow는 실패하지 않고 `KEY_REQUIRED` 상태를 기록합니다.
- `FAIRDATA_SERVICE_KEY`: FairData 인증키. 현재는 상태 표시에만 예약되어 있습니다.
- `FTC_FRANCHISE_INDUSTRY_ENDPOINT`: 공정위 업종별 API의 공식 요청 URL. GitHub repository variable 사용을 권장합니다.

## Output

`npm run status`는 다음을 갱신합니다.

- `data/franchise/source-status.json`
- `docs/franchise-data-preview/source-status.json`
- `docs/franchise-data-preview/source-status-final.js`

프리뷰는 `source-ui-final.js`에서 이 상태를 읽어 데이터 출처/업데이트/품질 화면에 반영합니다.

## Promotion rule

메타데이터 확인만 된 소스는 공식 페이지 수치에 사용하지 않습니다. `LIVE_VERIFIED` → Snapshot 저장 → 스키마/누락/이상치 검증 단계를 통과해야만 합성 프리뷰 값을 교체합니다.
