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
const EXPANDED_REVIEWED_AT = "2026-09-26T10:55:00.000Z";
const EXPANDED_REVIEW_NOTE =
  "Roblox 공식 게임 설명과 공개 메타데이터를 재확인하고 실제 플레이 순서를 한국어로 재작성.";
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
  {
    id: "editorial-source:steal-an-egg",
    universe_id: 10563114921,
    source_type: "official_roblox_experience",
    label: "Steal An Egg Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/107778070777162/",
    last_checked_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-source:jujutsu-shenanigans",
    universe_id: 3508322461,
    source_type: "official_roblox_experience",
    label: "Jujutsu Shenanigans Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/9391468976/",
    last_checked_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-source:steal-a-brainrot",
    universe_id: 7709344486,
    source_type: "official_roblox_experience",
    label: "Steal a Brainrot Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/109983668079237/",
    last_checked_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-source:fish-it",
    universe_id: 6701277882,
    source_type: "official_roblox_experience",
    label: "Fish It! Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/121864768012064/",
    last_checked_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-source:catalog-avatar-creator",
    universe_id: 2711375305,
    source_type: "official_roblox_experience",
    label: "Catalog Avatar Creator Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/7041939546/",
    last_checked_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-source:evade",
    universe_id: 3647333358,
    source_type: "official_roblox_experience",
    label: "Evade Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/9872472334/",
    last_checked_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-source:tower-of-hell",
    universe_id: 703124385,
    source_type: "official_roblox_experience",
    label: "Tower of Hell Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/1962086868/",
    last_checked_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-source:sols-rng",
    universe_id: 5361032378,
    source_type: "official_roblox_experience",
    label: "Sol's RNG Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/15532962292/",
    last_checked_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-source:dandys-world",
    universe_id: 5569032992,
    source_type: "official_roblox_experience",
    label: "Dandy's World Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/16116270224/",
    last_checked_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-source:bedwars",
    universe_id: 2619619496,
    source_type: "official_roblox_experience",
    label: "BedWars Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/6872265039/",
    last_checked_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-source:piggy",
    universe_id: 1516533665,
    source_type: "official_roblox_experience",
    label: "Piggy Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/4623386862/",
    last_checked_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-source:welcome-to-bloxburg",
    universe_id: 88070565,
    source_type: "official_roblox_experience",
    label: "Welcome to Bloxburg Roblox 공식 페이지",
    source_url: "https://www.roblox.com/games/185655149/",
    last_checked_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
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
  {
    id: "editorial-guide:steal-an-egg:egg-pet-loop",
    universe_id: 10563114921,
    slug: "egg-pet-loop",
    guide_type: "beginner",
    title: "Steal An Egg 시작법: 알 훔치기·부화·펫 수익 순서",
    summary: "알을 확보해 부화시키고 펫 수익으로 기지와 속도를 키운 뒤 다른 플레이어의 알까지 노리는 기본 진행 순서를 정리합니다.",
    body: `처음에는 알을 확보하고 부화시키는 흐름부터 익히세요. 부화한 펫은 단순 수집품이 아니라 돈을 벌어 주는 성장 자원이므로, 어떤 펫을 확보했는지가 이후 기지 성장 속도에 직접 연결됩니다.

펫이 벌어 주는 돈이 생기면 러닝머신과 기지를 업그레이드할 수 있습니다. 러닝머신에서는 속도를 키울 수 있어 다른 플레이어의 기지를 오갈 때 움직임이 편해집니다. 초반에는 수집만 늘리기보다 수익과 이동 성장을 함께 챙기는 편이 안정적입니다.

다른 플레이어의 알을 훔치는 경쟁 요소도 있습니다. 자신의 기지 성장이 너무 느린 상태에서 훔치기만 반복하기보다 먼저 펫 수익을 만들고 이동 속도를 확보한 뒤 경쟁 플레이를 섞는 편이 진행이 끊기지 않습니다.

알과 펫에는 더 희귀한 종류, 크기, 변형이 있어 수집 목표가 계속 이어집니다. 첫 목표는 “알 확보 → 부화 → 펫 수익 → 러닝머신·기지 업그레이드 → 다른 기지 도전” 순서로 잡으면 됩니다.`,
    source_id: "editorial-source:steal-an-egg",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: EXPANDED_REVIEWED_AT,
    reviewed_by: null,
    review_note: EXPANDED_REVIEW_NOTE,
    published_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-guide:jujutsu-shenanigans:controls",
    universe_id: 3508322461,
    slug: "controls",
    guide_type: "mechanic",
    title: "Jujutsu Shenanigans 조작법: 대시·방어·각성",
    summary: "기본 공격과 1~4번 스킬, Q 대시, F 방어, R 특수 행동, G 각성의 역할을 첫 교전 순서에 맞춰 정리합니다.",
    body: `PC에서 기본 공격은 M1이고 1~4번 키로 스킬을 사용합니다. 처음에는 기본 공격과 한두 개 스킬을 연결하는 짧은 콤보부터 익히면 전투 흐름을 이해하기 쉽습니다.

Q는 대시입니다. 거리를 좁히거나 공격을 피할 때 쓰며, 기절 상태에서는 탈출 입력으로도 사용할 수 있습니다. 공격만 연속으로 누르기보다 상대와의 거리를 바꿀 때 Q를 섞는 것이 중요합니다.

F는 방어, R은 특수 행동, G는 각성입니다. 방어로 상대 공격을 받아내고 빈틈이 생겼을 때 다시 공격으로 전환하는 흐름을 먼저 익히세요.

전투에는 지형 파괴가 섞일 수 있어 같은 장소에서도 상황이 달라집니다. 첫 판에서는 “기본 공격 → 스킬 → Q 이동 → F 방어 → 각성 게이지 확인” 순서로 각 입력의 역할을 구분하면 됩니다.`,
    source_id: "editorial-source:jujutsu-shenanigans",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: EXPANDED_REVIEWED_AT,
    reviewed_by: null,
    review_note: EXPANDED_REVIEW_NOTE,
    published_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-guide:steal-a-brainrot:money-rebirth-loop",
    universe_id: 7709344486,
    slug: "money-rebirth-loop",
    guide_type: "beginner",
    title: "Steal a Brainrot 시작법: 구매·수익·훔치기·Rebirth",
    summary: "Brainrot 구매에서 수익 만들기, 다른 플레이어에게서 훔치기, 장비 활용, Rebirth까지 기본 성장 루프를 정리합니다.",
    body: `처음에는 Brainrot을 구매해 돈이 들어오는 구조부터 만드는 것이 우선입니다. 다른 플레이어를 바로 노리기보다 자신의 기지에서 수익이 꾸준히 생기는 상태를 먼저 만들어 두면 이후 행동 선택지가 넓어집니다.

수익이 생기면 더 많은 Brainrot을 확보하면서 성장을 이어갑니다. 동시에 다른 플레이어의 Brainrot을 훔칠 수도 있어 타이쿤 성장과 경쟁 플레이가 함께 섞입니다.

슬랩과 장난 장비를 이용해 다른 플레이어를 방해하는 요소도 있습니다. 경쟁에만 돈을 쓰기보다 현재 수익과 다음 성장에 필요한 자원을 함께 확인하면서 장비를 선택하는 편이 좋습니다.

진행이 쌓이면 Rebirth로 다시 성장하는 루프가 이어집니다. 처음에는 “Brainrot 구매 → 수익 확보 → 추가 수집 또는 훔치기 → 장비 활용 → Rebirth”라는 큰 순서를 이해하면 됩니다.`,
    source_id: "editorial-source:steal-a-brainrot",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: EXPANDED_REVIEWED_AT,
    reviewed_by: null,
    review_note: EXPANDED_REVIEW_NOTE,
    published_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-guide:fish-it:fishing-basics",
    universe_id: 6701277882,
    slug: "fishing-basics",
    guide_type: "mechanic",
    title: "Fish It! 낚시하는 법: 충전부터 물고기 수집까지",
    summary: "낚시 입력을 눌러 힘을 모으고 빠르게 입력해 물고기를 잡는 기본 조작과 수집·탐험 흐름을 정리합니다.",
    body: `낚시를 시작할 때는 입력을 눌러 힘을 모으는 단계부터 진행합니다. 힘을 정한 뒤에는 빠르게 입력해 물고기를 끌어올리는 방식입니다.

처음에는 희귀 물고기보다 이 입력 순서를 안정적으로 익히는 것이 좋습니다. 낚시 한 번의 조작이 익숙해지면 같은 지역에서 여러 물고기와 변형을 모으는 수집이 자연스럽게 이어집니다.

친구와 함께 낚시할 수도 있고 배를 타고 바다를 돌아다니며 다른 지역을 탐험할 수도 있습니다. 한 장소에서 수집이 정체되면 이동과 탐험을 다음 목표로 잡으면 됩니다.

첫 플레이에서는 “힘 충전 → 빠른 입력으로 포획 → 수집 확인 → 다른 지역 탐험” 순서를 반복하면서 낚시와 탐험이 어떻게 연결되는지 익혀 보세요.`,
    source_id: "editorial-source:fish-it",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: EXPANDED_REVIEWED_AT,
    reviewed_by: null,
    review_note: EXPANDED_REVIEW_NOTE,
    published_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-guide:catalog-avatar-creator:avatar-tryon",
    universe_id: 2711375305,
    slug: "avatar-tryon",
    guide_type: "beginner",
    title: "Catalog Avatar Creator 시작법: 아이템 착용·코디 저장",
    summary: "카탈로그 아이템을 무료로 착용해 보고 코디를 비교한 뒤 아바타를 저장하거나 필요한 아이템을 구매하는 흐름을 정리합니다.",
    body: `Catalog Avatar Creator에서는 Roblox 카탈로그의 액세서리, 모자, 헤어, 번들, 애니메이션 등 여러 아이템을 자신의 아바타에 직접 착용해 볼 수 있습니다. 구매하기 전에 조합이 실제로 어떻게 보이는지 확인하는 용도로 쓰기 좋습니다.

한 아이템만 보는 것보다 헤어와 액세서리, 의상처럼 여러 요소를 함께 조합해 전체 코디를 확인하세요. 마음에 드는 조합은 경험 안에서 아바타로 저장할 수 있어 여러 버전을 비교하기 편합니다.

다른 이용자가 만든 커뮤니티 코디도 둘러볼 수 있습니다. 처음부터 직접 조합이 어렵다면 공개된 코디를 참고해 원하는 분위기와 아이템 구성을 찾는 방법도 있습니다.

게임 안에서 구매한 카탈로그 아이템은 Roblox 인벤토리에서도 사용할 수 있습니다. 따라서 “착용 시험 → 조합 비교 → 아바타 저장 → 실제로 필요한 아이템만 구매” 순서로 사용하는 편이 좋습니다.`,
    source_id: "editorial-source:catalog-avatar-creator",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: EXPANDED_REVIEWED_AT,
    reviewed_by: null,
    review_note: EXPANDED_REVIEW_NOTE,
    published_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-guide:evade:survival-controls",
    universe_id: 3647333358,
    slug: "survival-controls",
    guide_type: "mechanic",
    title: "Evade 생존 조작법: 이동·상호작용·웅크리기",
    summary: "Nextbot을 피하는 이동 중심 생존 구조와 E 상호작용, C/Ctrl 웅크리기, 아이템·메뉴 입력을 정리합니다.",
    body: `Evade는 Nextbot에게 잡히지 않도록 계속 이동하는 것이 핵심입니다. 전투로 적을 쓰러뜨리는 것보다 맵을 읽고 장애물을 넘으며 거리를 유지하는 움직임이 생존에 더 중요합니다.

PC에서는 E로 상호작용하고 C 또는 Ctrl로 웅크릴 수 있습니다. 1·3·F는 아이템 장착, 2는 사용 아이템 메뉴, M은 메뉴를 여는 입력으로 안내되어 있습니다.

처음에는 모든 키를 동시에 외우기보다 이동과 웅크리기, 상호작용부터 익히세요. 좁은 구간과 장애물에서 이동이 막히지 않도록 카메라와 경로를 미리 보는 습관이 도움이 됩니다.

게임에는 큰 소리와 번쩍이는 화면이 나올 수 있습니다. 시청각 자극에 민감하다면 이 점을 확인한 뒤 플레이하세요.`,
    source_id: "editorial-source:evade",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: EXPANDED_REVIEWED_AT,
    reviewed_by: null,
    review_note: EXPANDED_REVIEW_NOTE,
    published_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-guide:tower-of-hell:no-checkpoint-basics",
    universe_id: 703124385,
    slug: "no-checkpoint-basics",
    guide_type: "beginner",
    title: "Tower of Hell 시작법: 체크포인트 없는 타워 오비",
    summary: "체크포인트가 없는 무작위 타워를 오를 때 실수를 줄이고 구간별 점프를 안정적으로 이어 가는 기본 흐름을 정리합니다.",
    body: `Tower of Hell은 무작위로 구성되는 타워형 오비를 끝까지 올라가는 게임입니다. 가장 중요한 특징은 체크포인트가 없다는 점이라 한 번 크게 떨어지면 아래 구간부터 다시 올라가야 합니다.

처음에는 다른 플레이어보다 빨리 가는 것보다 각 장애물의 간격과 움직임을 보고 한 구간씩 안정적으로 통과하는 데 집중하세요. 어려운 점프에서 여러 번 떨어지더라도 같은 구간을 반복하며 타이밍을 익히는 구조입니다.

카메라 각도를 바꾸면 발판의 거리와 착지 위치가 더 잘 보이는 구간이 있습니다. 점프 직전에 무리하게 방향을 바꾸기보다 착지할 위치를 먼저 정하고 이동하는 편이 실수를 줄이기 쉽습니다.

VIP 서버에서는 라운드를 건너뛰거나 타워 크기를 조절하는 등의 설정을 사용할 수 있습니다. 일반 플레이에서는 “구간 관찰 → 안정적인 점프 → 실패 지점 기억 → 다시 도전” 흐름을 반복하면 됩니다.`,
    source_id: "editorial-source:tower-of-hell",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: EXPANDED_REVIEWED_AT,
    reviewed_by: null,
    review_note: EXPANDED_REVIEW_NOTE,
    published_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-guide:sols-rng:roll-craft-loop",
    universe_id: 5361032378,
    slug: "roll-craft-loop",
    guide_type: "beginner",
    title: "Sol's RNG 시작법: Roll·오라·장비 제작·포션",
    summary: "Roll로 오라를 모으고 수집한 오라를 장비 제작에 활용하며 포션으로 행운을 높이는 기본 성장 흐름을 정리합니다.",
    body: `Sol's RNG의 시작은 Roll을 눌러 서로 다른 희귀도의 오라를 얻는 것입니다. 첫 플레이에서는 희귀 결과만 기다리기보다 어떤 오라가 들어왔는지 확인하고 수집 구조부터 익히는 편이 좋습니다.

모은 오라는 단순 전시용으로 끝나지 않고 장비 제작에 활용할 수 있습니다. 제작 메뉴에서 필요한 재료를 확인하면 반복 Roll에서 어떤 오라를 남겨야 하는지 판단하기 쉬워집니다.

포션은 행운을 높여 더 희귀한 결과를 노릴 때 사용하는 진행 요소입니다. 장비와 포션을 함께 준비하면서 Roll 효율을 높이는 장기 수집 구조로 이어집니다.

처음에는 “Roll → 오라 확인 → 필요한 재료 보관 → 장비 제작 → 포션 활용 → 다시 Roll” 순서를 반복하면서 수집과 성장의 연결을 익히면 됩니다.`,
    source_id: "editorial-source:sols-rng",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: EXPANDED_REVIEWED_AT,
    reviewed_by: null,
    review_note: EXPANDED_REVIEW_NOTE,
    published_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-guide:dandys-world:machine-team-basics",
    universe_id: 5569032992,
    slug: "machine-team-basics",
    guide_type: "beginner",
    title: "Dandy's World 시작법: Toon·기계·다음 구역",
    summary: "Toon을 고르고 팀과 기계를 완료한 뒤 더 깊은 구역으로 내려가는 협동 생존의 기본 흐름을 정리합니다.",
    body: `Dandy's World에서는 여러 Toon이 팀을 이루어 Gardenview Center 안의 기계를 완료하는 것이 기본 목표입니다. 혼자 앞서가기보다 팀이 무엇을 하고 있는지 확인하면서 같은 구역의 목표를 처리하는 흐름이 중요합니다.

기계를 완료하면 더 깊은 구역으로 내려가며 진행이 이어집니다. 한 구역의 목표를 끝내고 다음 구역으로 이동하는 반복 구조이므로, 처음에는 캐릭터 성능보다 기계 완료와 이동 순서를 먼저 익히는 편이 좋습니다.

Toon마다 서로 다른 능력과 수치가 있고 Trinket으로 플레이 방식을 조정할 수 있습니다. 기본 진행에 익숙해진 뒤 자신의 역할과 잘 맞는 Toon과 Trinket 조합을 찾아가면 됩니다.

현재 게임은 Alpha 단계로 안내되며 번쩍이는 조명이 포함될 수 있습니다. 첫 판에서는 “팀 확인 → 기계 완료 → 다음 구역 이동 → Toon·Trinket 수집” 순서를 이해하는 데 집중하세요.`,
    source_id: "editorial-source:dandys-world",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: EXPANDED_REVIEWED_AT,
    reviewed_by: null,
    review_note: EXPANDED_REVIEW_NOTE,
    published_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-guide:bedwars:bed-resource-basics",
    universe_id: 2619619496,
    slug: "bed-resource-basics",
    guide_type: "beginner",
    title: "BedWars 시작법: 침대 방어·자원·상대 침대 파괴",
    summary: "팀 침대를 지키면서 자원으로 장비와 업그레이드를 사고 상대 침대를 파괴한 뒤 적을 제거하는 승리 흐름을 정리합니다.",
    body: `BedWars에서는 자신의 팀 침대를 지키는 것이 가장 먼저 확인할 목표입니다. 침대가 남아 있는 동안에는 다시 부활할 수 있지만, 침대가 파괴된 뒤에는 사망하면 경기에서 더 이상 돌아올 수 없습니다.

맵에서 자원을 모아 장비와 팀 업그레이드를 구매합니다. 초반에 모든 자원을 공격 장비에 쓰기보다 침대 방어와 이동 수단, 팀에 필요한 업그레이드를 함께 보면서 자원을 나누는 편이 좋습니다.

승리하려면 상대 팀의 침대를 파괴하고 남은 플레이어를 제거해야 합니다. 상대 침대가 아직 살아 있다면 처치만 반복해도 다시 부활할 수 있으므로 공격 목표의 순서를 구분해야 합니다.

첫 판에서는 “자원 확보 → 침대 방어 → 장비·팀 업그레이드 → 상대 침대 공격 → 남은 적 제거” 흐름을 따라가면 경기 구조를 빠르게 이해할 수 있습니다.`,
    source_id: "editorial-source:bedwars",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: EXPANDED_REVIEWED_AT,
    reviewed_by: null,
    review_note: EXPANDED_REVIEW_NOTE,
    published_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-guide:piggy:escape-item-basics",
    universe_id: 1516533665,
    slug: "escape-item-basics",
    guide_type: "beginner",
    title: "Piggy 시작법: 아이템 찾기·사용·탈출",
    summary: "Piggy를 피하면서 맵의 아이템을 찾아 알맞은 장소에 사용하고 탈출 조건을 진행하는 기본 플레이 순서를 정리합니다.",
    body: `Piggy에서는 맵을 돌아다니며 필요한 아이템을 찾고 탈출 조건을 하나씩 진행해야 합니다. 아이템을 발견했다고 바로 끝나는 것이 아니라 어디에 사용하는 물건인지 기억하는 것이 중요합니다.

PC에서는 클릭으로 아이템을 집거나 사용할 수 있고, 모바일은 탭, 컨트롤러는 오른쪽 트리거를 사용합니다. 플랫폼이 달라도 핵심은 필요한 아이템을 찾아 맞는 장소에서 사용하는 흐름입니다.

동시에 Piggy에게 잡히지 않도록 이동해야 합니다. 아이템 위치만 보고 달리기보다 도망칠 길을 함께 확인하고, 좁은 곳에서는 웅크리기 같은 이동을 활용해 추격을 피하세요.

첫 플레이에서는 “맵 탐색 → 아이템 확보 → 사용 장소 찾기 → Piggy 회피 → 탈출 조건 진행” 순서를 반복하면서 맵 구조와 아이템 용도를 익히는 데 집중하면 됩니다.`,
    source_id: "editorial-source:piggy",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: EXPANDED_REVIEWED_AT,
    reviewed_by: null,
    review_note: EXPANDED_REVIEW_NOTE,
    published_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
  },
  {
    id: "editorial-guide:welcome-to-bloxburg:first-money-home",
    universe_id: 88070565,
    slug: "first-money-home",
    guide_type: "beginner",
    title: "Welcome to Bloxburg 시작법: 직업·집·생활 스킬",
    summary: "직업으로 수입을 만들고 집을 짓거나 꾸미면서 차량과 생활 스킬, 친구 역할놀이로 확장하는 기본 진행을 정리합니다.",
    body: `Welcome to Bloxburg에서는 정해진 승리 조건보다 자신이 원하는 생활 목표를 정해 플레이합니다. 처음에는 집 꾸미기와 직업, 차량, 역할놀이 중 무엇을 먼저 하고 싶은지 정하면 진행 방향을 잡기 쉽습니다.

집과 가구를 늘리려면 돈이 필요하므로 초반에는 직업을 선택해 수입을 만드는 흐름을 익히는 것이 좋습니다. 번 돈으로 집을 짓거나 꾸미고 필요한 생활 요소를 하나씩 추가할 수 있습니다.

차량을 이용해 도시를 돌아다니고 친구들과 역할놀이를 할 수도 있습니다. 혼자 성장만 하는 게임이 아니라 생활 공간과 캐릭터를 만든 뒤 다른 플레이어와 상황을 만들어 노는 자유도가 큽니다.

요리 같은 생활 스킬을 올리면 새로운 콘텐츠를 열 수 있습니다. 첫 목표는 “직업으로 수입 만들기 → 집 목표 정하기 → 필요한 가구·차량 마련 → 생활 스킬과 역할놀이 확장” 순서로 잡으면 됩니다.`,
    source_id: "editorial-source:welcome-to-bloxburg",
    content_status: "published",
    index_state: "indexable",
    review_status: "approved",
    reviewed_at: EXPANDED_REVIEWED_AT,
    reviewed_by: null,
    review_note: EXPANDED_REVIEW_NOTE,
    published_at: EXPANDED_REVIEWED_AT,
    created_at: EXPANDED_REVIEWED_AT,
    updated_at: EXPANDED_REVIEWED_AT,
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
