# 싸그리 Community Native Content Engine v3 — Product Requirements Document

Status: implementation target  
Scope: DealOps / Daangn Cafe live publisher, future platform renderers  
Primary audience: 여성·주부·맘·시니어 중심의 생활 절약 이용자  
Core principle: **같은 계정의 일관성은 유지하되, 같은 생성기의 반복성은 드러나지 않아야 한다.**

---

## 0. 왜 v2로는 부족한가

v2는 기존 템플릿보다 개선됐지만 여전히 다음 한계가 있다.

1. 수집기가 이미 제목/본문 후보를 만든다. 사실 수집과 카피 작성이 분리되지 않았다.
2. 유형별 후보 수가 적다. 장기 운영 시 같은 skeleton이 다시 순환한다.
3. 최근 글 비교가 title/body pattern 중심이다. 실제 어휘 중복·문장 리듬·CTA 반복을 충분히 보지 못한다.
4. 좋은 후보가 없을 때 safe fallback이 존재한다. 이는 품질 게이트를 우회할 수 있다.
5. 플랫폼별 문법이 없다. 당근·네이버 카페·핫딜 전문 커뮤니티의 정보 밀도와 제목 관습이 다르다.
6. 글이 자연스러운지와 정보가 정확한지를 하나의 흐름에서 검증하지 않는다.
7. 과거 글의 성과와 정정 댓글을 카피/수집 규칙으로 되먹임하는 데이터 구조가 없다.

v3는 이를 구조적으로 제거한다.

---

## 1. 외부 커뮤니티 리서치에서 가져올 원칙

### 1.1 뽐뿌
공식 이용규칙은 제목에서 쇼핑몰·제품·가격·배송비를 명확히 요구하고, 본문에는 할인 방법 등 실제 메리트를 적도록 한다. 동일 쇼핑몰 물품의 짧은 시간 중복도 제한한다.

Reference:
- https://www.ppomppu.co.kr/zboard/view.php?id=regulation&no=7
- https://www.ppomppu.co.kr/zboard/view.php?id=ppomppu&no=604593

제품 정보가 충분하면 본문은 짧아도 된다. 반대로 쿠폰·조건이 복잡하면 조건 설명이 늘어난다. **모든 글의 길이가 같지 않다.**

### 1.2 퀘이사존
실제 핫딜 글은 판매처/가격/배송을 구조화해 보여주고, 쿠폰·결제할인·적립·조건을 별도로 설명한다. 특정 조건을 충족해야만 나오는 가격이면 그 조건을 명시한다.

Reference:
- https://quasarzone.com/bbs/qb_saleinfo/views/1957725
- https://quasarzone.com/bbs/qb_saleinfo/views/1965672
- https://quasarzone.com/bbs/qb_saleinfo/views/1967225

중요한 학습점은 커뮤니티 표현을 복제하는 것이 아니라 **결제가격, 조건부 할인, 적립, 배송을 의미상 분리**하는 것이다.

### 1.3 생활형·맘카페 계열
생활형 커뮤니티에서는 정보가 사용 상황과 결합된다.

예:
- 기저귀 쟁일 사람
- 아이와 갈 곳을 찾는 사람
- 장보기 전에 쿠폰이 필요한 사람
- 특정 카드/멤버십이 있는 사람

그러나 자동화는 개인 경험을 만들 수 없다.

금지:
- 저도 샀어요
- 우리 애가 좋아해요
- 직접 써봤는데
- 다녀왔는데 좋았어요

허용:
- 기저귀 쟁일 분이면
- 아이랑 갈 곳 찾는 분이면
- 이 카드 있는 분이면

**작성자 경험이 아니라 독자의 상황을 말한다.**

---

## 2. 제품 목표

### G1. AI 반복감 최소화
최근 100개 게시물을 연속으로 읽었을 때 동일한 자동화 skeleton이 눈에 띄지 않아야 한다.

### G2. 사실 정확성
가격·쿠폰·적립·배송·기간·무료 여부에서 의미 왜곡 0건을 목표로 한다.

### G3. 커뮤니티 네이티브
블로그/보도자료처럼 설명하지 않고, 해당 커뮤니티에서 사용자가 필요한 정보량만 제공한다.

### G4. 타깃 적합성
좋은 원천 데이터라도 싸그리 핵심 이용자와 관계가 낮으면 자동 게시하지 않는다.

### G5. 품질 우선
일일 목표 건수를 채우는 것보다 **안 올리는 것**을 우선한다.

---

## 3. 비목표

- 실제 사용·구매 경험을 AI가 만들어내지 않는다.
- 커뮤니티 은어와 오타를 인위적으로 삽입하지 않는다.
- 다른 사람의 문장을 변형·복제하지 않는다.
- 조회수를 위해 자극적 과장 표현을 자동 생성하지 않는다.
- 플랫폼 운영 규칙을 우회하는 자동화를 만들지 않는다.

---

## 4. v3 아키텍처

```
Source
  ↓
Collector
  ↓
Fact Ledger
  ↓
Eligibility / Trust Gate
  ↓
Audience & Utility Ranker
  ↓
Content Intent Classifier
  ↓
Style Mode Planner
  ↓
Platform Native Renderer
  ↓
Candidate Pool (compositional)
  ↓
Novelty / AI / Promotion / Claim QA
  ↓
Recent-100 Diversity Gate
  ↓
Publish
  ↓
Post Metadata / Corrections / Performance
```

수집 단계와 글쓰기 단계를 완전히 분리한다.

---

## 5. Fact Ledger

모든 게시 후보는 문장보다 먼저 사실 객체를 가진다.

예:

```json
{
  "facts": [
    {
      "key": "current_price",
      "value": 19900,
      "unit": "KRW",
      "source": "merchant_page",
      "source_url": "...",
      "confidence": 0.98,
      "observed_at": "..."
    },
    {
      "key": "baseline_price",
      "value": 26000,
      "label": "상품 페이지 기준가",
      "confidence": 0.88
    }
  ]
}
```

### 가격 의미 규칙

원가라는 표현 사용 금지.

- merchant current price → 현재가
- merchant comparison/reference price → 상품 페이지 기준가
- historical median → 최근 관측가
- previous observation → 이전 관측가
- reward/point → 적립
- card/coupon reduction → 조건부 할인
- payable after verified coupon → 쿠폰 적용 결제가

`체감가`는 자동 생성에서 사용하지 않는다.

---

## 6. Fact Confidence Gate

자동 게시 최소 기준:

- official policy: 0.95+
- official event page: 0.95+
- merchant current price: 0.90+
- comparison price: 0.80+
- historical price with >=3 observations: 0.85+
- single historical observation: 비교 문구에 사용하지 않거나 별도 라벨

다음은 자동 게시 금지:

- 통화 불명
- 일부 무료인데 전체 무료로 해석
- 쿠폰 대상 불명
- 특정 카드 조건인데 일반 가격처럼 표현
- 옵션별 가격인데 옵션 확인 불가
- 페이지 가격과 수집가 차이가 허용 범위를 초과
- 종료일이 지났거나 시간대가 확인되지 않는 마감형 정보

---

## 7. Content Intent Taxonomy

### Commerce
- DEAL_PRICE
- DEAL_UNIT
- DEAL_COUPON
- DEAL_CARD
- DEAL_MEMBER
- DEAL_BUNDLE
- DEAL_DEADLINE
- DEAL_RESTOCK
- DEAL_PRICE_DROP

### Benefit
- BENEFIT_AMOUNT
- BENEFIT_DEADLINE
- BENEFIT_ELIGIBILITY
- BENEFIT_CHANGE
- BENEFIT_REMINDER

### Local
- EVENT_FREE
- EVENT_DISCOUNT
- EVENT_FAMILY
- EVENT_WEEKEND
- EVENT_DEADLINE

한 후보는 primary intent 1개 + secondary intent 최대 2개까지만 가진다.

---

## 8. Style Mode

Intent와 별개로 **이번 글을 어떻게 전달할지** 선택한다.

- BARE: 숫자와 링크만
- CONTEXT: 누구에게 필요한지 한 줄
- CONDITION_FIRST: 쿠폰/카드/회원 조건 먼저
- PRICE_FIRST: 가격 먼저
- UNIT_FIRST: 단가 먼저
- DEADLINE_FIRST: 종료일 먼저
- CHANGE_FIRST: 이전 상태와 달라진 점 먼저
- LOCAL_FIRST: 지역 먼저
- REMINDER: 이미 알려진 혜택의 재알림
- QUESTION_ANSWER: 반복 질문에 짧게 답하는 형태

같은 Style Mode 연속 2회 금지.
최근 10개에서 한 mode가 30%를 넘으면 강한 패널티.

---

## 9. Platform Profile

### daangn
- 2~6개의 정보 줄 권장
- 제목 55자 내외 선호
- CTA 없어도 됨
- 애교 어미 글당 최대 1회
- 애교 사용 글은 최근 3개 중 최대 1개
- 이모지 본문 자동 생성 금지
- 생활 상황 한 줄 허용
- 표 형태 반복 금지

### naver_cafe
- 당근보다 상황 문장 허용폭 큼
- 제목은 검색어보다 커뮤니티 맥락 우선
- 3~8문장
- 댓글을 유도하기 위한 가짜 질문 금지
- ㅎㅎ/ㅠㅠ 같은 감정기호 자동 삽입 금지

### ppomppu
- 제목: 판매처/제품/가격/배송 구조 지원
- 본문은 할인방법·조건·장점 중심
- 감정 표현 최소
- 원본 링크 필수

### quasarzone
- 가격/배송/조건 분리
- 조건부 결제가의 산식 명확화
- 적립과 결제가 분리
- 전문 제품 설명은 검증 가능한 데이터가 있을 때만

### generic_community
- 짧은 정보체
- 개인 경험 금지
- 자동 CTA 최소

v3의 live publisher는 현재 daangn만 사용한다. 나머지는 renderer profile로만 준비한다.

---

## 10. Micro-Phrase Generator

고정 본문 템플릿을 두지 않는다.

각 사실 블록마다 짧은 표현 family를 둔다.

PRICE 예:
- 지금 {price} 나와요.
- 현재 {price}.
- {price}까지 내려왔네요.
- 가격은 {price}입니다.

단, 모든 후보가 같은 표현을 쓰지 않도록 recent usage budget을 적용한다.

### 금지
문장을 자연스럽게 보이게 하려고 동의어를 무작위 치환하는 것.

### 허용
의미가 다른 전달 전략에 따라 다른 표현을 선택하는 것.

---

## 11. Sentence Rhythm

기계적 리듬 방지.

측정:
- 문장 수
- 문장 길이 bucket
- 완결형/명사형 비율
- 줄바꿈 위치
- 링크 위치
- 숫자 밀도
- CTA 유무
- 애교 어미 수
- 문장 종결 형태
- 인접 문장의 동일 종결/동일 서술어 반복

최근 20개와 동일한 rhythm signature가 반복되면 패널티.
같은 종결이 인접 문장에서 반복되면 hard fail로 처리한다. 예: `~열립니다 / ~열립니다`.

---

## 12. Lexical Novelty

최근 100개와 비교한다.

측정:
- 제목 token Jaccard
- 본문 2-gram/3-gram overlap
- 첫 문장 normalized prefix
- 마지막 문장 normalized prefix
- 핵심 동사 반복률
- CTA phrase 반복률

Hard Fail 예:
- 제목 similarity > 0.82
- 첫 문장 normalized prefix 최근 20개에 동일
- skeleton 최근 8개 내 동일
- 동일 closing phrase 최근 15개 내 동일
- body shingle similarity > 0.70

Soft penalty:
- title pattern 최근 5개 내 재등장
- 같은 link position 4연속
- 같은 sentence count 4연속
- 같은 종결형 3문장 이상 반복

---

## 13. AI Tone Gate

Hard banned:
- 핵심만 보면
- 기준으로 보면
- 결국
- 체감
- 판단하면
- 볼 만해요
- 눈여겨
- 반갑죠
- 감 와요
- 필요한 숫자만
- 간단히 적어둘게
- 좋은 선택이 될 수
- 합리적인 가격
- 경쟁력 있는 가격
- 추천드립니다
- 도움 되실 것 같습니다
- 참고하시면 좋을 것 같아요

AI Tone Score는 보조 지표다.
**금지 조건은 점수와 관계없이 Hard Fail.**

---

## 14. Persona Safety

자동 생성 금지:
- 저도 샀어요
- 제가 써봤어요
- 우리 애가
- 먹어봤는데
- 다녀왔는데
- 원래 쓰던 제품
- 친구가 샀는데
- 엄마가 좋아하더라고요

이런 경험은 실제 사용자 입력이나 검증된 원문 인용이 없는 한 생성하지 않는다.

---

## 15. Cute / Friendly Tone Budget

싸그리는 귀여운 말투 계정이 아니라 **친근한 생활정보 계정**이다.

daangn:
- cute ending max/post = 1
- cute post ratio in recent 10 <= 30%
- consecutive cute posts = 0
- same cute ending recent 10에서 2회 초과 금지

예:
- `나와용` 한 번은 가능
- 모든 줄 `~용/~당` 금지

---

## 16. CTA Budget

CTA:
- 보세요
- 참고하세요
- 챙기세요
- 확인하세요
- 다녀오세요

최근 5글 중 CTA 포함글 최대 2개를 기본 목표로 한다.

정보가 끝났으면 링크에서 끝낸다.

---

## 17. Promotion / Viral Tone Gate

다음 표현 자동 생성 금지:
- 무조건
- 대박
- 역대급
- 미쳤다
- 혜자
- 꼭 사세요
- 놓치면 후회
- 강추
- 무조건 이득
- 역대 최저가 (근거 없으면)

가격 평가가 필요한 경우 반드시 비교 근거가 있어야 한다.

---

## 18. Audience Fit

High:
- 생필품
- 식품/장보기
- 육아/교육
- 가족 나들이
- 공과금
- 환급/세금/지원
- 건강/검진
- 시니어 혜택
- 교통
- 생활 서비스

Medium:
- 의류
- 신발
- 미용
- 가정용 가전

Low / auto reject 기본:
- 게이밍 부품
- 고가 취미장비
- 명품
- 전문 투자상품
- 성인/규제 상품

좋은 딜이어도 타깃이 아니면 올리지 않는다.

---

## 19. Utility Score

0~100.

- audience fit 25
- actionable saving/benefit 25
- trust/confidence 20
- freshness 15
- condition clarity 10
- novelty 5

Auto publish minimum: 70.

단, trust hard fail은 점수와 관계없이 차단.

---

## 20. Daily Mix

일일 15개는 목표가 아니라 ceiling.

추천 상한:
- hotdeal <= 6
- benefit/tip <= 4
- local/event <= 3
- card/finance <= 2
- life <= 2

같은 category 3연속 금지.
같은 merchant 2연속 금지.
같은 intent 3연속 금지.

좋은 후보 4개면 4개만 올린다.

---

## 21. Source Diversity

최근 10개 기준:
- 동일 merchant <= 3
- 동일 official publisher <= 4
- 동일 event source라도 지역 분산
- 동일 상품군 <= 3

---

## 22. Duplicate Policy

Hard duplicate:
- canonical source URL 동일
- 동일 상품 ID
- 동일 행사 ID
- 동일 정책 article ID

Semantic duplicate:
- 같은 혜택/상품 + 가격/조건 변화 없음
- title normalized semantic key 동일

재게시 허용:
- 가격 하락
- 재입고
- 쿠폰 조건 변화
- 종료 임박 리마인드 (설정된 최소 간격 충족)
- 정책 신청 재개

재게시 이유를 metadata에 저장한다.

---

## 23. Render Candidate Pool

각 아이템 최소 20개의 조합 후보를 만들 수 있어야 한다.

후보는 단순 동의어 치환이 아니라 다음 조합으로 생성한다.

```
StyleMode
× TitleStrategy
× FactBlockOrder
× OptionalContext
× LinkPosition
× ClosingMode
× ToneLevel
```

후보를 전부 publish하지 않고 QA 후 최상위 하나만 선택한다.

---

## 24. No Fallback Publish

v2의 safe fallback 자동 게시를 제거한다.

후보가 전부 실패하면:

```
status = copy_rejected
reason = ...
```

needs-review에 저장하고 다음 후보로 넘어간다.

**품질 실패를 템플릿 fallback으로 덮지 않는다.**

---

## 25. Claim-to-Copy Validation

본문 숫자는 Fact Ledger의 값과 매칭돼야 한다.

예:
본문 `19,900원`
→ current_price claim 또는 verified coupon price claim이 존재해야 함.

본문 `무료`
→ free claim confidence >= threshold.

본문 `27일까지`
→ event_end claim 존재.

근거 없는 숫자 생성은 hard fail.

---

## 26. Price Semantics

다음 문구를 구분한다.

- 현재 19,900원
- 상품 페이지 기준가 26,000원
- 최근 관측가 24,900원
- 쿠폰 적용 시 19,900원
- 특정 카드 결제 시 추가 2,000원 할인
- 네이버페이 2,000원 적립

다음을 합쳐서 쓰지 않는다.

`체감 17,900원`

---

## 27. Link Policy

daangn:
- end 45%
- middle 20%
- labeled-end 25%
- compact 10%

연속 4개 동일 위치 금지.

ppomppu/quasar profile은 해당 플랫폼 규칙 우선.

---

## 28. Image Policy

- 실제 상품 이미지 우선
- 공식 행사 이미지 우선
- 정책은 이미지가 없어도 발행 가능
- AI 생성 홍보 썸네일 자동 부착 금지
- 이미지가 사실과 불일치하면 무이미지 발행 또는 reject

---

## 29. Pre-Publish QA

### Fact
- price currency
- price freshness
- coupon conditions
- membership conditions
- shipping
- unit quantity
- event price scope
- start/end date
- eligibility

### Copy
- AI banned phrases
- fake experience
- hype
- cute budget
- CTA budget
- title similarity
- body similarity
- skeleton reuse
- rhythm repetition
- source/merchant repetition

### Platform
- title length
- line count
- link rules
- board mapping

---

## 30. Publish Record Schema

published record에 저장:

- type
- intent
- styleMode
- platform
- title
- titleStrategy
- skeleton
- rhythmSignature
- lexicalSignature
- openingKey
- closingKey
- cuteEnding
- hasCTA
- linkPosition
- sourceStore
- topic
- utilityScore
- trustScore
- noveltyScore
- qualityScore
- claimsUsed
- publishedAt
- postUrl

최근 100개 분석의 원본 데이터가 된다.

---

## 31. Corrections Feedback

댓글/수동 정정이 들어오면:

- price_wrong
- coupon_missing
- card_condition_missing
- sold_out
- event_not_free
- expired
- misleading_title
- spammy_tone

같은 reason code로 기록.

같은 유형 2회 이상이면 관련 collector/renderer rule의 severity를 올린다.

---

## 32. Observability

매 실행 로그:
- collected
- fact_gate_pass
- audience_pass
- render_candidates
- copy_gate_pass
- rejected_by_reason
- selected_score
- published
- needs_review

대시보드 없이도 GitHub Actions 로그로 원인을 확인 가능해야 한다.

---

## 33. Test Matrix

필수 자동 테스트:

1. 좋은 생활 핫딜 통과
2. 해외통화 오인 차단
3. 일부 무료 행사 전체 무료 오인 차단
4. 가짜 경험 차단
5. 애교 2회 이상 정책 위반 차단
6. AI banned phrase 차단
7. 동일 skeleton recent-8 차단
8. 제목 lexical similarity 차단
9. body shingle similarity 차단
10. 같은 merchant 연속 우선순위 하락
11. same intent 3연속 차단
12. 근거 없는 숫자 차단
13. 쿠폰/적립/결제가 분리
14. 후보 전부 실패 시 no fallback
15. target-fit 낮은 게이밍 하드웨어 차단
16. platform profile별 제목/길이 규칙

---

## 34. Acceptance Criteria

v3 출시 조건:

- copy regression tests 100% pass
- collect_only success
- live run이 품질 미달 후보를 억지 발행하지 않음
- 최근 생성 시뮬레이션 20건에서 exact skeleton consecutive duplicate 0
- recent-8 skeleton duplicate 0 where alternatives exist
- banned AI phrase 0
- fake experience 0
- unverified price claim 0
- partial-free false positive 0
- foreign-currency-as-KRW 0
- cute ending >1/post 0
- consecutive cute post 0
- target-fit hard reject 정상 작동
- copy-rejected가 정상 needs-review로 남음

---

## 35. 운영 원칙

싸그리의 문체는 “사람인 척하는 AI”가 아니다.

**검증된 생활 정보를, 사람이 커뮤니티에 공유할 때처럼 필요한 만큼만 쓰는 시스템**이다.

자연스러움은 오타·은어·가짜 경험에서 만들지 않는다.

자연스러움은:
- 무엇을 생략하는지
- 어떤 사실을 먼저 말하는지
- 글을 어디서 끝내는지
- 최근 글과 얼마나 다른 리듬을 가지는지

에서 만든다.

최종 규칙:

> 사실이 약하면 쓰지 않는다.  
> 글감이 약하면 올리지 않는다.  
> 할 말이 끝났으면 문장도 끝낸다.  
> 같은 계정처럼 보이되 같은 템플릿처럼 보이면 실패다.
