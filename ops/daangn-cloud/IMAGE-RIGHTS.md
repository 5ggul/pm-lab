# 싸그리 이미지 사용권 원장

상품 페이지의 `og:image` 또는 구조화 데이터에 이미지 URL이 있다는 사실만으로 당근 카페 재게시 권리가 생기지 않는다. `imageUsageApproved: true` 같은 수집기 플래그도 승인 근거가 아니다.

이 원장은 **출처 페이지와 이미지 URL의 정확한 조합**에 대해 사람이 확인한 권리 근거가 있을 때만 업로드를 허용한다. 원장은 `image-rights.json`이며 현재 `mode: "enforce"`다. 승인 항목이 없으면 이미지가 필수인 상품 글은 제출 전에 차단된다.

## 처리 흐름

1. `npm run collect`로 후보를 만든다.
2. `npm run image-rights:report`를 실행한다.
3. `state/image-rights-review.json`에서 원본 페이지, 직접 이미지 URL, 판매 조건 지문을 확인한다.
4. 실제 사용권 근거를 사람에게 확인받는다. 단순 노출, 링크 가능, 상품 판매 중이라는 사실은 사용권 근거가 아니다.
5. 확인된 정확한 조합만 `image-rights.json`에 추가한다.
6. 전체 검사를 통과한 뒤 운영 반영한다.

## 승인 항목 형식

```json
{
  "id": "merchant-image-20261024-001",
  "status": "approved",
  "sourceUrl": "https://shop.example.com/products/123",
  "imageUrl": "https://cdn.example.com/images/123.jpg",
  "rightsHolder": "권리자 또는 허가 주체",
  "basis": "written_permission",
  "evidenceUrl": "https://shop.example.com/legal/permission-record",
  "approvedBy": "검토자 식별값",
  "approvedAt": "2026-10-24T00:00:00Z",
  "expiresAt": "2027-10-24T00:00:00Z",
  "platforms": ["daangn"],
  "uses": ["community-post"],
  "sourceFingerprint": "선택 사항: 승인 당시 판매 조건 지문"
}
```

허용되는 `basis` 값은 다음과 같다.

- `owned`: 직접 제작했고 권리를 보유함
- `written_permission`: 권리자의 개별 서면 허가
- `platform_license`: 해당 플랫폼이 명시적으로 부여한 이용허락
- `affiliate_terms`: 제휴 약관이 해당 이미지 사용과 매체를 명시적으로 허용
- `merchant_terms`: 판매자 약관이 해당 이미지 사용과 매체를 명시적으로 허용
- `cc_by`, `cc_by_sa`: 라이선스 조건과 표시 의무를 충족
- `public_domain`: 퍼블릭 도메인 근거 확인

`evidenceUrl`에는 권리 근거를 재확인할 수 있는 주소를 넣는다. 로그인 전용 문서나 이메일처럼 URL로 남길 수 없는 근거는 별도 안전한 기록 시스템에 보관하고, 원장에는 그 기록을 가리키는 접근 가능한 증빙 위치를 사용한다.

## 자동 차단 조건

다음 중 하나라도 해당하면 사진 업로드 전에 차단한다.

- 승인 원장에 정확한 출처·이미지 조합이 없음
- 승인 상태가 아님
- 허용되지 않은 권리 근거
- 당근 플랫폼 또는 커뮤니티 게시 용도가 포함되지 않음
- 권리자, 증빙 URL, 승인자, 승인 시각이 없음
- 승인 시각이 미래이거나 만료됨
- 승인에 묶인 판매 조건 지문이 현재 지문과 다름
- 원장 파일이 깨졌거나 지원하지 않는 버전임

차단 코드는 `IMAGE_RIGHTS_*`로 시작하며 편집 미리보기와 제출 직전 검증에 모두 나타난다. 기존 수집기가 남긴 `imageUsageApproved: true`는 원장과 일치하지 않으면 자동으로 `false`로 덮어쓴다.

## 취소와 변경

허가가 철회되면 해당 항목의 `status`를 `revoked`로 바꾼다. 이미지 URL, 출처 페이지, 사용 범위가 바뀌면 기존 승인을 재사용하지 않고 새 항목으로 다시 검토한다. 과거 게시물 삭제·교체는 별도 운영 절차이며 원장 변경만으로 자동 수정하지 않는다.
