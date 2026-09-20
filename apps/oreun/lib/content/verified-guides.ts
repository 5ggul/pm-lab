export type VerifiedEditorialSource = {
  id: string;
  universe_id: number;
  source_type: string;
  label: string;
  source_url: string;
  last_checked_at: string;
  created_at: string;
  updated_at: string;
};

export type VerifiedEditorialGuide = {
  id: string;
  universe_id: number;
  slug: string;
  guide_type: "beginner" | "mechanic" | "progression" | "troubleshooting" | "faq" | "guide";
  title: string;
  summary: string;
  body: string;
  source_id: string;
  content_status: "published";
  index_state: "indexable";
  review_status: "approved";
  reviewed_at: string;
  reviewed_by: null;
  review_note: string;
  published_at: string;
  created_at: string;
  updated_at: string;
};

const REVIEWED_AT = "2026-09-20T06:35:00.000Z";
const REVIEW_NOTE =
  "Roblox 공식 Experience 설명과 공개 메타데이터에서 직접 확인 가능한 내용만 사용. 경험담·메타 추정·미확인 공략은 제외.";

export const VERIFIED_EDITORIAL_SOURCES: VerifiedEditorialSource[] = [
  {
    id: "editorial-source:blox-fruits",
    universe_id: 994732206,
    source_type: "official_roblox_experience",
    label: "Blox Fruits Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/2753915549/Blox-Fruits",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:fisch",
    universe_id: 5750914919,
    source_type: "official_roblox_experience",
    label: "Fisch Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/16732694052/Fisch",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:grow-a-garden",
    universe_id: 7436755782,
    source_type: "official_roblox_experience",
    label: "Grow a Garden Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/126884695634066/Grow-a-Garden",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:rivals",
    universe_id: 6035872082,
    source_type: "official_roblox_experience",
    label: "RIVALS Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/17625359962/RIVALS",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:murder-mystery-2",
    universe_id: 66654135,
    source_type: "official_roblox_experience",
    label: "Murder Mystery 2 Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/142823291/Murder-Mystery-2",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:volleyball-legends",
    universe_id: 6931042565,
    source_type: "official_roblox_experience",
    label: "Volleyball Legends Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/73956553001240/Volleyball-Legends",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:blade-ball",
    universe_id: 4777817887,
    source_type: "official_roblox_experience",
    label: "Blade Ball Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/13772394625/Blade-Ball",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:the-strongest-battlegrounds",
    universe_id: 3808081382,
    source_type: "official_roblox_experience",
    label: "The Strongest Battlegrounds Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/10449761463/The-Strongest-Battlegrounds",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },

  {
    id: "editorial-source:adopt-me",
    universe_id: 383310974,
    source_type: "official_roblox_experience",
    label: "Adopt Me! Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/920587237/Adopt-Me",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:anime-vanguards",
    universe_id: 5578556129,
    source_type: "official_roblox_experience",
    label: "Anime Vanguards Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/16146832113/Anime-Vanguards",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:bee-swarm-simulator",
    universe_id: 601130232,
    source_type: "official_roblox_experience",
    label: "Bee Swarm Simulator Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/1537690962/Bee-Swarm-Simulator",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:brookhaven",
    universe_id: 1686885941,
    source_type: "official_roblox_experience",
    label: "Brookhaven Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/4924922222/Brookhaven-RP",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:doors",
    universe_id: 2440500124,
    source_type: "official_roblox_experience",
    label: "DOORS Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/6516141723/DOORS",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:jailbreak",
    universe_id: 245662005,
    source_type: "official_roblox_experience",
    label: "Jailbreak Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/606849621/Jailbreak",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:theme-park-tycoon-2",
    universe_id: 31970568,
    source_type: "official_roblox_experience",
    label: "Theme Park Tycoon 2 Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/69184822/Theme-Park-Tycoon-2",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:tower-defense-simulator",
    universe_id: 1176784616,
    source_type: "official_roblox_experience",
    label: "Tower Defense Simulator Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/3260590327/Tower-Defense-Simulator",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
];

export const VERIFIED_EDITORIAL_GUIDES: VerifiedEditorialGuide[] = [
  {
    id: "editorial-guide:blox-fruits:fruit-basics",
    universe_id: 994732206,
    slug: "fruit-basics",
    guide_type: "beginner",
    title: "Blox Fruits 과일 얻는 법: 맵 스폰과 Dealer 차이",
    summary:
      "공식 설명에서 확인되는 과일 획득 경로와 맵 스폰·Dealer 재입고 시간을 처음 하는 사람 기준으로 구분합니다.",
    body: `Blox Fruits에서 처음 헷갈리기 쉬운 부분은 과일을 얻는 경로가 하나가 아니라는 점입니다. 공식 설명 기준으로는 맵에 직접 등장하는 과일을 찾는 방법과 Blox Fruits Dealer에게 구매하는 방법이 따로 있습니다.

맵 스폰은 공식 설명상 1시간마다 발생하고, 등장한 과일은 20분 뒤 사라집니다. 따라서 “아무 때나 맵을 돌면 반드시 과일이 있다”라고 생각하면 안 됩니다. 스폰과 소멸 주기가 따로 있기 때문에 현재 맵에 과일이 없는 시간도 생길 수 있습니다.

Dealer는 맵 스폰과 별개입니다. 공식 설명은 Dealer가 무작위 과일 목록을 4시간마다 다시 채운다고 안내합니다. 즉 맵에서 직접 찾는 방식과 상점 재고를 확인하는 방식은 서로 다른 루트입니다.

게임의 기본 진행은 검을 사용하는 전투 스타일과 Blox Fruit 능력을 사용하는 스타일 모두를 지원합니다. 일반 적과 보스를 상대하고 바다를 이동하며 지역과 숨겨진 요소를 찾는 구조가 공식 설명에 명시되어 있습니다.

이 가이드는 어떤 과일이 가장 강한지, 특정 과일의 확률, 최적 레벨업 장소 같은 메타 정보는 단정하지 않습니다. 그런 내용은 업데이트에 따라 크게 바뀔 수 있기 때문입니다. 여기서는 공식 페이지에서 현재 직접 확인되는 획득 구조와 시간 정보만 정리합니다.`,
    source_id: "editorial-source:blox-fruits",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:fisch:fishing-controls",
    universe_id: 5750914919,
    slug: "fishing-controls",
    guide_type: "beginner",
    title: "Fisch 낚시하는 법: 캐스팅부터 릴인까지",
    summary:
      "Fisch 공식 설명의 How To Fish를 기준으로 캐스팅, 입질 대기, 바 조작, 포획 완료 순서를 정리합니다.",
    body: `Fisch의 기본 낚시는 네 단계로 보면 이해하기 쉽습니다. 공식 설명에 적힌 순서는 캐스팅, 입질 대기, 바 조작, 포획 완료입니다.

먼저 낚싯대를 든 상태에서 입력을 길게 눌러 찌를 던집니다. 그다음 입질을 기다립니다. 공식 설명은 기다리는 동안 낚싯대를 흔들어 물고기를 더 빨리 유도할 수 있다고 안내합니다.

입질이 오면 화면의 흰색 바를 조작하는 단계로 넘어갑니다. 누르거나 클릭해 바를 움직이고, 파란 선을 가능한 한 따라가는 방식입니다. 공식 설명에서도 몇 번 놓치는 것은 괜찮다고 안내하므로 한 번 어긋났다고 바로 실패라고 볼 필요는 없습니다.

화면 아래 진행 바가 가득 차면 물고기를 끌어올리는 데 성공합니다. 즉 처음 플레이할 때는 희귀 어종이나 장비보다 “던지기 → 기다리기 → 흰색 바 조작 → 진행 바 채우기” 순서를 먼저 익히는 것이 핵심입니다.

이 가이드는 특정 낚싯대의 성능, 어종별 위치, 확률이나 돈벌이 효율을 임의로 추가하지 않습니다. 공식 페이지에서 직접 확인되는 기본 조작만 설명합니다.`,
    source_id: "editorial-source:fisch",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:grow-a-garden:planting-basics",
    universe_id: 7436755782,
    slug: "planting-basics",
    guide_type: "beginner",
    title: "Grow a Garden 처음 심는 법: 씨앗·밭·수확 순서",
    summary:
      "공식 How To Plant 설명을 기준으로 씨앗 구매부터 심기, 성장 대기, 수확, 오프라인 성장까지 연결해 설명합니다.",
    body: `Grow a Garden의 시작 흐름은 씨앗을 사고, 밭에 심고, 자라기를 기다린 뒤 수확하는 구조입니다. 공식 설명은 상점이 재입고될 때 씨앗을 구입한다고 안내합니다.

씨앗을 구했다면 먼저 심고 싶은 씨앗을 장착합니다. 그 상태에서 자신의 농장에 있는 갈색 밭 부분을 눌러 심습니다. 아무 곳이나 클릭하는 방식이 아니라 농장의 심을 수 있는 구역을 사용하는 구조입니다.

심은 뒤에는 작물이 자라기 시작할 때까지 기다립니다. 완전히 성장하면 수확할 수 있고, 공식 설명은 수확한 결과를 통해 수익을 얻는 흐름을 핵심으로 소개합니다.

중요한 특징은 오프라인 성장입니다. 공식 페이지는 접속하지 않은 동안에도 정원이 계속 자란다고 명시합니다. 따라서 다시 접속했을 때 이전에 심어 둔 작물이 성장해 있을 수 있습니다.

이 가이드는 씨앗별 수익률, 희귀 작물 확률, 최적 배치처럼 공식 설명만으로 확인할 수 없는 공략을 만들지 않습니다. 처음 접속한 사용자가 실제 기본 루프를 이해하는 데 필요한 내용만 다룹니다.`,
    source_id: "editorial-source:grow-a-garden",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:rivals:first-duel",
    universe_id: 6035872082,
    slug: "first-duel",
    guide_type: "beginner",
    title: "RIVALS 첫 대전 시작법: 듀얼 패드·키·계약",
    summary:
      "RIVALS 공식 설명에 명시된 대전 시작 방식과 1대1~5대5 규칙, 키·계약·연승 진행 요소를 구분합니다.",
    body: `RIVALS는 1대1부터 5대5까지 진행되는 FPS 대전 게임입니다. 공식 설명에 따르면 한 매치는 먼저 5라운드를 이긴 쪽이 승리합니다.

대전을 시작하는 가장 기본적인 방법은 로비의 듀얼 패드입니다. 공식 페이지는 듀얼 패드 위에 올라 다른 플레이어에게 대전을 걸 수 있다고 안내합니다. 처음 접속했다면 복잡한 메뉴를 찾기보다 이 대전 시작 구조를 먼저 알아두면 됩니다.

진행 요소는 키와 계약으로 나뉩니다. 플레이하면서 키를 얻어 새로운 무기와 스킨을 해제할 수 있고, 계약을 완료하면 별도 보상을 얻을 수 있다고 공식 설명에 적혀 있습니다.

승패 기록 외에도 연승을 표시하고 리더보드에 오르는 경쟁 요소가 있습니다. 다만 특정 무기 조합, 최강 세팅, 맵별 전술은 공식 설명만으로 검증되지 않으므로 이 가이드에서 임의로 추천하지 않습니다.

정리하면 처음에는 “듀얼 패드에서 경기 시작 → 먼저 5라운드 승리 목표 → 키와 계약으로 진행 요소 확인” 순서만 이해해도 게임의 기본 구조를 파악할 수 있습니다.`,
    source_id: "editorial-source:rivals",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:murder-mystery-2:roles",
    universe_id: 66654135,
    slug: "roles",
    guide_type: "mechanic",
    title: "Murder Mystery 2 역할 차이: Innocent·Sheriff·Murderer",
    summary:
      "세 역할의 목표를 공식 설명 그대로 분리해, 라운드 시작 직후 무엇을 해야 하는지 빠르게 확인할 수 있게 정리합니다.",
    body: `Murder Mystery 2는 라운드마다 역할에 따라 해야 할 일이 완전히 달라집니다. 공식 설명은 Innocent, Sheriff, Murderer 세 역할의 목표를 명확하게 구분합니다.

Innocent는 Murderer에게서 도망치고 숨어 살아남아야 합니다. 동시에 누가 Murderer인지 추리하는 역할입니다. 공식 설명상 Innocent에게는 Sheriff처럼 Murderer를 직접 제압하는 전용 무기가 주어지는 역할이 아닙니다.

Sheriff는 Innocent와 협력하며 Murderer를 쓰러뜨릴 수 있는 무기를 가진 역할입니다. 따라서 Sheriff의 핵심 임무는 생존과 함께 Murderer를 식별하고 제압하는 것입니다.

Murderer는 다른 플레이어를 제거하는 역할이며 Sheriff에게 총을 맞지 않아야 합니다. 라운드의 긴장은 이 세 역할이 서로의 정체와 행동을 관찰하는 데서 만들어집니다.

게임에는 칼을 수집하고 거래하는 요소도 공식 설명에 포함되어 있습니다. 하지만 특정 칼 가치, 거래 시세, 숨겨진 확률은 별도 검증 없이는 단정하지 않습니다. 이 페이지에서는 라운드 역할과 공식적으로 확인되는 기본 목표만 설명합니다.`,
    source_id: "editorial-source:murder-mystery-2",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:volleyball-legends:controls",
    universe_id: 6931042565,
    slug: "controls",
    guide_type: "mechanic",
    title: "Volleyball Legends 조작법: 리시브·스파이크·블록·서브",
    summary:
      "PC와 콘솔의 기본 입력과 서브 방법을 Roblox 공식 게임 설명에 적힌 조작 기준으로 정리합니다.",
    body: `Volleyball Legends는 빠른 6대6 배구를 중심으로 하는 게임입니다. 친구들과 일반 경기를 하거나 Ranked 매치에서 경쟁할 수 있다고 공식 설명에 안내되어 있습니다.

PC 기준 리시브와 공중 스파이크는 클릭, 콘솔은 RT를 사용합니다. 토스와 공중 블록은 PC에서 Q, 콘솔에서는 LT입니다. 다이브는 PC에서 Ctrl, 콘솔에서는 X로 안내되어 있습니다.

서브는 자신의 차례가 되었을 때 화면을 한 번 누르고, 다시 눌러 힘을 정하는 방식입니다. 콘솔에서는 RT가 대응 입력으로 안내됩니다.

서브할 때 점프한 뒤 스파이크 형태로 칠 수도 있고, 공이 내려오게 두었다가 범프 서브를 할 수도 있습니다. 공식 설명은 공의 방향을 조절할 수 있다는 점도 안내합니다.

이 가이드는 캐릭터별 능력, 티어, Ranked 메타처럼 업데이트에 따라 달라지는 내용을 추정하지 않습니다. 처음 경기장에 들어갔을 때 필요한 공식 기본 조작과 서브 흐름만 정리합니다.`,
    source_id: "editorial-source:volleyball-legends",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:blade-ball:controls",
    universe_id: 4777817887,
    slug: "controls",
    guide_type: "mechanic",
    title: "Blade Ball 조작법: 블록·능력·Shift Lock",
    summary:
      "추적 공을 튕겨내는 기본 흐름과 PC·콘솔·모바일에 안내된 Block, Ability, Shift Lock 입력을 정리합니다.",
    body: `Blade Ball의 기본 구조는 플레이어를 추적하는 공을 정확한 타이밍에 튕겨내는 것입니다. 공식 설명은 공의 속도가 점점 빨라지며 집중력, 타이밍, 전략을 시험하는 게임이라고 소개합니다.

Block은 PC에서 F 또는 왼쪽 클릭, 콘솔에서는 R1, 모바일에서는 화면이나 UI 버튼 입력으로 안내되어 있습니다. 공이 자신을 향할 때 사용하는 핵심 방어 입력입니다.

Ability는 PC에서 Q 또는 오른쪽 클릭, 콘솔에서는 X 버튼, 모바일에서는 UI 버튼을 사용합니다. 게임에는 능력을 얻고 강화하는 성장 요소가 있다고 공식 설명에 명시되어 있습니다.

Shift Lock은 PC에서 Shift, 콘솔에서는 Y 버튼, 모바일에서는 UI 버튼으로 안내됩니다. Emote는 PC에서 R, 콘솔에서는 L1, 모바일에서는 UI 버튼을 사용합니다.

이 가이드는 “언제 몇 프레임에 블록해야 한다” 같은 정밀 타이밍이나 특정 능력의 우열을 임의로 만들지 않습니다. 공식 페이지에서 확인 가능한 목적과 기본 입력을 먼저 익히는 데 초점을 둡니다.`,
    source_id: "editorial-source:blade-ball",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:the-strongest-battlegrounds:controls",
    universe_id: 3808081382,
    slug: "controls",
    guide_type: "mechanic",
    title: "The Strongest Battlegrounds 조작법: 방어·대시·회피·궁극기",
    summary:
      "공식 Roblox 설명에 적힌 PC 기본 키를 기준으로 공격, 방어, 이동, 래그돌 회피, 궁극기 입력을 정리합니다.",
    body: `The Strongest Battlegrounds는 다른 플레이어와 싸우는 액션 게임이며 PC, 콘솔, 모바일을 지원한다고 공식 페이지에 안내되어 있습니다.

PC에서 기본 공격은 왼쪽 클릭입니다. 방어는 F, 대시는 Q, 달리기는 W를 두 번 누르는 방식으로 안내되어 있습니다. 전투를 처음 시작할 때는 이 네 입력이 이동과 기본 교전의 뼈대가 됩니다.

넘어진 래그돌 상태에서는 Q가 일반 대시가 아니라 래그돌 취소 또는 회피 입력으로 사용됩니다. 같은 키라도 현재 상태에 따라 역할이 달라질 수 있다는 점을 구분해야 합니다.

궁극기 모드는 G, 이모트 휠은 B입니다. 공식 설명은 이러한 기본 키를 제공하지만 캐릭터별 콤보 순서나 피해량, 최적 빌드는 설명하지 않습니다.

따라서 이 페이지에서는 공식적으로 확인되는 조작만 정리합니다. 특정 캐릭터의 콤보나 PvP 메타는 실제 패치와 별도 검증이 필요하므로 임의로 붙이지 않습니다.`,
    source_id: "editorial-source:the-strongest-battlegrounds",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },

  {
    id: "editorial-guide:adopt-me:pet-home-basics",
    universe_id: 383310974,
    slug: "pet-home-basics",
    guide_type: "beginner",
    title: "Adopt Me! 처음 하는 법: 펫·거래·집 꾸미기 흐름",
    summary:
      "Adopt Me! 공식 설명에서 직접 확인되는 펫 육성, 수집·거래, 하우징, 역할놀이의 기본 흐름을 처음 시작하는 사람 기준으로 정리합니다.",
    body: `Adopt Me!의 핵심은 펫을 입양하고 키우는 것에서 시작합니다. 공식 설명은 다양한 펫을 기르고 수집하는 플레이를 가장 먼저 소개합니다.

수집한 펫은 다른 플레이어와 거래할 수 있습니다. 공식 설명에는 전설 등급 펫을 포함한 수집과 거래가 주요 기능으로 명시되어 있습니다. 다만 개별 펫의 시세나 교환 가치는 공식 설명만으로 확인되지 않기 때문에 이 가이드에서 가격표를 만들지 않습니다.

하우징도 별도의 핵심 축입니다. 자신의 집을 만들고 꾸밀 수 있으며, 친구들과 역할놀이를 하는 소셜 플레이가 함께 연결됩니다.

처음 접속했다면 “펫 입양·육성 → 수집 → 거래 기능 확인 → 집 꾸미기 → 친구와 역할놀이” 순서로 기능을 하나씩 익히면 게임이 어떤 구조인지 빠르게 파악할 수 있습니다.

현재 진행 중인 이벤트 아이템이나 한정 펫은 자주 바뀔 수 있으므로 이 입문 가이드의 고정 내용에 넣지 않습니다.`,
    source_id: "editorial-source:adopt-me",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:anime-vanguards:unit-progression",
    universe_id: 5578556129,
    slug: "unit-progression",
    guide_type: "progression",
    title: "Anime Vanguards 시작 흐름: 유닛 소환·레벨업·진화",
    summary:
      "공식 설명에 명시된 유닛 소환, 적 방어, 레벨업, 진화, 친구와의 멀티 모드 흐름을 순서대로 정리합니다.",
    body: `Anime Vanguards는 유닛을 소환해 몰려오는 적을 막는 타워 디펜스형 전략 게임입니다. 공식 설명은 여러 세계가 충돌한 상황에서 유닛을 불러 적을 상대하는 것을 기본 목표로 제시합니다.

첫 번째 핵심은 유닛 소환입니다. 소환한 유닛을 전투에 활용해 적의 진행을 막는 것이 기본 플레이 구조입니다.

다음은 성장입니다. 공식 설명은 유닛의 레벨을 올리고 진화시켜 이후 전투에 대비한다고 명시합니다. 즉 새 유닛을 얻는 것뿐 아니라 보유 유닛을 강화하는 과정도 진행의 핵심입니다.

친구와 함께 여러 게임 모드에서 적을 막는 협동 플레이도 공식 설명에 포함되어 있습니다. 혼자만의 진행으로 한정된 게임은 아닙니다.

어떤 유닛이 현재 최상위인지, 소환 확률이나 최적 조합이 무엇인지는 업데이트에 따라 변할 수 있으므로 별도 검증 없이 이 페이지에서 티어로 단정하지 않습니다.`,
    source_id: "editorial-source:anime-vanguards",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:bee-swarm-simulator:core-loop",
    universe_id: 601130232,
    slug: "core-loop",
    guide_type: "beginner",
    title: "Bee Swarm Simulator 처음 하는 법: 꽃가루에서 꿀까지",
    summary:
      "공식 설명을 기준으로 꽃가루 수집, 꿀 생산, 벌집 성장, 곰 퀘스트, 탐험과 전투가 어떻게 이어지는지 정리합니다.",
    body: `Bee Swarm Simulator의 가장 기본적인 흐름은 꽃가루를 모아 꿀을 만드는 것입니다. 공식 설명도 자신의 벌 무리를 키우고 꽃가루를 수집해 꿀을 만드는 플레이를 핵심으로 소개합니다.

벌집이 커질수록 더 멀리 산을 탐험할 수 있습니다. 진행이 단순히 같은 장소에서 자원을 반복 수집하는 데서 끝나지 않고 새로운 구역 탐험으로 이어지는 구조입니다.

맵의 친근한 곰 NPC에게서는 퀘스트를 받을 수 있고 완료하면 보상을 얻습니다. 벌을 이용해 위험한 벌레와 몬스터를 상대하는 전투 요소도 포함됩니다.

공식 설명은 맵 곳곳의 보물을 찾고 서로 다른 특성과 성격을 가진 새로운 종류의 벌을 발견하는 수집 요소도 안내합니다.

따라서 처음에는 “꽃가루 수집 → 꿀 생산 → 벌집 성장 → 곰 퀘스트 → 새 지역 탐험”이라는 큰 흐름을 이해하는 것이 좋습니다. 특정 벌 티어나 효율표는 공식 설명만으로 확인되지 않아 여기서 만들지 않습니다.`,
    source_id: "editorial-source:bee-swarm-simulator",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:brookhaven:roleplay-basics",
    universe_id: 1686885941,
    slug: "roleplay-basics",
    guide_type: "beginner",
    title: "Brookhaven 처음 하는 법: 집·차량·도시 역할놀이",
    summary:
      "Brookhaven 공식 설명에서 확인되는 집, 차량, 도시 탐험, 자유 역할놀이 구조만으로 처음 접속했을 때 할 수 있는 일을 정리합니다.",
    body: `Brookhaven은 정해진 전투 목표를 따라가는 게임보다 자유롭게 상황을 만드는 역할놀이 경험에 가깝습니다. 공식 설명은 비슷한 관심사를 가진 사람들과 함께 역할놀이를 하는 장소로 소개합니다.

플레이어는 집을 소유하고 그 안에서 생활하는 상황을 만들 수 있습니다. 공식 설명은 다양한 집을 직접 언급합니다.

차량을 이용해 도시를 돌아다니고 여러 공간을 탐험할 수도 있습니다. 그래서 처음 접속했다면 집과 차량 기능을 확인한 뒤 도시를 둘러보는 것이 게임 구조를 익히는 가장 직접적인 방법입니다.

가장 중요한 특징은 “원하는 사람이 되어 보라”는 자유 역할놀이입니다. 특정 직업이나 승리 조건 하나가 모든 플레이어에게 강제되는 방식으로 설명되어 있지 않습니다.

현재 진행 중인 이벤트나 기간 한정 차량·아이템은 바뀔 수 있으므로 이 기본 가이드에서는 제외합니다. 또한 현재 플레이 인원은 Roblox 공개 API에서 최근 값을 확인하지 못하는 동안 과거 값을 현재값처럼 표시하지 않습니다.`,
    source_id: "editorial-source:brookhaven",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:doors:before-you-enter",
    universe_id: 2440500124,
    slug: "before-you-enter",
    guide_type: "beginner",
    title: "DOORS 처음 시작하기 전 알아둘 점",
    summary:
      "DOORS 공식 설명의 핵심 권장사항과 시청각 경고를 기준으로 첫 플레이 전에 알아둘 내용을 짧게 정리합니다.",
    body: `DOORS는 문을 통과하며 진행하는 공포 게임입니다. 공식 설명 자체도 구체적인 정답 공략보다 직접 들어가 경험해 보는 방식을 권장합니다.

특히 공식 페이지는 가이드 없이 시작하고, 각 죽음을 다음 플레이를 위한 교훈으로 사용하라고 안내합니다. 처음부터 모든 상황의 답을 외우는 방식보다 실패를 통해 패턴을 알아가는 플레이를 의도한 셈입니다.

시청각 요소에 대한 주의도 필요합니다. 공식 설명에는 큰 소리와 번쩍이는 조명이 나온다는 경고가 있습니다.

헤드폰과 높은 그래픽 설정도 공식 페이지에서 권장하지만, 이는 필수 조건이라는 뜻은 아닙니다. 자신의 기기 성능과 환경에 맞춰 조절하는 것이 좋습니다.

이 페이지는 게임이 직접 권장하는 시작 방식과 안전 관련 안내만 정리합니다. 엔티티별 정답이나 방별 스포일러를 공식 설명에 없는 내용으로 채우지 않습니다.`,
    source_id: "editorial-source:doors",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:jailbreak:roles-basics",
    universe_id: 245662005,
    slug: "roles-basics",
    guide_type: "beginner",
    title: "Jailbreak 처음 하는 법: 범죄자와 경찰 역할 차이",
    summary:
      "Jailbreak 공식 설명에 명시된 강도·체포 역할, 솔로·팀 플레이, 차량 활용이라는 기본 구조를 역할별로 나눠 설명합니다.",
    body: `Jailbreak는 범죄자와 경찰 역할이 맞서는 오픈월드 액션 게임입니다. 공식 설명은 범죄자는 강도를 계획하고 경찰은 범죄자를 잡는 구조를 핵심으로 소개합니다.

범죄자 역할에서는 강도를 조직하는 것이 대표적인 목표입니다. 혼자 움직일 수도 있고 다른 플레이어와 함께 행동할 수도 있다고 공식 설명에 명시되어 있습니다.

경찰 역할은 반대로 범죄자를 찾아 체포하는 쪽입니다. 같은 맵을 사용하지만 선택한 역할에 따라 목적이 달라집니다.

차량도 중요한 이동 수단입니다. 공식 설명은 빠른 차량을 찾아 서버를 누비는 플레이를 직접 언급합니다. 넓은 오픈월드에서 추격과 이동이 역할 플레이와 연결됩니다.

기간 한정 이벤트 보상이나 특정 차량 성능 순위는 자주 바뀔 수 있어 기본 가이드에 고정하지 않습니다. 처음에는 자신의 역할 목적과 차량 이동 구조를 이해하는 데 집중하면 됩니다.`,
    source_id: "editorial-source:jailbreak",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:theme-park-tycoon-2:building-basics",
    universe_id: 31970568,
    slug: "building-basics",
    guide_type: "beginner",
    title: "Theme Park Tycoon 2 시작법: 부지·놀이기구·롤러코스터",
    summary:
      "공식 설명을 기준으로 개인 부지에서 놀이기구를 만들고 롤러코스터와 장식으로 공원을 확장하는 기본 구조를 정리합니다.",
    body: `Theme Park Tycoon 2에서는 자신의 땅을 받아 직접 테마파크를 만드는 것이 시작점입니다. 공식 설명은 친구와 함께 자신의 부지에서 공원을 건설할 수 있다고 안내합니다.

공원에는 여러 종류의 놀이기구를 원하는 방식으로 배치할 수 있습니다. 미리 정해진 한 가지 배치만 따라야 하는 구조가 아니라 자신의 공원 구성을 만드는 것이 핵심입니다.

롤러코스터는 직접 설계할 수 있다고 공식 설명에 명시되어 있습니다. 단순히 완성된 기구를 놓는 것과 별도로 트랙을 구성하며 공원의 개성을 만들 수 있습니다.

장식 요소도 큰 비중을 차지합니다. 공식 페이지는 수백 개의 scenery 요소를 선택해 공원을 더 꾸밀 수 있다고 안내합니다.

이 가이드에서는 수익 최적화 배치나 특정 기구의 효율을 임의로 계산하지 않습니다. 먼저 “개인 부지 → 놀이기구 배치 → 롤러코스터 설계 → 장식”이라는 공식 기본 구조를 이해하는 데 초점을 둡니다.`,
    source_id: "editorial-source:theme-park-tycoon-2",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:tower-defense-simulator:defense-basics",
    universe_id: 1176784616,
    slug: "defense-basics",
    guide_type: "beginner",
    title: "Tower Defense Simulator 시작법: 유닛 배치·좀비·보스",
    summary:
      "공식 Roblox 설명에서 확인되는 유닛 배치, 좀비 방어, 협동, 보스전, 신규 유닛 해제의 기본 진행 순서를 정리합니다.",
    body: `Tower Defense Simulator의 기본 목표는 유닛을 배치해 몰려오는 좀비를 막는 것입니다. 공식 설명은 이 방어 구조를 게임의 핵심으로 가장 먼저 안내합니다.

플레이어는 전장에 유닛을 배치하고 웨이브 형태로 오는 적을 막습니다. 혼자만 플레이해야 하는 구조가 아니라 친구와 팀을 이뤄 함께 방어할 수 있습니다.

진행할수록 더 강한 보스를 상대하게 됩니다. 공식 설명은 강한 보스에 맞서는 과정과 새로운 유닛 해제를 연결해 소개합니다.

따라서 처음에는 “유닛 배치 → 좀비 웨이브 방어 → 친구와 협동 → 강한 보스 도전 → 새 유닛 해제”라는 큰 흐름을 이해하는 것이 좋습니다.

특정 타워의 현재 티어, 배치 위치, 코드 보상은 업데이트에 따라 바뀔 수 있으므로 공식적으로 별도 검증된 경우가 아니면 이 기본 가이드에서 단정하지 않습니다.`,
    source_id: "editorial-source:tower-defense-simulator",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
];

export function getVerifiedEditorialGuides(universeId?: number) {
  return universeId == null
    ? VERIFIED_EDITORIAL_GUIDES
    : VERIFIED_EDITORIAL_GUIDES.filter(
        (guide) => guide.universe_id === universeId,
      );
}

export function getVerifiedEditorialGuide(
  universeId: number,
  slug: string,
) {
  return (
    VERIFIED_EDITORIAL_GUIDES.find(
      (guide) =>
        guide.universe_id === universeId && guide.slug === slug,
    ) ?? null
  );
}

export function getVerifiedEditorialSources(universeId?: number) {
  return universeId == null
    ? VERIFIED_EDITORIAL_SOURCES
    : VERIFIED_EDITORIAL_SOURCES.filter(
        (source) => source.universe_id === universeId,
      );
}
