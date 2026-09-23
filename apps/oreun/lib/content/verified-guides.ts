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
  content_status: "published" | "archived";
  index_state: "indexable" | "noindex";
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

  {
    id: "editorial-source:99-nights-in-the-forest",
    universe_id: 7326934954,
    source_type: "official_roblox_experience",
    label: "99 Nights in the Forest Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/79546208627805/99-Nights-in-the-Forest",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:arsenal",
    universe_id: 111958650,
    source_type: "official_roblox_experience",
    label: "Arsenal Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/286090429/Arsenal",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:blue-lock-rivals",
    universe_id: 6325068386,
    source_type: "official_roblox_experience",
    label: "Blue Lock: Rivals Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/18668065416/Blue-Lock-Rivals",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:dress-to-impress",
    universe_id: 5203828273,
    source_type: "official_roblox_experience",
    label: "Dress To Impress Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/15101393044/Dress-To-Impress",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:forsaken",
    universe_id: 6331902150,
    source_type: "official_roblox_experience",
    label: "Forsaken Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/18687417158/Forsaken",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:natural-disaster-survival",
    universe_id: 65241,
    source_type: "official_roblox_experience",
    label: "Natural Disaster Survival Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/189707/Natural-Disaster-Survival",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:pet-simulator-99",
    universe_id: 3317771874,
    source_type: "official_roblox_experience",
    label: "Pet Simulator 99 Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/8737899170/Pet-Simulator-99",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:pls-donate",
    universe_id: 3317679266,
    source_type: "official_roblox_experience",
    label: "PLS DONATE Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/8737602449/PLS-DONATE",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:prison-life",
    universe_id: 73885730,
    source_type: "official_roblox_experience",
    label: "Prison Life Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/155615604/Prison-Life",
    last_checked_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-source:work-at-a-pizza-place",
    universe_id: 47545,
    source_type: "official_roblox_experience",
    label: "Work at a Pizza Place Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/192800/Work-at-a-Pizza-Place",
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
      "과일을 얻는 방법은 맵에서 찾기와 Blox Fruits Dealer에게 구매하기로 나뉩니다. 맵에 등장하는 과일과 Dealer의 판매 재고는 서로 다른 주기로 바뀝니다.",
    body: `과일을 얻는 방법은 맵에서 찾기와 Blox Fruits Dealer에게 구매하기로 나뉩니다. 맵에 등장하는 과일과 Dealer의 판매 재고는 서로 다른 주기로 바뀝니다.

공식 안내상 맵에는 1시간마다 과일이 등장하고, 등장한 과일은 20분 뒤 사라집니다. 따라서 맵을 돌아도 과일이 없는 시간이 생길 수 있습니다.

Dealer는 무작위 과일 목록을 4시간마다 다시 채웁니다. 맵 스폰을 기다리는 것과 별개로 상점 재고를 확인할 수 있습니다.

검을 사용하는 전투와 Blox Fruit 능력을 사용하는 전투가 모두 가능하며, 적과 보스를 상대하고 바다를 이동하며 진행합니다.`,
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
      "낚싯대를 든 상태에서 입력을 길게 눌러 찌를 던지고 입질을 기다립니다. 공식 안내에 따르면 기다리는 동안 낚싯대를 흔들어 물고기를 더 빨리 유도할 수 있습니다.",
    body: `낚싯대를 든 상태에서 입력을 길게 눌러 찌를 던지고 입질을 기다립니다. 공식 안내에 따르면 기다리는 동안 낚싯대를 흔들어 물고기를 더 빨리 유도할 수 있습니다.

입질이 오면 누르거나 클릭해 흰색 바를 움직여 파란 선을 따라갑니다. 한 번 어긋났다고 바로 실패하는 것은 아닙니다.

화면 아래 진행 바가 가득 차면 물고기를 끌어올리는 데 성공합니다.`,
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
      "씨앗을 구입해 장착한 뒤, 자신의 농장에 있는 갈색 밭 부분을 눌러 심습니다. 농장의 심을 수 있는 구역을 선택해야 합니다.",
    body: `씨앗을 구입해 장착한 뒤, 자신의 농장에 있는 갈색 밭 부분을 눌러 심습니다. 농장의 심을 수 있는 구역을 선택해야 합니다.

씨앗은 상점 재입고 때 구입할 수 있습니다. 심은 작물이 완전히 자라면 수확해 수익을 얻습니다.

정원은 접속하지 않은 동안에도 계속 자랍니다. 다시 접속했을 때 이전에 심어 둔 작물이 성장해 있을 수 있습니다.`,
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
      "공식 안내에 따르면, 로비의 듀얼 패드 위에 올라 다른 플레이어에게 대전을 걸 수 있습니다.",
    body: `공식 안내에 따르면, 로비의 듀얼 패드 위에 올라 다른 플레이어에게 대전을 걸 수 있습니다.

대전은 1대1부터 5대5까지 진행하며, 한 매치는 먼저 5라운드를 이긴 쪽이 승리합니다.

플레이하면서 키를 모아 새로운 무기와 스킨을 해제할 수 있습니다. 계약을 완료하면 별도 보상도 얻습니다.

연승 기록과 리더보드를 통해 경기 결과를 확인할 수 있습니다.`,
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
      "라운드에서 Innocent를 맡으면 Murderer를 피해 도망치고 숨어 살아남아야 합니다. 동시에 누가 Murderer인지 추리합니다.",
    body: `라운드에서 Innocent를 맡으면 Murderer를 피해 도망치고 숨어 살아남아야 합니다. 동시에 누가 Murderer인지 추리합니다.

Sheriff는 무기를 이용해 Murderer를 쓰러뜨리는 역할입니다. Innocent와 협력해 상대를 식별하고, 생존하면서 제압해야 합니다.

Murderer는 다른 플레이어를 제거하는 역할이며 Sheriff에게 총을 맞지 않아야 합니다.`,
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
      "리시브와 공중 스파이크는 PC에서 클릭, 콘솔에서 RT를 사용합니다. 토스와 공중 블록은 PC의 Q, 콘솔의 LT이며, 다이브는 PC의 Ctrl, 콘솔의 X입니다.",
    body: `리시브와 공중 스파이크는 PC에서 클릭, 콘솔에서 RT를 사용합니다. 토스와 공중 블록은 PC의 Q, 콘솔의 LT이며, 다이브는 PC의 Ctrl, 콘솔의 X입니다.

서브 차례에는 화면을 한 번 누르고, 다시 눌러 힘을 정합니다. 콘솔에서는 RT가 대응 입력입니다.

서브할 때 점프한 뒤 스파이크로 칠 수도 있고, 공이 내려오게 두었다가 범프 서브를 할 수도 있습니다. 공의 방향도 조절할 수 있습니다.

경기는 6대6으로 진행하며 친구들과 일반 경기를 하거나 Ranked 매치에서 경쟁할 수 있습니다.`,
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
      "공이 자신을 향할 때 Block 입력으로 튕겨냅니다. PC에서는 F 또는 왼쪽 클릭, 콘솔에서는 R1, 모바일에서는 화면이나 UI 버튼을 사용합니다.",
    body: `공이 자신을 향할 때 Block 입력으로 튕겨냅니다. PC에서는 F 또는 왼쪽 클릭, 콘솔에서는 R1, 모바일에서는 화면이나 UI 버튼을 사용합니다.

Ability는 PC의 Q 또는 오른쪽 클릭, 콘솔의 X, 모바일의 UI 버튼입니다. 능력을 얻고 강화해 플레이 스타일을 바꿀 수 있습니다.

Shift Lock은 PC의 Shift, 콘솔의 Y, 모바일의 UI 버튼입니다. Emote는 PC의 R, 콘솔의 L1, 모바일의 UI 버튼으로 사용합니다.

공은 플레이어를 추적하며 점점 빨라집니다. 정확한 타이밍에 막는 것이 중요합니다.`,
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
      "PC에서 기본 공격은 왼쪽 클릭, 방어는 F, 대시는 Q입니다. 달리기는 W를 두 번 누릅니다.",
    body: `PC에서 기본 공격은 왼쪽 클릭, 방어는 F, 대시는 Q입니다. 달리기는 W를 두 번 누릅니다.

넘어진 래그돌 상태에서는 Q가 일반 대시가 아니라 래그돌 취소 또는 회피 입력으로 쓰입니다. 같은 키라도 현재 상태에 따라 역할이 달라집니다.

궁극기 모드는 G, 이모트 휠은 B입니다. 이 키 안내는 PC 기준이며 게임 자체는 콘솔과 모바일도 지원합니다.`,
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
      "펫을 입양해 키우고 수집합니다. 수집한 펫은 다른 플레이어와 거래할 수 있습니다.",
    body: `펫을 입양해 키우고 수집합니다. 수집한 펫은 다른 플레이어와 거래할 수 있습니다.

자신의 집을 만들고 꾸미는 하우징 기능도 있습니다. 펫을 기르는 것 외에 집 꾸미기와 친구들과의 역할놀이를 즐길 수 있습니다.

개별 펫의 시세와 교환 가치는 공식 게임 소개에서 확인되지 않습니다. 현재 이벤트와 한정 펫은 업데이트에 따라 바뀔 수 있습니다.`,
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
      "유닛을 소환해 전투에 활용하고, 몰려오는 적의 진행을 막습니다.",
    body: `유닛을 소환해 전투에 활용하고, 몰려오는 적의 진행을 막습니다.

보유 유닛의 레벨을 올리고 진화시켜 이후 전투에 대비할 수 있습니다. 새 유닛을 얻는 것과 기존 유닛을 강화하는 과정이 함께 이어집니다.

친구들과 여러 게임 모드에서 함께 적을 막는 협동 플레이도 가능합니다.`,
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
      "꽃가루를 모아 꿀을 만들고 자신의 벌집을 성장시킵니다. 벌집이 커지면 산의 새로운 구역을 탐험할 수 있습니다.",
    body: `꽃가루를 모아 꿀을 만들고 자신의 벌집을 성장시킵니다. 벌집이 커지면 산의 새로운 구역을 탐험할 수 있습니다.

맵의 곰 NPC에게 퀘스트를 받고 완료하면 보상을 얻습니다. 벌을 이용해 벌레와 몬스터를 상대할 수도 있습니다.

탐험하면서 맵의 보물을 찾고 서로 다른 특성을 가진 벌을 수집합니다.`,
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
      "집을 이용해 생활하는 상황을 만들거나, 차량을 타고 도시의 여러 공간을 둘러볼 수 있습니다.",
    body: `집을 이용해 생활하는 상황을 만들거나, 차량을 타고 도시의 여러 공간을 둘러볼 수 있습니다.

정해진 전투 목표보다 친구들과 원하는 역할과 상황을 만드는 플레이가 중심입니다.

한국 이용 제한 상태에서는 게임 이용 가능 여부를 먼저 확인하세요. 현재 접속자 수를 확인하지 못하는 동안 과거 인원을 현재값으로 표시하지 않습니다.`,
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
      "공식 안내에는 큰 소리와 번쩍이는 조명이 나온다는 경고가 있습니다. 플레이 전에 이 시청각 요소를 확인하세요.",
    body: `공식 안내에는 큰 소리와 번쩍이는 조명이 나온다는 경고가 있습니다. 플레이 전에 이 시청각 요소를 확인하세요.

DOORS는 문을 통과하며 진행하는 공포 게임입니다. 공식 페이지는 실패 경험에서 패턴을 배우는 플레이를 권장합니다.

헤드폰과 높은 그래픽 설정은 권장 사항이며 필수 조건은 아닙니다.`,
    source_id: "editorial-source:doors",
    content_status: "archived",
    index_state: "noindex",
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
      "범죄자를 선택하면 강도를 계획하고, 경찰을 선택하면 범죄자를 찾아 체포합니다. 선택한 역할에 따라 목표가 달라집니다.",
    body: `범죄자를 선택하면 강도를 계획하고, 경찰을 선택하면 범죄자를 찾아 체포합니다. 선택한 역할에 따라 목표가 달라집니다.

혼자 또는 다른 플레이어와 함께 행동할 수 있습니다. 차량은 넓은 맵을 이동하고 추격하는 수단입니다.

기간 한정 이벤트 보상과 차량 성능은 업데이트에 따라 바뀔 수 있습니다.`,
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
      "자신의 부지에 놀이기구를 배치해 테마파크를 만듭니다. 친구와 함께 건설할 수도 있습니다.",
    body: `자신의 부지에 놀이기구를 배치해 테마파크를 만듭니다. 친구와 함께 건설할 수도 있습니다.

롤러코스터는 직접 트랙을 설계할 수 있습니다. 완성된 기구를 배치하는 것과 별도의 기능입니다.

장식 요소를 선택해 공원을 꾸밀 수 있습니다.`,
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
      "전장에 유닛을 배치해 웨이브로 몰려오는 좀비를 막습니다. 친구와 팀을 이뤄 함께 방어할 수 있습니다.",
    body: `전장에 유닛을 배치해 웨이브로 몰려오는 좀비를 막습니다. 친구와 팀을 이뤄 함께 방어할 수 있습니다.

진행하면서 더 강한 보스를 상대하고 새로운 유닛을 해제합니다.

타워의 성능과 코드 보상은 업데이트에 따라 바뀔 수 있습니다.`,
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

  {
    id: "editorial-guide:99-nights-in-the-forest:camp-basics",
    universe_id: 7326934954,
    slug: "camp-basics",
    guide_type: "beginner",
    title: "99 Nights in the Forest 시작법: 캠프와 생존 구조",
    summary:
      "공식 게임 소개는 친구들과 캠프를 만드는 협동 생존을 안내합니다.",
    body: `공식 게임 소개는 친구들과 캠프를 만드는 협동 생존을 안내합니다.

캠프를 설치하는 구체적인 입력과 밤별 대응 방법은 현재 출처에서 확인되지 않습니다.`,
    source_id: "editorial-source:99-nights-in-the-forest",
    content_status: "archived",
    index_state: "noindex",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:arsenal:weapon-loop",
    universe_id: 111958650,
    slug: "weapon-loop",
    guide_type: "mechanic",
    title: "Arsenal 처음 하는 법: 무기 순환과 BattleBucks",
    summary:
      "전투 중 주어지는 무기를 사용하며 다음 무기로 진행합니다. 한 종류에 고정되지 않고 여러 무기를 거치는 아케이드 슈팅 방식입니다.",
    body: `전투 중 주어지는 무기를 사용하며 다음 무기로 진행합니다. 한 종류에 고정되지 않고 여러 무기를 거치는 아케이드 슈팅 방식입니다.

플레이로 얻는 BattleBucks는 캐릭터, 근접 무기, 처치 효과와 스킨 등 외형을 꾸미는 데 사용할 수 있습니다.

무기의 성능은 패치에 따라 바뀔 수 있습니다.`,
    source_id: "editorial-source:arsenal",
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
    id: "editorial-guide:blue-lock-rivals:match-basics",
    universe_id: 6325068386,
    slug: "match-basics",
    guide_type: "beginner",
    title: "Blue Lock: Rivals 시작법: 5대5·클래스·능력",
    summary:
      "서로 다른 능력을 가진 캐릭터 클래스를 선택해 5대5 축구 경기에 참여합니다. 클래스마다 사용할 수 있는 능력이 다릅니다.",
    body: `서로 다른 능력을 가진 캐릭터 클래스를 선택해 5대5 축구 경기에 참여합니다. 클래스마다 사용할 수 있는 능력이 다릅니다.

친구와 팀을 이루거나 다른 플레이어와 경쟁할 수 있습니다.

이 게임은 팬들이 만든 비공식 경험입니다. 공식 게임 안내는 원작 IP 저자나 Kodansha의 직접적인 감독·보증을 받은 콘텐츠가 아니라고 밝힙니다.`,
    source_id: "editorial-source:blue-lock-rivals",
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
    id: "editorial-guide:dress-to-impress:runway-basics",
    universe_id: 5203828273,
    slug: "runway-basics",
    guide_type: "beginner",
    title: "Dress To Impress 시작법: 코디·런웨이·투표",
    summary:
      "주어진 주제에 맞는 의상을 만들고 런웨이에서 보여줍니다. 완성한 코디를 보여줄 때 포즈를 사용할 수 있습니다.",
    body: `주어진 주제에 맞는 의상을 만들고 런웨이에서 보여줍니다. 완성한 코디를 보여줄 때 포즈를 사용할 수 있습니다.

다른 플레이어의 의상에 투표하고 자신의 의상도 평가받습니다.

친구와 함께 코디를 만들거나 경쟁할 수 있습니다.`,
    source_id: "editorial-source:dress-to-impress",
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
    id: "editorial-guide:forsaken:roles-objectives",
    universe_id: 6331902150,
    slug: "roles-objectives",
    guide_type: "mechanic",
    title: "Forsaken 역할 차이: Survivor와 Killer 목표",
    summary:
      "Survivor는 팀원을 보호하고 목표를 수행하면서 타이머가 0이 될 때까지 살아남아야 합니다.",
    body: `Survivor는 팀원을 보호하고 목표를 수행하면서 타이머가 0이 될 때까지 살아남아야 합니다.

Killer는 그 전에 Survivor를 모두 제거하는 것이 목표입니다.

공식 안내에는 번쩍이는 조명과 큰 소리가 포함되며, 광과민성 발작 위험이 있는 사람에게 플레이를 권하지 않는다는 경고가 있습니다.

현재 출처의 게임 소개는 Alpha 단계로 안내합니다. 세부 밸런스와 캐릭터 성능은 바뀔 수 있습니다.`,
    source_id: "editorial-source:forsaken",
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
    id: "editorial-guide:natural-disaster-survival:survival-basics",
    universe_id: 65241,
    slug: "survival-basics",
    guide_type: "beginner",
    title: "Natural Disaster Survival 시작 전 알아둘 기본 구조",
    summary:
      "재난 상황에서 위험을 피해 움직이며 라운드가 끝날 때까지 살아남는 것이 목표입니다.",
    body: `재난 상황에서 위험을 피해 움직이며 라운드가 끝날 때까지 살아남는 것이 목표입니다.

재난별 안전한 위치와 세부 규칙은 현재 공식 소개에서 확인되지 않습니다.`,
    source_id: "editorial-source:natural-disaster-survival",
    content_status: "archived",
    index_state: "noindex",
    review_status: "approved",
    reviewed_at: REVIEWED_AT,
    reviewed_by: null,
    review_note: REVIEW_NOTE,
    published_at: REVIEWED_AT,
    created_at: REVIEWED_AT,
    updated_at: REVIEWED_AT,
  },
  {
    id: "editorial-guide:pet-simulator-99:pet-army-basics",
    universe_id: 3317771874,
    slug: "pet-army-basics",
    guide_type: "beginner",
    title: "Pet Simulator 99 시작법: 펫 군단과 수집 흐름",
    summary:
      "펫을 모아 팀을 구성합니다. 펫은 자원을 얻고 성장하는 데 도움을 줍니다.",
    body: `펫을 모아 팀을 구성합니다. 펫은 자원을 얻고 성장하는 데 도움을 줍니다.

더 많은 펫을 수집하며 진행할 수 있습니다. 수집 가능한 전체 펫 수는 업데이트에 따라 달라질 수 있습니다.

특정 펫의 거래 시세와 획득 확률은 현재 공식 소개에서 확인되지 않습니다.`,
    source_id: "editorial-source:pet-simulator-99",
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
    id: "editorial-guide:pls-donate:booth-basics",
    universe_id: 3317679266,
    slug: "booth-basics",
    guide_type: "beginner",
    title: "PLS DONATE 시작법: 부스 만들기와 기부 흐름",
    summary:
      "자신의 부스를 차지한 뒤 부스에 표시할 문구를 설정합니다.",
    body: `자신의 부스를 차지한 뒤 부스에 표시할 문구를 설정합니다.

다른 플레이어에게 Robux를 받거나 반대로 기부할 수 있습니다.

Robux 결제·전송 조건은 Roblox 정책과 서비스 운영에 따라 달라질 수 있으므로 이용 시점의 안내를 확인하세요.`,
    source_id: "editorial-source:pls-donate",
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
    id: "editorial-guide:prison-life:roles",
    universe_id: 73885730,
    slug: "roles",
    guide_type: "mechanic",
    title: "Prison Life 역할 차이: Prisoner와 Guard",
    summary:
      "Prisoner를 맡으면 감옥에서 탈출을 시도할 수 있습니다. Guard는 Prisoner의 탈출을 막고 감옥을 지키는 역할입니다.",
    body: `Prisoner를 맡으면 감옥에서 탈출을 시도할 수 있습니다. Guard는 Prisoner의 탈출을 막고 감옥을 지키는 역할입니다.

선택한 역할에 따라 목표가 달라집니다. 무기와 세부 시스템은 업데이트에 따라 바뀔 수 있습니다.`,
    source_id: "editorial-source:prison-life",
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
    id: "editorial-guide:work-at-a-pizza-place:work-loop",
    universe_id: 47545,
    slug: "work-loop",
    guide_type: "beginner",
    title: "Work at a Pizza Place 시작법: 일해서 집 꾸미기까지",
    summary:
      "다른 플레이어와 팀을 이뤄 음식 주문을 처리합니다. 일을 해서 수입을 얻을 수 있습니다.",
    body: `다른 플레이어와 팀을 이뤄 음식 주문을 처리합니다. 일을 해서 수입을 얻을 수 있습니다.

번 돈으로 자신의 집을 업그레이드하거나 가구를 구입합니다.`,
    source_id: "editorial-source:work-at-a-pizza-place",
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
