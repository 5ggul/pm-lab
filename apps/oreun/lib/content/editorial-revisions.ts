import revisions from "./editorial-revisions.json";
import type { GameGuide } from "./queries";
import { isActionablePublicGuide } from "./public-guide";

const TDS_BEGINNER_OVERRIDE = `Tower Defense Simulator에서는 시작 현금을 한꺼번에 쓰기보다 초반 진행이 안정되는지 먼저 확인하세요. 여러 명이 함께한다면 한 명은 초반 웨이브 처리, 다른 한 명은 Farm 중심의 경제를 맡는 식으로 역할을 나누면 자원 낭비를 줄일 수 있습니다.

Farm은 웨이브마다 현금을 늘려 주지만 진행을 직접 처리하지 않습니다. 초반 라인이 불안한데 Farm만 계속 올리기보다, 웨이브가 안정된 뒤 남는 현금으로 경제를 키우는 순서가 안전합니다.

유닛을 놓을 때는 사거리 원이 경로와 얼마나 오래 겹치는지 보세요. 길이 꺾이는 지점이나 여러 구간을 함께 볼 수 있는 자리는 같은 유닛이 더 오래 기여하기 쉽습니다. 낮은 단계 유닛을 많이 늘리기보다 실제로 기여하는 핵심 유닛을 먼저 강화하는 편이 관리하기 쉽습니다.

중반부터는 어떤 적이 통과하는지를 확인해 부족한 역할을 보완하세요. 빠른 적인지, 체력이 높은 적인지, 특정 탐지가 필요한 적인지에 따라 같은 유닛만 반복해서 추가하는 것보다 대응 역할을 바꾸는 편이 낫습니다.

후반에는 새 Farm 투자보다 이미 모은 현금을 핵심 유닛과 지원 역할 강화에 옮기세요. 남은 웨이브가 적을수록 새 경제 투자에서 회수할 시간이 줄어듭니다. 공식 Roblox 설명에는 Paradoxum Games 그룹 가입 시 시작 현금 100이 추가된다고 안내되어 있습니다.`;

// Explicit reviewed copy edits for a known original, NOT a text filter. An
// independently edited DB article never gets silently rewritten. DB moderation
// and publication always take precedence. No review/publish timestamps changed.
export function applyKnownEditorialRevision(guide: GameGuide): GameGuide {
  if (guide.content_status !== "published" || guide.review_status !== "approved") return guide;
  const change = revisions.find(r => r.universeId === Number(guide.universe_id) && r.slug === guide.slug
    && r.expectedTitle === guide.title && r.expectedSummary === guide.summary && r.expectedBody === guide.body);
  let revised = change ? { ...guide, body: change.body, summary: change.summary,
    ...(change.withdraw ? { content_status: "archived" as const, index_state: "noindex" as const } : {}) } : guide;
  if (Number(guide.universe_id) === 1176784616 && guide.slug === "defense-basics") revised = { ...revised, body: TDS_BEGINNER_OVERRIDE, summary: "초반 진행과 Farm 경제의 균형, 배치 위치, 중후반 자원 전환을 실제 플레이 순서로 정리합니다.", content_status: "published", index_state: "noindex" };
  if (revised.content_status === "published" && !isActionablePublicGuide(revised)) {
    return { ...revised, content_status: "archived" as const, index_state: "noindex" as const };
  }
  return revised;
}
