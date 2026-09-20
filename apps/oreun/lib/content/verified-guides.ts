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
