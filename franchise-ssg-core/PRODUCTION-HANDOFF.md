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

## PR release rehearsal — 실제 운영 배포와 완전히 분리

`franchise-release-rehearsal` workflow는 pull request의 **실제 head SHA**를 직접 checkout해 production 변환 경로를 미리 검증합니다. GitHub가 만든 PR merge ref나 최신 main을 대신 검사하지 않습니다.

이 리허설은 실제 운영 승인을 대신하지 않습니다.

- `SSG_RELEASE_TEST_MODE=true`만 사용합니다.
- 운영 origin은 고정 테스트 주소 `https://franchise-release-contract.invalid`만 허용합니다.
- 운영자·문의·개인정보처리방침·이용약관은 builder에 내장된 `TEST ONLY` 계약 테스트 값만 사용합니다.
- `SSG_RELEASE_BUILD_APPROVED`와 실제 배포 승인 신호는 설정하지 않습니다.
- production candidate는 GitHub runner의 임시 `/tmp` 영역에만 생성합니다.
- 실제 운영 도메인으로 HTTP 요청을 보내지 않습니다.
- 프리뷰 폴더에 candidate를 덮어쓰지 않습니다.
- 검증 뒤 임시 candidate를 삭제하고 v11.52/v11.53 프리뷰 잠금 상태를 다시 검증합니다.

리허설 순서는 다음과 같습니다.

1. exact PR head에서 v11.52 preview를 fresh build
2. public copy / internal authority / RC 재검증
3. 실제 운영 입력이 없으므로 readiness와 dry-run이 계속 차단 상태인지 확인
4. v11.53 handoff 계약 검증
5. `.invalid` test-mode production candidate 311 HTML 생성
6. production index policy finalize
7. production SEO audit
8. production candidate 정적 validator 통과
9. exact source HEAD + release-input fingerprint + candidate tree SHA256로 test seal 생성
10. sealed candidate와 동일한 test deploy package 생성 + package manifest/checksum 검증
11. localhost에서 Chromium으로 transformed candidate 311페이지 렌더링 검수
12. 별도 loopback에 deploy package/site를 올리고 **패키지의 모든 파일을 byte-exact 재검증**
13. deploy approval/seal digest/source SHA/package digest를 주지 않은 상태에서 deploy gate가 반드시 BLOCKED인지 확인
14. candidate 정적 validator를 다시 실행한 뒤 임시 candidate 삭제
15. preview v11.52/v11.53 재검증 및 저장소 쓰기 범위 확인

Chromium 리허설에서는 다음을 확인합니다.

- 311개 HTML 모두 localhost에서 HTTP 200
- effective candidate만 `index,follow`
- 나머지는 `noindex,nofollow,noarchive,nosnippet`
- canonical은 모두 `.invalid` production origin
- `robots.txt`는 production sitemap을 가리키고 전역 차단이 없음
- sitemap URL 수와 effective candidate 수가 일치
- preview URL/base path가 변환 결과에 남지 않음
- production 운영자 footer가 모든 페이지에 존재
- 동일 origin JS/CSS/이미지 자산 4xx 없음
- 브라우저 page error 없음
- 핵심 13개 경로를 390px / 1440px에서 추가 확인
- 테스트용 about/contact/privacy/terms 치환이 실제 DOM에 나타남

이 workflow의 성공은 **production 변환 코드가 현재 PR head에서 재현된다는 증거**일 뿐입니다. 실제 운영정보, 실제 개인정보처리방침·이용약관, 실제 도메인으로 만든 candidate 검수와 운영 배포 승인은 여전히 별도입니다.

## 실제 출시 전에 사용자가 제공해야 하는 8개 값

`release-config.example.json`을 `release-config.local.json`으로 복사한 뒤 아래 값만 실제 정보로 채웁니다. `release-config.local.json`은 `.gitignore`로 차단되어 저장소에 커밋하지 않습니다.

1. `productionSiteUrl` — 최종 HTTPS 운영 origin. 경로, query, hash, 사용자명/비밀번호 없이 `https://example.kr` 형태여야 합니다. github.io, localhost, `.invalid`, `.test`, `.example`, example.com/org/net 같은 예약·예시 origin은 허용하지 않습니다.
2. `operator.displayName` — 사이트에 공개할 서비스 운영명.
3. `operator.legalName` — 실제 운영주체 또는 법적 명칭.
4. `operator.businessDisclosure` — 실제 사업자·운영자 고지 문구.
5. `operator.address` — 사이트에 공개 가능한 실제 운영/사업 주소.
6. `contact.email` — 실제로 수신 가능한 공개 문의 이메일. `.invalid`, localhost, 예시 도메인은 허용하지 않습니다.
7. `legal.privacyPolicySource` — 최종 개인정보처리방침 Markdown 파일 경로. 400자 이상이며 TODO/TBD/preview placeholder가 없어야 하고 개인정보 처리·수집·이용에 관한 실제 문구가 있어야 합니다.
8. `legal.termsSource` — 최종 이용약관 Markdown 파일 경로. 400자 이상이며 TODO/TBD/preview placeholder가 없어야 하고 서비스 이용 조건을 설명하는 실제 문구가 있어야 합니다.

`ads.adsTxtLine`은 광고 계정이 확정된 뒤 입력하는 선택값입니다. AdSense publisher 정보가 확정되지 않았다면 빈 문자열로 둡니다. 값을 추측해서 만들지 않습니다. 값을 넣는 경우 ads.txt의 광고 시스템 도메인, publisher account, `DIRECT`/`RESELLER`, 선택적 certification authority ID 형식을 사전검사합니다.

## 운영값 입력 사전검사 — 승인 요청 전에 반드시 실행

실제 운영값을 적은 뒤에는 candidate 생성 승인을 요청하기 전에 아래 검사를 먼저 통과시킵니다.

```bash
SSG_RELEASE_CONFIG=franchise-ssg-core/release-config.local.json \
node franchise-ssg-core/run-validate-release-inputs.mjs
```

이 검사는 파일을 배포하거나 색인을 바꾸지 않습니다. 다음 항목만 검증합니다.

- `schemaVersion: 1`
- 정확한 HTTPS origin인지
- path/query/hash/credentials가 붙지 않았는지
- github.io, localhost, 테스트·예약·예시 도메인이 아닌지
- 운영자 4개 공개값이 placeholder가 아닌지
- 공개 문의 이메일의 형식과 예약 도메인 여부
- 개인정보처리방침·이용약관 파일 존재, 최소 길이, placeholder/preview 문구 잔존 여부, 필수 주제 표기
- 아래 releasePolicy 4개 값이 잠금값과 정확히 같은지
- ads.txt 값을 입력했다면 한 줄 형식이 유효한지

`PASS`가 아니면 **1차 candidate 생성 승인을 요청하지 않습니다.**

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

운영값 사전검사가 PASS여도 candidate를 자동으로 만들지 않습니다. 사용자가 **실제 운영값으로 production candidate를 생성해도 된다고 명시 승인한 뒤에만** 아래 승인 신호를 사용합니다.

문서화된 안전 진입점은 `run-build-production-candidate-v11-24.mjs`입니다. 이 wrapper는 실제 builder를 실행하기 전에 같은 strict release-input contract를 다시 검증하므로 사전검사와 candidate 생성 사이의 입력 드리프트를 막습니다.

```bash
SSG_RELEASE_CONFIG=franchise-ssg-core/release-config.local.json \
SSG_RELEASE_BUILD_APPROVED=YES \
node franchise-ssg-core/run-build-production-candidate-v11-24.mjs
```

생성 위치는 `build/franchise-production-candidate/`이며 프리뷰 디렉터리와 분리됩니다. builder는 프리뷰 hash가 바뀌면 실패하도록 되어 있습니다.

## candidate 생성 뒤 검증 순서

```bash
node franchise-ssg-core/run-finalize-production-index-policy.mjs
node franchise-ssg-core/run-audit-production-seo.mjs
node franchise-ssg-core/run-validate-production-candidate.mjs
node franchise-ssg-core/run-seal-production-candidate.mjs
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
- candidate 전체 tree SHA256이 report의 `outputHash`와 동일
- builder가 기록한 exact source HEAD와 release-input fingerprint가 존재
- 위 검증이 모두 끝난 뒤 별도 `production-candidate-seal.json` 생성

## 검증본 봉인 — provenance seal

정적 검증이 끝난 candidate는 **candidate 폴더 밖의 별도 seal 파일**로 봉인합니다. seal을 candidate 안에 넣지 않는 이유는 seal 파일 추가 자체가 candidate hash를 바꾸는 순환을 막기 위해서입니다.

기본 실운영 seal 위치:

`build/franchise-production-candidate-seal.json`

seal에는 실제 운영정보 원문 대신 다음 검증 식별자만 기록합니다.

- exact source HEAD SHA
- release-input fingerprint
- candidate 전체 tree SHA256
- candidate 파일 수·바이트 수
- requested/effective candidate 수
- index policy finalize 시각
- SEO audit PASS
- static production validator PASS
- seal digest
- deploy performed: false

candidate 파일이 한 바이트라도 바뀌거나 파일명/경로가 바뀌면 tree SHA256이 달라져 기존 seal과 일치하지 않습니다.

## deploy package — 실제 업로드할 파일을 별도 패키지로 고정

seal 생성 뒤에는 candidate 폴더를 직접 골라서 호스팅에 올리지 않습니다. **실제 업로드 대상으로 사용할 deploy package**를 별도 생성합니다.

기본 위치:

`build/franchise-production-deploy-package/`

구성:

- `site/` — 봉인된 candidate와 byte-for-byte 동일한 실제 업로드 대상
- `deployment-manifest.json` — sourceHead / sealDigest / packageDigest / candidateTreeHash / rollback 계약 / 모든 파일 SHA256
- `checksums.sha256` — `site/`의 각 파일 checksum 목록

### rollback 기준을 먼저 명시

실운영 package는 rollback 전략을 선언하지 않으면 생성되지 않습니다.

첫 배포라 이전 운영본이 정말 없는 경우:

```bash
SSG_PRODUCTION_ROLLBACK_MODE=FIRST_DEPLOYMENT \
node franchise-ssg-core/run-prepare-production-deploy-package.mjs
```

기존 운영본이 있다면 이전 배포의 production seal을 보존하고:

```bash
SSG_PRODUCTION_ROLLBACK_MODE=PREVIOUS_SEAL \
SSG_PREVIOUS_PRODUCTION_SEAL=/path/to/previous-production-candidate-seal.json \
node franchise-ssg-core/run-prepare-production-deploy-package.mjs
```

`PREVIOUS_SEAL` 모드에서는 이전 seal의 sealDigest / sourceHead / candidateTreeHash / productionSite를 현재 package manifest에 rollback 기준으로 기록합니다.

첫 배포가 아닌데 `FIRST_DEPLOYMENT`로 우회해서는 안 됩니다. 실제 상태에 맞는 rollback mode를 사람이 명시해야 합니다.

생성 후 반드시:

```bash
node franchise-ssg-core/run-verify-production-deploy-package.mjs
```

를 실행합니다.

이 검사는:

- package digest
- `site/` 전체 tree SHA256
- 모든 파일 SHA256 / byte size / 상대경로
- seal의 candidateTreeHash
- sourceHead
- release-input fingerprint
- production origin
- rollback contract

를 다시 확인합니다.

package 안의 파일 하나가 누락·추가·변경·이름변경되면 검증이 실패합니다.

## 2차 승인 — 검증한 바로 그 package만 실제 운영 배포

production candidate가 모든 검증과 seal 생성을 통과해도 **실제 배포는 자동으로 하지 않습니다.** 사용자가 최종 candidate를 직접 검수한 뒤 “실제 운영 도메인에 배포해도 된다”는 별도의 명시 승인이 있어야 합니다.

2차 승인 뒤에도 바로 hosting deploy를 실행하지 않고, 먼저 아래 **무배포 deploy gate**가 검증한 candidate와 승인 대상이 정확히 같은지 확인합니다.

```bash
SSG_PRODUCTION_DEPLOY_APPROVED=YES \
SSG_PRODUCTION_DEPLOY_DIGEST=<production-candidate-seal.json의 sealDigest> \
SSG_PRODUCTION_DEPLOY_SOURCE_SHA=<production-candidate-seal.json의 sourceHead> \
SSG_PRODUCTION_DEPLOY_PACKAGE_DIGEST=<deployment-manifest.json의 packageDigest> \
node franchise-ssg-core/run-verify-production-deploy-gate.mjs
```

이 명령은 **배포를 하지 않습니다.** candidate bytes, report, seal, deploy package, source SHA, release-input fingerprint, SEO/static validation을 다시 대조하고 다음 네 승인값이 정확히 맞을 때만 `READY_FOR_EXPLICIT_HOST_DEPLOY`를 출력합니다.

- `SSG_PRODUCTION_DEPLOY_APPROVED=YES`
- `SSG_PRODUCTION_DEPLOY_DIGEST=<sealDigest>`
- `SSG_PRODUCTION_DEPLOY_SOURCE_SHA=<sourceHead>`
- `SSG_PRODUCTION_DEPLOY_PACKAGE_DIGEST=<packageDigest>`

seal 이후 candidate 또는 deploy package가 바뀌면 `CANDIDATE_BYTES_CHANGED_AFTER_SEAL`로 차단합니다. digest 또는 source SHA가 다르면 2차 승인 대상 불일치로 차단합니다. TEST MODE는 승인값이 모두 맞아도 실제 배포 준비 상태가 되지 않습니다.

즉 승인 단계는 두 번이며, 두 번째 승인은 **특정 seal digest + source SHA + deploy package digest에 묶입니다.**

1. 실제 값으로 production candidate를 생성해도 된다는 승인
2. 검증·봉인된 정확한 candidate digest를 실제 운영 호스트에 배포하고 production 색인을 열어도 된다는 승인

둘 중 하나라도 없거나 seal 무결성이 깨지면 배포하지 않습니다. 실제 hosting deploy 자체는 이 gate와 별도이며, 사용자 2차 명시 승인 후에만 수행합니다.

## 배포 후 검증 — 실제 호스트가 package와 같은 bytes를 제공하는지 확인

실제 hosting deployment가 끝난 뒤에는 아래 verifier를 실행합니다.

```bash
SSG_LIVE_SITE_URL=https://실제-운영-도메인 \
node franchise-ssg-core/run-verify-live-production.mjs
```

실운영에서는 `SSG_LIVE_SITE_URL` origin이 deploy package의 productionSite와 정확히 같아야 합니다.

이 verifier는 `deployment-manifest.json`에 기록된 **모든 package 파일**을 실제 운영 URL에서 가져와 SHA256과 byte size를 비교합니다.

- HTML은 각 trailing-slash route로 요청
- assets / robots.txt / sitemap.xml / ads.txt 등은 파일 경로 그대로 요청
- 다른 origin으로 redirect되면 실패
- HTTP 200이 아니면 실패
- 파일 bytes가 package와 다르면 실패

성공 시 `build/franchise-post-deploy-report.json`에 sourceHead / sealDigest / packageDigest / checkedFiles / exactPackageObserved를 기록합니다.

이 verifier 역시 **배포 기능은 없습니다.** 실제 호스트가 승인한 deploy package와 같은 정적 bytes를 제공하는지만 확인합니다.

## 현재는 무엇을 하면 안 되는가

- 프리뷰의 `noindex`를 직접 제거하지 않기
- github.io canonical을 임의로 운영 도메인으로 치환하지 않기
- 프리뷰 `robots.txt`를 Allow로 변경하지 않기
- 프리뷰 sitemap에 184개 URL을 넣지 않기
- 존재하지 않는 사업자·주소·연락처를 실제 운영값으로 사용하지 않기
- test-mode의 `.invalid` 도메인이나 `TEST ONLY` 문구를 실제 운영 설정으로 재사용하지 않기
- AdSense publisher ID 또는 ads.txt 라인을 추측하지 않기
- production candidate 폴더를 프리뷰 폴더에 덮어쓰지 않기
- `run-validate-release-inputs.mjs`가 BLOCKED인데 candidate 생성 승인 신호를 주지 않기
- seal을 만든 뒤 candidate 폴더를 수정하고 같은 seal을 재사용하지 않기
- `run-verify-production-deploy-gate.mjs`가 READY가 아닌데 실제 hosting deploy를 시작하지 않기
- 다른 commit의 source SHA나 다른 seal digest를 현재 candidate 승인값으로 재사용하지 않기
- rollback mode를 실제 운영 상태와 다르게 선언하지 않기
- `run-verify-production-deploy-package.mjs`가 FAIL인데 package를 업로드하지 않기
- package 생성 뒤 `site/`를 수정하고 같은 packageDigest를 재사용하지 않기
- 실제 배포 후 `run-verify-live-production.mjs`가 FAIL이면 해당 배포를 검증 완료로 간주하지 않기

## 현재 다음 행동

실제 출시를 진행할 때 사용자가 위 8개 실제 값과 최종 개인정보처리방침·이용약관 원문을 준비한 뒤 `run-validate-release-inputs.mjs`를 PASS시켜야 합니다. 1차 승인 후 생성한 candidate는 finalize → SEO audit → static validate → seal 순으로 고정합니다. seal 다음에는 rollback mode를 명시하고 deploy package를 생성·검증합니다. 이후 2차 승인은 **sealDigest + sourceHead + packageDigest**에 묶어서 `run-verify-production-deploy-gate.mjs`를 PASS시켜야 하며, 그 gate 자체는 배포하지 않습니다. 실제 hosting deploy는 그 이후에도 별도 명시 승인 없이는 진행하지 않습니다. 배포 후에는 `run-verify-live-production.mjs`로 실제 호스트의 모든 정적 파일이 package와 byte-exact인지 확인합니다.
