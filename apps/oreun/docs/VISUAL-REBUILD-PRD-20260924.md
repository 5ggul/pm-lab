# 로블잼 Visual Rebuild PRD v2

기준일: 2026-09-24  
대상: `apps/oreun/`  
브랜치: `feat/r1-oreun-release-candidate`

## 1. 목표

로블잼 첫 화면을 "임시 게임 대시보드"가 아니라 초등 고학년~중학생 Roblox 이용자가 들어오자마자 재미와 친근함을 느끼는 한국어 게임 놀이터로 만든다.

핵심 목표:
- 깨진 이미지와 물음표 placeholder 0건
- 첫 화면의 브랜드/히어로/커뮤니티가 하나의 세계관처럼 보일 것
- 자유·질문·공략·업데이트·파티·코드를 동급의 핵심 목적지로 표현
- 모바일 390px을 우선 기준으로 완성
- 가짜 회원 수, 게시글 수, 활동량을 만들지 않음
- Roblox 공식 로고/공식 캐릭터를 복제하지 않는 오리지널 브랜드 유지

## 2. 현재 문제 정의

### P0 출시 차단
- 로고/히어로에 `?` 또는 깨진 이미지 placeholder가 노출되면 즉시 실패
- 로컬 핵심 에셋을 사용해 네트워크 실패가 브랜드 핵심 비주얼을 깨뜨리지 않게 함
- 390px 모바일에서 가로 overflow, 잘린 CTA, 깨진 카드가 없어야 함

### P1 비주얼 완성도
- 단순 파란 그라데이션 바탕을 다층 게임 월드 분위기로 교체
- 히어로는 승인된 고해상도 일러스트를 사용하고 불필요한 작은 카드 콜라주를 제거
- 커뮤니티 카드 6종은 장난감/스티커 패키지처럼 입체적으로 표현
- 하단 모바일 내비게이션의 active 상태를 더 또렷하게 표현

### P1 타이포그래피
- 본문은 가독성을 우선
- 브랜드명, 히어로 제목, 카드 제목, CTA는 둥글고 굵은 게임형 디스플레이 톤
- 얇은 회색 텍스트, 기본 시스템 글꼴처럼 보이는 대형 제목 금지
- 외부 폰트 로딩 실패 시에도 레이아웃이 깨지지 않는 fallback 필요

## 3. 비주얼 시스템

### 컬러
- Background: deep navy / cobalt
- Primary blue: vivid game blue
- Accent lime: 형광 라임
- Accent cyan: 밝은 시안
- Accent pink: 선명한 핑크
- Accent purple: 보라
- Accent yellow/orange: 보상/파티 강조

### 배경
- 단색/단순 2색 gradient 금지
- 다층 radial glow + 섹션 패널 + 얕은 패턴 사용
- 콘텐츠 가독성을 해치지 않는 범위에서 별/빛/도형의 깊이감 추가

### 카드
- 18~24px radius
- 얕은 highlight, inner border, bottom shadow
- 카드별 개별 색상 유지
- hover/press는 짧고 과하지 않게
- reduced-motion 존중

## 4. 홈 정보 구조

1. Header
2. Mobile game search
3. Hero
4. 로블잼 가치 strip
5. 지금 핫한 게임
6. 커뮤니티 6종
7. 최근 자유 톡 (실제 데이터 있을 때만)
8. 실시간 TOP
9. 상승 중
10. 업데이트 감지
11. 장르 탐색
12. 공략
13. 실제 수치 기반 브랜드 strip

## 5. Header

필수:
- 오리지널 로블잼 마스코트 + 로블잼 워드마크
- Desktop: 중앙 게임 검색 + 2단 메뉴
- Mobile: 로고 + 메뉴
- 마스코트 파일은 `/public/brand` 로컬 정적 에셋
- 깨진 이미지 아이콘 대신 안전한 색상 배경이 먼저 보이도록 구성

## 6. Hero

문구:
- 제목: "함께라면 게임이 더 재밌다!"
- CTA: "지금 시작하기", "자유 톡 가기"

구성:
- 왼쪽: 카피/CTA/빠른 게임 링크
- 오른쪽: 승인된 `/brand/roblejam-hero-world.webp`
- 모바일: 카피와 히어로 아트를 하나의 장면처럼 블렌딩하되, 캐릭터 얼굴과 상체가 카피에 가려지지 않아야 함
- 모바일에서 캐릭터가 거대한 몸통 크롭으로 보이거나 얼굴이 숨으면 실패
- 작은 중첩 썸네일이나 의미 없는 장식으로 메인 아트를 가리지 않음

## 7. 커뮤니티 카드

메뉴:
- 자유
- 질문답변
- 공략
- 업데이트
- 파티 모집
- 코드

원칙:
- 각 목적지의 의미가 1초 안에 이해돼야 함
- 아이콘 + 제목 + 한 줄 설명
- 실제 존재하지 않는 게시글 수/회원 수 사용 금지
- Mobile 390px: 2열
- 420px 이하에서도 카드가 한 줄에 지나치게 좁아지지 않도록 QA

## 8. Typography

권장:
- Display: Jua 계열의 둥글고 굵은 한국어 게임 톤
- Body: Pretendard/SUIT 계열의 높은 가독성

적용:
- `brand-mark`
- hero h1
- section h2
- community tile strong
- CTA/button

본문/메타 데이터에는 과도한 디스플레이 폰트 사용 금지.

## 9. Asset reliability

핵심 브랜드 에셋:
- `/brand/roblejam-mascot.png`
- `/brand/roblejam-mascot.webp`
- `/brand/roblejam-hero-world.webp`

Acceptance:
- HTTP 200
- 적절한 MIME
- width/height 지정
- 핵심 에셋은 eager/high priority 사용 가능
- iOS Safari/인앱 Safari에서 깨진 이미지 아이콘 0건
- 외부 게임 이미지가 실패하더라도 브랜드 핵심 영역에는 영향 없음

## 10. Mobile nav

고정 메뉴:
- 홈
- 자유
- 질문
- 공략
- 내 정보

Acceptance:
- 모든 target 44x44 이상
- safe-area 존중
- active state가 라임/글로우로 명확
- 본문 콘텐츠를 과도하게 가리지 않음

## 11. QA

Viewport:
- 360
- 375
- 390
- 430
- 768
- 1440

검사:
- 이미지 404/깨짐
- horizontal overflow
- 검색 입력 및 검색 이동
- 커뮤니티 6개 링크
- 자유/질문 분리
- Google-only 로그인
- noindex 유지
- reduced-motion
- mobile nav target
- hero title crop
- 핵심 asset 실제 로드 여부

## 12. Release Gate

아래 전부 충족 전에는 완성으로 표시하지 않는다.
- [ ] 로고/마스코트 깨짐 0
- [ ] 히어로 이미지 깨짐 0
- [ ] 모바일 히어로 캐릭터 얼굴/실루엣 식별 가능, 몸통 과대 크롭 금지
- [ ] 390px overflow 0
- [ ] 핵심 CTA 정상
- [ ] 커뮤니티 6종 정상
- [ ] display typography 적용
- [ ] main preview QA PASS
- [ ] community Chromium/WebKit QA PASS
- [ ] stable Vercel preview PASS
- [ ] preview noindex 유지
- [ ] 실제 회원/게시물/권한을 QA 목적으로 조작하지 않음

## 13. 완료 정의

"기능이 작동한다"가 완료가 아니다.  
모바일 첫 화면을 처음 본 이용자가 깨진 요소 없이 로블잼 브랜드, 게임 분위기, 자유 커뮤니티, 게임 탐색 목적을 즉시 이해하고 눌러보고 싶게 보여야 한다.
