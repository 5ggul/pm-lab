import type { GameView } from "../types";

export type ExpandedGameEditorial = {
  nameKo: string;
  aliases: string[];
  descriptionKo: string;
};

const EDITORIAL = new Map<number, ExpandedGameEditorial>([
  [10563114921, {
    nameKo: "Steal An Egg",
    aliases: ["스틸 언 에그", "스틸 에그", "steal an egg"],
    descriptionKo: "펫에게서 알을 얻고 부화시켜 희귀 펫을 모으는 수집형 게임입니다. 펫이 벌어 주는 돈으로 러닝머신과 기지를 업그레이드하고, 러닝머신에서 속도를 올린 뒤 다른 플레이어의 알을 훔칠 수도 있습니다. 알·펫의 종류와 크기, 변형을 늘려 가는 진행이 핵심입니다.",
  }],
  [3508322461, {
    nameKo: "Jujutsu Shenanigans",
    aliases: ["주술 셰니건즈", "주술 쉐니건즈", "jujutsu shenanigans"],
    descriptionKo: "근접 콤보와 여러 스킬을 조합해 싸우는 배틀그라운드형 액션 게임입니다. PC 기준 Q는 대시, F는 방어, R은 특수 행동, G는 각성에 사용되며 1~4번 키로 스킬을 사용합니다. 전투 중 지형 파괴가 섞이는 난전이 특징입니다.",
  }],
  [7709344486, {
    nameKo: "Steal a Brainrot",
    aliases: ["스틸 어 브레인롯", "브레인롯 훔치기", "steal a brainrot"],
    descriptionKo: "Brainrot을 사고 다른 플레이어에게서 훔치며 돈을 늘리는 타이쿤형 게임입니다. 모은 수익으로 진행을 확장하고 Rebirth를 반복하며, 슬랩과 장난 장비를 사용해 다른 플레이어를 방해할 수도 있습니다. 수집·약탈·재시작 성장이 한 흐름으로 이어집니다.",
  }],
  [6701277882, {
    nameKo: "Fish It!",
    aliases: ["피쉬 잇", "피쉬잇", "fish it"],
    descriptionKo: "낚시와 수집, 바다 탐험을 함께 즐기는 시뮬레이션 게임입니다. 낚시할 때는 입력을 눌러 힘을 모은 뒤 빠르게 입력해 물고기를 끌어올리는 방식이며, 친구와 함께 낚시하거나 배를 타고 바다를 돌아다닐 수 있습니다. 여러 물고기와 변형을 모으는 수집이 중심입니다.",
  }],
  [2711375305, {
    nameKo: "Catalog Avatar Creator",
    aliases: ["카탈로그 아바타 크리에이터", "아바타 크리에이터", "catalog avatar creator"],
    descriptionKo: "Roblox 카탈로그의 액세서리, 헤어, 번들, 애니메이션 등 다양한 아바타 아이템을 직접 착용해 볼 수 있는 꾸미기 도구형 경험입니다. 다른 이용자가 만든 코디를 둘러보고 자신이 만든 아바타를 저장할 수 있으며, 게임 안에서 구매한 아이템은 Roblox 인벤토리에서도 사용할 수 있습니다.",
  }],
  [3647333358, {
    nameKo: "Evade",
    aliases: ["이베이드", "에베이드", "evade"],
    descriptionKo: "Nextbot을 피해 달리고 장애물을 넘으며 살아남는 파쿠르 중심 생존 게임입니다. 이동 자체가 생존의 핵심이며 PC에서는 E로 상호작용, C 또는 Ctrl로 웅크리기, M으로 메뉴를 열 수 있습니다. 큰 소리와 번쩍이는 화면이 나올 수 있어 시청각 자극에 민감하다면 주의가 필요합니다.",
  }],
  [703124385, {
    nameKo: "Tower of Hell",
    aliases: ["타워 오브 헬", "타워오브헬", "tower of hell"],
    descriptionKo: "체크포인트 없이 무작위로 생성되는 타워형 오비를 끝까지 올라가는 플랫폼 게임입니다. 떨어지면 아래 구간부터 다시 올라가야 하므로 짧은 구간을 안정적으로 넘기는 조작이 중요합니다. VIP 서버에서는 라운드 건너뛰기, 타워 크기 조절 등 별도 설정도 사용할 수 있습니다.",
  }],
  [5361032378, {
    nameKo: "Sol's RNG",
    aliases: ["솔스 RNG", "솔 RNG", "sols rng", "sol's rng"],
    descriptionKo: "Roll을 반복해 서로 다른 희귀도의 오라를 모으는 RNG 수집 게임입니다. 수집한 오라를 재료로 장비를 제작하고 포션으로 행운을 높여 더 희귀한 오라를 노릴 수 있습니다. 단순 반복 뽑기뿐 아니라 장비 제작과 수집 기록을 함께 늘리는 진행 구조입니다.",
  }],
  [5569032992, {
    nameKo: "Dandy's World",
    aliases: ["댄디스 월드", "댄디 월드", "dandys world", "dandy's world"],
    descriptionKo: "여러 Toon과 팀을 이루어 기계를 완료하고 Gardenview Center의 더 깊은 구역으로 내려가는 멀티플레이 생존 게임입니다. 서로 다른 능력의 Toon을 모으고 Trinket으로 플레이 방식을 바꿀 수 있습니다. 현재 Alpha 단계이며 번쩍이는 조명이 포함될 수 있다는 안내가 있습니다.",
  }],
  [2619619496, {
    nameKo: "BedWars",
    aliases: ["베드워즈", "베드 워즈", "bedwars", "bed wars"],
    descriptionKo: "팀의 침대를 지키면서 자원을 모아 장비와 팀 업그레이드를 구매하고, 상대 침대를 부순 뒤 적을 모두 제거하면 승리하는 팀 대전 게임입니다. 침대가 파괴된 뒤에는 다시 부활할 수 없기 때문에 공격과 방어의 전환 시점을 잡는 것이 중요합니다.",
  }],
  [1516533665, {
    nameKo: "Piggy",
    aliases: ["피기", "로블록스 피기", "piggy"],
    descriptionKo: "Piggy를 피해 맵에서 탈출하면서 주변의 수수께끼를 풀어 가는 생존·탈출 게임입니다. 맵에서 아이템을 찾아 필요한 장소에 사용하고, 상황에 따라 웅크리거나 함정을 활용합니다. PC·모바일·컨트롤러 모두 아이템 사용과 이동 조작을 지원합니다.",
  }],
  [88070565, {
    nameKo: "Welcome to Bloxburg",
    aliases: ["웰컴 투 블록스버그", "블록스버그", "블록스버그 로블록스", "welcome to bloxburg"],
    descriptionKo: "집을 짓고 꾸미며 직업을 선택해 돈을 벌고, 차량으로 도시를 돌아다니거나 친구들과 역할놀이를 하는 생활형 게임입니다. 요리 같은 생활 스킬을 올려 새 콘텐츠를 열 수 있고, 캐릭터 의상과 역할도 자유롭게 꾸밀 수 있습니다.",
  }],
]);

export function getExpandedGameEditorial(universeId: number) {
  return EDITORIAL.get(universeId) ?? null;
}

export function applyExpandedGameEditorial(game: GameView): GameView {
  const editorial = getExpandedGameEditorial(game.universeId);
  if (!editorial) return game;
  const aliases = [...new Set([...editorial.aliases, ...game.aliases])];
  return {
    ...game,
    nameKo: editorial.nameKo,
    aliases,
    descriptionKo: editorial.descriptionKo,
  };
}

export function expandedGameEditorialCount() {
  return EDITORIAL.size;
}
