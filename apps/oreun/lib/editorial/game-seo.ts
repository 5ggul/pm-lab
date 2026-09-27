import type { GameGuide } from "@/lib/content/queries";
import type { GameView } from "@/lib/types";
import type { CuratedGameProfile } from "./search-game-profiles";

type TitleRule = {
  guideSlug?: string;
  suffix: string;
};

const RULES: Record<string, TitleRule> = {
  rivals: { guideSlug: "first-duel", suffix: "동접·24H/7D 변화·초보 공략" },
  "blox-fruits": { guideSlug: "fruit-basics", suffix: "동접·7일 추이·과일 얻는 법" },
  "murder-mystery-2": { guideSlug: "roles", suffix: "동접·역할 공략" },
  "dress-to-impress": { guideSlug: "runway-basics", suffix: "동접·랭크·초보 공략" },
  "tower-defense-simulator": { guideSlug: "defense-basics", suffix: "동접·24H 변화·Farm 초보 공략" },
  "adopt-me": { guideSlug: "pet-home-basics", suffix: "동접·펫·거래 초보" },
  "grow-a-garden": { guideSlug: "planting-basics", suffix: "동접·씨앗·심는 법" },
  jailbreak: { guideSlug: "roles-basics", suffix: "동접·경찰·범죄자 초보" },
};

export function gameSeoTitle(
  game: GameView,
  profile: CuratedGameProfile | null,
  guides: Pick<GameGuide, "slug">[],
) {
  const name = profile?.searchName ?? game.nameKo;
  if (game.regionalAvailability === "restricted_kr") {
    return `${name} 한국 이용 상태·현재 플레이 기록`;
  }

  const rule = RULES[game.slug];
  if (rule && (!rule.guideSlug || guides.some((guide) => guide.slug === rule.guideSlug))) {
    return `${name} ${rule.suffix}`;
  }

  return `${name} 동접·24H/7D 변화`;
}
