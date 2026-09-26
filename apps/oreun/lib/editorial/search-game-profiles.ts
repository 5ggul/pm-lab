export type CuratedGameProfile = {
  slug: string;
  searchName: string;
  shortAnswer: string;
  playPattern: string;
  goodFit: string;
  checkBeforePlay: string;
  relatedIntent: string[];
};

const PROFILES: Record<string, CuratedGameProfile> = {
  rivals: {
    slug: "rivals",
    searchName: "라이벌즈(RIVALS)",
    shortAnswer: "1대1부터 5대5까지, 먼저 5라운드를 따내는 쪽이 이기는 짧은 대전형 FPS입니다.",
    playPattern: "로비의 듀얼 패드에서 대전을 시작하고, 라운드 승리를 쌓는 흐름이 중심입니다. 플레이 중 얻는 키와 계약 보상은 장기 진행 요소로 이어집니다.",
    goodFit: "긴 성장형 RPG보다 짧게 반복되는 대전, 연승, 리더보드 경쟁을 좋아하는 이용자에게 구조가 명확합니다.",
    checkBeforePlay: "지금 플레이 인원과 최근 변화, 서버 최대 인원을 먼저 보면 매칭 규모를 가늠하기 쉽습니다. 특정 무기 티어나 최강 세팅은 검증된 공략이 있을 때만 따로 확인하세요.",
    relatedIntent: ["라이벌즈 동접", "라이벌즈 초보", "RIVALS 하는 법"],
  },
  "blox-fruits": {
    slug: "blox-fruits",
    searchName: "블록스피스(Blox Fruits)",
    shortAnswer: "검과 Blox Fruit 능력으로 캐릭터를 성장시키며 지역을 이동하고 보스를 상대하는 장기 성장형 액션 RPG입니다.",
    playPattern: "전투, 보스전, 과일 수집, 지역 탐험이 한 흐름으로 이어집니다. 과일과 상점 상태처럼 시간에 따라 달라지는 요소가 있어 누적 진행에 가깝습니다.",
    goodFit: "짧은 한 판보다 캐릭터를 오래 키우고 새 지역과 능력을 하나씩 열어 가는 플레이를 선호할 때 잘 맞습니다.",
    checkBeforePlay: "현재 플레이 인원과 최근 추이를 먼저 보고, 코드나 공략은 마지막 확인 시각이 있는 항목만 참고하는 편이 안전합니다.",
    relatedIntent: ["블록스피스 동접", "Blox Fruits 초보", "블록스피스 코드"],
  },
  "99-nights-in-the-forest": {
    slug: "99-nights-in-the-forest",
    searchName: "99 나이트 인 더 포레스트",
    shortAnswer: "친구들과 숲에 캠프를 만들고 밤을 버티는 협동 생존 게임입니다.",
    playPattern: "캠프를 함께 만들고 숲에서 생존하는 흐름이 중심입니다. 처음에는 캠프와 주변 환경을 살피고 밤을 버티는 기본 흐름부터 익히면 됩니다.",
    goodFit: "혼자 빠르게 끝내는 대전보다 친구들과 같은 공간에서 생존 상황을 같이 풀어 가는 플레이를 원할 때 맞습니다.",
    checkBeforePlay: "현재 플레이 인원과 서버 최대 인원을 먼저 확인하세요. 세부 생존 루트가 필요하면 해당 게임 공략을 함께 보는 편이 좋습니다.",
    relatedIntent: ["99 나이트 공략", "99 나이트 초보", "99 나이트 동접"],
  },
  "murder-mystery-2": {
    slug: "murder-mystery-2",
    searchName: "머더 미스터리 2(Murder Mystery 2)",
    shortAnswer: "Innocent, Sheriff, Murderer 세 역할이 서로 다른 목표로 움직이는 라운드형 추리·생존 게임입니다.",
    playPattern: "Innocent는 살아남으며 정체를 추리하고, Sheriff는 Murderer를 제압할 수 있는 무기를 맡고, Murderer는 다른 플레이어를 제거합니다.",
    goodFit: "정해진 빌드보다 역할 추리, 관찰, 짧은 라운드의 긴장감을 좋아하는 이용자에게 구조가 분명합니다.",
    checkBeforePlay: "서버 최대 인원과 현재 인원을 같이 보면 한 서버에서 느끼는 플레이 규모를 가늠하기 쉽습니다.",
    relatedIntent: ["머더 미스터리 2 역할", "MM2 초보", "Murder Mystery 2 동접"],
  },
  "dress-to-impress": {
    slug: "dress-to-impress",
    searchName: "드레스 투 임프레스(Dress To Impress)",
    shortAnswer: "주제에 맞춰 코디를 완성하고 런웨이에서 보여 준 뒤 서로 투표하는 라운드형 드레스업 게임입니다.",
    playPattern: "코디를 만들고, 런웨이에서 포즈를 사용하고, 다른 플레이어의 의상에 투표하는 순서가 기본 흐름입니다.",
    goodFit: "전투나 파밍보다 꾸미기, 주제 해석, 다른 이용자와의 평가·경쟁을 즐기고 싶을 때 잘 맞습니다.",
    checkBeforePlay: "현재 플레이 인원과 최근 업데이트 시각을 먼저 보고, 특정 테마의 정답 코디처럼 고정되지 않은 정보는 검증된 공략에서만 다룹니다.",
    relatedIntent: ["드레스 투 임프레스 초보", "DTI 하는 법", "Dress To Impress 동접"],
  },
  "tower-defense-simulator": {
    slug: "tower-defense-simulator",
    searchName: "타워 디펜스 시뮬레이터(TDS)",
    shortAnswer: "유닛을 배치해 몰려오는 좀비를 막고 더 강한 보스에 도전하는 협동 타워 디펜스 게임입니다.",
    playPattern: "유닛 배치와 방어가 중심이고, 진행하면서 새로운 유닛을 해제하는 장기 성장 요소가 이어집니다.",
    goodFit: "직접 조준하는 FPS보다 배치 순서와 팀 구성을 고민하는 전략형 플레이를 선호할 때 맞습니다.",
    checkBeforePlay: "현재 플레이 인원과 검증된 공략·활성 혜택이 함께 있는지 확인하면 처음 시작할 때 필요한 정보를 한 번에 찾기 쉽습니다.",
    relatedIntent: ["TDS 초보", "타워 디펜스 시뮬레이터 공략", "TDS 동접"],
  },
  "adopt-me": {
    slug: "adopt-me",
    searchName: "입양하세요!(Adopt Me!)",
    shortAnswer: "펫을 입양하고 키우며 수집·거래하고, 집 꾸미기와 역할놀이를 함께 즐기는 소셜 게임입니다.",
    playPattern: "펫 수집과 육성, 거래, 하우징, 친구와의 역할놀이가 한 흐름 안에 묶여 있습니다.",
    goodFit: "승패가 분명한 대전보다 수집과 꾸미기, 친구와 오래 머무는 소셜 플레이를 선호할 때 맞습니다.",
    checkBeforePlay: "거래를 시작하기 전에는 원하는 펫과 교환 조건을 차분히 확인하세요. 펫 가치와 거래 시세는 계속 바뀔 수 있어 현재 게임 상황을 함께 보는 편이 좋습니다.",
    relatedIntent: ["Adopt Me 동접", "입양하세요 펫", "Adopt Me 초보"],
  },
  "grow-a-garden": {
    slug: "grow-a-garden",
    searchName: "그로우 어 가든(Grow a Garden)",
    shortAnswer: "씨앗을 사고 심은 뒤 작물을 수확해 수익을 늘리는 농장형 시뮬레이션·타이쿤 게임입니다.",
    playPattern: "씨앗 구매 → 심기 → 성장 대기 → 수확의 반복 구조이며, 접속하지 않은 동안에도 정원이 성장할 수 있습니다.",
    goodFit: "빠른 승패보다 천천히 쌓이는 성장과 다시 접속했을 때 달라진 상태를 보는 플레이를 좋아할 때 잘 맞습니다.",
    checkBeforePlay: "상점 재입고나 씨앗 상태처럼 시간에 따라 바뀌는 요소는 확인 시각과 함께 보는 편이 좋습니다.",
    relatedIntent: ["그로우 어 가든 초보", "Grow a Garden 동접", "그로우 어 가든 하는 법"],
  },
  jailbreak: {
    slug: "jailbreak",
    searchName: "제일브레이크(Jailbreak)",
    shortAnswer: "범죄자와 경찰 역할을 중심으로 강도, 체포, 차량 추격이 이어지는 오픈월드 액션 게임입니다.",
    playPattern: "범죄자는 강도를 계획하고 경찰은 이를 막고 체포하는 역할을 맡습니다. 차량 이동과 추격이 플레이 흐름의 큰 비중을 차지합니다.",
    goodFit: "정해진 짧은 라운드보다 넓은 공간에서 역할을 고르고 친구와 상황을 만들어 가는 액션을 선호할 때 맞습니다.",
    checkBeforePlay: "현재 인원과 최근 업데이트 감지 시점을 함께 보되, 실제 패치 내용은 단순 업데이트 시각 감지와 구분해서 봐야 합니다.",
    relatedIntent: ["제일브레이크 동접", "Jailbreak 초보", "제일브레이크 업데이트"],
  },
  brookhaven: {
    slug: "brookhaven",
    searchName: "브룩헤이븐(Brookhaven)",
    shortAnswer: "집과 차량을 이용하며 도시에서 자유롭게 역할놀이를 하는 소셜 RP 게임입니다.",
    playPattern: "정해진 전투 목표보다 집, 차량, 이동, 상황극처럼 이용자가 직접 놀이 상황을 만드는 자유도가 중심입니다.",
    goodFit: "경쟁이나 파밍보다 친구들과 역할을 정하고 도시 공간에서 자유롭게 노는 플레이를 원할 때 맞습니다.",
    checkBeforePlay: "한국 리전 이용 제한 상태라면 해외 수치로 우회해서 채우지 않습니다. 이용 가능 상태와 마지막 정상 관측을 먼저 확인하세요.",
    relatedIntent: ["브룩헤이븐 한국", "Brookhaven 동접", "브룩헤이븐 하는 법"],
  },
};

export function getCuratedGameProfile(slug: string) {
  return PROFILES[slug] ?? null;
}
export function curatedGameSlugs() {
  return Object.keys(PROFILES);
}
