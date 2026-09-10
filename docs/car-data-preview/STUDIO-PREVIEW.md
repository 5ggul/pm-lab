# 2026-09-08 현재 변경

크기 비교는 사용자 요청으로 공개 화면에서 제거했습니다. 기존 주소는 차량 비교로 이동합니다. 아래 크기 데이터 범위는 이전 구현 기록이며 현재 제공 기능이 아닙니다. 원본 치수는 차량 제원 자료로 보존합니다.

연비 사양표의 검수상태 열과 후보 배지를 제거했고, 리콜 목록 및 상세를 공지·대상 차종·결함·수리 방법별로 나눴습니다.

# Showroom and size coverage — 2026-09-07

Home now uses one full-width IONIQ 6 studio photograph. The six vehicle selector buttons, floating model name, representative-value panels and AI-edited K8 image are removed. A readable heading and search lead into the photograph, followed by four concise service links. Six static catalogue cards remain below, and the mobile catalogue inspector retains return-to-list behavior.

The former size comparison covered the full catalogue. After model-name normalization and high-confidence alias consolidation, the catalogue contains 425 families. Manufacturer dimensions cover **34 families and 50 explicitly scoped configurations**; **391 families** have no automatic dimensions. This section is retained only as an implementation record because the public size comparison was removed.

The independent reviewed dimension registry preserves source URLs, review dates and generation/trim/roof conditions. The catalogue inspector also uses these reviewed dimensions where its original manufacturer dataset has no entry. It does not imply that engine/torque specifications have been added.

The comparison draws rectangular outside dimensions at the same scale and ground baseline. Front and rear show the same published width/height; these are not photographic vehicle silhouettes. Accurate photo overlays still need licensed matching-generation orthographic assets and calibration. Width excludes any unsupported claim about mirror-to-mirror clearance.

The masthead is Pexels photo 17840483, credited to Hyundai Motor Group. Its 6000 x 3750 original was visually inspected: no people are visible in the cabin or surrounding studio. Pexels permits website/e-commerce and banner/marketing use; no brand endorsement is implied. Source URL, license URL, source hash and local responsive derivatives are recorded in data/hero-image.json. Only resizing/WebP conversion is applied; no AI retouching or person removal is used. The photo is an editorial illustration and is not attached to another model’s specifications.

Tests cover catalogue search, removed vehicle selectors and licensed hero, exact size ratios, manual input validation, optional wheelbase, URL reload, swapping, source labels, mobile controls and no-JavaScript static content. Preview noindex and the existing domain remain unchanged.
