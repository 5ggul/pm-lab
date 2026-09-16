# 창업데이터랩 Production Handoff

현재 프리뷰의 잠금 버전은 **UI v11.52 Release Candidate**입니다. 이 문서는 실제 운영 도메인 전환을 위한 입력 계약만 정의합니다. 이 문서가 존재해도 production 배포, 색인 전환, 광고 삽입은 자동으로 실행되지 않습니다.

## 현재 고정 상태

- 프리뷰: `https://5ggul.github.io/pm-lab/franchise-ssg-preview/`
- RC HTML: 311개
- production candidate: 184개
- trusted brand: 136개
- category: 20개, production category candidate: 16개
- 프리뷰는 `noindex,nofollow,noarchive,nosnippet` 유지
- 프리뷰 `robots.txt`는 전체 차단 유지
- 프리뷰 sitemap은 비어 있는 상태 유지
- 프리뷰 광고 코드는 없음
- 실제 운영 배포는 사용자 명시 승인 전 금지

## 실제 출시 전에 사용자가 제공해야 하는 8개 값

`release-config.example.json`을 `release-config.local.json`으로 복사한 뒤 아래 값만 실제 정보로 채웁니다. `release-config.local.json`은 `.gitignore`로 차단되어 저장소에 커밋하지 않습니다.

1. `productionSiteUrl` — 최종 HTTPS 운영 origin. 경로, query, hash 없이 `https://example.com` 형태여야 하며 github.io/localhost/test origin은 허용하지 않습니다.
2. `operator.displayName` — 사이트에 공개할 서비스 운영명.
3. `operator.legalName` — 실제 운영주체 또는 법적 명칭.
4. `operator.businessDisclosure` — 실제 사업자·운영자 고지 문구.
5. `operator.address` — 사이트에 공개 가능한 실제 운영/사업 주소.
6. `contact.email` — 실제로 수신 가능한 공개 문의 이메일.
7. `legal.privacyPolicySource` — 최종 개인정보처리방침 Markdown 파일 경로. 400자 이상이며 TODO/TBD/placeholder가 없어야 합니다.
8. `legal.termsSource` — 최종 이용약관 Markdown 파일 경로. 400자 이상이며 TODO/TBD/placeholder가 없어야 합니다.

`ads.adsTxtLine`은 광고 계정이 확정된 뒤 입력하는 선택값입니다. AdSense publisher 정보가 확정되지 않았다면 비워둡니다. 값을 추측해서 만들지 않습니다.

## 잠금 정책 — 변경 금지

```json
{
  "releasePolicy": {
    "indexOnlyProductionCandidates": true,
    "keepNonCandidatesNoindex": true,
    "requireManualApprovalBeforeDeploy": true,
    "deployFromDryRun": false
  }
}
```

이 네 값은 production builder의 안전 계약입니다. 색인 후보 184개만 index 대상으로 만들고 나머지 HTML은 noindex로 유지하며, dry-run 결과를 자동 배포하지 않습니다.

## 1차 승인 — production candidate 생성

실제 운영값을 채운 것만으로 candidate를 만들지 않습니다. 사용자가 **실제 운영값으로 production candidate를 생성해도 된다고 명시 승인한 뒤에만** 아래 승인 신호를 사용합니다.

```bash
SSG_RELEASE_CONFIG=franchise-ssg-core/release-config.local.json \
SSG_RELEASE_BUILD_APPROVED=YES \
node franchise-ssg-core/run-build-production-candidate.mjs
```

생성 위치는 `build/franchise-production-candidate/`이며 프리뷰 디렉터리와 분리됩니다. builder는 프리뷰 hash가 바뀌면 실패하도록 되어 있습니다.

## candidate 생성 뒤 검증 순서

```bash
node franchise-ssg-core/run-finalize-production-index-policy.mjs
node franchise-ssg-core/run-validate-production-candidate.mjs
node franchise-ssg-core/run-audit-production-seo.mjs
```

검증해야 할 핵심 조건은 다음과 같습니다.

- production origin canonical만 사용
- 실제 effective candidate만 `index,follow`
- canonical alias는 자동 demotion 후 noindex
- non-candidate는 noindex 유지
- sitemap URL 수와 effective candidate 수 일치
- robots가 production sitemap을 가리킴
- 운영자·문의·개인정보처리방침·이용약관이 실제 값으로 치환됨
- broken internal link, missing asset, duplicate canonical/title/description, thin-content blocker가 없음
- preview tree hash는 candidate 생성 전후 동일

## 2차 승인 — 실제 운영 배포

production candidate가 모든 검증을 통과해도 **실제 배포는 자동으로 하지 않습니다.** 사용자가 최종 candidate를 직접 검수한 뒤 “실제 운영 도메인에 배포해도 된다”는 별도의 명시 승인이 있어야 합니다.

즉 승인 단계는 두 번입니다.

1. 실제 값으로 production candidate를 생성해도 된다는 승인
2. 검증된 candidate를 실제 운영 호스트에 배포하고 production 색인을 열어도 된다는 승인

둘 중 하나라도 없으면 배포하지 않습니다.

## 현재는 무엇을 하면 안 되는가

- 프리뷰의 `noindex`를 직접 제거하지 않기
- github.io canonical을 임의로 운영 도메인으로 치환하지 않기
- 프리뷰 `robots.txt`를 Allow로 변경하지 않기
- 프리뷰 sitemap에 184개 URL을 넣지 않기
- 존재하지 않는 사업자·주소·연락처를 임시로 만들지 않기
- AdSense publisher ID 또는 ads.txt 라인을 추측하지 않기
- production candidate 폴더를 프리뷰 폴더에 덮어쓰지 않기

## 현재 다음 행동

실제 출시를 진행할 때 사용자가 위 8개 실제 값을 제공하고 최종 개인정보처리방침·이용약관 원문을 확정하면 됩니다. 그 전까지 v11.52 프리뷰 RC가 최종 검수본입니다.
